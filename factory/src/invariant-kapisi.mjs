import { readFileSync } from "node:fs";

export const KANIT_DURUMLARI = Object.freeze({
  KANITLANDI: "KANITLANDI",
  IHLAL: "IHLAL",
  BILINMIYOR: "BILINMIYOR",
});
export const HUMAN_GATE_DURUMLARI = Object.freeze({
  ONAYLANDI: "ONAYLANDI",
});

const ZORUNLU_INVARIANT_KIMLIKLERI = Object.freeze([
  "INV-TEN-001", "INV-TEN-002", "INV-TEN-003", "INV-TEN-004",
  "INV-STK-001", "INV-STK-002", "INV-STK-003", "INV-STK-004", "INV-STK-005",
  "INV-FIN-001", "INV-FIN-002", "INV-FIN-003", "INV-FIN-004",
  "INV-PAY-001", "INV-PAY-002", "INV-PAY-003",
  "INV-OFF-001", "INV-OFF-002", "INV-OFF-003", "INV-OFF-004",
  "INV-AUD-001", "INV-AUD-002", "INV-AUD-003", "INV-AUD-004",
  "INV-GOV-001", "INV-GOV-002",
]);

const ZORUNLU_METIN_ALANLARI = Object.freeze([
  "kimlik",
  "sinif",
  "tanim",
  "gerekce",
  "ihlalOrnegi",
  "dogrulamaYontemi",
  "testKimligi",
  "onem",
  "duzeltme",
]);
const ONEM_SEVIYELERI = new Set(["HIGH", "CRITICAL"]);

export function kayitDefteriniOku(dosyaYolu) {
  return JSON.parse(readFileSync(dosyaYolu, "utf8"));
}

export function kayitDefteriniDogrula(kayitDefteri) {
  const hatalar = [];
  if (!kayitDefteri || typeof kayitDefteri !== "object") {
    return ["Kayit defteri nesne olmalidir."];
  }
  if (!Number.isInteger(kayitDefteri.surum) || kayitDefteri.surum < 1) {
    hatalar.push("surum pozitif bir tam sayi olmalidir.");
  }
  if (!Array.isArray(kayitDefteri.invariantlar)) {
    return [...hatalar, "invariantlar dizi olmalidir."];
  }
  const kayitKimlikleri = kayitDefteri.invariantlar.map(
    (invariant) => invariant?.kimlik,
  );
  if (
    kayitKimlikleri.length !== ZORUNLU_INVARIANT_KIMLIKLERI.length ||
    kayitKimlikleri.some(
      (kimlik, sira) => kimlik !== ZORUNLU_INVARIANT_KIMLIKLERI[sira],
    )
  ) {
    hatalar.push("invariantlar kanonik kimlik manifestiyle birebir ayni olmalidir.");
  }

  const kimlikler = new Set();
  const testKimlikleri = new Set();
  for (const [sira, invariant] of kayitDefteri.invariantlar.entries()) {
    const baglam = invariant?.kimlik ?? `sira:${sira}`;
    if (!invariant || typeof invariant !== "object") {
      hatalar.push(`${baglam} nesne olmalidir.`);
      continue;
    }
    for (const alan of ZORUNLU_METIN_ALANLARI) {
      if (!doluMetinMi(invariant[alan])) {
        hatalar.push(`${baglam}.${alan} zorunludur.`);
      }
    }
    if (
      doluMetinMi(invariant.kimlik) &&
      !/^INV-[A-Z]+-\d{3}$/.test(invariant.kimlik)
    ) {
      hatalar.push(`${baglam}.kimlik kalici INV-<ALAN>-NNN biciminde olmalidir.`);
    }
    if (kimlikler.has(invariant.kimlik)) {
      hatalar.push(`${baglam}.kimlik benzersiz olmalidir.`);
    }
    kimlikler.add(invariant.kimlik);
    if (!Array.isArray(invariant.kaynaklar) || invariant.kaynaklar.length === 0) {
      hatalar.push(`${baglam}.kaynaklar en az bir kaynak tasimalidir.`);
    } else if (invariant.kaynaklar.some((kaynak) => !doluMetinMi(kaynak))) {
      hatalar.push(`${baglam}.kaynaklar bos deger tasiyamaz.`);
    }
    if (!ONEM_SEVIYELERI.has(invariant.onem)) {
      hatalar.push(`${baglam}.onem HIGH veya CRITICAL olmalidir.`);
    }
    if (testKimlikleri.has(invariant.testKimligi)) {
      hatalar.push(`${baglam}.testKimligi benzersiz olmalidir.`);
    }
    testKimlikleri.add(invariant.testKimligi);
    if (typeof invariant.humanGate !== "boolean") {
      hatalar.push(`${baglam}.humanGate boolean olmalidir.`);
    }
    if (invariant.onem === "CRITICAL" && invariant.humanGate !== true) {
      hatalar.push(`${baglam} CRITICAL oldugu icin Human Gate gerektirir.`);
    }
  }
  return hatalar;
}

export function tumInvariantlariDegerlendir(kayitDefteri, kanitlar) {
  const kayitHatalari = kayitDefteriniDogrula(kayitDefteri);
  if (kayitHatalari.length > 0) {
    return {
      sonuc: "BLOCKED",
      bulgular: kayitHatalari.map((kanit) => ({
        invariantKimligi: null,
        nedenKodu: "INVARIANT_KAYIT_DEFTERI_GECERSIZ",
        kanit,
      })),
    };
  }

  const kanitNesnesi = kanitlar && typeof kanitlar === "object" ? kanitlar : {};
  const kayitKimlikleri = new Set(
    kayitDefteri.invariantlar.map(({ kimlik }) => kimlik),
  );
  const bulgular = [];

  for (const invariant of kayitDefteri.invariantlar) {
    const kanit = kanitNesnesi[invariant.kimlik];
    if (!kanit) {
      bulgular.push({
        invariantKimligi: invariant.kimlik,
        nedenKodu: "INVARIANT_KANITI_EKSIK",
        kanit: null,
      });
      continue;
    }
    if (kanit.testKimligi !== invariant.testKimligi) {
      bulgular.push({
        invariantKimligi: invariant.kimlik,
        nedenKodu: "INVARIANT_TEST_KIMLIGI_UYUSMUYOR",
        kanit: kanit.testKimligi ?? null,
      });
      continue;
    }
    if (kanit.durum === KANIT_DURUMLARI.IHLAL) {
      bulgular.push({
        invariantKimligi: invariant.kimlik,
        nedenKodu: "INVARIANT_IHLALI",
        kanit: kanit.kanit,
      });
      continue;
    }
    if (
      kanit.durum === KANIT_DURUMLARI.KANITLANDI &&
      invariant.humanGate &&
      (kanit.humanGate?.durum !== HUMAN_GATE_DURUMLARI.ONAYLANDI ||
        !doluMetinMi(kanit.humanGate?.kanit))
    ) {
      bulgular.push({
        invariantKimligi: invariant.kimlik,
        nedenKodu: "INVARIANT_HUMAN_GATE_EKSIK",
        kanit: kanit.humanGate?.kanit ?? null,
      });
      continue;
    }
    if (
      kanit.durum !== KANIT_DURUMLARI.KANITLANDI ||
      !doluMetinMi(kanit.kanit)
    ) {
      bulgular.push({
        invariantKimligi: invariant.kimlik,
        nedenKodu: "INVARIANT_KANITI_BILINMIYOR",
        kanit: kanit.kanit ?? null,
      });
    }
  }

  for (const [kimlik, kanit] of Object.entries(kanitNesnesi)) {
    if (!kayitKimlikleri.has(kimlik)) {
      bulgular.push({
        invariantKimligi: kimlik,
        nedenKodu: "INVARIANT_KAYDI_BULUNAMADI",
        kanit: kanit?.kanit ?? null,
      });
    }
  }

  return bulgular.length === 0
    ? { sonuc: "ACCEPTED", bulgular: [] }
    : { sonuc: "BLOCKED", bulgular };
}

export function fixtureyiDegerlendir(kural, girdi) {
  if (
    !kural ||
    typeof kural !== "object" ||
    !doluMetinMi(kural.alan) ||
    typeof kural.beklenen !== "boolean" ||
    !girdi ||
    typeof girdi !== "object" ||
    typeof girdi[kural.alan] !== "boolean"
  ) {
    return KANIT_DURUMLARI.BILINMIYOR;
  }
  return girdi[kural.alan] === kural.beklenen
    ? KANIT_DURUMLARI.KANITLANDI
    : KANIT_DURUMLARI.IHLAL;
}

function doluMetinMi(deger) {
  return typeof deger === "string" && deger.trim() !== "";
}
