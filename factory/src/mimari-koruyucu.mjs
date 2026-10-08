export const INVARIANTLAR = Object.freeze([
  Object.freeze({ alan: "databasePerTenant", kod: "INV-TEN-001" }),
  Object.freeze({ alan: "masterDbSiniri", kod: "INV-TEN-002" }),
  Object.freeze({ alan: "tenantCozumleme", kod: "INV-TEN-003" }),
  Object.freeze({ alan: "stokLedger", kod: "INV-STK-001" }),
  Object.freeze({ alan: "odemeOtoritesi", kod: "INV-PAY-001" }),
  Object.freeze({ alan: "kodlamaStandardi", kod: "INV-CODE-001" }),
]);

export function mimariyiDegerlendir(mimari) {
  const kayitlar = nesneMi(mimari) && nesneMi(mimari.invariantlar)
    ? mimari.invariantlar
    : {};
  const bulgular = [];

  for (const { alan, kod } of INVARIANTLAR) {
    const kayit = nesneMi(kayitlar[alan]) ? kayitlar[alan] : null;
    const kanitlar = gecerliKanitlar(kayit?.kanitlar);
    const neden = engelNedeni(kayit, kanitlar);

    if (neden) {
      bulgular.push({
        invariantKodu: kod,
        alan: `invariantlar.${alan}`,
        neden,
        kanitlar,
      });
    }
  }

  return {
    sonuc: bulgular.length === 0 ? "ACCEPTED" : "BLOCKED",
    invariantKodlari: bulgular.map(({ invariantKodu }) => invariantKodu),
    bulgular,
  };
}

function engelNedeni(kayit, kanitlar) {
  if (!kayit || !["UYGUN", "IHLAL"].includes(kayit.durum)) {
    return "BILINMIYOR";
  }
  if (kanitlar.length === 0) {
    return "KANIT_EKSIK";
  }
  return kayit.durum === "IHLAL" ? "IHLAL" : null;
}

function gecerliKanitlar(deger) {
  if (
    !Array.isArray(deger)
    || deger.length === 0
    || deger.some((kanit) => typeof kanit !== "string" || kanit.trim() === "")
  ) {
    return [];
  }
  return deger.map((kanit) => kanit.trim());
}

function nesneMi(deger) {
  return deger !== null && typeof deger === "object" && !Array.isArray(deger);
}
