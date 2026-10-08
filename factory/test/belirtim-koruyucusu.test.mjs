import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  ZORUNLU_ALANLAR,
  belirtimiDegerlendir,
} from "../src/belirtim-koruyucusu.mjs";

const HAZIR_ETIKETLER = [
  "yz-hazir",
  "GEREKSINIM_HAZIR",
  "MIMARI_HAZIR",
  "SOZLESME_HAZIR",
  "TASARIM_GEREKMEZ",
  "IZLENEBILIRLIK_HAZIR",
  "TEST_REFERANSI_HAZIR",
  "INSAN_ONAYI_GEREKMEZ",
  "risk-high",
];

function hazirAlanlar() {
  return Object.fromEntries(
    ZORUNLU_ALANLAR.map((alan) => [alan, alan + " icin somut tanim"]),
  );
}

function hazirIs(ek = {}) {
  return {
    ...ek,
    alanlar: {
      ...hazirAlanlar(),
      designRequired: "Hayir - Bu is kullanici arayuzu degistirmiyor.",
      humanGate: "Gerekli Degil - Geri donusu zor karar icermiyor.",
      riskSeviyesi: "HIGH - Factory uygulama kapisini etkiliyor.",
      ...ek.alanlar,
    },
    etiketler: ek.etiketler ?? HAZIR_ETIKETLER,
    kanitlar: {
      mimari: ["ADR-012"],
      sozlesme: ["TBP-32 SDD-AI Uygulama Sozlesmesi"],
      tasarim: [],
      izlenebilirlik: ["TBP-32 -> ADR-012 -> factory testleri"],
      testReferansi: ["GS-TBP-32-01"],
      insanOnayi: [],
      ...ek.kanitlar,
    },
  };
}

describe("belirtim koruyucusu", () => {
  test("butun zorunlu alanlar ve kanitlar varken HAZIR uretir", () => {
    assert.deepEqual(belirtimiDegerlendir(hazirIs()), {
      sonuc: "HAZIR",
      nedenKodlari: [],
      eksikler: [],
    });
  });

  const eksiklikOrnekleri = [
    [
      "bos zorunlu alani gereksinim eksigi olarak raporlar",
      () => hazirIs({ alanlar: { isHedefi: "" } }),
      "GEREKSINIM_EKSIK",
      "alanlar.isHedefi",
    ],
    [
      "mimari kaniti yoksa mimari eksigi raporlar",
      () => hazirIs({ kanitlar: { mimari: [] } }),
      "MIMARI_EKSIK",
      "kanitlar.mimari",
    ],
    [
      "sozlesme kaniti yoksa sozlesme eksigi raporlar",
      () => hazirIs({ kanitlar: { sozlesme: [] } }),
      "SOZLESME_EKSIK",
      "kanitlar.sozlesme",
    ],
    [
      "tasarim gerekliyken Figma kaniti yoksa tasarim eksigi raporlar",
      () =>
        hazirIs({
          alanlar: { designRequired: "Evet - Kullanici arayuzu degisiyor." },
          etiketler: HAZIR_ETIKETLER.map((etiket) =>
            etiket === "TASARIM_GEREKMEZ" ? "TASARIM_HAZIR" : etiket,
          ),
        }),
      "TASARIM_EKSIK",
      "kanitlar.tasarim",
    ],
    [
      "izlenebilirlik baglantisi yoksa izlenebilirlik eksigi raporlar",
      () => hazirIs({ kanitlar: { izlenebilirlik: [] } }),
      "IZLENEBILIRLIK_EKSIK",
      "kanitlar.izlenebilirlik",
    ],
    [
      "test dogruluk referansi yoksa test referansi eksigi raporlar",
      () => hazirIs({ kanitlar: { testReferansi: [] } }),
      "TEST_REFERANSI_EKSIK",
      "kanitlar.testReferansi",
    ],
  ];

  for (const [ad, girdiOlustur, nedenKodu, eksikAlan] of eksiklikOrnekleri) {
    test(ad, () => {
      assert.deepEqual(belirtimiDegerlendir(girdiOlustur()), {
        sonuc: nedenKodu,
        nedenKodlari: [nedenKodu],
        eksikler: [{ nedenKodu, alan: eksikAlan }],
      });
    });
  }

  test("birden cok eksigi kararli sirada ve tek sonuc icinde raporlar", () => {
    const is = hazirIs({
      alanlar: { isHedefi: "" },
      kanitlar: { mimari: [], testReferansi: [] },
    });

    assert.deepEqual(belirtimiDegerlendir(is), {
      sonuc: "GEREKSINIM_EKSIK",
      nedenKodlari: [
        "GEREKSINIM_EKSIK",
        "MIMARI_EKSIK",
        "TEST_REFERANSI_EKSIK",
      ],
      eksikler: [
        { nedenKodu: "GEREKSINIM_EKSIK", alan: "alanlar.isHedefi" },
        { nedenKodu: "MIMARI_EKSIK", alan: "kanitlar.mimari" },
        {
          nedenKodu: "TEST_REFERANSI_EKSIK",
          alan: "kanitlar.testReferansi",
        },
      ],
    });
  });
});


describe("fail-closed sinirlar", () => {
  test("gerekcesiz N/A zorunlu alani kabul etmez", () => {
    const sonuc = belirtimiDegerlendir(
      hazirIs({ alanlar: { offlineCache: "N/A" } }),
    );

    assert.deepEqual(sonuc, {
      sonuc: "GEREKSINIM_EKSIK",
      nedenKodlari: ["GEREKSINIM_EKSIK"],
      eksikler: [
        { nedenKodu: "GEREKSINIM_EKSIK", alan: "alanlar.offlineCache" },
      ],
    });
  });

  test("risk alani ile tek risk etiketi eslesmelidir", () => {
    const sonuc = belirtimiDegerlendir(
      hazirIs({ alanlar: { riskSeviyesi: "MEDIUM - Sinirli etki." } }),
    );

    assert.deepEqual(sonuc, {
      sonuc: "GEREKSINIM_EKSIK",
      nedenKodlari: ["GEREKSINIM_EKSIK"],
      eksikler: [
        { nedenKodu: "GEREKSINIM_EKSIK", alan: "alanlar.riskSeviyesi" },
      ],
    });
  });

  test("risk etiketi yoksa HAZIR uretmez", () => {
    const sonuc = belirtimiDegerlendir(
      hazirIs({
        etiketler: HAZIR_ETIKETLER.filter((etiket) => !etiket.startsWith("risk-")),
      }),
    );

    assert.deepEqual(sonuc, {
      sonuc: "GEREKSINIM_EKSIK",
      nedenKodlari: ["GEREKSINIM_EKSIK"],
      eksikler: [
        { nedenKodu: "GEREKSINIM_EKSIK", alan: "etiketler.riskSeviyesi" },
      ],
    });
  });

  test("Human Gate gerekli ve verilmis olsa da onay kaniti ister", () => {
    const sonuc = belirtimiDegerlendir(
      hazirIs({
        alanlar: { humanGate: "Gerekli - Production karari." },
        etiketler: HAZIR_ETIKETLER.map((etiket) =>
          etiket === "INSAN_ONAYI_GEREKMEZ" ? "INSAN_ONAYI_VERILDI" : etiket,
        ),
      }),
    );

    assert.deepEqual(sonuc, {
      sonuc: "GEREKSINIM_EKSIK",
      nedenKodlari: ["GEREKSINIM_EKSIK"],
      eksikler: [
        { nedenKodu: "GEREKSINIM_EKSIK", alan: "kanitlar.insanOnayi" },
      ],
    });
  });

  test("tasarim hazir etiketi yalniz Figma URL kanitiyla gecer", () => {
    const sonuc = belirtimiDegerlendir(
      hazirIs({
        alanlar: { designRequired: "Evet - Kullanici arayuzu degisiyor." },
        etiketler: HAZIR_ETIKETLER.map((etiket) =>
          etiket === "TASARIM_GEREKMEZ" ? "TASARIM_HAZIR" : etiket,
        ),
        kanitlar: { tasarim: ["ekran-42"] },
      }),
    );

    assert.deepEqual(sonuc, {
      sonuc: "TASARIM_EKSIK",
      nedenKodlari: ["TASARIM_EKSIK"],
      eksikler: [
        { nedenKodu: "TASARIM_EKSIK", alan: "kanitlar.tasarim" },
      ],
    });
  });

  test("bir kapinin hazir ve gerekmez etiketlerini birlikte kabul etmez", () => {
    const sonuc = belirtimiDegerlendir(
      hazirIs({ etiketler: [...HAZIR_ETIKETLER, "TASARIM_HAZIR"] }),
    );

    assert.deepEqual(sonuc, {
      sonuc: "TASARIM_EKSIK",
      nedenKodlari: ["TASARIM_EKSIK"],
      eksikler: [
        { nedenKodu: "TASARIM_EKSIK", alan: "etiketler.tasarimKapisi" },
      ],
    });
  });

  test("sozlesme gerekmez secenegini somut gerekceyle kabul eder", () => {
    const sonuc = belirtimiDegerlendir(
      hazirIs({
        etiketler: HAZIR_ETIKETLER.map((etiket) =>
          etiket === "SOZLESME_HAZIR" ? "SOZLESME_GEREKMEZ" : etiket,
        ),
        kanitlar: { sozlesme: ["N/A - Dis API veya olay degismiyor."] },
      }),
    );

    assert.equal(sonuc.sonuc, "HAZIR");
  });

  test("caller hazir beyanini bypass olarak kabul etmez", () => {
    const sonuc = belirtimiDegerlendir(
      hazirIs({ hazir: true, kanitlar: { testReferansi: [] } }),
    );

    assert.equal(sonuc.sonuc, "TEST_REFERANSI_EKSIK");
  });

  test("bozuk Jira girdisini exception yerine fail-closed reddeder", () => {
    assert.deepEqual(belirtimiDegerlendir(null), {
      sonuc: "GEREKSINIM_EKSIK",
      nedenKodlari: ["GEREKSINIM_EKSIK"],
      eksikler: [
        { nedenKodu: "GEREKSINIM_EKSIK", alan: "jiraGirdisi" },
      ],
    });
  });

  test("metin olmayan etiketi bozuk Jira girdisi olarak reddeder", () => {
    const sonuc = belirtimiDegerlendir(
      hazirIs({ etiketler: [...HAZIR_ETIKETLER, 42] }),
    );

    assert.deepEqual(sonuc, {
      sonuc: "GEREKSINIM_EKSIK",
      nedenKodlari: ["GEREKSINIM_EKSIK"],
      eksikler: [
        { nedenKodu: "GEREKSINIM_EKSIK", alan: "jiraGirdisi.etiketler" },
      ],
    });
  });
});
