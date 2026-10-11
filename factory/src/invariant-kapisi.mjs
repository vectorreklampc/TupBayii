import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  doluMetinMi,
  insanOnaylayanMi,
  isoZamanMi,
  kendiDegeri,
  kuralTanimliMi,
  kuraliUygula,
  nesneMi,
} from "./invariant-kurallari.mjs";

export const KANIT_DURUMLARI = Object.freeze({
  KANITLANDI: "KANITLANDI",
  IHLAL: "IHLAL",
  BILINMIYOR: "BILINMIYOR",
});
export const HUMAN_GATE_DURUMLARI = Object.freeze({
  ONAYLANDI: "ONAYLANDI",
});
// Kabul edilmis risk duzeltilmis veya PASS degildir; yalniz suresi dolana kadar
// telafi edici kontrolle tasinan acik bir istisnadir.
export const RISK_ISTISNASI_DURUMU = "KABUL_EDILMIS_RISK";

// Butun kanonik yollar calisma dizininden bagimsiz olarak modulun kendi
// konumundan cozulur.
export const KANONIK_YOLLAR = Object.freeze({
  kayitDefteri: fileURLToPath(new URL("../invariants/kayit-defteri.json", import.meta.url)),
  kurallar: fileURLToPath(new URL("../invariants/yurutulebilir-kurallar.json", import.meta.url)),
  ornekler: fileURLToPath(new URL("../invariants/kural-ornekleri.json", import.meta.url)),
  riskIstisnalari: fileURLToPath(
    new URL("../invariants/kabul-edilmis-riskler.json", import.meta.url),
  ),
  normatifMarkdown: fileURLToPath(
    new URL("../../TupBayiProje_Global_Invariantlar.md", import.meta.url),
  ),
});

// Kayit defterinden bagimsiz kanonik manifest. Kimlik, sira, onem veya Human
// Gate degisikligi yalniz INV-GOV-002 Change Request kanitiyla burada yapilir;
// kayit defterindeki tek tarafli dusurme dogrulamayi bozar.
const CRITICAL = Object.freeze({ onem: "CRITICAL", humanGate: true });
const HIGH = Object.freeze({ onem: "HIGH", humanGate: false });
export const KANONIK_MANIFEST = Object.freeze({
  "INV-TEN-001": CRITICAL,
  "INV-TEN-002": CRITICAL,
  "INV-TEN-003": CRITICAL,
  "INV-TEN-004": CRITICAL,
  "INV-STK-001": HIGH,
  "INV-STK-002": HIGH,
  "INV-STK-003": HIGH,
  "INV-STK-004": HIGH,
  "INV-STK-005": HIGH,
  "INV-FIN-001": CRITICAL,
  "INV-FIN-002": CRITICAL,
  "INV-FIN-003": CRITICAL,
  "INV-FIN-004": CRITICAL,
  "INV-PAY-001": CRITICAL,
  "INV-PAY-002": CRITICAL,
  "INV-PAY-003": CRITICAL,
  "INV-OFF-001": HIGH,
  "INV-OFF-002": HIGH,
  "INV-OFF-003": HIGH,
  "INV-OFF-004": HIGH,
  "INV-AUD-001": HIGH,
  "INV-AUD-002": HIGH,
  "INV-AUD-003": CRITICAL,
  "INV-AUD-004": HIGH,
  "INV-AUD-005": HIGH,
  "INV-GOV-001": CRITICAL,
  "INV-GOV-002": CRITICAL,
  "INV-GOV-003": CRITICAL,
});
const KANONIK_KIMLIKLER = Object.freeze(Object.keys(KANONIK_MANIFEST));

const KOK_ALANLARI = Object.freeze(["surum", "invariantlar"]);
const KAYIT_ALANLARI = Object.freeze([
  "kimlik",
  "sinif",
  "tanim",
  "gerekce",
  "kaynaklar",
  "ihlalOrnegi",
  "dogrulamaYontemi",
  "testKimligi",
  "onem",
  "duzeltme",
  "humanGate",
]);
const METIN_ALANLARI = Object.freeze(["tanim", "gerekce", "ihlalOrnegi", "duzeltme"]);
// TBP-233 Jira invariant siniflari; `izlenebilirlik` mevcut audit/trace
// kayitlarinin siniflandirmasidir.
const SINIFLAR = new Set([
  "is-alani",
  "veri-sahipligi",
  "tenant-izolasyonu",
  "guvenlik-yetki",
  "finans",
  "stok-ledger",
  "idempotency-concurrency",
  "api-sozlesmesi",
  "ui-ux-state",
  "release-production",
  "izlenebilirlik",
]);
const DOGRULAMA_YONTEMLERI = new Set([
  "architecture-test",
  "security-test",
  "integration-security-test",
  "domain-architecture-test",
  "domain-test",
  "domain-integration-test",
  "persistence-test",
  "concurrency-test",
  "domain-persistence-test",
  "transaction-failure-injection-test",
  "idempotency-replay-test",
  "webhook-security-test",
  "webhook-replay-test",
  "contract-domain-test",
  "offline-conflict-test",
  "contract-test",
  "authorization-integration-test",
  "ui-state-test",
  "audit-integration-test",
  "redaction-security-test",
  "trace-propagation-test",
  "quality-gate",
  "release-policy-test",
  "review-policy-test",
]);
const ONEM_SEVIYELERI = new Set(["HIGH", "CRITICAL"]);
// Jira issue, ADR dosyasi ve Source of Truth satir kimlikleri.
const KAYNAK_DESENI = /^(?:TBP-[1-9]\d*|ADR-(?!000)\d{3}|SOT-[A-Z]{3}-\d{3})$/;
const KIMLIK_DESENI = /^INV-[A-Z]+-\d{3}$/;
const IS_KIMLIGI_DESENI = /^TBP-[1-9]\d*$/;
// CI calistirmasi veya commit gibi kanitin uretildigi yurutmenin kimligi.
const CALISTIRMA_KIMLIGI_DESENI = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const HUMAN_GATE_ALANLARI = Object.freeze([
  "durum",
  "invariantKimligi",
  "isKimligi",
  "onaylayan",
  "zaman",
  "kanit",
]);
const KANIT_ALANLARI = Object.freeze([
  "testKimligi",
  "isKimligi",
  "calistirmaKimligi",
  "gozlem",
  "humanGate",
]);
const ZORUNLU_KANIT_ALANLARI = Object.freeze(KANIT_ALANLARI.slice(0, 4));
const MARKDOWN_BASLIGI = /^### `(INV-[A-Z]+-\d{3})` — \S/;
const RISK_KOK_ALANLARI = Object.freeze(["surum", "riskler"]);
const RISK_ALANLARI = Object.freeze([
  "kimlik",
  "paket",
  "bilesen",
  "kapsam",
  "durum",
  "duzeltildi",
  "gerekce",
  "telafiEdiciKontrol",
  "kaynak",
  "sonGecerlilik",
]);
const GHSA_DESENI = /^GHSA(?:-[23456789cfghjmpqrvwx]{4}){3}$/;
const BILESENLER = new Set(["admin-web", "contracts", "event-contracts", "factory", "flutter"]);

// Okunamayan, bos, kesik veya JSON olmayan dosya istisna firlatmaz; null doner
// ve dogrulamada fail-closed bulguya donusur.
export function jsonDosyasiniOku(dosyaYolu) {
  try {
    return JSON.parse(readFileSync(dosyaYolu, "utf8"));
  } catch {
    return null;
  }
}

function metinDosyasiniOku(dosyaYolu) {
  try {
    return readFileSync(dosyaYolu, "utf8");
  } catch {
    return null;
  }
}

export function kanonikKaynaklariOku() {
  return {
    kayitDefteri: jsonDosyasiniOku(KANONIK_YOLLAR.kayitDefteri),
    kurallar: jsonDosyasiniOku(KANONIK_YOLLAR.kurallar),
    ornekler: jsonDosyasiniOku(KANONIK_YOLLAR.ornekler),
    riskIstisnalari: jsonDosyasiniOku(KANONIK_YOLLAR.riskIstisnalari),
    markdown: metinDosyasiniOku(KANONIK_YOLLAR.normatifMarkdown),
  };
}

export function kayitDefteriniDogrula(kayitDefteri) {
  if (!nesneMi(kayitDefteri)) {
    return ["Kayit defteri okunamadi veya JSON nesnesi degil."];
  }
  const hatalar = fazlaAlanlar(kayitDefteri, KOK_ALANLARI, "kayit defteri");
  const surum = kendiDegeri(kayitDefteri, "surum");
  if (!Number.isSafeInteger(surum) || surum < 1) {
    hatalar.push("surum pozitif bir tam sayi olmalidir.");
  }
  const invariantlar = kendiDegeri(kayitDefteri, "invariantlar");
  if (!Array.isArray(invariantlar)) {
    return [...hatalar, "invariantlar dizi olmalidir."];
  }
  const kayitKimlikleri = invariantlar.map((invariant) => kendiDegeri(invariant, "kimlik"));
  if (!ayniSiraMi(kayitKimlikleri, KANONIK_KIMLIKLER)) {
    hatalar.push("invariantlar kanonik manifestle ayni kimlik ve sirada olmalidir.");
  }

  for (const [sira, invariant] of invariantlar.entries()) {
    const kimlik = kendiDegeri(invariant, "kimlik");
    const baglam = doluMetinMi(kimlik) ? kimlik : `sira:${sira}`;
    if (!nesneMi(invariant)) {
      hatalar.push(`${baglam} duz JSON nesnesi olmalidir.`);
      continue;
    }
    hatalar.push(...fazlaAlanlar(invariant, KAYIT_ALANLARI, baglam));
    for (const alan of KAYIT_ALANLARI) {
      if (!Object.hasOwn(invariant, alan)) hatalar.push(`${baglam}.${alan} zorunludur.`);
    }
    if (typeof kimlik !== "string" || !KIMLIK_DESENI.test(kimlik)) {
      hatalar.push(`${baglam}.kimlik kalici INV-<ALAN>-NNN biciminde olmalidir.`);
    }
    for (const alan of METIN_ALANLARI) {
      if (Object.hasOwn(invariant, alan) && !doluMetinMi(invariant[alan])) {
        hatalar.push(`${baglam}.${alan} bos olmayan metin olmalidir.`);
      }
    }
    if (!SINIFLAR.has(invariant.sinif)) {
      hatalar.push(`${baglam}.sinif desteklenen invariant siniflarindan biri olmalidir.`);
    }
    if (!DOGRULAMA_YONTEMLERI.has(invariant.dogrulamaYontemi)) {
      hatalar.push(`${baglam}.dogrulamaYontemi desteklenen yontemlerden biri olmalidir.`);
    }
    if (invariant.testKimligi !== `TEST-${kimlik}`) {
      hatalar.push(`${baglam}.testKimligi TEST-${baglam} olmalidir.`);
    }
    hatalar.push(...kaynakHatalari(invariant.kaynaklar, baglam));
    if (!ONEM_SEVIYELERI.has(invariant.onem)) {
      hatalar.push(`${baglam}.onem HIGH veya CRITICAL olmalidir.`);
    }
    if (typeof invariant.humanGate !== "boolean") {
      hatalar.push(`${baglam}.humanGate boolean olmalidir.`);
    }
    const manifest = kendiDegeri(KANONIK_MANIFEST, kimlik);
    if (
      manifest &&
      (invariant.onem !== manifest.onem || invariant.humanGate !== manifest.humanGate)
    ) {
      hatalar.push(
        `${baglam} manifestteki ${manifest.onem}/humanGate=${manifest.humanGate} degerinden sapamaz.`,
      );
    }
  }
  return hatalar;
}

export function kurallariDogrula(kayitDefteri, kurallar) {
  if (kayitDefteriniDogrula(kayitDefteri).length > 0) {
    return ["Kurallar gecerli kayit defteri olmadan dogrulanamaz."];
  }
  if (!nesneMi(kurallar)) return ["Kural dosyasi duz JSON nesnesi olmalidir."];
  const kimlikler = kayitDefteri.invariantlar.map(({ kimlik }) => kimlik);
  const hatalar = [];
  if (!ayniSiraMi(Object.keys(kurallar), kimlikler)) {
    hatalar.push("Kural kimlikleri kayit defteriyle ayni sirada birebir olmalidir.");
  }
  for (const kimlik of kimlikler) {
    if (!kuralGecerliMi(kendiDegeri(kurallar, kimlik))) {
      hatalar.push(`${kimlik} kurali yalniz tanimli bir predikat adini tasimalidir.`);
    }
  }
  return hatalar;
}

// Kural yalniz `{ "kural": "<predikat>" }` bicimindedir. Bilinmeyen predikat,
// ek alan veya bozuk domain girdisi BILINMIYOR olur; kapi bunu BLOCKED yapar.
export function fixtureyiDegerlendir(kural, girdi) {
  if (!kuralGecerliMi(kural)) return KANIT_DURUMLARI.BILINMIYOR;
  const sonuc = kuraliUygula(kural.kural, girdi);
  if (sonuc === true) return KANIT_DURUMLARI.KANITLANDI;
  if (sonuc === false) return KANIT_DURUMLARI.IHLAL;
  return KANIT_DURUMLARI.BILINMIYOR;
}

// Her kural kendi pozitif orneklerini KANITLANDI, ihlal orneklerini IHLAL
// olarak siniflandirmalidir; aksi halde kural Test Oracle olarak guvenilmez.
export function ornekleriDogrula(kayitDefteri, kurallar, ornekler) {
  if (kurallariDogrula(kayitDefteri, kurallar).length > 0) {
    return ["Ornekler gecerli kayit defteri ve kurallar olmadan dogrulanamaz."];
  }
  if (!nesneMi(ornekler)) return ["Ornek dosyasi duz JSON nesnesi olmalidir."];
  const kimlikler = kayitDefteri.invariantlar.map(({ kimlik }) => kimlik);
  const hatalar = [];
  if (!ayniSiraMi(Object.keys(ornekler), kimlikler)) {
    hatalar.push("Ornek kimlikleri kayit defteriyle ayni sirada birebir olmalidir.");
  }
  for (const kimlik of kimlikler) {
    const ornek = kendiDegeri(ornekler, kimlik);
    const gecerli = kendiDegeri(ornek, "gecerli");
    const ihlal = kendiDegeri(ornek, "ihlal");
    if (
      !nesneMi(ornek)
      || fazlaAlanlar(ornek, ["gecerli", "ihlal"], kimlik).length > 0
      || !Array.isArray(gecerli)
      || gecerli.length === 0
      || !Array.isArray(ihlal)
      || ihlal.length === 0
    ) {
      hatalar.push(`${kimlik} en az bir gecerli ve bir ihlal ornegi tasimalidir.`);
      continue;
    }
    const kural = kurallar[kimlik];
    for (const [sira, girdi] of gecerli.entries()) {
      const durum = fixtureyiDegerlendir(kural, girdi);
      if (durum !== KANIT_DURUMLARI.KANITLANDI) {
        hatalar.push(`${kimlik} gecerli[${sira}] ${durum} uretti.`);
      }
    }
    for (const [sira, girdi] of ihlal.entries()) {
      const durum = fixtureyiDegerlendir(kural, girdi);
      if (durum !== KANIT_DURUMLARI.IHLAL) {
        hatalar.push(`${kimlik} ihlal[${sira}] ${durum} uretti.`);
      }
    }
  }
  return hatalar;
}

export function normatifKaynakParitesiniDogrula(markdown, kayitDefteri) {
  if (!doluMetinMi(markdown)) return ["Normatif Markdown bos olmayan metin olmalidir."];
  if (kayitDefteriniDogrula(kayitDefteri).length > 0) {
    return ["Markdown paritesi gecerli kayit defteri olmadan dogrulanamaz."];
  }
  const kimlikler = kayitDefteri.invariantlar.map(({ kimlik }) => kimlik);
  const kayitli = new Set(kimlikler);
  const hatalar = [];
  const basliklar = [];

  for (const [sira, satir] of markdown.split(/\r?\n/).entries()) {
    const tokenlar = invariantTokenlari(satir);
    for (const token of tokenlar) {
      if (!kayitli.has(token)) hatalar.push(`satir ${sira + 1}: ${token} kayit defterinde yok.`);
    }
    if (tokenlar.length === 0 || !/^\s*#/.test(satir)) continue;
    const eslesme = MARKDOWN_BASLIGI.exec(satir);
    if (!eslesme || tokenlar.length !== 1) {
      hatalar.push(`satir ${sira + 1}: invariant basligi "### \`INV-<ALAN>-NNN\` — <ad>" olmalidir.`);
    } else {
      basliklar.push(eslesme[1]);
    }
  }
  if (!ayniSiraMi(basliklar, kimlikler)) {
    hatalar.push("Markdown invariant basliklari kayit defteriyle ayni sirada birebir olmalidir.");
  }
  return hatalar;
}

// Kabul edilmis guvenlik riski yalniz gelistirme bagimliligi kapsaminda,
// duzeltilmemis olarak ve `sonGecerlilik` gununden (UTC) once tasinabilir.
// O gun ve sonrasinda istisna gecersizdir; yeniden inceleme zorunludur.
export function riskIstisnalariniDogrula(riskIstisnalari, bugun) {
  if (!takvimGunuMu(bugun)) return { hatalar: ["bugun YYYY-MM-DD takvim gunu olmalidir."], dolanlar: [] };
  if (!nesneMi(riskIstisnalari)) {
    return { hatalar: ["Risk istisna dosyasi okunamadi veya JSON nesnesi degil."], dolanlar: [] };
  }
  const hatalar = fazlaAlanlar(riskIstisnalari, RISK_KOK_ALANLARI, "risk istisnalari");
  const dolanlar = [];
  const surum = kendiDegeri(riskIstisnalari, "surum");
  if (!Number.isSafeInteger(surum) || surum < 1) {
    hatalar.push("risk istisnalari surumu pozitif bir tam sayi olmalidir.");
  }
  const riskler = kendiDegeri(riskIstisnalari, "riskler");
  if (!Array.isArray(riskler)) return { hatalar: [...hatalar, "riskler dizi olmalidir."], dolanlar };

  const kimlikler = riskler.map((risk) => kendiDegeri(risk, "kimlik"));
  if (new Set(kimlikler).size !== kimlikler.length) hatalar.push("risk kimlikleri tekrar edemez.");
  for (const [sira, risk] of riskler.entries()) {
    const kimlik = kendiDegeri(risk, "kimlik");
    const baglam = doluMetinMi(kimlik) ? kimlik : `risk:${sira}`;
    if (!nesneMi(risk)) {
      hatalar.push(`${baglam} duz JSON nesnesi olmalidir.`);
      continue;
    }
    hatalar.push(...fazlaAlanlar(risk, RISK_ALANLARI, baglam));
    for (const alan of RISK_ALANLARI) {
      if (!Object.hasOwn(risk, alan)) hatalar.push(`${baglam}.${alan} zorunludur.`);
    }
    if (typeof kimlik !== "string" || !GHSA_DESENI.test(kimlik)) {
      hatalar.push(`${baglam}.kimlik GHSA-xxxx-xxxx-xxxx olmalidir.`);
    }
    for (const alan of ["paket", "gerekce", "telafiEdiciKontrol"]) {
      if (!doluMetinMi(risk[alan])) hatalar.push(`${baglam}.${alan} bos olmayan metin olmalidir.`);
    }
    if (!BILESENLER.has(risk.bilesen)) hatalar.push(`${baglam}.bilesen bilinen bir bilesen olmalidir.`);
    if (risk.kapsam !== "GELISTIRME_BAGIMLILIGI") {
      hatalar.push(`${baglam}.kapsam yalniz GELISTIRME_BAGIMLILIGI olabilir.`);
    }
    if (risk.durum !== RISK_ISTISNASI_DURUMU || risk.duzeltildi !== false) {
      hatalar.push(`${baglam} duzeltilmemis ${RISK_ISTISNASI_DURUMU} olarak kalmalidir.`);
    }
    if (typeof risk.kaynak !== "string" || !IS_KIMLIGI_DESENI.test(risk.kaynak)) {
      hatalar.push(`${baglam}.kaynak TBP-n olmalidir.`);
    }
    if (!takvimGunuMu(risk.sonGecerlilik)) {
      hatalar.push(`${baglam}.sonGecerlilik YYYY-MM-DD takvim gunu olmalidir.`);
    } else if (bugun >= risk.sonGecerlilik) {
      dolanlar.push(`${baglam} ${risk.sonGecerlilik} tarihinde suresi doldu; yeniden inceleme zorunlu.`);
    }
  }
  return { hatalar, dolanlar };
}

// Kayit defteri/uygunluk modu: kayit defteri, kurallar, kural ornekleri,
// normatif Markdown paritesi ve kabul edilmis risklerin suresi birlikte gecmelidir.
export function uygunluguDogrula(kaynaklar, bugun) {
  const kaynak = (alan) => kendiDegeri(kaynaklar, alan);
  const kayitDefteri = kaynak("kayitDefteri");
  const bulgular = [];
  const ekle = (nedenKodu, hatalar) => {
    for (const ayrinti of hatalar) bulgular.push({ invariantKimligi: null, nedenKodu, ayrinti });
  };
  const kayitHatalari = kayitDefteriniDogrula(kayitDefteri);
  ekle("INVARIANT_KAYIT_DEFTERI_GECERSIZ", kayitHatalari);
  if (kayitHatalari.length === 0) {
    const kuralHatalari = kurallariDogrula(kayitDefteri, kaynak("kurallar"));
    ekle("INVARIANT_KURALLARI_GECERSIZ", kuralHatalari);
    if (kuralHatalari.length === 0) {
      ekle(
        "INVARIANT_ORNEKLERI_GECERSIZ",
        ornekleriDogrula(kayitDefteri, kaynak("kurallar"), kaynak("ornekler")),
      );
    }
    ekle(
      "INVARIANT_MARKDOWN_PARITESI_BOZUK",
      normatifKaynakParitesiniDogrula(kaynak("markdown"), kayitDefteri),
    );
  }
  const riskIstisnalari = kaynak("riskIstisnalari");
  const { hatalar, dolanlar } = riskIstisnalariniDogrula(riskIstisnalari, bugun);
  ekle("RISK_ISTISNASI_GECERSIZ", hatalar);
  ekle("RISK_ISTISNASI_SURESI_DOLDU", dolanlar);

  const kabulEdilmisRiskler = hatalar.length === 0 && dolanlar.length === 0
    ? riskIstisnalari.riskler.map(({ kimlik, paket, bilesen, kapsam, durum, duzeltildi, sonGecerlilik }) =>
      ({ kimlik, paket, bilesen, kapsam, durum, duzeltildi, sonGecerlilik }))
    : [];
  return {
    sonuc: bulgular.length === 0 ? "ACCEPTED" : "BLOCKED",
    bulgular,
    kabulEdilmisRiskler,
  };
}

// Is kalemi modu: yalniz ilgili invariantlar icin, ayni is ve ayni yurutmede
// uretilmis gozlem kaniti degerlendirilir. Kapi beyan edilen sonuca guvenmez;
// gozlemi kayitli semantik kurala uygulayarak kendisi KANITLANDI/IHLAL karar verir.
export function invariantKanitlariniDegerlendir(girdi, kaynaklar = kanonikKaynaklariOku()) {
  const kayitDefteri = kendiDegeri(kaynaklar, "kayitDefteri");
  const kurallar = kendiDegeri(kaynaklar, "kurallar");
  const kayitHatalari = kayitDefteriniDogrula(kayitDefteri);
  if (kayitHatalari.length > 0) return engelli(kayitHatalari, "INVARIANT_KAYIT_DEFTERI_GECERSIZ");
  const kuralHatalari = kurallariDogrula(kayitDefteri, kurallar);
  if (kuralHatalari.length > 0) return engelli(kuralHatalari, "INVARIANT_KURALLARI_GECERSIZ");

  const isKimligi = kendiDegeri(girdi, "isKimligi");
  const calistirmaKimligi = kendiDegeri(girdi, "calistirmaKimligi");
  const ilgiliInvariantlar = kendiDegeri(girdi, "ilgiliInvariantlar");
  const baglamBulgulari = [];
  if (!nesneMi(girdi) || typeof isKimligi !== "string" || !IS_KIMLIGI_DESENI.test(isKimligi)) {
    baglamBulgulari.push(bulgu(null, "INVARIANT_IS_KIMLIGI_GECERSIZ"));
  }
  if (typeof calistirmaKimligi !== "string" || !CALISTIRMA_KIMLIGI_DESENI.test(calistirmaKimligi)) {
    baglamBulgulari.push(bulgu(null, "INVARIANT_CALISTIRMA_KIMLIGI_GECERSIZ"));
  }
  if (
    !Array.isArray(ilgiliInvariantlar)
    || ilgiliInvariantlar.length === 0
    || ilgiliInvariantlar.some((kimlik) => typeof kimlik !== "string")
    || new Set(ilgiliInvariantlar).size !== ilgiliInvariantlar.length
  ) {
    baglamBulgulari.push(bulgu(null, "INVARIANT_ILGILI_LISTESI_GECERSIZ"));
  }
  if (baglamBulgulari.length > 0) return { sonuc: "BLOCKED", bulgular: baglamBulgulari };

  const kayitlar = new Map(kayitDefteri.invariantlar.map((invariant) => [invariant.kimlik, invariant]));
  const ilgili = new Set(ilgiliInvariantlar);
  const kanitlar = kendiDegeri(girdi, "kanitlar");
  const kanitNesnesi = nesneMi(kanitlar) ? kanitlar : {};
  const baglam = { isKimligi, calistirmaKimligi, kurallar };
  const bulgular = [];

  for (const kimlik of ilgiliInvariantlar) {
    const invariant = kayitlar.get(kimlik);
    if (!invariant) {
      bulgular.push(bulgu(kimlik, "INVARIANT_KAYDI_BULUNAMADI"));
      continue;
    }
    const sonuc = kanitBulgusu(invariant, kendiDegeri(kanitNesnesi, kimlik), baglam);
    if (sonuc) bulgular.push(bulgu(kimlik, sonuc.nedenKodu, sonuc.ayrinti));
  }
  for (const kimlik of Object.keys(kanitNesnesi)) {
    if (!ilgili.has(kimlik)) {
      bulgular.push(bulgu(
        kimlik,
        kayitlar.has(kimlik) ? "INVARIANT_KANITI_ILGISIZ" : "INVARIANT_KAYDI_BULUNAMADI",
      ));
    }
  }

  return bulgular.length === 0
    ? { sonuc: "ACCEPTED", bulgular: [] }
    : { sonuc: "BLOCKED", bulgular };
}

function kanitBulgusu(invariant, kanit, { isKimligi, calistirmaKimligi, kurallar }) {
  if (kanit === undefined) return { nedenKodu: "INVARIANT_KANITI_EKSIK" };
  if (
    !nesneMi(kanit)
    || fazlaAlanlar(kanit, KANIT_ALANLARI, "kanit").length > 0
    || ZORUNLU_KANIT_ALANLARI.some((alan) => !Object.hasOwn(kanit, alan))
  ) {
    return { nedenKodu: "INVARIANT_KANITI_GECERSIZ" };
  }
  if (kanit.testKimligi !== invariant.testKimligi) {
    return { nedenKodu: "INVARIANT_TEST_KIMLIGI_UYUSMUYOR", ayrinti: metinVeyaNull(kanit.testKimligi) };
  }
  if (kanit.isKimligi !== isKimligi || kanit.calistirmaKimligi !== calistirmaKimligi) {
    return { nedenKodu: "INVARIANT_KANITI_ESKI" };
  }
  const durum = fixtureyiDegerlendir(kurallar[invariant.kimlik], kanit.gozlem);
  if (durum === KANIT_DURUMLARI.IHLAL) return { nedenKodu: "INVARIANT_IHLALI" };
  if (durum !== KANIT_DURUMLARI.KANITLANDI) return { nedenKodu: "INVARIANT_KANITI_BILINMIYOR" };
  if (!invariant.humanGate) return null;
  const humanGate = kendiDegeri(kanit, "humanGate");
  if (humanGate === undefined || humanGate === null) {
    return { nedenKodu: "INVARIANT_HUMAN_GATE_EKSIK" };
  }
  if (!humanGateGecerliMi(humanGate, invariant.kimlik, isKimligi)) {
    return { nedenKodu: "INVARIANT_HUMAN_GATE_GECERSIZ" };
  }
  return null;
}

// CRITICAL onay, degerlendirilen ise ve invariant'a bagli, insan tarafindan
// verilmis, zaman damgali ve kalici bir kanit referansina dayanmalidir.
function humanGateGecerliMi(onay, invariantKimligi, isKimligi) {
  return nesneMi(onay)
    && fazlaAlanlar(onay, HUMAN_GATE_ALANLARI, "humanGate").length === 0
    && onay.durum === HUMAN_GATE_DURUMLARI.ONAYLANDI
    && onay.invariantKimligi === invariantKimligi
    && onay.isKimligi === isKimligi
    && insanOnaylayanMi(onay.onaylayan)
    && isoZamanMi(onay.zaman)
    && kaliciKanitReferansiMi(onay.kanit);
}

function kaliciKanitReferansiMi(deger) {
  const adres = typeof deger === "string" ? URL.parse(deger) : null;
  return adres !== null
    && adres.href === deger
    && adres.protocol === "https:"
    && adres.username === ""
    && adres.password === ""
    && adres.pathname !== "/";
}

function kuralGecerliMi(kural) {
  return nesneMi(kural)
    && fazlaAlanlar(kural, ["kural"], "kural").length === 0
    && kuralTanimliMi(kural.kural);
}

function kaynakHatalari(kaynaklar, baglam) {
  if (!Array.isArray(kaynaklar) || kaynaklar.length === 0) {
    return [`${baglam}.kaynaklar en az bir kaynak tasiyan dizi olmalidir.`];
  }
  const hatalar = [];
  for (const kaynak of kaynaklar) {
    if (typeof kaynak !== "string" || !KAYNAK_DESENI.test(kaynak)) {
      hatalar.push(`${baglam}.kaynaklar TBP-n, ADR-NNN veya SOT-XXX-NNN olmalidir: ${String(kaynak)}`);
    }
  }
  if (new Set(kaynaklar).size !== kaynaklar.length) {
    hatalar.push(`${baglam}.kaynaklar tekrar tasiyamaz.`);
  }
  return hatalar;
}

function takvimGunuMu(deger) {
  return typeof deger === "string"
    && /^\d{4}-\d{2}-\d{2}$/.test(deger)
    && isoZamanMi(`${deger}T00:00:00Z`);
}

function engelli(hatalar, nedenKodu) {
  return {
    sonuc: "BLOCKED",
    bulgular: hatalar.map((ayrinti) => bulgu(null, nedenKodu, ayrinti)),
  };
}

function bulgu(invariantKimligi, nedenKodu, ayrinti = null) {
  return { invariantKimligi, nedenKodu, ayrinti };
}

function fazlaAlanlar(nesne, izinliAlanlar, baglam) {
  return Object.keys(nesne)
    .filter((alan) => !izinliAlanlar.includes(alan))
    .map((alan) => `${baglam}.${alan} tanimli bir alan degildir.`);
}

function invariantTokenlari(metin) {
  return [...metin.matchAll(/(?<![A-Za-z0-9-])INV-[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*/g)]
    .map(([token]) => token);
}

function ayniSiraMi(sol, sag) {
  return sol.length === sag.length && sol.every((deger, sira) => deger === sag[sira]);
}

function metinVeyaNull(deger) {
  return doluMetinMi(deger) ? deger : null;
}
