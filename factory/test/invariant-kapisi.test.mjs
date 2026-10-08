import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";

import {
  HUMAN_GATE_DURUMLARI,
  KANIT_DURUMLARI,
  fixtureyiDegerlendir,
  kayitDefteriniDogrula,
  kayitDefteriniOku,
  tumInvariantlariDegerlendir,
} from "../src/invariant-kapisi.mjs";

const testDizini = dirname(fileURLToPath(import.meta.url));
const factoryDizini = join(testDizini, "..");
const depoKoku = join(factoryDizini, "..");
const kayitDefteriYolu = join(
  factoryDizini,
  "invariants",
  "kayit-defteri.json",
);
const fixtureYolu = join(
  testDizini,
  "fixtures",
  "invariant-kanitlari.json",
);
const kurallarYolu = join(
  factoryDizini,
  "invariants",
  "yurutulebilir-kurallar.json",
);

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
  "INV-GOV-001",
  "INV-GOV-002",
];

function kanitlariOku() {
  return JSON.parse(readFileSync(fixtureYolu, "utf8"));
}

function kurallariOku() {
  return JSON.parse(readFileSync(kurallarYolu, "utf8"));
}

function kanitlariOlustur(kayitDefteri, ihlalKimligi = null) {
  const fixturelar = kanitlariOku();
  const kurallar = kurallariOku();
  return Object.fromEntries(
    kayitDefteri.invariantlar.map((invariant) => {
      const fixture = fixturelar[invariant.kimlik];
      const fixtureTuru = invariant.kimlik === ihlalKimligi ? "ihlal" : "gecerli";
      const durum = fixtureyiDegerlendir(kurallar[invariant.kimlik], {
        [fixture.alan]: fixture[fixtureTuru],
      });
      return [
        invariant.kimlik,
        {
          durum,
          kanit: `fixture:${invariant.kimlik}:${fixtureTuru}`,
          testKimligi: invariant.testKimligi,
          ...(invariant.humanGate && durum === KANIT_DURUMLARI.KANITLANDI
            ? {
                humanGate: {
                  durum: HUMAN_GATE_DURUMLARI.ONAYLANDI,
                  kanit: "JIRA-HUMAN-GATE-TBP-233",
                },
              }
            : {}),
        },
      ];
    }),
  );
}

describe("invariant kayit defteri", () => {
  test("zorunlu alanlari ve benzersiz kalici kimlikleri tasir", () => {
    const kayitDefteri = kayitDefteriniOku(kayitDefteriYolu);

    assert.deepEqual(kayitDefteriniDogrula(kayitDefteri), []);
    assert.deepEqual(
      kayitDefteri.invariantlar.map(({ kimlik }) => kimlik),
      BEKLENEN_KIMLIKLER,
    );
  });

  test("Markdown normatif kaynakla ayni invariant kimliklerini tasir", () => {
    const markdown = readFileSync(
      join(depoKoku, "TupBayiProje_Global_Invariantlar.md"),
      "utf8",
    );
    const markdownKimlikleri = [
      ...markdown.matchAll(/^### `(?<kimlik>INV-[A-Z]+-\d{3})`/gm),
    ].map(({ groups }) => groups.kimlik);

    assert.deepEqual(markdownKimlikleri, BEKLENEN_KIMLIKLER);
  });

  test("her HIGH ve CRITICAL invariant icin gecerli ve ihlal fixture'i vardir", () => {
    const kayitDefteri = kayitDefteriniOku(kayitDefteriYolu);
    const fixturelar = kanitlariOku();
    const kurallar = kurallariOku();

    for (const invariant of kayitDefteri.invariantlar) {
      const fixture = fixturelar[invariant.kimlik];
      const kural = kurallar[invariant.kimlik];
      assert.ok(fixture, invariant.kimlik);
      assert.ok(Object.hasOwn(fixture, "gecerli"), invariant.kimlik);
      assert.ok(Object.hasOwn(fixture, "ihlal"), invariant.kimlik);
      assert.equal(fixture.alan, kural?.alan, invariant.kimlik);
      assert.equal(
        fixtureyiDegerlendir(kural, { [fixture.alan]: fixture.gecerli }),
        KANIT_DURUMLARI.KANITLANDI,
        invariant.kimlik,
      );
      assert.equal(
        fixtureyiDegerlendir(kural, { [fixture.alan]: fixture.ihlal }),
        KANIT_DURUMLARI.IHLAL,
        invariant.kimlik,
      );
    }
    assert.deepEqual(Object.keys(kurallar), BEKLENEN_KIMLIKLER);
    assert.deepEqual(Object.keys(fixturelar), BEKLENEN_KIMLIKLER);
  });
});

describe("invariant kapisi", () => {
  test("butun invariantlar kanitlandiginda ACCEPTED uretir", () => {
    const kayitDefteri = kayitDefteriniOku(kayitDefteriYolu);
    const kanitlar = kanitlariOlustur(kayitDefteri);

    assert.deepEqual(tumInvariantlariDegerlendir(kayitDefteri, kanitlar), {
      sonuc: "ACCEPTED",
      bulgular: [],
    });
  });

  test("her ihlal fixture'ini invariant kimligiyle BLOCKED uretir", () => {
    const kayitDefteri = kayitDefteriniOku(kayitDefteriYolu);

    for (const kimlik of BEKLENEN_KIMLIKLER) {
      const kanitlar = kanitlariOlustur(kayitDefteri, kimlik);

      const sonuc = tumInvariantlariDegerlendir(kayitDefteri, kanitlar);
      assert.equal(sonuc.sonuc, "BLOCKED", kimlik);
      assert.deepEqual(sonuc.bulgular, [
        {
          invariantKimligi: kimlik,
          nedenKodu: "INVARIANT_IHLALI",
          kanit: `fixture:${kimlik}:ihlal`,
        },
      ]);
    }
  });

  test("eksik ve bilinmeyen kanitta fail-closed BLOCKED uretir", () => {
    const kayitDefteri = kayitDefteriniOku(kayitDefteriYolu);

    const sonuc = tumInvariantlariDegerlendir(kayitDefteri, {
      "INV-TEN-001": {
        durum: KANIT_DURUMLARI.BILINMIYOR,
        kanit: "tarama-sonucu-yok",
        testKimligi: "TEST-INV-TEN-001",
      },
    });

    assert.equal(sonuc.sonuc, "BLOCKED");
    assert.ok(
      sonuc.bulgular.some(
        ({ invariantKimligi, nedenKodu }) =>
          invariantKimligi === "INV-TEN-001" &&
          nedenKodu === "INVARIANT_KANITI_BILINMIYOR",
      ),
    );
    assert.ok(
      sonuc.bulgular.some(
        ({ invariantKimligi, nedenKodu }) =>
          invariantKimligi === "INV-TEN-002" &&
          nedenKodu === "INVARIANT_KANITI_EKSIK",
      ),
    );
  });

  test("yanlis test kimligindeki kaniti kabul etmez", () => {
    const kayitDefteri = kayitDefteriniOku(kayitDefteriYolu);
    const kanitlar = kanitlariOlustur(kayitDefteri);
    kanitlar["INV-TEN-001"].testKimligi = "TEST-BASKA-INVARIANT";

    const sonuc = tumInvariantlariDegerlendir(kayitDefteri, kanitlar);

    assert.equal(sonuc.sonuc, "BLOCKED");
    assert.deepEqual(sonuc.bulgular, [
      {
        invariantKimligi: "INV-TEN-001",
        nedenKodu: "INVARIANT_TEST_KIMLIGI_UYUSMUYOR",
        kanit: "TEST-BASKA-INVARIANT",
      },
    ]);
  });

  test("CRITICAL invariant insan onay kaniti olmadan ACCEPTED olmaz", () => {
    const kayitDefteri = kayitDefteriniOku(kayitDefteriYolu);
    const kanitlar = kanitlariOlustur(kayitDefteri);
    delete kanitlar["INV-TEN-001"].humanGate;

    assert.deepEqual(tumInvariantlariDegerlendir(kayitDefteri, kanitlar), {
      sonuc: "BLOCKED",
      bulgular: [
        {
          invariantKimligi: "INV-TEN-001",
          nedenKodu: "INVARIANT_HUMAN_GATE_EKSIK",
          kanit: null,
        },
      ],
    });
  });

  test("bos veya eksiltilmis kanonik manifest ACCEPTED olmaz", () => {
    const bosKayitDefteri = { surum: 1, invariantlar: [] };
    const sonuc = tumInvariantlariDegerlendir(bosKayitDefteri, {});

    assert.equal(sonuc.sonuc, "BLOCKED");
    assert.ok(
      sonuc.bulgular.some(
        ({ nedenKodu }) =>
          nedenKodu === "INVARIANT_KAYIT_DEFTERI_GECERSIZ",
      ),
    );
  });

  test("null invariant kaydi firlatmak yerine BLOCKED uretir", () => {
    const gecersizKayitDefteri = { surum: 1, invariantlar: [null] };

    const sonuc = tumInvariantlariDegerlendir(gecersizKayitDefteri, {});

    assert.equal(sonuc.sonuc, "BLOCKED");
    assert.ok(
      sonuc.bulgular.some(
        ({ nedenKodu }) =>
          nedenKodu === "INVARIANT_KAYIT_DEFTERI_GECERSIZ",
      ),
    );
  });

  test("eksik metadata kaydini kabul etmez", () => {
    const gecersiz = {
      surum: 1,
      invariantlar: [{ kimlik: "INV-TEN-001", tanim: "eksik kayit" }],
    };

    assert.ok(kayitDefteriniDogrula(gecersiz).length > 0);
  });
});
