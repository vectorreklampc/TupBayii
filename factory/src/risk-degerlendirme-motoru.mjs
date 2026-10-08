const KRITIK_KURALLAR = Object.freeze([
  kural("KRITIK_TENANT_IZOLASYONU", ["tenant-isolation"], ["tenant isolation", "tenant izolasyonu"]),
  kural("KRITIK_AUTH_CEKIRDEGI", ["auth-core"], ["authentication architecture", "authorization architecture", "kimlik cekirdegi"]),
  kural("KRITIK_ODEME_CEKIRDEGI", ["payment-core"], ["payment core", "odeme cekirdegi", "odeme otoritesi"]),
  kural("KRITIK_YIKICI_MIGRATION", ["destructive-migration"], ["destructive migration", "yikici migration"]),
  kural("KRITIK_RESTORE", ["restore"], ["restore", "geri yukleme"]),
  kural("KRITIK_TENANT_DB_SILME", ["tenant-db-deletion"], ["tenant db deletion", "tenant veritabanini kalici sil"]),
  kural("KRITIK_OFFLINE_FINANS_CONFLICT", ["offline-finance-conflict"], ["offline finans conflict", "offline finance conflict"]),
  kural("KRITIK_PRODUCTION_DEPLOY", ["production-deploy"], ["production deploy", "canli ortama release"]),
]);

const YUKSEK_KURALLAR = Object.freeze([
  kural("YUKSEK_CONNECTION_LIFECYCLE", ["connection-lifecycle"], ["connection lifecycle", "baglanti yasam dongusu"]),
  kural("YUKSEK_CONCURRENCY", ["concurrency"], ["concurrency", "eszamanli", "paralel yaris"]),
  kural("YUKSEK_IDEMPOTENCY", ["idempotency"], ["idempotency", "duplicate komut"]),
  kural("YUKSEK_STOK_FINANS_REVERSAL", ["stock-reversal", "financial-reversal"], ["stok reversal", "finansal reversal", "ledger reversal"]),
  kural("YUKSEK_CONTRACT_BREAKING", ["breaking-change"], ["breaking change", "contract alanini kaldir"]),
  kural("YUKSEK_AUTHORIZATION", ["authorization"], ["authorization", "yetkilendirme"]),
]);

const DUSUK_RISK_ETIKETLERI = new Set(["docs-only", "style-only"]);
const DEGISIKLIK_TERIMLERI = Object.freeze([
  "degistir",
  "gelistir",
  "guncelle",
  "uygula",
  "sil",
  "kaldir",
  "yeniden tasarla",
  "otomasyon",
]);

export function riskiDegerlendir(girdi) {
  const konu = girdiyiCozumle(girdi);
  if (konu.girdiGecersizMi) return sonucOlustur("MEDIUM", ["RISK_GIRDISI_GECERSIZ"]);
  if (!konu.gecerliMi) return sonucOlustur("MEDIUM", ["RISK_BELIRSIZ"]);

  const kritikNedenler = nedenleriBul(KRITIK_KURALLAR, konu);
  if (kritikNedenler.length > 0) return sonucOlustur("CRITICAL", kritikNedenler);

  const yuksekNedenler = nedenleriBul(YUKSEK_KURALLAR, konu);
  if (yuksekNedenler.length > 0) return sonucOlustur("HIGH", yuksekNedenler);

  if ([...konu.etiketler].some((etiket) => DUSUK_RISK_ETIKETLERI.has(etiket))) {
    return sonucOlustur("LOW", ["DOKUMANTASYON_VEYA_STIL"]);
  }

  return sonucOlustur("MEDIUM", ["SINIRLI_RUNTIME_DAVRANISI"]);
}

function nedenleriBul(kurallar, konu) {
  return kurallar
    .filter(({ etiketler, terimler }) =>
      etiketler.some((etiket) => konu.etiketler.has(etiket))
      || (
        !yalnizSunumDegisikligiMi(konu.etiketler)
        && degisiklikNiyetiVarMi(konu.metin)
        && terimler.some((terim) => konu.metin.includes(terim))
      ),
    )
    .map(({ nedenKodu }) => nedenKodu);
}

function yalnizSunumDegisikligiMi(etiketler) {
  return [...etiketler].some((etiket) => DUSUK_RISK_ETIKETLERI.has(etiket));
}

function girdiyiCozumle(girdi) {
  if (!nesneMi(girdi)) {
    return { etiketler: new Set(), gecerliMi: false, girdiGecersizMi: false, metin: "" };
  }

  const girdiGecersizMi = [girdi.baslik, girdi.aciklama]
    .some((alan) => alan !== undefined && typeof alan !== "string")
    || (girdi.etiketler !== undefined && !Array.isArray(girdi.etiketler))
    || (Array.isArray(girdi.etiketler) && girdi.etiketler.some((etiket) => typeof etiket !== "string"));

  const baslik = metniNormallestir(girdi.baslik);
  const aciklama = metniNormallestir(girdi.aciklama);
  const etiketler = Array.isArray(girdi.etiketler)
    ? new Set(girdi.etiketler.filter((etiket) => typeof etiket === "string").map(etiketiNormallestir))
    : new Set();
  const metin = `${baslik} ${aciklama}`.trim();

  return { etiketler, gecerliMi: metin !== "" || etiketler.size > 0, girdiGecersizMi, metin };
}

function metniNormallestir(deger) {
  if (typeof deger !== "string") return "";
  return deger
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function etiketiNormallestir(deger) {
  return metniNormallestir(deger).replace(/ /g, "-");
}

function degisiklikNiyetiVarMi(metin) {
  return DEGISIKLIK_TERIMLERI.some((terim) => metin.includes(terim));
}

function sonucOlustur(riskSeviyesi, nedenKodlari) {
  return {
    riskSeviyesi,
    nedenKodlari,
    codexOnIncelemeGerekliMi: riskSeviyesi === "HIGH" || riskSeviyesi === "CRITICAL",
    insanKapisiGerekliMi: riskSeviyesi === "CRITICAL",
  };
}

function kural(nedenKodu, etiketler, terimler) {
  return Object.freeze({ nedenKodu, etiketler: Object.freeze(etiketler), terimler: Object.freeze(terimler) });
}

function nesneMi(deger) {
  return deger !== null && typeof deger === "object" && !Array.isArray(deger);
}
