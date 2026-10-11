export const HAZIRLIK_KAPSAMLARI = Object.freeze({
  REPO_KESFI: "REPO_KESFI",
  SCAFFOLD: "SCAFFOLD",
  FIXTURE: "FIXTURE",
  MOCK_STUB: "MOCK_STUB",
  CONTRACT_SAMPLE: "CONTRACT_SAMPLE",
  TEST_HARNESS: "TEST_HARNESS",
  TELEMETRY_SKELETON: "TELEMETRY_SKELETON",
  TEKNIK_SPIKE: "TEKNIK_SPIKE",
  CODEBASE_MAP: "CODEBASE_MAP",
  DUSUK_RISK_REFACTOR: "DUSUK_RISK_REFACTOR",
});

const IZINLI_HAZIRLIK_KAPSAMLARI = new Set(
  Object.values(HAZIRLIK_KAPSAMLARI),
);
const RISK_ETIKETLERI = new Set([
  "risk-low",
  "risk-medium",
  "risk-high",
  "risk-critical",
]);

const TAM_ZORUNLU_ETIKETLER = Object.freeze([
  ["aktif-plan", "AKTIF_PLAN_DEGIL"],
  ["yz-hazir", "YZ_HAZIR_DEGIL"],
  ["GEREKSINIM_HAZIR", "GEREKSINIM_HAZIR_DEGIL"],
  ["MIMARI_HAZIR", "MIMARI_HAZIR_DEGIL"],
]);

const TAM_ALTERNATIF_KAPILAR = Object.freeze([
  [
    ["SOZLESME_HAZIR", "SOZLESME_GEREKMEZ"],
    "SOZLESME_KAPISI_HAZIR_DEGIL",
  ],
  [["TASARIM_HAZIR", "TASARIM_GEREKMEZ"], "TASARIM_KAPISI_HAZIR_DEGIL"],
]);

const TAM_SON_ETIKETLER = Object.freeze([
  ["IZLENEBILIRLIK_HAZIR", "IZLENEBILIRLIK_HAZIR_DEGIL"],
  ["TEST_REFERANSI_HAZIR", "TEST_REFERANSI_HAZIR_DEGIL"],
  ["BAGIMLILIKLAR_TAMAM", "BAGIMLILIKLAR_TAMAM_DEGIL"],
]);

export function tamUygunluguDegerlendir(is) {
  const { etiketler, nedenKodlari } = ortakGirdiyiDogrula(is);

  for (const [etiket, nedenKodu] of TAM_ZORUNLU_ETIKETLER) {
    etiketYoksaEkle(etiketler, etiket, nedenKodu, nedenKodlari);
  }
  if (!riskSinifiBelliMi(etiketler)) {
    nedenKodlari.push("RISK_SINIFI_BELLI_DEGIL");
  }
  for (const [alternatifler, nedenKodu] of TAM_ALTERNATIF_KAPILAR) {
    if (!alternatifler.some((etiket) => etiketler.has(etiket))) {
      nedenKodlari.push(nedenKodu);
    }
  }
  for (const [etiket, nedenKodu] of TAM_SON_ETIKETLER) {
    etiketYoksaEkle(etiketler, etiket, nedenKodu, nedenKodlari);
  }
  if (
    !etiketler.has("INSAN_ONAYI_VERILDI") &&
    !etiketler.has("INSAN_ONAYI_GEREKMEZ")
  ) {
    nedenKodlari.push("INSAN_ONAYI_KAPISI_HAZIR_DEGIL");
  }

  return kararOlustur("UYGUN", "UYGUN_DEGIL", nedenKodlari);
}

export function hazirlikUygunlugunuDegerlendir(is, kapsam) {
  const { etiketler, nedenKodlari } = ortakGirdiyiDogrula(is);

  etiketYoksaEkle(etiketler, "aktif-plan", "AKTIF_PLAN_DEGIL", nedenKodlari);
  etiketYoksaEkle(etiketler, "PREP_HAZIR", "PREP_HAZIR_DEGIL", nedenKodlari);
  etiketYoksaEkle(
    etiketler,
    "agent-claude-prep",
    "CLAUDE_PREP_AJANI_HAZIR_DEGIL",
    nedenKodlari,
  );
  if (!riskSinifiBelliMi(etiketler)) {
    nedenKodlari.push("RISK_SINIFI_BELLI_DEGIL");
  }
  etiketYoksaEkle(
    etiketler,
    "BAGIMLILIK_PREP_UYGUN",
    "BAGIMLILIK_PREP_UYGUN_DEGIL",
    nedenKodlari,
  );
  if (!IZINLI_HAZIRLIK_KAPSAMLARI.has(kapsam)) {
    nedenKodlari.push("PREP_KAPSAMI_YASAK");
  } else if (
    kapsam === HAZIRLIK_KAPSAMLARI.DUSUK_RISK_REFACTOR &&
    !etiketler.has("risk-low")
  ) {
    nedenKodlari.push("PREP_REFACTOR_RISKI_DUSUK_DEGIL");
  }

  return kararOlustur("PREP_UYGUN", "PREP_UYGUN_DEGIL", nedenKodlari);
}

export function calismaSeridiSec(is, hazirlikKapsami) {
  const tamKarar = tamUygunluguDegerlendir(is);
  if (tamKarar.sonuc === "UYGUN") {
    return { serit: "TAM_UYGULAMA", ...tamKarar };
  }

  const hazirlikKarari = hazirlikUygunlugunuDegerlendir(is, hazirlikKapsami);
  if (hazirlikKarari.sonuc === "PREP_UYGUN") {
    return { serit: "HAZIRLIK", ...hazirlikKarari };
  }

  return {
    serit: null,
    sonuc: "UYGUN_DEGIL",
    nedenKodlari: [...new Set([...tamKarar.nedenKodlari, ...hazirlikKarari.nedenKodlari])],
  };
}

function ortakGirdiyiDogrula(is) {
  const nedenKodlari = [];
  if (!is || typeof is !== "object") {
    return { etiketler: new Set(), nedenKodlari: ["JIRA_GIRDISI_GECERSIZ"] };
  }

  if (is.projeAnahtari !== "TBP") nedenKodlari.push("PROJE_UYGUN_DEGIL");
  if (is.durumKategorisi === "done") nedenKodlari.push("IS_TAMAMLANMIS");
  else if (!new Set(["new", "indeterminate"]).has(is.durumKategorisi)) {
    nedenKodlari.push("DURUM_KATEGORISI_GECERSIZ");
  }
  if (
    !Array.isArray(is.tamamlanmamisOnKosullar) ||
    is.tamamlanmamisOnKosullar.length > 0
  ) {
    nedenKodlari.push("TAMAMLANMAMIS_ON_KOSUL");
  }
  if (!Array.isArray(is.acikEngeller) || is.acikEngeller.length > 0) {
    nedenKodlari.push("ACIK_ENGEL");
  }
  const hamEtiketler = Array.isArray(is.etiketler) ? is.etiketler : [];
  if (hamEtiketler.some((etiket) => typeof etiket !== "string")) {
    nedenKodlari.push("JIRA_GIRDISI_GECERSIZ");
  }

  return {
    etiketler: new Set(
      hamEtiketler.filter((etiket) => typeof etiket === "string"),
    ),
    nedenKodlari,
  };
}

function etiketYoksaEkle(etiketler, etiket, nedenKodu, nedenKodlari) {
  if (!etiketler.has(etiket)) nedenKodlari.push(nedenKodu);
}

function riskSinifiBelliMi(etiketler) {
  return (
    etiketler.has("RISK_SINIFI_BELLI") ||
    [...etiketler].some((etiket) => RISK_ETIKETLERI.has(etiket))
  );
}

function kararOlustur(uygun, uygunDegil, nedenKodlari) {
  return {
    sonuc: nedenKodlari.length === 0 ? uygun : uygunDegil,
    nedenKodlari,
  };
}
