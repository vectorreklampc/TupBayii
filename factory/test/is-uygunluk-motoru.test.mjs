import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  HAZIRLIK_KAPSAMLARI,
  calismaSeridiSec,
  hazirlikUygunlugunuDegerlendir,
  tamUygunluguDegerlendir,
} from "../src/is-uygunluk-motoru.mjs";

const TAM_ETIKETLER = [
  "aktif-plan",
  "yz-hazir",
  "GEREKSINIM_HAZIR",
  "MIMARI_HAZIR",
  "SOZLESME_HAZIR",
  "TASARIM_GEREKMEZ",
  "IZLENEBILIRLIK_HAZIR",
  "TEST_REFERANSI_HAZIR",
  "BAGIMLILIKLAR_TAMAM",
  "INSAN_ONAYI_GEREKMEZ",
  "risk-medium",
];

const PREP_ETIKETLER = [
  "aktif-plan",
  "PREP_HAZIR",
  "agent-claude-prep",
  "BAGIMLILIK_PREP_UYGUN",
  "risk-medium",
];

function isOlustur(ek = {}) {
  return {
    projeAnahtari: "TBP",
    durumKategorisi: "new",
    etiketler: TAM_ETIKETLER,
    tamamlanmamisOnKosullar: [],
    acikEngeller: [],
    ...ek,
  };
}

describe("tam uygulama uygunlugu", () => {
  const ornekler = [
    ["butun kapilar acikken uygundur", {}, "UYGUN", []],
    [
      "sozlesme gerekmez alternatifi kabul edilir",
      {
        etiketler: TAM_ETIKETLER.map((etiket) =>
          etiket === "SOZLESME_HAZIR" ? "SOZLESME_GEREKMEZ" : etiket,
        ),
      },
      "UYGUN",
      [],
    ],
    [
      "tasarim hazir alternatifi kabul edilir",
      {
        etiketler: TAM_ETIKETLER.map((etiket) =>
          etiket === "TASARIM_GEREKMEZ" ? "TASARIM_HAZIR" : etiket,
        ),
      },
      "UYGUN",
      [],
    ],
    [
      "insan onayi verildi alternatifi kabul edilir",
      {
        etiketler: TAM_ETIKETLER.map((etiket) =>
          etiket === "INSAN_ONAYI_GEREKMEZ"
            ? "INSAN_ONAYI_VERILDI"
            : etiket,
        ),
      },
      "UYGUN",
      [],
    ],
    [
      "eksik gereksinimi neden koduyla reddeder",
      { etiketler: TAM_ETIKETLER.filter((e) => e !== "GEREKSINIM_HAZIR") },
      "UYGUN_DEGIL",
      ["GEREKSINIM_HAZIR_DEGIL"],
    ],
    [
      "risk sinifi bilinmeyen tam isi reddeder",
      { etiketler: TAM_ETIKETLER.filter((e) => !e.startsWith("risk-")) },
      "UYGUN_DEGIL",
      ["RISK_SINIFI_BELLI_DEGIL"],
    ],
    [
      "birden cok eksigi kararli sirada raporlar",
      {
        etiketler: TAM_ETIKETLER.filter(
          (e) => e !== "MIMARI_HAZIR" && e !== "TEST_REFERANSI_HAZIR",
        ),
      },
      "UYGUN_DEGIL",
      ["MIMARI_HAZIR_DEGIL", "TEST_REFERANSI_HAZIR_DEGIL"],
    ],
    [
      "tamamlanmis isi reddeder",
      { durumKategorisi: "done" },
      "UYGUN_DEGIL",
      ["IS_TAMAMLANMIS"],
    ],
    [
      "tamamlanmamis Blocks on kosulunu reddeder",
      { tamamlanmamisOnKosullar: ["TBP-27"] },
      "UYGUN_DEGIL",
      ["TAMAMLANMAMIS_ON_KOSUL"],
    ],
    [
      "bozuk Jira label girdisini exception yerine reddeder",
      { etiketler: [...TAM_ETIKETLER, 42] },
      "UYGUN_DEGIL",
      ["JIRA_GIRDISI_GECERSIZ"],
    ],
  ];

  for (const [ad, ek, sonuc, nedenKodlari] of ornekler) {
    test(ad, () => {
      assert.deepEqual(tamUygunluguDegerlendir(isOlustur(ek)), {
        sonuc,
        nedenKodlari,
      });
    });
  }
});

describe("hazirlik seridi uygunlugu", () => {
  const ornekler = [
    [
      "yalniz PREP kapilariyla test harness calismasini kabul eder",
      {},
      HAZIRLIK_KAPSAMLARI.TEST_HARNESS,
      "PREP_UYGUN",
      [],
    ],
    [
      "risk sinifi veya risk etiketi yoksa reddeder",
      { etiketler: PREP_ETIKETLER.filter((e) => !e.startsWith("risk-")) },
      HAZIRLIK_KAPSAMLARI.FIXTURE,
      "PREP_UYGUN_DEGIL",
      ["RISK_SINIFI_BELLI_DEGIL"],
    ],
    [
      "prep dependency kapisi yoksa reddeder",
      {
        etiketler: PREP_ETIKETLER.filter(
          (e) => e !== "BAGIMLILIK_PREP_UYGUN",
        ),
      },
      HAZIRLIK_KAPSAMLARI.SCAFFOLD,
      "PREP_UYGUN_DEGIL",
      ["BAGIMLILIK_PREP_UYGUN_DEGIL"],
    ],
    [
      "acik engeli fail closed reddeder",
      { acikEngeller: ["BLOCKED"] },
      HAZIRLIK_KAPSAMLARI.TEKNIK_SPIKE,
      "PREP_UYGUN_DEGIL",
      ["ACIK_ENGEL"],
    ],
    [
      "business davranisi gibi yasak kapsami reddeder",
      {},
      "BUSINESS_DAVRANISI",
      "PREP_UYGUN_DEGIL",
      ["PREP_KAPSAMI_YASAK"],
    ],
    [
      "dusuk risk olmayan refactor hazirligini reddeder",
      {},
      HAZIRLIK_KAPSAMLARI.DUSUK_RISK_REFACTOR,
      "PREP_UYGUN_DEGIL",
      ["PREP_REFACTOR_RISKI_DUSUK_DEGIL"],
    ],
    [
      "dusuk risk refactor hazirligini kabul eder",
      {
        etiketler: PREP_ETIKETLER.map((e) =>
          e === "risk-medium" ? "risk-low" : e,
        ),
      },
      HAZIRLIK_KAPSAMLARI.DUSUK_RISK_REFACTOR,
      "PREP_UYGUN",
      [],
    ],
  ];

  for (const [ad, ek, kapsam, sonuc, nedenKodlari] of ornekler) {
    test(ad, () => {
      assert.deepEqual(
        hazirlikUygunlugunuDegerlendir(
          isOlustur({ etiketler: PREP_ETIKETLER, ...ek }),
          kapsam,
        ),
        { sonuc, nedenKodlari },
      );
    });
  }
});

describe("calisma seridi onceligi", () => {
  test("tam uygulamayi PREP seridinden once secer", () => {
    const is = isOlustur({
      etiketler: [...TAM_ETIKETLER, ...PREP_ETIKETLER],
    });

    assert.deepEqual(calismaSeridiSec(is, HAZIRLIK_KAPSAMLARI.FIXTURE), {
      serit: "TAM_UYGULAMA",
      sonuc: "UYGUN",
      nedenKodlari: [],
    });
  });

  test("tam uygulama uygun degilse PREP seridini secer", () => {
    const is = isOlustur({ etiketler: PREP_ETIKETLER });

    assert.deepEqual(calismaSeridiSec(is, HAZIRLIK_KAPSAMLARI.FIXTURE), {
      serit: "HAZIRLIK",
      sonuc: "PREP_UYGUN",
      nedenKodlari: [],
    });
  });

  test("iki serit de uygun degilse yeni is uydurmaz", () => {
    const is = isOlustur({ etiketler: ["aktif-plan"] });

    const karar = calismaSeridiSec(is, HAZIRLIK_KAPSAMLARI.FIXTURE);
    assert.equal(karar.serit, null);
    assert.equal(karar.sonuc, "UYGUN_DEGIL");
    assert.ok(karar.nedenKodlari.includes("YZ_HAZIR_DEGIL"));
    assert.ok(karar.nedenKodlari.includes("PREP_HAZIR_DEGIL"));
  });
});
