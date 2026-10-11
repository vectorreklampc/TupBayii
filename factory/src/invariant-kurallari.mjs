// TBP-233 semantik invariant predikatlari. Her predikat domain bicimli girdiyi
// degerlendirir: true -> invariant korunur, false -> ihlal. Bicim bozuksa
// GirdiHatasi firlatilir ve dispatcher sonucu BILINMIYOR yapar; hicbir predikat
// eksik alani varsayilan olarak gecerli saymaz. Bu predikatlar kapinin
// Test Oracle'idir; urun implementasyonunun uyumunu tek basina kanitlamaz.

class GirdiHatasi extends Error {}

const LOKASYON_TURLERI = new Set(["DEPO", "ARAC", "MUSTERI"]);
const COMMIT_SONUCLARI = new Set(["COMMIT", "ROLLBACK"]);
const SYNC_DURUMLARI = new Set(["PENDING", "STALE", "REJECTED", "CONFLICTED", "SYNCED"]);
const RISK_SEVIYELERI = new Set(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
const KAPI_SONUCLARI = new Set(["PASS", "FAIL", "BILINMIYOR"]);
const RELEASE_ORTAMLARI = new Set(["GELISTIRME", "STAGING", "PRODUCTION"]);
const KRITIK_ISLEM_TURLERI = new Set([
  "PRODUCTION_DEPLOY",
  "DESTRUCTIVE_MIGRATION",
  "RESTORE",
  "TENANT_IZOLASYONU",
  "AUTHENTICATION",
  "PAYMENT_CORE",
]);
const ISLEM_TURLERI = new Set([...KRITIK_ISLEM_TURLERI, "DIGER"]);
const HASSAS_ALANLAR = new Set([
  "sifre",
  "parola",
  "password",
  "token",
  "accesstoken",
  "refreshtoken",
  "secret",
  "clientsecret",
  "apikey",
  "authorization",
  "kartnumarasi",
  "cardnumber",
  "cvv",
]);
const AI_KIMLIK_PARCALARI = new Set([
  "ai",
  "yz",
  "llm",
  "bot",
  "agent",
  "ajan",
  "gpt",
  "chatgpt",
  "claude",
  "codex",
  "openai",
  "anthropic",
  "copilot",
  "gemini",
]);

export function nesneMi(deger) {
  return deger !== null
    && typeof deger === "object"
    && !Array.isArray(deger)
    && Object.getPrototypeOf(deger) === Object.prototype;
}

export function doluMetinMi(deger) {
  return typeof deger === "string" && deger.trim() !== "";
}

export function kendiDegeri(nesne, alan) {
  return nesne !== null && typeof nesne === "object" && Object.hasOwn(nesne, alan)
    ? nesne[alan]
    : undefined;
}

// Kesin ISO 8601 zaman damgasi: saat dilimi zorunlu, takvim tarihi gercek olmali.
export function isoZamanMi(deger) {
  if (typeof deger !== "string") return false;
  const eslesme = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/
    .exec(deger);
  if (!eslesme) return false;
  const [, yil, ay, gun, saat, dakika, saniye] = eslesme.map(Number);
  const takvim = new Date(Date.UTC(yil, ay - 1, gun));
  return takvim.getUTCFullYear() === yil
    && takvim.getUTCMonth() === ay - 1
    && takvim.getUTCDate() === gun
    && saat < 24
    && dakika < 60
    && saniye < 60
    && !Number.isNaN(Date.parse(deger));
}

// Insan onaylayan politikasi: acik `insan:` principal beyani zorunludur ve
// kimlik parcalari bilinen AI/otomasyon kimlikleri olamaz. Bu bir kimlik
// dogrulamasi degildir; gercekligi kalici Human Gate kanit referansi tasir.
export function insanOnaylayanMi(deger) {
  if (typeof deger !== "string") return false;
  const eslesme = /^insan:([A-Za-z0-9][A-Za-z0-9._@:-]{1,127})$/.exec(deger);
  if (!eslesme) return false;
  const parcalar = eslesme[1].toLowerCase().split(/[^a-z0-9]+/);
  return !parcalar.some((parca) => AI_KIMLIK_PARCALARI.has(parca)
    || [...AI_KIMLIK_PARCALARI].some((ad) => ad.length > 3 && parca.includes(ad)));
}

function sart(kosul) {
  if (!kosul) throw new GirdiHatasi();
}

function nesne(deger) {
  sart(nesneMi(deger));
  return deger;
}

function dizi(deger, { bosOlabilir = false } = {}) {
  sart(Array.isArray(deger) && (bosOlabilir || deger.length > 0));
  return deger;
}

function metin(deger) {
  sart(doluMetinMi(deger));
  return deger;
}

function tamSayi(deger) {
  sart(Number.isSafeInteger(deger));
  return deger;
}

function mantiksal(deger) {
  sart(typeof deger === "boolean");
  return deger;
}

function secim(deger, kume) {
  sart(typeof deger === "string" && kume.has(deger));
  return deger;
}

function metinVeyaNull(deger) {
  sart(deger === null || doluMetinMi(deger));
  return deger;
}

function alanlar(girdi, ...adlar) {
  const kayit = nesne(girdi);
  return adlar.map((ad) => kendiDegeri(kayit, ad));
}

function benzersiz(degerler) {
  sart(new Set(degerler).size === degerler.length);
}

function kanonikJson(deger) {
  if (Array.isArray(deger)) return `[${deger.map(kanonikJson).join(",")}]`;
  if (deger !== null && typeof deger === "object") {
    return `{${Object.keys(deger).sort()
      .map((anahtar) => `${JSON.stringify(anahtar)}:${kanonikJson(deger[anahtar])}`)
      .join(",")}}`;
  }
  return JSON.stringify(deger);
}

function lokasyon(deger) {
  const [tur, kimlik] = alanlar(deger, "tur", "kimlik");
  return { tur: secim(tur, LOKASYON_TURLERI), kimlik: metin(kimlik) };
}

function hareketToplami(hareketler, filtre = () => true) {
  return hareketler.filter(filtre).reduce((toplam, { miktar }) => toplam + miktar, 0);
}

const PREDIKATLAR = {
  // INV-TEN-001
  tenantBasinaAyriVeritabani(girdi) {
    const [kayitlar] = alanlar(girdi, "tenantVeritabanlari");
    const ciftler = dizi(kayitlar).map((kayit) => {
      const [tenant, veritabani] = alanlar(kayit, "tenantKimligi", "veritabaniAdi");
      return [metin(tenant), metin(veritabani)];
    });
    benzersiz(ciftler.map(([tenant]) => tenant));
    return new Set(ciftler.map(([, veritabani]) => veritabani)).size === ciftler.length;
  },

  // INV-TEN-002
  masterYalnizControlPlane(girdi) {
    const [varliklar] = alanlar(girdi, "masterVarliklari");
    return dizi(varliklar).every((varlik) => {
      const [ad, sahiplik] = alanlar(varlik, "ad", "sahiplik");
      metin(ad);
      return secim(sahiplik, new Set(["CONTROL_PLANE", "TENANT_IS_VERISI"])) === "CONTROL_PLANE";
    });
  },

  // INV-TEN-003
  tenantSunucuTarafliCozulur(girdi) {
    const [beyan, kimlikTenanti, cozulmus] = alanlar(
      girdi,
      "istekTenantBeyani",
      "dogrulanmisKimlikTenanti",
      "cozulmusTenant",
    );
    metinVeyaNull(beyan);
    return metin(cozulmus) === metin(kimlikTenanti);
  },

  // INV-TEN-004
  tenantBaglamiZorunlu(girdi) {
    const [erisimler] = alanlar(girdi, "erisimler");
    return dizi(erisimler).every((erisim) => {
      const [baglam, sonuc] = alanlar(erisim, "tenantBaglami", "sonuc");
      metinVeyaNull(baglam);
      return secim(sonuc, new Set(["IZIN", "RED"])) === "RED" || baglam !== null;
    });
  },

  // INV-STK-001, INV-FIN-001
  bakiyeHareketlerdenTuretilir(girdi) {
    const [hareketler, bakiye] = alanlar(girdi, "hareketler", "bakiye");
    const liste = dizi(hareketler, { bosOlabilir: true }).map((hareket) => {
      const [miktar] = alanlar(hareket, "miktar");
      return { miktar: tamSayi(miktar) };
    });
    return tamSayi(bakiye) === hareketToplami(liste);
  },

  // INV-STK-002
  fullEmptyAyriTutulur(girdi) {
    const [hareketler, bakiyeler] = alanlar(girdi, "hareketler", "bakiyeler");
    const liste = dizi(hareketler).map((hareket) => {
      const [durum, miktar] = alanlar(hareket, "durum", "miktar");
      return { durum: secim(durum, new Set(["FULL", "EMPTY"])), miktar: tamSayi(miktar) };
    });
    const [full, empty] = alanlar(bakiyeler, "FULL", "EMPTY");
    sart(Object.keys(bakiyeler).length === 2);
    return tamSayi(full) === hareketToplami(liste, ({ durum }) => durum === "FULL")
      && tamSayi(empty) === hareketToplami(liste, ({ durum }) => durum === "EMPTY");
  },

  // INV-STK-003
  fizikselLokasyonAcik(girdi) {
    const [hareketler] = alanlar(girdi, "hareketler");
    return dizi(hareketler).every((hareket) => {
      const [islem, kaynak, hedef] = alanlar(hareket, "islem", "kaynak", "hedef");
      metin(islem);
      const kaynakLokasyon = lokasyon(kaynak);
      const hedefLokasyon = lokasyon(hedef);
      return islem !== "KURYE_TESLIMATI"
        || (kaynakLokasyon.tur === "ARAC" && hedefLokasyon.tur === "MUSTERI");
    });
  },

  // INV-STK-004, INV-FIN-002, INV-AUD-002
  kayitGecmisiKorunur(girdi) {
    const [onceki, sonraki] = alanlar(girdi, "onceki", "sonraki");
    const kimlikli = (liste) => dizi(liste).map((kayit) => {
      const [kimlik] = alanlar(kayit, "kimlik");
      return [metin(kimlik), kayit];
    });
    const oncekiKayitlar = kimlikli(onceki);
    const sonrakiKayitlar = new Map(kimlikli(sonraki));
    benzersiz(oncekiKayitlar.map(([kimlik]) => kimlik));
    sart(sonrakiKayitlar.size === sonraki.length);
    const korunur = oncekiKayitlar.every(([kimlik, kayit]) => sonrakiKayitlar.has(kimlik)
      && kanonikJson(sonrakiKayitlar.get(kimlik)) === kanonikJson(kayit));
    const referanslarGecerli = [...sonrakiKayitlar.values()].every((kayit) => {
      const referans = kendiDegeri(kayit, "referansKimligi");
      return referans === undefined || sonrakiKayitlar.has(metin(referans));
    });
    return korunur && referanslarGecerli;
  },

  // INV-STK-005
  stokEtkisiAtomikVeTutarli(girdi) {
    const [baslangic, talepler, son] = alanlar(girdi, "baslangicStok", "talepler", "sonStok");
    sart(tamSayi(baslangic) >= 0);
    const liste = dizi(talepler).map((talep) => {
      const [kimlik, miktar, sonuc] = alanlar(talep, "talepKimligi", "miktar", "sonuc");
      sart(tamSayi(miktar) > 0);
      return { kimlik: metin(kimlik), miktar, sonuc: secim(sonuc, new Set(["KABUL", "RED"])) };
    });
    benzersiz(liste.map(({ kimlik }) => kimlik));
    const kabul = hareketToplami(liste, ({ sonuc }) => sonuc === "KABUL");
    return kabul <= baslangic && tamSayi(son) === baslangic - kabul;
  },

  // INV-FIN-003
  etkilerBirlikteSonuclanir(girdi) {
    const [etkiler] = alanlar(girdi, "etkiler");
    sart(nesneMi(etkiler) && Object.keys(etkiler).length === 3);
    const sonuclar = alanlar(etkiler, "finans", "stok", "cari")
      .map((sonuc) => secim(sonuc, COMMIT_SONUCLARI));
    return new Set(sonuclar).size === 1;
  },

  // INV-FIN-004
  komutTekEtkiUretir(girdi) {
    const [komutlar, etkiler] = alanlar(girdi, "komutlar", "etkiler");
    const anahtar = (kayit) => {
      const [tenant, idempotency] = alanlar(kayit, "tenantKimligi", "idempotencyAnahtari");
      return `${metin(tenant)}\u0000${metin(idempotency)}`;
    };
    const komutAnahtarlari = new Set(dizi(komutlar).map(anahtar));
    const etkiAnahtarlari = dizi(etkiler, { bosOlabilir: true }).map(anahtar);
    return etkiAnahtarlari.every((etki) => komutAnahtarlari.has(etki))
      && new Set(etkiAnahtarlari).size === etkiAnahtarlari.length;
  },

  // INV-PAY-001
  odemeOtoritesiDogrulanmis(girdi) {
    const [basarili, kaynak, imza, master] = alanlar(
      girdi,
      "odemeBasariliSayildi",
      "kanitKaynagi",
      "webhookImzasiDogrulandi",
      "masterOdemeDurumuOnayli",
    );
    secim(kaynak, new Set(["WEBHOOK", "CLIENT_CALLBACK", "REDIRECT"]));
    mantiksal(imza);
    mantiksal(master);
    return !mantiksal(basarili) || (kaynak === "WEBHOOK" && imza && master);
  },

  // INV-PAY-002
  webhookSiraVeTekrarKorumali(girdi) {
    const [olaylar, sonDurum] = alanlar(girdi, "olaylar", "sonDurum");
    const gorulen = new Set();
    let uygulanan = null;
    for (const olay of dizi(olaylar)) {
      const [kimlik, sira, durum] = alanlar(olay, "olayKimligi", "saglayiciSirasi", "durum");
      metin(kimlik);
      tamSayi(sira);
      metin(durum);
      if (gorulen.has(kimlik)) continue;
      gorulen.add(kimlik);
      if (uygulanan && sira <= uygulanan.sira) continue;
      uygulanan = { sira, durum };
    }
    return metin(sonDurum) === uygulanan.durum;
  },

  // INV-PAY-003
  lisansYalnizOdemeGecisiyle(girdi) {
    const [gecisler, aktivasyonlar] = alanlar(
      girdi,
      "dogrulanmisOdemeGecisleri",
      "lisansAktivasyonlari",
    );
    const dogrulanmis = new Set(dizi(gecisler, { bosOlabilir: true }).map(metin));
    return dizi(aktivasyonlar).every((aktivasyon) => {
      const [lisans, gecis] = alanlar(aktivasyon, "lisansKimligi", "odemeGecisiKimligi");
      metin(lisans);
      return metinVeyaNull(gecis) !== null && dogrulanmis.has(gecis);
    });
  },

  // INV-OFF-001
  sessizSonYazanKazanmaz(girdi) {
    const [catismalar] = alanlar(girdi, "catismalar");
    return dizi(catismalar).every((catisma) => {
      const [etkiAlani, cozum, kayitAltinda] = alanlar(catisma, "etkiAlani", "cozum", "kayitAltinda");
      secim(etkiAlani, new Set(["FINANS", "STOK", "DIGER"]));
      secim(cozum, new Set(["SON_YAZAN_KAZANIR", "CONFLICT_REVIEW", "DOMAIN_POLITIKASI"]));
      mantiksal(kayitAltinda);
      return etkiAlani === "DIGER" || (cozum !== "SON_YAZAN_KAZANIR" && kayitAltinda);
    });
  },

  // INV-OFF-002
  offlineKomutZarfiTam(girdi) {
    const [komutlar] = alanlar(girdi, "komutlar");
    return dizi(komutlar).every((komut) => {
      const [zarf, sonuc] = alanlar(komut, "zarf", "sunucuSonucu");
      nesne(zarf);
      if (secim(sonuc, new Set(["KABUL", "RED"])) === "RED") return true;
      const sira = kendiDegeri(zarf, "sira");
      return ["komutKimligi", "tenantKimligi", "cihazKimligi", "idempotencyAnahtari"]
        .every((alan) => doluMetinMi(kendiDegeri(zarf, alan)))
        && Number.isSafeInteger(sira)
        && sira >= 0;
    });
  },

  // INV-OFF-003
  syncYetkisiYenidenDogrulanir(girdi) {
    const [komutlar] = alanlar(girdi, "komutlar");
    return dizi(komutlar).every((komut) => {
      const [olusturmada, syncAninda, uygulandi] = alanlar(
        komut,
        "olusturmadaYetkili",
        "syncAnindaYetkili",
        "uygulandi",
      );
      mantiksal(olusturmada);
      return !mantiksal(uygulandi) || mantiksal(syncAninda);
    });
  },

  // INV-OFF-004
  syncDurumuGorunur(girdi) {
    const [komutlar] = alanlar(girdi, "komutlar");
    return dizi(komutlar).every((komut) => {
      const [gercek, gosterilen] = alanlar(komut, "syncDurumu", "gosterilenDurum");
      return secim(gercek, SYNC_DURUMLARI) === secim(gosterilen, SYNC_DURUMLARI);
    });
  },

  // INV-AUD-001
  kritikIslemAuditli(girdi) {
    const [islemler, kayitlar] = alanlar(girdi, "kritikIslemler", "auditKayitlari");
    const auditler = dizi(kayitlar, { bosOlabilir: true }).map(nesne);
    return dizi(islemler).every((islem) => {
      const [kimlik] = alanlar(islem, "islemKimligi");
      metin(kimlik);
      return auditler.some((audit) => kendiDegeri(audit, "islemKimligi") === kimlik
        && ["aktor", "tenantKimligi", "korelasyonKimligi"]
          .every((alan) => doluMetinMi(kendiDegeri(audit, alan)))
        && isoZamanMi(kendiDegeri(audit, "zaman")));
    });
  },

  // INV-AUD-003
  hassasVeriYazilmaz(girdi) {
    const [kayitlar] = alanlar(girdi, "kayitlar");
    return dizi(kayitlar).every((kayit) => {
      const [kayitAlanlari] = alanlar(kayit, "alanlar");
      return Object.entries(nesne(kayitAlanlari)).every(([ad, deger]) => {
        const normalAd = ad.toLowerCase().replace(/[^a-z0-9]/g, "");
        const metinDeger = typeof deger === "string" ? deger.trim() : "";
        return !HASSAS_ALANLAR.has(normalAd)
          && !/^bearer\s+\S/i.test(metinDeger)
          && !/^eyJ[\w-]+\.[\w-]+\./.test(metinDeger);
      });
    });
  },

  // INV-AUD-004
  riskliIsOracleIleTamamlanir(girdi) {
    const [isler] = alanlar(girdi, "isler");
    return dizi(isler).every((is) => {
      const [kimlik, risk, durum, oracle] = alanlar(
        is,
        "isKimligi",
        "risk",
        "durum",
        "testOracleKimligi",
      );
      metin(kimlik);
      metin(durum);
      metinVeyaNull(oracle);
      const riskli = ["HIGH", "CRITICAL"].includes(secim(risk, RISK_SEVIYELERI));
      return !(riskli && durum === "TAMAMLANDI") || oracle !== null;
    });
  },

  // INV-AUD-005
  disIstekUctanUcaIzlenebilir(girdi) {
    const [istekler] = alanlar(girdi, "istekler");
    const korelasyonlar = [];
    const kopuksuz = dizi(istekler).every((istek) => {
      const [istekKimligi, korelasyon, adimlar] = alanlar(
        istek,
        "istekKimligi",
        "korelasyonKimligi",
        "adimlar",
      );
      metin(istekKimligi);
      metinVeyaNull(korelasyon);
      const adimListesi = dizi(adimlar).map((adim) => {
        const [bilesen] = alanlar(adim, "bilesen");
        metin(bilesen);
        return kendiDegeri(adim, "korelasyonKimligi");
      });
      korelasyonlar.push(korelasyon);
      return korelasyon !== null && adimListesi.every((kimlik) => kimlik === korelasyon);
    });
    // Farkli dis istekler ayni correlation kimligini paylasirsa iz ayrisamaz.
    return kopuksuz && new Set(korelasyonlar).size === korelasyonlar.length;
  },

  // INV-GOV-001
  kritikIslemHumanGateOnayli(girdi) {
    const [islemler] = alanlar(girdi, "islemler");
    return dizi(islemler).every((islem) => {
      const [tur, calistirildi, onay] = alanlar(islem, "tur", "calistirildi", "humanGateOnayi");
      secim(tur, ISLEM_TURLERI);
      sart(onay === null || nesneMi(onay));
      if (!mantiksal(calistirildi) || !KRITIK_ISLEM_TURLERI.has(tur)) return true;
      return onay !== null
        && insanOnaylayanMi(kendiDegeri(onay, "onaylayan"))
        && isoZamanMi(kendiDegeri(onay, "zaman"))
        && doluMetinMi(kendiDegeri(onay, "kanit"));
    });
  },

  // INV-GOV-002
  invariantDegisikligiYetkili(girdi) {
    const [degisiklikler] = alanlar(girdi, "degisiklikler");
    return dizi(degisiklikler).every((degisiklik) => {
      const [kimlik, tur, kanitlar] = alanlar(
        degisiklik,
        "invariantKimligi",
        "degisiklikTuru",
        "kanitlar",
      );
      metin(kimlik);
      secim(tur, new Set(["EKLEME", "DUZELTME", "GEVSETME", "KALDIRMA"]));
      nesne(kanitlar);
      return ["changeRequest", "etkiVeGeriDonusPlani", "adr", "testKaniti", "humanGate"]
        .every((alan) => doluMetinMi(kendiDegeri(kanitlar, alan)));
    });
  },

  // INV-GOV-003
  releaseKapilariGecmedenYayinYok(girdi) {
    const [releaseler] = alanlar(girdi, "releaseler");
    return dizi(releaseler).every((release) => {
      const [surum, ortam, yayinlandi, kapilar] = alanlar(
        release,
        "surum",
        "ortam",
        "yayinlandi",
        "kapilar",
      );
      metin(surum);
      secim(ortam, RELEASE_ORTAMLARI);
      sart(nesneMi(kapilar) && Object.keys(kapilar).length === 3);
      const sonuclar = alanlar(kapilar, "test", "kabul", "smoke")
        .map((sonuc) => secim(sonuc, KAPI_SONUCLARI));
      return !(mantiksal(yayinlandi) && ortam === "PRODUCTION")
        || sonuclar.every((sonuc) => sonuc === "PASS");
    });
  },
};

export const KURAL_ADLARI = Object.freeze(Object.keys(PREDIKATLAR));

export function kuralTanimliMi(ad) {
  return typeof ad === "string" && Object.hasOwn(PREDIKATLAR, ad);
}

// true: invariant korunur, false: ihlal, null: girdi bilinmiyor/bozuk.
export function kuraliUygula(ad, girdi) {
  if (!kuralTanimliMi(ad)) return null;
  try {
    const sonuc = PREDIKATLAR[ad](girdi);
    return typeof sonuc === "boolean" ? sonuc : null;
  } catch {
    return null;
  }
}
