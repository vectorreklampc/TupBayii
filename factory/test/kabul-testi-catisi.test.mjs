import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

import {
  TEST_PIRAMIDI,
  TEST_TURLERI,
  kabulTestPlaniOlustur,
  kaliteKapisiniDegerlendir,
} from "../src/kabul-testi-catisi.mjs";

const oracle = Object.freeze({
  kimlik: "ORACLE-TBP-237",
  surum: "1",
  ozet: "Kritik davranislarin authoritative beklenen sonuclari",
});

function kriter({
  kimlik = "AC-TBP-237-01",
  riskSeviyesi = "YUKSEK",
  kaynakKimlikleri = ["REQ-TBP-237-01", "BR-TBP-237-01", "GS-TBP-237-01"],
  testler = [
    { kimlik: "TEST-TBP-237-UNIT-01", tur: "UNIT" },
    { kimlik: "TEST-TBP-237-CONTRACT-01", tur: "CONTRACT_OPENAPI" },
  ],
  ...ek
} = {}) {
  return {
    kimlik,
    bicim: "GHERKIN",
    given: "yz-hazir bir Jira isi",
    when: "kabul kriteri derlenir",
    then: "izlenebilir test plani uretilir",
    riskSeviyesi,
    kaynakKimlikleri,
    testler,
    ...ek,
  };
}

function planOlustur(kriterler = [kriter()]) {
  return kabulTestPlaniOlustur({ testOracle: oracle, kabulKriterleri: kriterler });
}

function basariliSonuclar(plan) {
  return plan.testler.map(({ kimlik }) => ({ testKimligi: kimlik, durum: "PASS" }));
}

describe("Kabul testi catisi", () => {
  test("Jira'daki test turlerini risk tabanli kalite piramidinde eksiksiz tutar", () => {
    assert.deepEqual(TEST_TURLERI, [
      "UNIT",
      "DOMAIN_PROPERTY_BASED",
      "INVARIANT_ARCHITECTURE",
      "INTEGRATION",
      "DATABASE_TRANSACTION",
      "CONCURRENCY",
      "IDEMPOTENCY",
      "CONTRACT_OPENAPI",
      "AUTHORIZATION_SECURITY",
      "UI_COMPONENT",
      "END_TO_END",
      "MIGRATION_ROLLBACK",
      "PERFORMANCE_BUDGET",
      "SMOKE",
      "PRODUCTION_SYNTHETIC",
    ]);
    assert.deepEqual(
      Object.values(TEST_PIRAMIDI).flat(),
      TEST_TURLERI,
    );
  });

  test("Gherkin kabul kriterini oracle'i degistirmeden test planina derler", () => {
    const plan = planOlustur();

    assert.equal(plan.sonuc, "HAZIR");
    assert.deepEqual(plan.testOracle, oracle);
    assert.deepEqual(plan.testler.map(({ kimlik }) => kimlik), [
      "TEST-TBP-237-UNIT-01",
      "TEST-TBP-237-CONTRACT-01",
    ]);
    assert.deepEqual(plan.izlenebilirlik, [
      { kaynakKimligi: "AC-TBP-237-01", testKimlikleri: ["TEST-TBP-237-CONTRACT-01", "TEST-TBP-237-UNIT-01"] },
      { kaynakKimligi: "BR-TBP-237-01", testKimlikleri: ["TEST-TBP-237-CONTRACT-01", "TEST-TBP-237-UNIT-01"] },
      { kaynakKimligi: "GS-TBP-237-01", testKimlikleri: ["TEST-TBP-237-CONTRACT-01", "TEST-TBP-237-UNIT-01"] },
      { kaynakKimligi: "REQ-TBP-237-01", testKimlikleri: ["TEST-TBP-237-CONTRACT-01", "TEST-TBP-237-UNIT-01"] },
    ]);
  });

  test("structured kabul kriterini de ayni derleyici girdisi olarak kabul eder", () => {
    const structured = kriter({
      kimlik: "AC-TBP-237-02",
      bicim: "STRUCTURED",
      given: undefined,
      when: undefined,
      then: undefined,
      kosul: "Contract testi kirmizi",
      eylem: "tamamlama kapisi degerlendirilir",
      beklenen: "issue tamamlanmaz",
    });

    assert.equal(planOlustur([structured]).sonuc, "HAZIR");
  });

  test("eksik veya bozuk kabul kriterini fail-closed reddeder", () => {
    assert.deepEqual(
      kabulTestPlaniOlustur(null).nedenKodlari,
      ["KABUL_TESTI_GIRDISI_GECERSIZ"],
    );
    assert.deepEqual(
      planOlustur([kriter({ then: "" })]).nedenKodlari,
      ["KABUL_KRITERI_GECERSIZ"],
    );
    assert.deepEqual(
      kabulTestPlaniOlustur({ testOracle: oracle, kabulKriterleri: {} }).nedenKodlari,
      ["KABUL_KRITERI_EKSIK"],
    );
  });

  test("REQ BR INV AC ve GS disindaki kaynagi veya izlenebilirliksiz testi reddeder", () => {
    assert.deepEqual(
      planOlustur([kriter({ kaynakKimlikleri: ["ADR-012"] })]).nedenKodlari,
      ["KAYNAK_KIMLIGI_GECERSIZ"],
    );
    assert.deepEqual(
      planOlustur([kriter({ testler: [] })]).nedenKodlari,
      ["KABUL_KRITERI_TESTSIZ"],
    );
  });

  test("bilinmeyen test turunu ve tekrar eden test kimligini reddeder", () => {
    assert.deepEqual(
      planOlustur([kriter({ testler: [{ kimlik: "TEST-1", tur: "SNAPSHOT" }] })]).nedenKodlari,
      ["TEST_TURU_GECERSIZ"],
    );
    assert.deepEqual(
      planOlustur([
        kriter({ testler: [{ kimlik: "TEST-1", tur: "UNIT" }] }),
        kriter({ kimlik: "AC-2", testler: [{ kimlik: "TEST-1", tur: "UNIT" }] }),
      ]).nedenKodlari,
      ["TEST_KIMLIGI_TEKRARLI"],
    );
  });

  test("kabul kriterinden gelen Test Oracle degisikligini reddeder", () => {
    const sonuc = planOlustur([kriter({ testOracle: { ...oracle, surum: "2" } })]);

    assert.deepEqual(sonuc.nedenKodlari, ["TEST_ORACLE_DEGISIKLIGI_YASAK"]);
  });
});

describe("Kabul testi kalite kapisi", () => {
  test("butun davranis ve risk testleri PASS ise issue tamamlanabilir", () => {
    const plan = planOlustur();

    assert.deepEqual(kaliteKapisiniDegerlendir({
      plan,
      testSonuclari: basariliSonuclar(plan),
    }), {
      sonuc: "ACCEPTED",
      tamamlanabilirMi: true,
      nedenKodlari: [],
      bulgular: [],
      kapsama: { kaynakSayisi: 4, kapsananKaynakSayisi: 4, eksikKaynakKimlikleri: [] },
    });
  });

  test("tek bir FAIL sonucu issue tamamlamayi engeller", () => {
    const plan = planOlustur();
    const sonuclar = basariliSonuclar(plan);
    sonuclar[0].durum = "FAIL";

    const sonuc = kaliteKapisiniDegerlendir({ plan, testSonuclari: sonuclar });

    assert.equal(sonuc.sonuc, "BLOCKED");
    assert.equal(sonuc.tamamlanabilirMi, false);
    assert.deepEqual(sonuc.nedenKodlari, ["TEST_BASARISIZ"]);
  });

  test("eksik, bilinmeyen veya tekrarli test sonucuyla fail-closed davranir", () => {
    const plan = planOlustur();

    assert.deepEqual(
      kaliteKapisiniDegerlendir({ plan, testSonuclari: [] }).nedenKodlari,
      ["TEST_SONUCU_EKSIK"],
    );
    assert.deepEqual(
      kaliteKapisiniDegerlendir({
        plan,
        testSonuclari: [
          ...basariliSonuclar(plan),
          { testKimligi: "TEST-BILINMEYEN", durum: "PASS" },
        ],
      }).nedenKodlari,
      ["TEST_SONUCU_BILINMIYOR"],
    );
    assert.deepEqual(
      kaliteKapisiniDegerlendir({
        plan,
        testSonuclari: [...basariliSonuclar(plan), basariliSonuclar(plan)[0]],
      }).nedenKodlari,
      ["TEST_SONUCU_TEKRARLI"],
    );
  });

  test("kritik flaky testi karantina ile dahi bypass etmez", () => {
    const plan = planOlustur([kriter({ riskSeviyesi: "KRITIK" })]);
    const sonuclar = basariliSonuclar(plan);
    sonuclar[0] = {
      testKimligi: sonuclar[0].testKimligi,
      durum: "FLAKY",
      karantina: { gerekce: "Zamanlama sapmasi", takipIsAnahtari: "TBP-999" },
    };

    assert.deepEqual(
      kaliteKapisiniDegerlendir({ plan, testSonuclari: sonuclar }).nedenKodlari,
      ["KRITIK_TEST_KARANTINA_YASAK"],
    );
  });

  test("kritik olmayan flaky testi yalniz gerekce ve takip isiyle karantinaya alir", () => {
    const plan = planOlustur([kriter({ riskSeviyesi: "ORTA" })]);
    const sonuclar = basariliSonuclar(plan);
    sonuclar[0] = {
      testKimligi: sonuclar[0].testKimligi,
      durum: "FLAKY",
      karantina: { gerekce: "Deterministik olmayan dis fixture", takipIsAnahtari: "TBP-999" },
    };

    assert.equal(
      kaliteKapisiniDegerlendir({ plan, testSonuclari: sonuclar }).sonuc,
      "ACCEPTED",
    );

    delete sonuclar[0].karantina.takipIsAnahtari;
    assert.deepEqual(
      kaliteKapisiniDegerlendir({ plan, testSonuclari: sonuclar }).nedenKodlari,
      ["FLAKY_TEST_KARANTINA_GECERSIZ"],
    );
  });

  test("hazir olmayan plan veya bozuk sonuc durumunu kabul etmez", () => {
    const plan = planOlustur();
    const sonuclar = basariliSonuclar(plan);
    sonuclar[0].durum = "SKIPPED";

    assert.deepEqual(
      kaliteKapisiniDegerlendir({ plan: planOlustur([kriter({ testler: [] })]), testSonuclari: [] }).nedenKodlari,
      ["TEST_PLANI_HAZIR_DEGIL"],
    );
    assert.deepEqual(
      kaliteKapisiniDegerlendir({ plan, testSonuclari: sonuclar }).nedenKodlari,
      ["TEST_SONUCU_GECERSIZ"],
    );
    assert.deepEqual(
      kaliteKapisiniDegerlendir({
        plan: { sonuc: "HAZIR", testler: "bozuk", izlenebilirlik: [] },
        testSonuclari: [],
      }).nedenKodlari,
      ["TEST_PLANI_GECERSIZ"],
    );

    const iziBozukPlan = planOlustur();
    iziBozukPlan.izlenebilirlik[0].testKimlikleri = ["TEST-PLANDA-YOK"];
    assert.deepEqual(
      kaliteKapisiniDegerlendir({
        plan: iziBozukPlan,
        testSonuclari: basariliSonuclar(iziBozukPlan),
      }).nedenKodlari,
      ["TEST_PLANI_GECERSIZ"],
    );
  });
});

describe("Kabul kalite kapisi invariant entegrasyonu", () => {
  function isKalemi(ad = "is-kalemi-gecerli.json") {
    return JSON.parse(readFileSync(new URL(`./fixtures/${ad}`, import.meta.url), "utf8"));
  }

  function degerlendir(girdi) {
    const plan = kabulTestPlaniOlustur({
      testOracle: girdi.testOracle,
      kabulKriterleri: girdi.kabulKriterleri,
    });
    assert.equal(plan.sonuc, "HAZIR");
    return kaliteKapisiniDegerlendir({
      plan,
      testSonuclari: girdi.testSonuclari,
      isKimligi: girdi.isKimligi,
      calistirmaKimligi: girdi.calistirmaKimligi,
      invariantKanitlari: girdi.invariantKanitlari,
    });
  }

  function bulgular(sonuc) {
    return sonuc.bulgular.map(({ kod, alan }) => [kod, alan]);
  }

  test("ilgili invariantlarin yurutulmus gozlem kaniti gecerliyse issue tamamlanabilir", () => {
    const sonuc = degerlendir(isKalemi());

    assert.equal(sonuc.sonuc, "ACCEPTED");
    assert.equal(sonuc.tamamlanabilirMi, true);
    assert.deepEqual(sonuc.kapsama.eksikKaynakKimlikleri, []);
  });

  test("ihlal gozlemi testler PASS olsa da her invariant icin ayri bulguyla tamamlamayi engeller", () => {
    const sonuc = degerlendir(isKalemi("is-kalemi-ihlal.json"));

    assert.equal(sonuc.tamamlanabilirMi, false);
    assert.deepEqual(sonuc.nedenKodlari, ["INVARIANT_IHLALI"]);
    assert.deepEqual(bulgular(sonuc), [
      ["INVARIANT_IHLALI", "invariantKanitlari.INV-AUD-005"],
      ["INVARIANT_IHLALI", "invariantKanitlari.INV-GOV-003"],
    ]);
  });

  test("eksik, bozuk, eski, eslesmeyen veya kanitlanamayan ilgili kanit fail-closed engeller", () => {
    const durumlar = [
      ["INVARIANT_KANITI_EKSIK", (girdi) => { delete girdi.invariantKanitlari["INV-AUD-005"]; }],
      ["INVARIANT_KANITI_EKSIK", (girdi) => { delete girdi.invariantKanitlari; }],
      ["INVARIANT_KANITI_GECERSIZ", (girdi) => { girdi.invariantKanitlari["INV-AUD-005"].durum = "KANITLANDI"; }],
      ["INVARIANT_KANITI_ESKI", (girdi) => { girdi.invariantKanitlari["INV-AUD-005"].calistirmaKimligi = "github-actions:1:1"; }],
      ["INVARIANT_KANITI_ESKI", (girdi) => { girdi.invariantKanitlari["INV-AUD-005"].isKimligi = "TBP-232"; }],
      ["INVARIANT_TEST_KIMLIGI_UYUSMUYOR", (girdi) => { girdi.invariantKanitlari["INV-AUD-005"].testKimligi = "TEST-INV-AUD-004"; }],
      ["INVARIANT_KANITI_BILINMIYOR", (girdi) => { girdi.invariantKanitlari["INV-AUD-005"].gozlem = { istekler: [] }; }],
      ["INVARIANT_HUMAN_GATE_EKSIK", (girdi) => { delete girdi.invariantKanitlari["INV-GOV-003"].humanGate; }],
      ["INVARIANT_HUMAN_GATE_GECERSIZ", (girdi) => { girdi.invariantKanitlari["INV-GOV-003"].humanGate.onaylayan = "insan:codex"; }],
      ["INVARIANT_KANITI_ILGISIZ", (girdi) => {
        girdi.invariantKanitlari["INV-STK-001"] = { ...girdi.invariantKanitlari["INV-AUD-005"], testKimligi: "TEST-INV-STK-001" };
      }],
      ["INVARIANT_IS_KIMLIGI_GECERSIZ", (girdi) => { delete girdi.isKimligi; }],
      ["INVARIANT_CALISTIRMA_KIMLIGI_GECERSIZ", (girdi) => { girdi.calistirmaKimligi = ""; }],
    ];

    for (const [kod, bozucu] of durumlar) {
      const girdi = isKalemi();
      bozucu(girdi);
      const sonuc = degerlendir(girdi);
      assert.equal(sonuc.sonuc, "BLOCKED", kod);
      assert.equal(sonuc.tamamlanabilirMi, false, kod);
      assert.deepEqual(sonuc.nedenKodlari, [kod], kod);
    }
  });

  test("kayit defterinde olmayan INV kaynagi tamamlanamaz", () => {
    const girdi = isKalemi();
    girdi.kabulKriterleri[0].kaynakKimlikleri.push("INV-TBP-237-01");
    girdi.kabulKriterleri[0].testler.push({ kimlik: "TEST-INV-TBP-237-01", tur: "UNIT" });
    girdi.testSonuclari.push({ testKimligi: "TEST-INV-TBP-237-01", durum: "PASS" });

    assert.deepEqual(bulgular(degerlendir(girdi)), [
      ["INVARIANT_KAYDI_BULUNAMADI", "invariantKanitlari.INV-TBP-237-01"],
    ]);
  });

  test("kayitli invariant testi planda yoksa, FAIL veya FLAKY ise tamamlanamaz", () => {
    const plansiz = isKalemi();
    plansiz.kabulKriterleri[0].testler = [{ kimlik: "TEST-TBP-233-SMOKE-01", tur: "SMOKE" }];
    plansiz.testSonuclari = [{ testKimligi: "TEST-TBP-233-SMOKE-01", durum: "PASS" }];
    assert.deepEqual(bulgular(degerlendir(plansiz)), [
      ["INVARIANT_TESTI_PLANDA_YOK", "plan.izlenebilirlik.INV-AUD-005"],
      ["INVARIANT_TESTI_PLANDA_YOK", "plan.izlenebilirlik.INV-GOV-003"],
    ]);

    const basarisiz = isKalemi();
    basarisiz.testSonuclari[0].durum = "FAIL";
    assert.deepEqual(degerlendir(basarisiz).nedenKodlari, ["TEST_BASARISIZ"]);

    const karantina = isKalemi();
    karantina.kabulKriterleri[0].riskSeviyesi = "ORTA";
    karantina.testSonuclari[0] = {
      testKimligi: "TEST-INV-AUD-005",
      durum: "FLAKY",
      karantina: { gerekce: "Zamanlama sapmasi", takipIsAnahtari: "TBP-999" },
    };
    assert.deepEqual(bulgular(degerlendir(karantina)), [
      ["INVARIANT_TESTI_KARANTINA_YASAK", "testSonuclari.TEST-INV-AUD-005"],
    ]);
  });

  test("ilgili invariant tasimayan is kalemi invariant kaniti istemez", () => {
    const plan = planOlustur();

    assert.equal(kaliteKapisiniDegerlendir({ plan, testSonuclari: basariliSonuclar(plan) }).sonuc, "ACCEPTED");
  });

  test("miras alinan is ve kanit alanlari kullanilmaz", () => {
    const girdi = isKalemi();
    const plan = kabulTestPlaniOlustur({ testOracle: girdi.testOracle, kabulKriterleri: girdi.kabulKriterleri });
    const miras = Object.create({
      isKimligi: girdi.isKimligi,
      calistirmaKimligi: girdi.calistirmaKimligi,
      invariantKanitlari: girdi.invariantKanitlari,
    });
    Object.assign(miras, { plan, testSonuclari: girdi.testSonuclari });

    assert.deepEqual(kaliteKapisiniDegerlendir(miras).nedenKodlari, [
      "INVARIANT_IS_KIMLIGI_GECERSIZ",
      "INVARIANT_CALISTIRMA_KIMLIGI_GECERSIZ",
    ]);
  });
});
