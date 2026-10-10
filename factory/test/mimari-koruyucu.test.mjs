import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  INVARIANTLAR,
  mimariyiDegerlendir,
} from "../src/mimari-koruyucu.mjs";

function gecerliMimari() {
  return {
    invariantlar: Object.fromEntries(
      INVARIANTLAR.map(({ alan, kod }) => [
        alan,
        {
          durum: "UYGUN",
          kanitlar: [`${kod} uyumunu gosteren architecture test`],
        },
      ]),
    ),
  };
}

describe("Architecture Guardian", () => {
  test("gecerli referans mimariyi ACCEPTED yapar", () => {
    assert.deepEqual(mimariyiDegerlendir(gecerliMimari()), {
      sonuc: "ACCEPTED",
      invariantKodlari: [],
      bulgular: [],
    });
  });

  for (const { alan, kod } of INVARIANTLAR) {
    test(`${kod} icin pozitif fixture kanitli UYGUN durumunu kabul eder`, () => {
      const mimari = gecerliMimari();

      assert.equal(mimari.invariantlar[alan].durum, "UYGUN");
      assert.ok(mimari.invariantlar[alan].kanitlar.length > 0);
      assert.equal(mimariyiDegerlendir(mimari).sonuc, "ACCEPTED");
    });

    test(`${kod} ihlalini kanitiyla BLOCKED yapar`, () => {
      const mimari = gecerliMimari();
      mimari.invariantlar[alan] = {
        durum: "IHLAL",
        kanitlar: [`${kod} ihlalini gosteren diff`],
      };

      assert.deepEqual(mimariyiDegerlendir(mimari), {
        sonuc: "BLOCKED",
        invariantKodlari: [kod],
        bulgular: [
          {
            invariantKodu: kod,
            alan: `invariantlar.${alan}`,
            neden: "IHLAL",
            kanitlar: [`${kod} ihlalini gosteren diff`],
          },
        ],
      });
    });
  }

  test("bilinmeyen durumda ACCEPTED vermez", () => {
    const mimari = gecerliMimari();
    mimari.invariantlar.tenantCozumleme = {
      durum: "BILINMIYOR",
      kanitlar: ["Resolver davranisi henuz incelenmedi"],
    };

    assert.deepEqual(mimariyiDegerlendir(mimari).bulgular, [
      {
        invariantKodu: "INV-TEN-003",
        alan: "invariantlar.tenantCozumleme",
        neden: "BILINMIYOR",
        kanitlar: ["Resolver davranisi henuz incelenmedi"],
      },
    ]);
  });

  test("kanitsiz UYGUN beyanini fail-closed reddeder", () => {
    const mimari = gecerliMimari();
    mimari.invariantlar.odemeOtoritesi.kanitlar = [];

    assert.deepEqual(mimariyiDegerlendir(mimari).bulgular, [
      {
        invariantKodu: "INV-PAY-001",
        alan: "invariantlar.odemeOtoritesi",
        neden: "KANIT_EKSIK",
        kanitlar: [],
      },
    ]);
  });

  test("birden cok ihlali invariant sirasinda toplar", () => {
    const mimari = gecerliMimari();
    mimari.invariantlar.masterDbSiniri.durum = "IHLAL";
    mimari.invariantlar.kodlamaStandardi.durum = "IHLAL";

    const sonuc = mimariyiDegerlendir(mimari);

    assert.equal(sonuc.sonuc, "BLOCKED");
    assert.deepEqual(sonuc.invariantKodlari, ["INV-TEN-002", "STD-KOD-001"]);
  });

  test("kodlama standardi global invariant namespace'ini kullanmaz", () => {
    assert.deepEqual(
      INVARIANTLAR.map(({ kod }) => kod),
      ["INV-TEN-001", "INV-TEN-002", "INV-TEN-003", "INV-STK-001", "INV-PAY-001", "STD-KOD-001"],
    );
  });

  test("bozuk girdiyi tum invariantlar icin fail-closed reddeder", () => {
    const sonuc = mimariyiDegerlendir(null);

    assert.equal(sonuc.sonuc, "BLOCKED");
    assert.deepEqual(
      sonuc.invariantKodlari,
      INVARIANTLAR.map(({ kod }) => kod),
    );
    assert.ok(sonuc.bulgular.every(({ neden }) => neden === "BILINMIYOR"));
  });

  test("metin olmayan kaniti kanit eksigi sayar", () => {
    const mimari = gecerliMimari();
    mimari.invariantlar.stokLedger.kanitlar = [42];

    assert.equal(mimariyiDegerlendir(mimari).bulgular[0].neden, "KANIT_EKSIK");
  });
});
