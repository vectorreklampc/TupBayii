export const ZORUNLU_ALANLAR = Object.freeze([
  "isHedefi",
  "aktor",
  "tetikleyici",
  "gercekKaynak",
  "veriSahibi",
  "normalAkis",
  "stateModel",
  "negatifSenaryolar",
  "offlineCache",
  "security",
  "transaction",
  "concurrency",
  "idempotency",
  "failure",
  "audit",
  "observability",
  "acceptanceCriteria",
  "testMatrisi",
  "testOracle",
  "yasakUygulamalar",
  "designRequired",
  "humanGate",
  "riskSeviyesi",
]);

const KODLAR = Object.freeze({
  GEREKSINIM: "GEREKSINIM_EKSIK",
  MIMARI: "MIMARI_EKSIK",
  SOZLESME: "SOZLESME_EKSIK",
  TASARIM: "TASARIM_EKSIK",
  IZLENEBILIRLIK: "IZLENEBILIRLIK_EKSIK",
  TEST_REFERANSI: "TEST_REFERANSI_EKSIK",
});
const RISK_ETIKETLERI = Object.freeze([
  "risk-low",
  "risk-medium",
  "risk-high",
  "risk-critical",
]);

export function belirtimiDegerlendir(is) {
  if (!is || typeof is !== "object" || Array.isArray(is)) {
    return kararOlustur([
      eksikOlustur(KODLAR.GEREKSINIM, "jiraGirdisi"),
    ]);
  }

  const alanlar = nesneMi(is.alanlar) ? is.alanlar : {};
  const kanitlar = nesneMi(is.kanitlar) ? is.kanitlar : {};
  const hamEtiketler = Array.isArray(is.etiketler) ? is.etiketler : [];
  const etiketler = new Set(
    hamEtiketler.filter((etiket) => typeof etiket === "string"),
  );
  const eksikler = [];

  if (
    !Array.isArray(is.etiketler) ||
    hamEtiketler.some((etiket) => typeof etiket !== "string")
  ) {
    eksikEkle(eksikler, KODLAR.GEREKSINIM, "jiraGirdisi.etiketler");
  }

  gereksinimleriDogrula(alanlar, kanitlar, etiketler, eksikler);
  mimariyiDogrula(kanitlar, etiketler, eksikler);
  sozlesmeyiDogrula(kanitlar, etiketler, eksikler);
  tasarimiDogrula(alanlar, kanitlar, etiketler, eksikler);
  izlenebilirligiDogrula(kanitlar, etiketler, eksikler);
  testReferansiniDogrula(kanitlar, etiketler, eksikler);

  return kararOlustur(eksikler);
}

function gereksinimleriDogrula(alanlar, kanitlar, etiketler, eksikler) {
  if (!etiketler.has("GEREKSINIM_HAZIR")) {
    eksikEkle(eksikler, KODLAR.GEREKSINIM, "etiketler.GEREKSINIM_HAZIR");
  }
  for (const alan of ZORUNLU_ALANLAR) {
    if (!alanDegeriGecerliMi(alanlar[alan])) {
      eksikEkle(eksikler, KODLAR.GEREKSINIM, "alanlar." + alan);
    }
  }
  riskiDogrula(alanlar.riskSeviyesi, etiketler, eksikler);
  insanKapisiDogrula(alanlar.humanGate, kanitlar.insanOnayi, etiketler, eksikler);
}

function riskiDogrula(riskAlani, etiketler, eksikler) {
  const secilenler = RISK_ETIKETLERI.filter((etiket) => etiketler.has(etiket));
  if (secilenler.length !== 1) {
    eksikEkle(eksikler, KODLAR.GEREKSINIM, "etiketler.riskSeviyesi");
    return;
  }
  const beklenen = secilenler[0].slice("risk-".length).toUpperCase();
  const gercek = doluMetinMi(riskAlani)
    ? riskAlani.split("-")[0].trim().toUpperCase()
    : "";
  if (gercek !== beklenen) {
    eksikEkle(eksikler, KODLAR.GEREKSINIM, "alanlar.riskSeviyesi");
  }
}

function insanKapisiDogrula(humanGate, insanOnayi, etiketler, eksikler) {
  const verildi = etiketler.has("INSAN_ONAYI_VERILDI");
  const gerekmez = etiketler.has("INSAN_ONAYI_GEREKMEZ");
  if (verildi === gerekmez) {
    eksikEkle(eksikler, KODLAR.GEREKSINIM, "etiketler.humanGate");
    return;
  }
  if (verildi) {
    if (!gerekceliDegerMi(humanGate, "Gerekli")) {
      eksikEkle(eksikler, KODLAR.GEREKSINIM, "alanlar.humanGate");
    }
    if (!doluMetinListesiMi(insanOnayi)) {
      eksikEkle(eksikler, KODLAR.GEREKSINIM, "kanitlar.insanOnayi");
    }
  } else if (!gerekceliDegerMi(humanGate, "Gerekli Degil")) {
    eksikEkle(eksikler, KODLAR.GEREKSINIM, "alanlar.humanGate");
  }
}

function mimariyiDogrula(kanitlar, etiketler, eksikler) {
  if (!etiketler.has("MIMARI_HAZIR")) {
    eksikEkle(eksikler, KODLAR.MIMARI, "etiketler.MIMARI_HAZIR");
  }
  if (!doluMetinListesiMi(kanitlar.mimari)) {
    eksikEkle(eksikler, KODLAR.MIMARI, "kanitlar.mimari");
  }
}

function sozlesmeyiDogrula(kanitlar, etiketler, eksikler) {
  const hazir = etiketler.has("SOZLESME_HAZIR");
  const gerekmez = etiketler.has("SOZLESME_GEREKMEZ");
  if (hazir === gerekmez) {
    eksikEkle(eksikler, KODLAR.SOZLESME, "etiketler.sozlesmeKapisi");
    return;
  }
  const kanitGecerli = hazir
    ? doluMetinListesiMi(kanitlar.sozlesme)
    : gerekceliListeMi(kanitlar.sozlesme);
  if (!kanitGecerli) {
    eksikEkle(eksikler, KODLAR.SOZLESME, "kanitlar.sozlesme");
  }
}

function tasarimiDogrula(alanlar, kanitlar, etiketler, eksikler) {
  const hazir = etiketler.has("TASARIM_HAZIR");
  const gerekmez = etiketler.has("TASARIM_GEREKMEZ");
  if (hazir === gerekmez) {
    eksikEkle(eksikler, KODLAR.TASARIM, "etiketler.tasarimKapisi");
    return;
  }
  if (hazir) {
    if (!gerekceliDegerMi(alanlar.designRequired, "Evet")) {
      eksikEkle(eksikler, KODLAR.TASARIM, "alanlar.designRequired");
    }
    if (!figmaKanitListesiMi(kanitlar.tasarim)) {
      eksikEkle(eksikler, KODLAR.TASARIM, "kanitlar.tasarim");
    }
  } else if (!gerekceliDegerMi(alanlar.designRequired, "Hayir")) {
    eksikEkle(eksikler, KODLAR.TASARIM, "alanlar.designRequired");
  }
}

function izlenebilirligiDogrula(kanitlar, etiketler, eksikler) {
  if (!etiketler.has("IZLENEBILIRLIK_HAZIR")) {
    eksikEkle(
      eksikler,
      KODLAR.IZLENEBILIRLIK,
      "etiketler.IZLENEBILIRLIK_HAZIR",
    );
  }
  if (!doluMetinListesiMi(kanitlar.izlenebilirlik)) {
    eksikEkle(eksikler, KODLAR.IZLENEBILIRLIK, "kanitlar.izlenebilirlik");
  }
}

function testReferansiniDogrula(kanitlar, etiketler, eksikler) {
  if (!etiketler.has("TEST_REFERANSI_HAZIR")) {
    eksikEkle(
      eksikler,
      KODLAR.TEST_REFERANSI,
      "etiketler.TEST_REFERANSI_HAZIR",
    );
  }
  if (!doluMetinListesiMi(kanitlar.testReferansi)) {
    eksikEkle(eksikler, KODLAR.TEST_REFERANSI, "kanitlar.testReferansi");
  }
}

function kararOlustur(eksikler) {
  const nedenKodlari = [...new Set(eksikler.map((eksik) => eksik.nedenKodu))];
  return {
    sonuc: nedenKodlari[0] ?? "HAZIR",
    nedenKodlari,
    eksikler,
  };
}

function eksikEkle(eksikler, nedenKodu, alan) {
  if (!eksikler.some((eksik) => eksik.nedenKodu === nedenKodu && eksik.alan === alan)) {
    eksikler.push(eksikOlustur(nedenKodu, alan));
  }
}

function eksikOlustur(nedenKodu, alan) {
  return { nedenKodu, alan };
}

function alanDegeriGecerliMi(deger) {
  if (!doluMetinMi(deger)) return false;
  if (!/^N\/A\b/i.test(deger.trim())) return true;
  return gerekceliDegerMi(deger, "N/A");
}

function doluMetinMi(deger) {
  return typeof deger === "string" && deger.trim().length > 0;
}

function doluMetinListesiMi(deger) {
  return Array.isArray(deger) && deger.length > 0 && deger.every(doluMetinMi);
}

function gerekceliListeMi(deger) {
  return Array.isArray(deger)
    && deger.length > 0
    && deger.every((metin) => gerekceliDegerMi(metin, "N/A"));
}

function figmaKanitListesiMi(deger) {
  return doluMetinListesiMi(deger)
    && deger.every((url) => /^https:\/\/(www\.)?figma\.com\/(design|file)\//i.test(url));
}

function gerekceliDegerMi(deger, onEk) {
  if (!doluMetinMi(deger)) return false;
  const parcalar = deger.split("-");
  return parcalar[0].trim().toLocaleLowerCase("tr-TR") === onEk.toLocaleLowerCase("tr-TR")
    && parcalar.slice(1).join("-").trim().length >= 4;
}

function nesneMi(deger) {
  return deger !== null && typeof deger === "object" && !Array.isArray(deger);
}
