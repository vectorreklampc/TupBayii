import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";

import {
  HUMAN_GATE_DURUMLARI,
  KANIT_DURUMLARI,
  KANONIK_MANIFEST,
  KANONIK_YOLLAR,
  RISK_ISTISNASI_DURUMU,
  fixtureyiDegerlendir,
  invariantKanitlariniDegerlendir,
  jsonDosyasiniOku,
  kanonikKaynaklariOku,
  kayitDefteriniDogrula,
  kurallariDogrula,
  normatifKaynakParitesiniDogrula,
  ornekleriDogrula,
  riskIstisnalariniDogrula,
  uygunluguDogrula,
} from "../src/invariant-kapisi.mjs";

const testDizini = dirname(fileURLToPath(import.meta.url));
const factoryDizini = join(testDizini, "..");
const depoKoku = join(factoryDizini, "..");

const BEKLENEN_KIMLIKLER = [
  "INV-TEN-001",
  "INV-TEN-002",
  "INV-TEN-003",
  "INV-TEN-004",
  "INV-STK-001",
  "INV-STK-002",
  "INV-STK-003",
  "INV-STK-004",
  "INV-STK-005",
  "INV-FIN-001",
  "INV-FIN-002",
  "INV-FIN-003",
  "INV-FIN-004",
  "INV-PAY-001",
  "INV-PAY-002",
  "INV-PAY-003",
  "INV-OFF-001",
  "INV-OFF-002",
  "INV-OFF-003",
  "INV-OFF-004",
  "INV-AUD-001",
  "INV-AUD-002",
  "INV-AUD-003",
  "INV-AUD-004",
  "INV-AUD-005",
  "INV-GOV-001",
  "INV-GOV-002",
  "INV-GOV-003",
];
const IS_KIMLIGI = "TBP-233";
const CALISTIRMA_KIMLIGI = "github-actions:18000000001:1";
// Kabul edilmis riskin suresi icindeki ve sonrasindaki sabit gunler; testler
// gercek saatten bagimsizdir.
const RISK_ICINDE = "2026-10-10";
const RISK_SON_GUNU_ONCESI = "2026-11-06";
const RISK_SURESI_DOLDU = "2026-11-07";
// Kayit defterinden bagimsiz beklenti: kayit defteri ve manifest ayni anda
// gevsetilse bile bu tablo drift'i yakalar.
const BEKLENEN_CRITICAL = new Set([
  "INV-TEN-001", "INV-TEN-002", "INV-TEN-003", "INV-TEN-004",
  "INV-FIN-001", "INV-FIN-002", "INV-FIN-003", "INV-FIN-004",
  "INV-PAY-001", "INV-PAY-002", "INV-PAY-003",
  "INV-AUD-003",
  "INV-GOV-001", "INV-GOV-002", "INV-GOV-003",
]);

function kaynaklar() {
  return kanonikKaynaklariOku();
}

function kayitDefteri() {
  return kaynaklar().kayitDefteri;
}

function ornekler() {
  return kaynaklar().ornekler;
}

function kopya(deger) {
  return structuredClone(deger);
}

function invariant(kd, kimlik) {
  return kd.invariantlar.find((kayit) => kayit.kimlik === kimlik);
}

function gecerliHumanGate(invariantKimligi, isKimligi = IS_KIMLIGI) {
  return {
    durum: HUMAN_GATE_DURUMLARI.ONAYLANDI,
    invariantKimligi,
    isKimligi,
    onaylayan: "insan:jira-712020-2dbf3d7f",
    zaman: "2026-10-08T13:06:07+03:00",
    kanit: "https://ucarmakadil.atlassian.net/browse/TBP-233?focusedCommentId=10842",
  };
}

function gecerliKanit(kimlik, gozlem = ornekler()[kimlik].gecerli[0]) {
  return {
    testKimligi: `TEST-${kimlik}`,
    isKimligi: IS_KIMLIGI,
    calistirmaKimligi: CALISTIRMA_KIMLIGI,
    gozlem: kopya(gozlem),
    ...(BEKLENEN_CRITICAL.has(kimlik) ? { humanGate: gecerliHumanGate(kimlik) } : {}),
  };
}

function isGirdisi(ilgiliInvariantlar = BEKLENEN_KIMLIKLER, ek = {}) {
  return {
    isKimligi: IS_KIMLIGI,
    calistirmaKimligi: CALISTIRMA_KIMLIGI,
    ilgiliInvariantlar,
    kanitlar: Object.fromEntries(ilgiliInvariantlar.map((kimlik) => [kimlik, gecerliKanit(kimlik)])),
    ...ek,
  };
}

function kodlar(sonuc) {
  return sonuc.bulgular.map(({ invariantKimligi, nedenKodu }) => [invariantKimligi, nedenKodu]);
}

function kayitHatasiVarMi(kd) {
  const sonuc = invariantKanitlariniDegerlendir(isGirdisi(), { ...kaynaklar(), kayitDefteri: kd });
  const uygunluk = uygunluguDogrula({ ...kaynaklar(), kayitDefteri: kd }, RISK_ICINDE);
  const hepsiKayitHatasi = ({ bulgular }) => bulgular.length > 0
    && bulgular.every(({ nedenKodu }) => nedenKodu === "INVARIANT_KAYIT_DEFTERI_GECERSIZ");
  return kayitDefteriniDogrula(kd).length > 0
    && sonuc.sonuc === "BLOCKED"
    && hepsiKayitHatasi(sonuc)
    && uygunluk.sonuc === "BLOCKED"
    && hepsiKayitHatasi(uygunluk);
}

function invTokenlari(metin) {
  return [...metin.matchAll(/(?<![A-Za-z0-9-])INV-[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*/g)]
    .map(([token]) => token);
}

describe("invariant kayit defteri", () => {
  test("kanonik 28 kimligi zorunlu alanlarla tasir", () => {
    const kd = kayitDefteri();

    assert.deepEqual(kayitDefteriniDogrula(kd), []);
    assert.deepEqual(kd.invariantlar.map(({ kimlik }) => kimlik), BEKLENEN_KIMLIKLER);
  });

  test("Jira cekirdek TRACE ve RELEASE invariantlari kanonik kimlikle kayitlidir", () => {
    const kd = kayitDefteri();
    const iz = invariant(kd, "INV-AUD-005");
    const release = invariant(kd, "INV-GOV-003");

    assert.equal(iz.sinif, "izlenebilirlik");
    assert.equal(iz.onem, "HIGH");
    assert.equal(iz.humanGate, false);
    assert.equal(iz.dogrulamaYontemi, "trace-propagation-test");
    assert.match(iz.tanim, /correlation/i);
    assert.ok(iz.kaynaklar.includes("TBP-233"));
    assert.equal(release.sinif, "release-production");
    assert.equal(release.onem, "CRITICAL");
    assert.equal(release.humanGate, true);
    assert.equal(release.dogrulamaYontemi, "release-policy-test");
    assert.match(release.tanim, /smoke/i);
    assert.ok(release.kaynaklar.includes("TBP-233"));
  });

  test("bagimsiz immutable manifest kimlik, onem ve Human Gate degerlerini sabitler", () => {
    assert.ok(Object.isFrozen(KANONIK_MANIFEST));
    assert.deepEqual(Object.keys(KANONIK_MANIFEST), BEKLENEN_KIMLIKLER);
    for (const kimlik of BEKLENEN_KIMLIKLER) {
      const kayit = KANONIK_MANIFEST[kimlik];
      assert.ok(Object.isFrozen(kayit), kimlik);
      const critical = BEKLENEN_CRITICAL.has(kimlik);
      assert.deepEqual({ ...kayit }, {
        onem: critical ? "CRITICAL" : "HIGH",
        humanGate: critical,
      }, kimlik);
    }
    assert.throws(() => {
      KANONIK_MANIFEST["INV-TEN-001"].onem = "HIGH";
    }, TypeError);
    assert.throws(() => {
      delete KANONIK_MANIFEST["INV-TEN-001"];
    }, TypeError);
    assert.throws(() => {
      KANONIK_MANIFEST["INV-NEW-001"] = { onem: "HIGH", humanGate: false };
    }, TypeError);
  });

  test("kayit defteri manifestle birebir onem ve Human Gate tasir", () => {
    for (const { kimlik, onem, humanGate } of kayitDefteri().invariantlar) {
      assert.deepEqual({ onem, humanGate }, { ...KANONIK_MANIFEST[kimlik] }, kimlik);
    }
  });

  test("CRITICAL dusurme veya Human Gate drift'i dogrulamayi bozar", () => {
    const dusurulmus = kopya(kayitDefteri());
    const kayit = invariant(dusurulmus, "INV-PAY-001");
    kayit.onem = "HIGH";
    kayit.humanGate = false;
    assert.ok(kayitHatasiVarMi(dusurulmus));

    const yalnizBayrak = kopya(kayitDefteri());
    invariant(yalnizBayrak, "INV-TEN-001").humanGate = false;
    assert.ok(kayitHatasiVarMi(yalnizBayrak));

    const yukseltilmis = kopya(kayitDefteri());
    invariant(yukseltilmis, "INV-STK-001").humanGate = true;
    assert.ok(kayitHatasiVarMi(yukseltilmis));

    const yeniHigh = kopya(kayitDefteri());
    invariant(yeniHigh, "INV-GOV-003").onem = "HIGH";
    assert.ok(kayitHatasiVarMi(yeniHigh));
  });

  const SEMA_IHLALLERI = [
    ["bilinmeyen kayit alani", (kd) => { kd.invariantlar[0].notlar = "x"; }],
    ["bilinmeyen kok alani", (kd) => { kd.ekAlan = true; }],
    ["__proto__ kayit alani", (kd) => {
      kd.invariantlar[0] = JSON.parse(`{"__proto__": {"x": 1}, ${JSON.stringify(kd.invariantlar[0]).slice(1)}`);
    }],
    ["eksik alan", (kd) => { delete kd.invariantlar[0].ihlalOrnegi; }],
    ["eksik humanGate", (kd) => { delete kd.invariantlar[4].humanGate; }],
    ["null tanim", (kd) => { kd.invariantlar[0].tanim = null; }],
    ["bos gerekce", (kd) => { kd.invariantlar[0].gerekce = "  "; }],
    ["sayi duzeltme", (kd) => { kd.invariantlar[0].duzeltme = 7; }],
    ["bilinmeyen sinif", (kd) => { kd.invariantlar[0].sinif = "genel"; }],
    ["null sinif", (kd) => { kd.invariantlar[0].sinif = null; }],
    ["bilinmeyen dogrulama yontemi", (kd) => { kd.invariantlar[0].dogrulamaYontemi = "manuel-goz"; }],
    ["kanonik olmayan test kimligi", (kd) => { kd.invariantlar[0].testKimligi = "TEST-TEN-001"; }],
    ["null test kimligi", (kd) => { kd.invariantlar[0].testKimligi = null; }],
    ["takas edilmis test kimlikleri", (kd) => {
      kd.invariantlar[0].testKimligi = "TEST-INV-TEN-002";
      kd.invariantlar[1].testKimligi = "TEST-INV-TEN-001";
    }],
    ["tekrarli test kimligi", (kd) => { kd.invariantlar[1].testKimligi = "TEST-INV-TEN-001"; }],
    ["metin kaynaklar", (kd) => { kd.invariantlar[0].kaynaklar = "TBP-2"; }],
    ["bos kaynaklar", (kd) => { kd.invariantlar[0].kaynaklar = []; }],
    ["null kaynak", (kd) => { kd.invariantlar[0].kaynaklar = ["TBP-2", null]; }],
    ["gecersiz kaynak bicimi", (kd) => { kd.invariantlar[0].kaynaklar = ["JIRA-2"]; }],
    ["sifir TBP kaynagi", (kd) => { kd.invariantlar[0].kaynaklar = ["TBP-0"]; }],
    ["gecersiz ADR bicimi", (kd) => { kd.invariantlar[0].kaynaklar = ["ADR-1"]; }],
    ["gecersiz SOT bicimi", (kd) => { kd.invariantlar[0].kaynaklar = ["SOT-TENANT-1"]; }],
    ["tekrarli kaynak", (kd) => { kd.invariantlar[0].kaynaklar = ["TBP-2", "TBP-2"]; }],
    ["metin humanGate", (kd) => { kd.invariantlar[0].humanGate = "true"; }],
    ["bilinmeyen onem", (kd) => { kd.invariantlar[4].onem = "LOW"; }],
    ["null kayit", (kd) => { kd.invariantlar[3] = null; }],
    ["dizi kayit", (kd) => { kd.invariantlar[3] = []; }],
    ["sifir surum", (kd) => { kd.surum = 0; }],
    ["metin surum", (kd) => { kd.surum = "2"; }],
    ["eksik kanonik kayit", (kd) => { kd.invariantlar.pop(); }],
    ["fazla kayit", (kd) => { kd.invariantlar.push({ ...kd.invariantlar[0], kimlik: "INV-TEN-009", testKimligi: "TEST-INV-TEN-009" }); }],
    ["tekrarli kayit", (kd) => { kd.invariantlar[1] = kopya(kd.invariantlar[0]); }],
    ["kanonik sira degisikligi", (kd) => { kd.invariantlar.reverse(); }],
    ["INV-CODE-001 eklenmesi", (kd) => {
      kd.invariantlar.push({ ...kd.invariantlar[0], kimlik: "INV-CODE-001", testKimligi: "TEST-INV-CODE-001" });
    }],
  ];

  for (const [ad, bozucu] of SEMA_IHLALLERI) {
    test(`strict sema ${ad} durumunu reddeder`, () => {
      const kd = kopya(kayitDefteri());
      bozucu(kd);

      assert.ok(kayitHatasiVarMi(kd), ad);
    });
  }

  test("miras alinan kayit alanlari kayit defterinde sayilmaz", () => {
    const kd = kopya(kayitDefteri());
    kd.invariantlar[0] = Object.create(kd.invariantlar[0]);
    assert.ok(kayitHatasiVarMi(kd));

    const mirasKok = Object.create(kopya(kayitDefteri()));
    assert.ok(kayitHatasiVarMi(mirasKok));
  });

  test("Markdown normatif kaynakla kimlik ve token paritesini korur", () => {
    const { markdown } = kaynaklar();

    assert.deepEqual(normatifKaynakParitesiniDogrula(markdown, kayitDefteri()), []);
    for (const kimlik of ["INV-AUD-005", "INV-GOV-003"]) {
      assert.match(markdown, new RegExp(`^### \`${kimlik}\` — \\S`, "m"), kimlik);
    }
    assert.deepEqual(
      normatifKaynakParitesiniDogrula(`${markdown}\nKaynak: SOT-INV-001, \`SOT-INV-002\`.\n`, kayitDefteri()),
      [],
    );
  });

  test("Markdown'daki kayitsiz token veya bicimsiz baslik paritesi bozar", () => {
    const { markdown } = kaynaklar();
    const kd = kayitDefteri();

    for (const bozuk of [
      `${markdown}\nBkz. \`INV-CODE-001\`.\n`,
      `${markdown}\nJira kisaltmasi INV-TRACE.\n`,
      `${markdown}\nKucuk harf inv-ten-001 degil ama INV-ten-001 kayitsizdir.\n`,
      markdown.replace("### `INV-TEN-002`", "### INV-TEN-002"),
      markdown.replace("### `INV-TEN-002`", "##  `INV-TEN-002`"),
      `${markdown}\n### \`INV-TEN-001\` — Tekrar\n`,
      markdown.replace(/### `INV-GOV-003`[^\n]*\n/, ""),
      markdown.replace(/### `INV-AUD-005`[^\n]*\n/, ""),
    ]) {
      assert.ok(normatifKaynakParitesiniDogrula(bozuk, kd).length > 0);
    }
    for (const bozukMarkdown of [null, undefined, 7, ""]) {
      assert.ok(normatifKaynakParitesiniDogrula(bozukMarkdown, kd).length > 0);
    }
    assert.ok(normatifKaynakParitesiniDogrula(markdown, null).length > 0);
  });

  test("factory/src icindeki her INV literal'i kanonik kayit defterindedir", () => {
    const kimlikler = new Set(kayitDefteri().invariantlar.map(({ kimlik }) => kimlik));
    const kaynakDizini = join(factoryDizini, "src");
    const kayitsizlar = [];

    for (const dosya of readdirSync(kaynakDizini).filter((ad) => ad.endsWith(".mjs"))) {
      for (const token of invTokenlari(readFileSync(join(kaynakDizini, dosya), "utf8"))) {
        if (!kimlikler.has(token)) kayitsizlar.push(`${dosya}:${token}`);
      }
    }

    assert.deepEqual(kayitsizlar, []);
  });

  test("ADR ve SOT kaynaklari depoda tanimlidir", () => {
    const adrDosyalari = readdirSync(join(depoKoku, "docs", "adr"));
    const sot = readFileSync(
      join(depoKoku, "TupBayiProje_Source_of_Truth_ve_Domain_Ownership.md"),
      "utf8",
    );

    for (const { kimlik, kaynaklar: kayitKaynaklari } of kayitDefteri().invariantlar) {
      for (const kaynak of kayitKaynaklari) {
        if (kaynak.startsWith("ADR-")) {
          assert.ok(adrDosyalari.some((ad) => ad.startsWith(`${kaynak}-`)), `${kimlik}:${kaynak}`);
        }
        if (kaynak.startsWith("SOT-")) {
          assert.ok(sot.includes(`\`${kaynak}\``), `${kimlik}:${kaynak}`);
        }
      }
    }
  });
});

describe("bozuk kanonik dosyalar", () => {
  const BOZUK_ICERIKLER = [
    ["bos dosya", ""],
    ["bosluk", "  \n"],
    ["null", "null"],
    ["kesik JSON", "{\"surum\": 2, \"invariantlar\": [{\"kimlik\": \"INV-TEN"],
    ["dizi", "[]"],
    ["metin", "\"kayit\""],
    ["BOM onekli", `${String.fromCharCode(0xfeff)}{"surum": 2}`],
  ];

  for (const [ad, icerik] of BOZUK_ICERIKLER) {
    test(`${ad} dosya istisna yerine her kaynakta BLOCKED uretir`, () => {
      const dizin = mkdtempSync(join(tmpdir(), "tbp233-kd-"));
      try {
        const yol = join(dizin, "bozuk.json");
        writeFileSync(yol, icerik);
        const okunan = jsonDosyasiniOku(yol);

        assert.ok(kayitHatasiVarMi(okunan));
        for (const alan of ["kurallar", "ornekler", "riskIstisnalari"]) {
          const sonuc = uygunluguDogrula({ ...kaynaklar(), [alan]: okunan }, RISK_ICINDE);
          assert.equal(sonuc.sonuc, "BLOCKED", `${ad}:${alan}`);
        }
        assert.deepEqual(
          uygunluguDogrula({ ...kaynaklar(), riskIstisnalari: okunan }, RISK_ICINDE).kabulEdilmisRiskler,
          [],
        );
        const kuralsiz = invariantKanitlariniDegerlendir(isGirdisi(), { ...kaynaklar(), kurallar: okunan });
        assert.equal(kuralsiz.sonuc, "BLOCKED");
        assert.ok(kuralsiz.bulgular.every(({ nedenKodu }) => nedenKodu === "INVARIANT_KURALLARI_GECERSIZ"));
      } finally {
        rmSync(dizin, { recursive: true, force: true });
      }
    });
  }

  test("var olmayan dosya istisna yerine null ve BLOCKED uretir", () => {
    const okunan = jsonDosyasiniOku(join(tmpdir(), "tbp233-olmayan", "kayit.json"));

    assert.equal(okunan, null);
    assert.ok(kayitHatasiVarMi(okunan));
  });

  test("okunamayan Markdown uygunlugu BLOCKED yapar", () => {
    const sonuc = uygunluguDogrula({ ...kaynaklar(), markdown: null }, RISK_ICINDE);

    assert.equal(sonuc.sonuc, "BLOCKED");
    assert.deepEqual(sonuc.bulgular.map(({ nedenKodu }) => nedenKodu), ["INVARIANT_MARKDOWN_PARITESI_BOZUK"]);
  });

  test("tip bozuk kayitlar ve kaynaklar hicbir yolda firlatmaz", () => {
    for (const bozuk of [
      undefined,
      null,
      7,
      { surum: 2, invariantlar: "x" },
      { surum: 2, invariantlar: [null] },
      { surum: 2, invariantlar: [1, "x", []] },
      { surum: 2, invariantlar: [{ kimlik: {} }] },
      { surum: 2, invariantlar: [{ kimlik: "INV-TEN-001", kaynaklar: [null] }] },
    ]) {
      assert.ok(kayitHatasiVarMi(bozuk), JSON.stringify(bozuk));
    }
    for (const bozukKaynaklar of [null, 7, [], "x", {}]) {
      assert.equal(invariantKanitlariniDegerlendir(isGirdisi(), bozukKaynaklar).sonuc, "BLOCKED");
      assert.equal(uygunluguDogrula(bozukKaynaklar, RISK_ICINDE).sonuc, "BLOCKED");
    }
    assert.equal(uygunluguDogrula(undefined, RISK_ICINDE).sonuc, "BLOCKED");
  });
});

describe("semantik kural ve ornekler", () => {
  test("kural dosyasi her kayitli invariant icin bilinen predikat tanimlar", () => {
    const { kayitDefteri: kd, kurallar } = kaynaklar();

    assert.deepEqual(kurallariDogrula(kd, kurallar), []);
    assert.deepEqual(Object.keys(kurallar), BEKLENEN_KIMLIKLER);
  });

  test("bilinmeyen predikat veya eski alan/beklenen kurali BILINMIYOR olur ve kural dosyasini bozar", () => {
    const { kayitDefteri: kd, kurallar } = kaynaklar();
    const gecerliGirdi = ornekler()["INV-TEN-001"].gecerli[0];

    for (const kural of [
      { kural: "olmayanPredikat" },
      { kural: "toString" },
      { kural: "constructor" },
      { kural: "__proto__" },
      { alan: "x", beklenen: true },
      { kural: "tenantBasinaAyriVeritabani", beklenen: true },
      Object.create({ kural: "tenantBasinaAyriVeritabani" }),
      null,
      "tenantBasinaAyriVeritabani",
    ]) {
      assert.equal(fixtureyiDegerlendir(kural, gecerliGirdi), KANIT_DURUMLARI.BILINMIYOR, JSON.stringify(kural));
      assert.ok(kurallariDogrula(kd, { ...kurallar, "INV-TEN-001": kural }).length > 0, JSON.stringify(kural));
    }
    assert.equal(fixtureyiDegerlendir({ alan: "x", beklenen: true }, { x: true }), KANIT_DURUMLARI.BILINMIYOR);
    assert.ok(kurallariDogrula(kd, { ...kurallar, "INV-TEN-009": { kural: "tenantBasinaAyriVeritabani" } }).length > 0);
    const eksik = { ...kurallar };
    delete eksik["INV-GOV-003"];
    assert.ok(kurallariDogrula(kd, eksik).length > 0);
    assert.ok(kurallariDogrula(kd, null).length > 0);
    assert.ok(kurallariDogrula(null, kurallar).length > 0);
  });

  test("ornekler domain bicimlidir; beklenen sonuc bayragi veya alan/gecerli tautolojisi tasimaz", () => {
    const tumOrnekler = ornekler();

    assert.deepEqual(Object.keys(tumOrnekler), BEKLENEN_KIMLIKLER);
    for (const kimlik of BEKLENEN_KIMLIKLER) {
      const ornek = tumOrnekler[kimlik];
      assert.deepEqual(Object.keys(ornek), ["gecerli", "ihlal"], kimlik);
      assert.ok(Array.isArray(ornek.gecerli) && ornek.gecerli.length >= 1, kimlik);
      assert.ok(Array.isArray(ornek.ihlal) && ornek.ihlal.length >= 1, kimlik);
      for (const girdi of [...ornek.gecerli, ...ornek.ihlal]) {
        assert.ok(girdi && typeof girdi === "object" && !Array.isArray(girdi), kimlik);
        assert.ok(!Object.values(girdi).every((deger) => typeof deger === "boolean"), kimlik);
        assert.doesNotMatch(
          JSON.stringify(girdi),
          /"(beklenen|beklenenSonuc|sonucBeklenen|gecerli|gecerliMi|ihlal|ihlalMi|alan|kural|durumBeklenen)"\s*:/,
          kimlik,
        );
      }
    }
  });

  test("her HIGH/CRITICAL kural gecerli ornekte KANITLANDI, her ihlal orneginde IHLAL uretir", () => {
    const { kayitDefteri: kd, kurallar } = kaynaklar();
    const tumOrnekler = ornekler();

    assert.deepEqual(ornekleriDogrula(kd, kurallar, tumOrnekler), []);
    for (const kayit of kd.invariantlar) {
      assert.ok(["HIGH", "CRITICAL"].includes(kayit.onem));
      for (const girdi of tumOrnekler[kayit.kimlik].gecerli) {
        assert.equal(fixtureyiDegerlendir(kurallar[kayit.kimlik], girdi), KANIT_DURUMLARI.KANITLANDI, kayit.kimlik);
      }
      for (const [sira, girdi] of tumOrnekler[kayit.kimlik].ihlal.entries()) {
        assert.equal(fixtureyiDegerlendir(kurallar[kayit.kimlik], girdi), KANIT_DURUMLARI.IHLAL, `${kayit.kimlik}:${sira}`);
      }
    }
  });

  test("ters cevrilmis, eksik veya bozuk ornekler uygunlugu bozar", () => {
    const { kayitDefteri: kd, kurallar } = kaynaklar();
    const ters = kopya(ornekler());
    [ters["INV-GOV-003"].gecerli, ters["INV-GOV-003"].ihlal] = [ters["INV-GOV-003"].ihlal, ters["INV-GOV-003"].gecerli];
    const bosIhlal = kopya(ornekler());
    bosIhlal["INV-AUD-005"].ihlal = [];
    const eksik = kopya(ornekler());
    delete eksik["INV-AUD-005"];
    const bozukGirdi = kopya(ornekler());
    bozukGirdi["INV-STK-001"].gecerli.push({ hareketler: "x" });
    const ekAlan = kopya(ornekler());
    ekAlan["INV-TEN-001"].beklenen = true;

    for (const bozuk of [ters, bosIhlal, eksik, bozukGirdi, ekAlan, null, []]) {
      assert.ok(ornekleriDogrula(kd, kurallar, bozuk).length > 0);
      const sonuc = uygunluguDogrula({ ...kaynaklar(), ornekler: bozuk }, RISK_ICINDE);
      assert.equal(sonuc.sonuc, "BLOCKED");
      assert.deepEqual([...new Set(sonuc.bulgular.map(({ nedenKodu }) => nedenKodu))], ["INVARIANT_ORNEKLERI_GECERSIZ"]);
    }
  });

  test("bozuk veya bos domain girdisi hicbir predikatta kanit sayilmaz", () => {
    const { kurallar } = kaynaklar();

    for (const [kimlik, kural] of Object.entries(kurallar)) {
      for (const girdi of [null, undefined, {}, [], "x", 7, { gecerli: true }]) {
        assert.equal(fixtureyiDegerlendir(kural, girdi), KANIT_DURUMLARI.BILINMIYOR, `${kimlik}:${JSON.stringify(girdi)}`);
      }
    }
  });

  test("miras alinan domain alanlari predikatta kanit sayilmaz", () => {
    const { kurallar } = kaynaklar();
    const tumOrnekler = ornekler();

    for (const kimlik of BEKLENEN_KIMLIKLER) {
      const miras = Object.create(tumOrnekler[kimlik].gecerli[0]);
      assert.equal(fixtureyiDegerlendir(kurallar[kimlik], miras), KANIT_DURUMLARI.BILINMIYOR, kimlik);
    }
  });

  test("TRACE kurali kopuk, eksik ve paylasilan correlation kimligini ihlal sayar", () => {
    const { kurallar } = kaynaklar();
    const kural = kurallar["INV-AUD-005"];
    const istek = (istekKimligi, korelasyonKimligi, adimKorelasyonlari) => ({
      istekKimligi,
      korelasyonKimligi,
      adimlar: adimKorelasyonlari.map((kimlik, sira) => ({ bilesen: `bilesen-${sira}`, korelasyonKimligi: kimlik })),
    });

    assert.equal(fixtureyiDegerlendir(kural, { istekler: [istek("i-1", "kor-1", ["kor-1", "kor-1"])] }), KANIT_DURUMLARI.KANITLANDI);
    assert.equal(fixtureyiDegerlendir(kural, { istekler: [istek("i-1", "kor-1", ["kor-1", "kor-2"])] }), KANIT_DURUMLARI.IHLAL);
    assert.equal(fixtureyiDegerlendir(kural, { istekler: [istek("i-1", null, [null])] }), KANIT_DURUMLARI.IHLAL);
    assert.equal(
      fixtureyiDegerlendir(kural, { istekler: [istek("i-1", "kor-1", ["kor-1"]), istek("i-2", "kor-1", ["kor-1"])] }),
      KANIT_DURUMLARI.IHLAL,
    );
    assert.equal(fixtureyiDegerlendir(kural, { istekler: [istek("i-1", "kor-1", [])] }), KANIT_DURUMLARI.BILINMIYOR);
    assert.equal(fixtureyiDegerlendir(kural, { istekler: [{ korelasyonKimligi: "kor-1", adimlar: [{ bilesen: "api" }] }] }), KANIT_DURUMLARI.BILINMIYOR);
  });

  test("RELEASE kurali yalniz uc kapisi PASS olan production yayinini kabul eder", () => {
    const { kurallar } = kaynaklar();
    const kural = kurallar["INV-GOV-003"];
    const release = (ortam, yayinlandi, kapilar) => ({ releaseler: [{ surum: "2.0.0", ortam, yayinlandi, kapilar }] });
    const pass = { test: "PASS", kabul: "PASS", smoke: "PASS" };

    assert.equal(fixtureyiDegerlendir(kural, release("PRODUCTION", true, pass)), KANIT_DURUMLARI.KANITLANDI);
    for (const kapi of ["test", "kabul", "smoke"]) {
      for (const sonuc of ["FAIL", "BILINMIYOR"]) {
        assert.equal(
          fixtureyiDegerlendir(kural, release("PRODUCTION", true, { ...pass, [kapi]: sonuc })),
          KANIT_DURUMLARI.IHLAL,
          `${kapi}:${sonuc}`,
        );
      }
    }
    for (const bozukKapilar of [
      { test: "PASS", kabul: "PASS" },
      { ...pass, smoke: "SKIPPED" },
      { ...pass, ekKapi: "PASS" },
      { ...pass, smoke: "KABUL_EDILMIS_RISK" },
    ]) {
      assert.equal(fixtureyiDegerlendir(kural, release("PRODUCTION", true, bozukKapilar)), KANIT_DURUMLARI.BILINMIYOR);
    }
    assert.equal(fixtureyiDegerlendir(kural, release("PROD", true, pass)), KANIT_DURUMLARI.BILINMIYOR);
  });
});

describe("kayit defteri/uygunluk modu", () => {
  test("kanonik kaynaklar risk suresi icinde ACCEPTED ve riski duzeltilmemis olarak raporlar", () => {
    const sonuc = uygunluguDogrula(kaynaklar(), RISK_ICINDE);

    assert.deepEqual(sonuc, {
      sonuc: "ACCEPTED",
      bulgular: [],
      kabulEdilmisRiskler: [{
        kimlik: "GHSA-vfj7-8cjw-p6xm",
        paket: "braces",
        bilesen: "admin-web",
        kapsam: "GELISTIRME_BAGIMLILIGI",
        durum: RISK_ISTISNASI_DURUMU,
        duzeltildi: false,
        sonGecerlilik: "2026-11-07",
      }],
    });
    assert.equal(RISK_ISTISNASI_DURUMU, "KABUL_EDILMIS_RISK");
    assert.equal(uygunluguDogrula(kaynaklar(), RISK_SON_GUNU_ONCESI).sonuc, "ACCEPTED");
  });

  test("admin-web braces/GHSA istisnasi 2026-11-07 ve sonrasinda BLOCKED olur", () => {
    for (const bugun of [RISK_SURESI_DOLDU, "2026-11-08", "2027-01-01"]) {
      const sonuc = uygunluguDogrula(kaynaklar(), bugun);
      assert.equal(sonuc.sonuc, "BLOCKED", bugun);
      assert.deepEqual(sonuc.bulgular.map(({ nedenKodu }) => nedenKodu), ["RISK_ISTISNASI_SURESI_DOLDU"], bugun);
      assert.match(sonuc.bulgular[0].ayrinti, /GHSA-vfj7-8cjw-p6xm/);
      assert.deepEqual(sonuc.kabulEdilmisRiskler, [], bugun);
    }
  });

  test("gecersiz bugun degeri fail-closed BLOCKED uretir", () => {
    for (const bugun of [undefined, null, "", "2026-13-01", "2026-02-30", "10.10.2026", "2026-10-10T00:00:00Z", 20261010]) {
      const sonuc = uygunluguDogrula(kaynaklar(), bugun);
      assert.equal(sonuc.sonuc, "BLOCKED", String(bugun));
      assert.deepEqual(sonuc.bulgular.map(({ nedenKodu }) => nedenKodu), ["RISK_ISTISNASI_GECERSIZ"], String(bugun));
    }
  });

  const RISK_BOZUCULARI = [
    ["PASS olarak isaretlenmis", (risk) => { risk.durum = "PASS"; }],
    ["duzeltildi olarak isaretlenmis", (risk) => { risk.duzeltildi = true; }],
    ["eksik duzeltildi", (risk) => { delete risk.duzeltildi; }],
    ["uretim kapsami", (risk) => { risk.kapsam = "URETIM_BAGIMLILIGI"; }],
    ["bilinmeyen bilesen", (risk) => { risk.bilesen = "web"; }],
    ["gecersiz GHSA", (risk) => { risk.kimlik = "CVE-2024-4068"; }],
    ["eksik son gecerlilik", (risk) => { delete risk.sonGecerlilik; }],
    ["gecersiz takvim gunu", (risk) => { risk.sonGecerlilik = "2026-02-30"; }],
    ["zaman damgali son gecerlilik", (risk) => { risk.sonGecerlilik = "2026-11-07T00:00:00Z"; }],
    ["bos telafi edici kontrol", (risk) => { risk.telafiEdiciKontrol = " "; }],
    ["gecersiz kaynak", (risk) => { risk.kaynak = "JIRA-19"; }],
    ["bilinmeyen alan", (risk) => { risk.not = "x"; }],
  ];

  for (const [ad, bozucu] of RISK_BOZUCULARI) {
    test(`risk istisnasi ${ad} ise BLOCKED olur`, () => {
      const riskIstisnalari = kopya(kaynaklar().riskIstisnalari);
      bozucu(riskIstisnalari.riskler[0]);

      const sonuc = uygunluguDogrula({ ...kaynaklar(), riskIstisnalari }, RISK_ICINDE);
      assert.equal(sonuc.sonuc, "BLOCKED", ad);
      assert.ok(sonuc.bulgular.some(({ nedenKodu }) => nedenKodu === "RISK_ISTISNASI_GECERSIZ"), ad);
      assert.deepEqual(sonuc.kabulEdilmisRiskler, [], ad);
    });
  }

  test("risk istisna dosyasinin kok semasi strict ve own-property'dir", () => {
    const temel = kaynaklar().riskIstisnalari;
    for (const bozuk of [
      { ...kopya(temel), ek: 1 },
      { surum: 0, riskler: kopya(temel.riskler) },
      { surum: 1, riskler: "x" },
      { surum: 1, riskler: [null] },
      { surum: 1, riskler: [kopya(temel.riskler[0]), kopya(temel.riskler[0])] },
      { surum: 1, riskler: [Object.create(kopya(temel.riskler[0]))] },
      Object.create(kopya(temel)),
    ]) {
      assert.ok(riskIstisnalariniDogrula(bozuk, RISK_ICINDE).hatalar.length > 0, JSON.stringify(bozuk));
    }
  });
});

describe("is kalemi modu", () => {
  test("ilgili butun invariantlar ayni is ve yurutmeye bagli gozlemle ACCEPTED uretir", () => {
    assert.deepEqual(invariantKanitlariniDegerlendir(isGirdisi()), { sonuc: "ACCEPTED", bulgular: [] });
  });

  test("yalniz ilgili invariant alt kumesi degerlendirilir", () => {
    const ilgili = ["INV-AUD-005", "INV-GOV-003"];

    assert.deepEqual(invariantKanitlariniDegerlendir(isGirdisi(ilgili)), { sonuc: "ACCEPTED", bulgular: [] });
  });

  test("her ihlal gozlemi beyan edilen sonuctan bagimsiz INVARIANT_IHLALI uretir", () => {
    const tumOrnekler = ornekler();
    for (const kimlik of BEKLENEN_KIMLIKLER) {
      for (const [sira, gozlem] of tumOrnekler[kimlik].ihlal.entries()) {
        const girdi = isGirdisi([kimlik]);
        girdi.kanitlar[kimlik] = gecerliKanit(kimlik, gozlem);

        assert.deepEqual(kodlar(invariantKanitlariniDegerlendir(girdi)), [[kimlik, "INVARIANT_IHLALI"]], `${kimlik}:${sira}`);
      }
    }
  });

  test("eksik ilgili kanit INVARIANT_KANITI_EKSIK uretir", () => {
    const girdi = isGirdisi(["INV-TEN-001", "INV-AUD-005"]);
    delete girdi.kanitlar["INV-AUD-005"];

    assert.deepEqual(kodlar(invariantKanitlariniDegerlendir(girdi)), [["INV-AUD-005", "INVARIANT_KANITI_EKSIK"]]);
    for (const kanitlar of [undefined, null, [], "x", 5]) {
      assert.deepEqual(
        kodlar(invariantKanitlariniDegerlendir({ ...isGirdisi(["INV-AUD-005"]), kanitlar })),
        [["INV-AUD-005", "INVARIANT_KANITI_EKSIK"]],
      );
    }
  });

  test("bilinmeyen veya ilgisiz invariant kaniti kabul edilmez", () => {
    const bilinmeyenIlgili = isGirdisi(["INV-AUD-005"]);
    bilinmeyenIlgili.ilgiliInvariantlar = ["INV-AUD-005", "INV-TRACE-001"];
    assert.deepEqual(kodlar(invariantKanitlariniDegerlendir(bilinmeyenIlgili)), [["INV-TRACE-001", "INVARIANT_KAYDI_BULUNAMADI"]]);

    const bilinmeyenKanit = isGirdisi(["INV-AUD-005"]);
    bilinmeyenKanit.kanitlar["INV-CODE-001"] = gecerliKanit("INV-AUD-005");
    assert.deepEqual(kodlar(invariantKanitlariniDegerlendir(bilinmeyenKanit)), [["INV-CODE-001", "INVARIANT_KAYDI_BULUNAMADI"]]);

    const ilgisiz = isGirdisi(["INV-AUD-005"]);
    ilgisiz.kanitlar["INV-STK-001"] = gecerliKanit("INV-STK-001");
    assert.deepEqual(kodlar(invariantKanitlariniDegerlendir(ilgisiz)), [["INV-STK-001", "INVARIANT_KANITI_ILGISIZ"]]);
  });

  test("bozuk kanit veya beyan edilmis sonuc INVARIANT_KANITI_GECERSIZ uretir", () => {
    const kimlik = "INV-AUD-005";
    const gecerli = gecerliKanit(kimlik);
    const eksikGozlem = { ...gecerli };
    delete eksikGozlem.gozlem;
    const eksikCalistirma = { ...gecerli };
    delete eksikCalistirma.calistirmaKimligi;

    for (const kanit of [
      null,
      true,
      "KANITLANDI",
      [],
      eksikGozlem,
      eksikCalistirma,
      { ...gecerli, durum: KANIT_DURUMLARI.KANITLANDI },
      { ...gecerli, kanit: "ci:run-1" },
      Object.create(gecerli),
    ]) {
      const girdi = isGirdisi([kimlik]);
      girdi.kanitlar[kimlik] = kanit;
      assert.deepEqual(kodlar(invariantKanitlariniDegerlendir(girdi)), [[kimlik, "INVARIANT_KANITI_GECERSIZ"]], String(kanit));
    }
  });

  test("baska test kimligindeki kanit INVARIANT_TEST_KIMLIGI_UYUSMUYOR uretir", () => {
    for (const testKimligi of ["TEST-INV-TEN-002", "TEST-TEN-001", null, ""]) {
      const girdi = isGirdisi(["INV-TEN-001"]);
      girdi.kanitlar["INV-TEN-001"].testKimligi = testKimligi;
      assert.deepEqual(
        kodlar(invariantKanitlariniDegerlendir(girdi)),
        [["INV-TEN-001", "INVARIANT_TEST_KIMLIGI_UYUSMUYOR"]],
        String(testKimligi),
      );
    }
  });

  test("baska is veya baska yurutmeden gelen kanit INVARIANT_KANITI_ESKI uretir", () => {
    for (const degisiklik of [
      { isKimligi: "TBP-232" },
      { isKimligi: null },
      { calistirmaKimligi: "github-actions:17999999999:1" },
      { calistirmaKimligi: `${CALISTIRMA_KIMLIGI} ` },
    ]) {
      const girdi = isGirdisi(["INV-STK-001"]);
      Object.assign(girdi.kanitlar["INV-STK-001"], degisiklik);
      assert.deepEqual(
        kodlar(invariantKanitlariniDegerlendir(girdi)),
        [["INV-STK-001", "INVARIANT_KANITI_ESKI"]],
        JSON.stringify(degisiklik),
      );
    }
  });

  test("kanitlanamayan veya bozuk gozlem INVARIANT_KANITI_BILINMIYOR uretir", () => {
    for (const gozlem of [null, {}, { hareketler: [{ miktar: "50" }], bakiye: 50 }, { hareketler: [{ miktar: 1.5 }], bakiye: 1.5 }]) {
      const girdi = isGirdisi(["INV-STK-001"]);
      girdi.kanitlar["INV-STK-001"].gozlem = gozlem;
      assert.deepEqual(
        kodlar(invariantKanitlariniDegerlendir(girdi)),
        [["INV-STK-001", "INVARIANT_KANITI_BILINMIYOR"]],
        JSON.stringify(gozlem),
      );
    }
  });

  test("is kimligi, yurutme kimligi veya ilgili listesi bozuksa ACCEPTED olmaz", () => {
    for (const [ek, beklenen] of [
      [{ isKimligi: "" }, "INVARIANT_IS_KIMLIGI_GECERSIZ"],
      [{ isKimligi: "tbp-233" }, "INVARIANT_IS_KIMLIGI_GECERSIZ"],
      [{ isKimligi: "TBP-0" }, "INVARIANT_IS_KIMLIGI_GECERSIZ"],
      [{ isKimligi: "TBP-233 " }, "INVARIANT_IS_KIMLIGI_GECERSIZ"],
      [{ isKimligi: 233 }, "INVARIANT_IS_KIMLIGI_GECERSIZ"],
      [{ calistirmaKimligi: "" }, "INVARIANT_CALISTIRMA_KIMLIGI_GECERSIZ"],
      [{ calistirmaKimligi: "run 1" }, "INVARIANT_CALISTIRMA_KIMLIGI_GECERSIZ"],
      [{ calistirmaKimligi: null }, "INVARIANT_CALISTIRMA_KIMLIGI_GECERSIZ"],
      [{ ilgiliInvariantlar: [] }, "INVARIANT_ILGILI_LISTESI_GECERSIZ"],
      [{ ilgiliInvariantlar: "INV-AUD-005" }, "INVARIANT_ILGILI_LISTESI_GECERSIZ"],
      [{ ilgiliInvariantlar: ["INV-AUD-005", "INV-AUD-005"] }, "INVARIANT_ILGILI_LISTESI_GECERSIZ"],
      [{ ilgiliInvariantlar: [null] }, "INVARIANT_ILGILI_LISTESI_GECERSIZ"],
    ]) {
      const sonuc = invariantKanitlariniDegerlendir(isGirdisi(["INV-AUD-005"], ek));
      assert.equal(sonuc.sonuc, "BLOCKED", JSON.stringify(ek));
      assert.deepEqual(sonuc.bulgular.map(({ nedenKodu }) => nedenKodu), [beklenen], JSON.stringify(ek));
    }
    for (const girdi of [undefined, null, [], "x", Object.create(isGirdisi(["INV-AUD-005"]))]) {
      assert.equal(invariantKanitlariniDegerlendir(girdi).sonuc, "BLOCKED");
    }
  });

  test("yalniz kendi property'leri kanit sayilir", () => {
    const mirasKanitlar = isGirdisi(["INV-AUD-005"]);
    mirasKanitlar.kanitlar = Object.create(mirasKanitlar.kanitlar);
    assert.deepEqual(kodlar(invariantKanitlariniDegerlendir(mirasKanitlar)), [["INV-AUD-005", "INVARIANT_KANITI_EKSIK"]]);

    const mirasGozlem = isGirdisi(["INV-AUD-005"]);
    mirasGozlem.kanitlar["INV-AUD-005"].gozlem = Object.create(mirasGozlem.kanitlar["INV-AUD-005"].gozlem);
    assert.deepEqual(kodlar(invariantKanitlariniDegerlendir(mirasGozlem)), [["INV-AUD-005", "INVARIANT_KANITI_BILINMIYOR"]]);

    const mirasHumanGate = isGirdisi(["INV-TEN-001"]);
    mirasHumanGate.kanitlar["INV-TEN-001"].humanGate = Object.create(gecerliHumanGate("INV-TEN-001"));
    assert.deepEqual(kodlar(invariantKanitlariniDegerlendir(mirasHumanGate)), [["INV-TEN-001", "INVARIANT_HUMAN_GATE_GECERSIZ"]]);

    const protoAnahtari = isGirdisi(["INV-AUD-005"]);
    protoAnahtari.kanitlar = JSON.parse(`{"__proto__": ${JSON.stringify(gecerliKanit("INV-AUD-005"))}}`);
    assert.deepEqual(kodlar(invariantKanitlariniDegerlendir(protoAnahtari)), [
      ["INV-AUD-005", "INVARIANT_KANITI_EKSIK"],
      ["__proto__", "INVARIANT_KAYDI_BULUNAMADI"],
    ]);
  });
});

describe("CRITICAL Human Gate baglantisi", () => {
  function degerlendir(humanGate, isKimligi = IS_KIMLIGI) {
    const girdi = isGirdisi(["INV-TEN-001", "INV-STK-001"]);
    if (humanGate === undefined) delete girdi.kanitlar["INV-TEN-001"].humanGate;
    else girdi.kanitlar["INV-TEN-001"].humanGate = humanGate;
    girdi.isKimligi = isKimligi;
    girdi.kanitlar["INV-TEN-001"].isKimligi = isKimligi;
    girdi.kanitlar["INV-STK-001"].isKimligi = isKimligi;
    return invariantKanitlariniDegerlendir(girdi);
  }

  test("is ve invariant kimligine bagli insan onayi ACCEPTED uretir; HIGH kayit onay istemez", () => {
    assert.deepEqual(degerlendir(gecerliHumanGate("INV-TEN-001")), { sonuc: "ACCEPTED", bulgular: [] });
  });

  test("her CRITICAL invariant insan onay kaniti olmadan ACCEPTED olmaz", () => {
    for (const kimlik of BEKLENEN_CRITICAL) {
      for (const eksik of [undefined, null]) {
        const girdi = isGirdisi([kimlik]);
        if (eksik === undefined) delete girdi.kanitlar[kimlik].humanGate;
        else girdi.kanitlar[kimlik].humanGate = eksik;
        assert.deepEqual(kodlar(invariantKanitlariniDegerlendir(girdi)), [[kimlik, "INVARIANT_HUMAN_GATE_EKSIK"]], kimlik);
      }
    }
  });

  test("ihlal gozlemi Human Gate onayi ile gecersiz kilinmaz", () => {
    const girdi = isGirdisi(["INV-GOV-003"]);
    girdi.kanitlar["INV-GOV-003"].gozlem = kopya(ornekler()["INV-GOV-003"].ihlal[0]);

    assert.deepEqual(kodlar(invariantKanitlariniDegerlendir(girdi)), [["INV-GOV-003", "INVARIANT_IHLALI"]]);
  });

  const GECERSIZ_ONAYLAR = [
    ["yanlis invariant", { invariantKimligi: "INV-TEN-002" }],
    ["eksik invariant", { invariantKimligi: undefined }],
    ["yanlis is", { isKimligi: "TBP-232" }],
    ["eksik is", { isKimligi: undefined }],
    ["eksik onaylayan", { onaylayan: undefined }],
    ["bos onaylayan", { onaylayan: "" }],
    ["onekisiz onaylayan", { onaylayan: "adil" }],
    ["Claude onaylayan", { onaylayan: "insan:claude" }],
    ["Codex onaylayan", { onaylayan: "insan:codex-review" }],
    ["bot onaylayan", { onaylayan: "insan:release-bot" }],
    ["agent onaylayan", { onaylayan: "insan:openai-agent" }],
    ["AI onaylayan", { onaylayan: "insan:ai" }],
    ["gecersiz ay", { zaman: "2026-13-01T10:00:00Z" }],
    ["gecersiz gun", { zaman: "2026-02-30T10:00:00Z" }],
    ["saat dilimsiz zaman", { zaman: "2026-10-08T13:06:07" }],
    ["serbest zaman", { zaman: "dun aksam" }],
    ["sayi zaman", { zaman: 1760000000 }],
    ["eksik zaman", { zaman: undefined }],
    ["bos referans", { kanit: "" }],
    ["eksik referans", { kanit: undefined }],
    ["kalici olmayan referans", { kanit: "JIRA-HUMAN-GATE-TBP-233" }],
    ["http referans", { kanit: "http://ornek.test/onay" }],
    ["kimlik bilgili referans", { kanit: "https://kullanici:sifre@ornek.test/onay" }],
    ["kok referans", { kanit: "https://ornek.test/" }],
    ["onaylanmamis durum", { durum: "BEKLIYOR" }],
    ["kucuk harf durum", { durum: "onaylandi" }],
    ["eksik durum", { durum: undefined }],
    ["bilinmeyen alan", { ekAciklama: "x" }],
  ];

  for (const [ad, degisiklik] of GECERSIZ_ONAYLAR) {
    test(`${ad} Human Gate kanitini BLOCKED yapar`, () => {
      const humanGate = { ...gecerliHumanGate("INV-TEN-001"), ...degisiklik };
      for (const [alan, deger] of Object.entries(degisiklik)) {
        if (deger === undefined) delete humanGate[alan];
      }

      assert.deepEqual(kodlar(degerlendir(humanGate)), [["INV-TEN-001", "INVARIANT_HUMAN_GATE_GECERSIZ"]], ad);
    });
  }

  test("truthy junk Human Gate kanitini kabul etmez", () => {
    for (const junk of [true, 1, "ONAYLANDI", [], ["ONAYLANDI"], { durum: "ONAYLANDI" }]) {
      assert.deepEqual(kodlar(degerlendir(junk)), [["INV-TEN-001", "INVARIANT_HUMAN_GATE_GECERSIZ"]], String(junk));
    }
  });

  test("baska is icin verilen onay bu is degerlendirmesinde gecmez", () => {
    assert.equal(degerlendir(gecerliHumanGate("INV-TEN-001", "TBP-59")).sonuc, "BLOCKED");
    assert.equal(degerlendir(gecerliHumanGate("INV-TEN-001"), "TBP-59").sonuc, "BLOCKED");
    assert.equal(degerlendir(gecerliHumanGate("INV-TEN-001", "TBP-59"), "TBP-59").sonuc, "ACCEPTED");
  });
});

describe("kanonik yol cozumu", () => {
  test("kanonik yollar calisma dizininden bagimsiz olarak factory altindan cozulur", () => {
    assert.equal(KANONIK_YOLLAR.kayitDefteri, join(factoryDizini, "invariants", "kayit-defteri.json"));
    assert.equal(KANONIK_YOLLAR.kurallar, join(factoryDizini, "invariants", "yurutulebilir-kurallar.json"));
    assert.equal(KANONIK_YOLLAR.ornekler, join(factoryDizini, "invariants", "kural-ornekleri.json"));
    assert.equal(KANONIK_YOLLAR.riskIstisnalari, join(factoryDizini, "invariants", "kabul-edilmis-riskler.json"));
    assert.equal(KANONIK_YOLLAR.normatifMarkdown, join(depoKoku, "TupBayiProje_Global_Invariantlar.md"));
  });
});
