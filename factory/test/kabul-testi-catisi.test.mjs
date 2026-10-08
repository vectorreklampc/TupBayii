import assert from "node:assert/strict";
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
  kaynakKimlikleri = ["REQ-TBP-237-01", "INV-TBP-237-01", "GS-TBP-237-01"],
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
      { kaynakKimligi: "GS-TBP-237-01", testKimlikleri: ["TEST-TBP-237-CONTRACT-01", "TEST-TBP-237-UNIT-01"] },
      { kaynakKimligi: "INV-TBP-237-01", testKimlikleri: ["TEST-TBP-237-CONTRACT-01", "TEST-TBP-237-UNIT-01"] },
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
