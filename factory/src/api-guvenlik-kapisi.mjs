export const API_GUVENLIK_KONTROLLERI = Object.freeze([
  kontrol("authentication", "AUTHENTICATION"),
  kontrol("authorization", "AUTHORIZATION"),
  kontrol("tenantIzolasyonu", "TENANT_IZOLASYONU"),
  kontrol("girdiDogrulamaVePayloadSiniri", "GIRDI_DOGRULAMA_VE_PAYLOAD_SINIRI"),
  kontrol("rateLimit", "RATE_LIMIT"),
  kontrol("idempotency", "IDEMPOTENCY"),
  kontrol("timeoutVeCancellation", "TIMEOUT_VE_CANCELLATION"),
  kontrol("retrySiniri", "RETRY_SINIRI"),
  kontrol("corsVeCsrf", "CORS_VE_CSRF"),
  kontrol("secretYonetimi", "SECRET_YONETIMI"),
  kontrol("hataYanitiStandardi", "HATA_YANITI_STANDARDI"),
  kontrol("logRedaksiyonu", "LOG_REDAKSIYONU"),
  kontrol("webhookImzaDogrulama", "WEBHOOK_IMZA_DOGRULAMA"),
  kontrol("replayKoruma", "REPLAY_KORUMA"),
  kontrol("apiSurumlemeVeKullanimdanKaldirma", "API_SURUMLEME_VE_KULLANIMDAN_KALDIRMA"),
  kontrol("openApiContractDogrulama", "OPENAPI_CONTRACT_DOGRULAMA"),
  kontrol("abuseVeAnomaliTelemetry", "ABUSE_VE_ANOMALI_TELEMETRY"),
]);

export function apiGuvenliginiDegerlendir(sozlesme) {
  if (!nesneMi(sozlesme)) {
    return engelliSonuc([
      bulgu("API_GUVENLIK_SOZLESMESI_GECERSIZ", "sozlesme"),
    ]);
  }

  const bulgular = [];
  const endpointler = Array.isArray(sozlesme.endpointler)
    ? sozlesme.endpointler
    : [];

  if (endpointler.length === 0) {
    bulgular.push(bulgu("API_ENDPOINT_EKSIK", "endpointler"));
  }

  endpointler.forEach((endpoint, endpointIndex) => {
    endpointiDegerlendir(endpoint, endpointIndex, bulgular);
  });

  kaliteKapisiniDegerlendir(
    sozlesme.kaliteKapilari,
    "securityTestleri",
    "SECURITY_TESTLERI_KIRMIZI",
    bulgular,
  );
  kaliteKapisiniDegerlendir(
    sozlesme.kaliteKapilari,
    "contractTestleri",
    "CONTRACT_TESTLERI_KIRMIZI",
    bulgular,
  );

  return bulgular.length === 0
    ? { sonuc: "ACCEPTED", nedenKodlari: [], bulgular: [] }
    : engelliSonuc(bulgular);
}

export function rateLimitKarariVer(politika, girdi) {
  if (!gecerliRateLimitPolitikasiMi(politika)) {
    throw new TypeError("RATE_LIMIT_POLITIKASI_GECERSIZ");
  }
  if (
    !nesneMi(girdi)
    || !negatifOlmayanTamsayiMi(girdi.pencereYasiMs)
    || !negatifOlmayanTamsayiMi(girdi.oncekiIstekSayisi)
  ) {
    throw new TypeError("RATE_LIMIT_GIRDISI_GECERSIZ");
  }

  const limit = politika.kota + politika.burst;
  const pencereDolduMu = girdi.pencereYasiMs >= politika.pencereMs;
  const guncelIstekSayisi = pencereDolduMu ? 0 : girdi.oncekiIstekSayisi;
  const izinliMi = guncelIstekSayisi < limit;
  const yeniIstekSayisi = izinliMi
    ? guncelIstekSayisi + 1
    : guncelIstekSayisi;

  return {
    izinliMi,
    limit,
    kalan: Math.max(0, limit - yeniIstekSayisi),
    yeniIstekSayisi,
    yenidenDeneMs: izinliMi
      ? 0
      : Math.max(0, politika.pencereMs - girdi.pencereYasiMs),
  };
}

function endpointiDegerlendir(endpoint, endpointIndex, bulgular) {
  const kok = `endpointler[${endpointIndex}]`;
  if (!nesneMi(endpoint) || !doluMetinMi(endpoint.kimlik)) {
    bulgular.push(bulgu("API_ENDPOINT_GECERSIZ", kok));
    return;
  }

  const kontroller = nesneMi(endpoint.kontroller) ? endpoint.kontroller : {};
  for (const kontrolTanimi of API_GUVENLIK_KONTROLLERI) {
    kontroluDegerlendir(kontroller[kontrolTanimi.alan], kontrolTanimi, kok, bulgular);
  }

  if (typeof endpoint.kritikMi !== "boolean") {
    bulgular.push(bulgu("API_ENDPOINT_KRITIKLIK_BELIRSIZ", `${kok}.kritikMi`));
  }
  if (endpoint.kritikMi === true && endpoint.failOpen !== false) {
    bulgular.push(bulgu("KRITIK_ENDPOINT_FAIL_OPEN_YASAK", `${kok}.failOpen`));
  }

  if (!gecerliRateLimitPolitikasiMi(endpoint.rateLimitPolitikasi)) {
    bulgular.push(bulgu("RATE_LIMIT_POLITIKASI_GECERSIZ", `${kok}.rateLimitPolitikasi`));
  }
}

function kontroluDegerlendir(kayit, tanim, endpointKoku, bulgular) {
  const alan = `${endpointKoku}.kontroller.${tanim.alan}`;
  if (!nesneMi(kayit)) {
    bulgular.push(bulgu(tanim.eksikKodu, alan));
    return;
  }
  if (!gecerliKanitlarMi(kayit.kanitlar)) {
    bulgular.push(bulgu(tanim.kanitEksikKodu, alan));
    return;
  }
  if (kayit.durum === "NOT_APPLICABLE") {
    if (!doluMetinMi(kayit.gerekce)) {
      bulgular.push(bulgu(tanim.gerekceEksikKodu, alan));
    }
    return;
  }
  if (kayit.durum !== "PASS") {
    bulgular.push(bulgu(tanim.basarisizKodu, alan));
  }
}

function kaliteKapisiniDegerlendir(kapilar, alan, kod, bulgular) {
  if (!nesneMi(kapilar) || kapilar[alan] !== "PASS") {
    bulgular.push({
      ...bulgu(kod, `kaliteKapilari.${alan}`),
      mergeEngelliMi: true,
      releaseEngelliMi: true,
    });
  }
}

function kontrol(alan, kodKoku) {
  return Object.freeze({
    alan,
    eksikKodu: `${kodKoku}_EKSIK`,
    basarisizKodu: `${kodKoku}_BASARISIZ`,
    kanitEksikKodu: `${kodKoku}_KANIT_EKSIK`,
    gerekceEksikKodu: `${kodKoku}_GEREKCE_EKSIK`,
  });
}

function bulgu(kod, alan) {
  return { kod, alan };
}

function engelliSonuc(bulgular) {
  return {
    sonuc: "BLOCKED",
    nedenKodlari: bulgular.map(({ kod }) => kod),
    bulgular,
  };
}

function gecerliRateLimitPolitikasiMi(politika) {
  return nesneMi(politika)
    && pozitifTamsayiMi(politika.pencereMs)
    && pozitifTamsayiMi(politika.kota)
    && negatifOlmayanTamsayiMi(politika.burst)
    && Number.isSafeInteger(politika.kota + politika.burst)
    && doluMetinMi(politika.sayacAnahtari);
}

function gecerliKanitlarMi(kanitlar) {
  return Array.isArray(kanitlar)
    && kanitlar.length > 0
    && kanitlar.every(doluMetinMi);
}

function doluMetinMi(deger) {
  return typeof deger === "string" && deger.trim() !== "";
}

function pozitifTamsayiMi(deger) {
  return Number.isSafeInteger(deger) && deger > 0;
}

function negatifOlmayanTamsayiMi(deger) {
  return Number.isSafeInteger(deger) && deger >= 0;
}

function nesneMi(deger) {
  return deger !== null && typeof deger === "object" && !Array.isArray(deger);
}
