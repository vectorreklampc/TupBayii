import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

import { riskiDegerlendir } from "./risk-degerlendirme-motoru.mjs";

export const CANLI_HATA_DURUMLARI = Object.freeze({
  PAKETLENDI: "PAKETLENDI",
  JIRA_BUG_HAZIR: "JIRA_BUG_HAZIR",
  BAGIMSIZ_TEST_GECTI: "BAGIMSIZ_TEST_GECTI",
  CODEX_ONAYLADI: "CODEX_ONAYLADI",
  STAGING_SMOKE_GECTI: "STAGING_SMOKE_GECTI",
  INSAN_ONAYI_VERILDI: "INSAN_ONAYI_VERILDI",
  PRODUCTION_DOGRULANDI: "PRODUCTION_DOGRULANDI",
});

const TELEMETRY_ALANLARI = new Set([
  "olayKimligi",
  "sinyalTuru",
  "olayAdi",
  "seviye",
  "bilesen",
  "girisNoktasi",
  "islem",
  "sonucKodu",
  "traceKimligi",
  "spanKimligi",
  "ustSpanKimligi",
  "korelasyonKimligi",
  "nedenKimligi",
  "isAnahtari",
  "releaseKimligi",
  "commitKimligi",
  "deploymentKimligi",
  "sureMilisaniye",
  "zamanDamgasi",
]);
const SINYAL_TURLERI = new Set(["LOG", "SPAN", "METRIC"]);
const SEVIYELER = new Set(["DEBUG", "INFO", "WARN", "ERROR"]);
const JIRA_KIMLIGI = /^TBP-[1-9][0-9]*$/;
const TEST_KIMLIGI = /^TEST-[A-Z0-9][A-Z0-9-]*$/;
const INVARIANT_KIMLIGI = /^INV-[A-Z0-9][A-Z0-9-]*$/;
const TRIAGE_ALANLARI = new Set([
  "paketKimligi",
  "ozet",
  "yenidenUretmeTestKimligi",
  "riskEtiketleri",
  "invariantKimlikleri",
]);

const GECISLER = new Map([
  [CANLI_HATA_DURUMLARI.JIRA_BUG_HAZIR, new Set([
    CANLI_HATA_DURUMLARI.BAGIMSIZ_TEST_GECTI,
  ])],
  [CANLI_HATA_DURUMLARI.BAGIMSIZ_TEST_GECTI, new Set([
    CANLI_HATA_DURUMLARI.CODEX_ONAYLADI,
  ])],
  [CANLI_HATA_DURUMLARI.CODEX_ONAYLADI, new Set([
    CANLI_HATA_DURUMLARI.STAGING_SMOKE_GECTI,
  ])],
  [CANLI_HATA_DURUMLARI.STAGING_SMOKE_GECTI, new Set([
    CANLI_HATA_DURUMLARI.INSAN_ONAYI_VERILDI,
    CANLI_HATA_DURUMLARI.PRODUCTION_DOGRULANDI,
  ])],
  [CANLI_HATA_DURUMLARI.INSAN_ONAYI_VERILDI, new Set([
    CANLI_HATA_DURUMLARI.PRODUCTION_DOGRULANDI,
  ])],
]);

export class GozlemlenebilirlikHatasi extends Error {
  constructor(kod, mesaj) {
    super(mesaj);
    this.name = "GozlemlenebilirlikHatasi";
    this.kod = kod;
  }
}

export class GozlemlenebilirlikDeposu {
  #veritabani;

  constructor(veritabaniYolu) {
    doluMetinDogrula(veritabaniYolu, "veritabaniYolu");
    this.#veritabani = new DatabaseSync(veritabaniYolu);
    this.#veritabani.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
    this.#semayiOlustur();
  }

  kaydet(girdi) {
    const kayit = telemetryDogrula(girdi);
    if (this.#olayVarMi(kayit.olayKimligi)) {
      throw new GozlemlenebilirlikHatasi(
        "TELEMETRY_EVENT_DUPLICATE",
        "Telemetry olayi daha once kaydedilmis.",
      );
    }
    if (kayit.ustSpanKimligi && !this.#spanVarMi(kayit.traceKimligi, kayit.ustSpanKimligi)) {
      throw new GozlemlenebilirlikHatasi(
        "TELEMETRY_PARENT_SPAN_NOT_FOUND",
        "Ust span ayni trace icinde bulunamadi.",
      );
    }

    this.#veritabani.prepare(`
      INSERT INTO telemetry_kayitlari (
        olay_kimligi, sinyal_turu, olay_adi, seviye, bilesen, giris_noktasi,
        islem, sonuc_kodu, trace_kimligi, span_kimligi, ust_span_kimligi,
        korelasyon_kimligi, neden_kimligi, is_anahtari, release_kimligi,
        commit_kimligi, deployment_kimligi, sure_milisaniye, zaman_damgasi
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      kayit.olayKimligi,
      kayit.sinyalTuru,
      kayit.olayAdi,
      kayit.seviye,
      kayit.bilesen,
      kayit.girisNoktasi,
      kayit.islem,
      kayit.sonucKodu,
      kayit.traceKimligi,
      kayit.spanKimligi,
      kayit.ustSpanKimligi,
      kayit.korelasyonKimligi,
      kayit.nedenKimligi,
      kayit.isAnahtari,
      kayit.releaseKimligi,
      kayit.commitKimligi,
      kayit.deploymentKimligi,
      kayit.sureMilisaniye,
      kayit.zamanDamgasi,
    );
    return { ...kayit };
  }

  izGetir(traceKimligi) {
    doluMetinDogrula(traceKimligi, "traceKimligi");
    const kayitlar = this.#veritabani.prepare(`
      SELECT
        olay_kimligi AS olayKimligi,
        sinyal_turu AS sinyalTuru,
        olay_adi AS olayAdi,
        seviye,
        bilesen,
        giris_noktasi AS girisNoktasi,
        islem,
        sonuc_kodu AS sonucKodu,
        trace_kimligi AS traceKimligi,
        span_kimligi AS spanKimligi,
        ust_span_kimligi AS ustSpanKimligi,
        korelasyon_kimligi AS korelasyonKimligi,
        neden_kimligi AS nedenKimligi,
        is_anahtari AS isAnahtari,
        release_kimligi AS releaseKimligi,
        commit_kimligi AS commitKimligi,
        deployment_kimligi AS deploymentKimligi,
        sure_milisaniye AS sureMilisaniye,
        zaman_damgasi AS zamanDamgasi
      FROM telemetry_kayitlari
      WHERE trace_kimligi = ?
      ORDER BY zaman_damgasi, id
    `).all(traceKimligi).map((kayit) => ({ ...kayit }));

    return {
      traceKimligi,
      kayitlar,
      referanslar: {
        isAnahtarlari: tekilSirali(kayitlar.map(({ isAnahtari }) => isAnahtari)),
        releaseKimlikleri: tekilSirali(kayitlar.map(({ releaseKimligi }) => releaseKimligi)),
        commitKimlikleri: tekilSirali(kayitlar.map(({ commitKimligi }) => commitKimligi)),
        deploymentKimlikleri: tekilSirali(kayitlar.map(({ deploymentKimligi }) => deploymentKimligi)),
      },
    };
  }

  redOzetiGetir({ bilesen, islem }) {
    doluMetinDogrula(bilesen, "bilesen");
    doluMetinDogrula(islem, "islem");
    const kayitlar = this.#veritabani.prepare(`
      SELECT seviye, sure_milisaniye AS sureMilisaniye
      FROM telemetry_kayitlari
      WHERE sinyal_turu = 'METRIC'
        AND olay_adi = 'request_completed'
        AND bilesen = ?
        AND islem = ?
      ORDER BY sure_milisaniye
    `).all(bilesen, islem);
    const sureler = kayitlar.map(({ sureMilisaniye }) => sureMilisaniye);
    const hataSayisi = kayitlar.filter(({ seviye }) => seviye === "ERROR").length;
    return {
      istekSayisi: kayitlar.length,
      hataSayisi,
      hataOrani: kayitlar.length === 0 ? 0 : hataSayisi / kayitlar.length,
      p50Milisaniye: yuzdelik(sureler, 0.5),
      p95Milisaniye: yuzdelik(sureler, 0.95),
      p99Milisaniye: yuzdelik(sureler, 0.99),
    };
  }

  canliHataPaketiOlustur(traceKimligi) {
    const iz = this.izGetir(traceKimligi);
    if (iz.kayitlar.length === 0) {
      throw new GozlemlenebilirlikHatasi(
        "TELEMETRY_TRACE_NOT_FOUND",
        "Diagnostic bundle icin trace bulunamadi.",
      );
    }
    const hataKayitlari = iz.kayitlar.filter(({ seviye }) => seviye === "ERROR");
    if (hataKayitlari.length === 0) {
      throw new GozlemlenebilirlikHatasi(
        "TELEMETRY_ERROR_NOT_FOUND",
        "Diagnostic bundle yalniz hata trace'i icin olusturulabilir.",
      );
    }
    const paketKimligi = `paket-${createHash("sha256")
      .update(`${traceKimligi}:${hataKayitlari.map(({ olayKimligi }) => olayKimligi).join(",")}`)
      .digest("hex")
      .slice(0, 24)}`;
    this.#veritabani.prepare(`
      INSERT OR IGNORE INTO canli_hata_paketleri
        (paket_kimligi, trace_kimligi, durum, hata_kodlari, referanslar, olaylar)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      paketKimligi,
      traceKimligi,
      CANLI_HATA_DURUMLARI.PAKETLENDI,
      JSON.stringify(tekilSirali(hataKayitlari.map(({ sonucKodu }) => sonucKodu))),
      JSON.stringify(iz.referanslar),
      JSON.stringify(iz.kayitlar.map(({
        olayAdi,
        seviye,
        bilesen,
        girisNoktasi,
        islem,
        sonucKodu,
        spanKimligi,
        ustSpanKimligi,
        sureMilisaniye,
        zamanDamgasi,
      }) => ({
        olayAdi,
        seviye,
        bilesen,
        girisNoktasi,
        islem,
        sonucKodu,
        spanKimligi,
        ustSpanKimligi,
        sureMilisaniye,
        zamanDamgasi,
      }))),
    );
    return this.#paketGetir(paketKimligi);
  }

  triageKaydet(girdi) {
    const triage = triageDogrula(girdi);
    const paket = this.#paketSatiriGetir(triage.paketKimligi);
    if (!paket || paket.durum !== CANLI_HATA_DURUMLARI.PAKETLENDI) {
      throw new GozlemlenebilirlikHatasi(
        "FEEDBACK_PACKAGE_NOT_READY",
        "Diagnostic bundle triage icin hazir degil.",
      );
    }
    const risk = riskiDegerlendir({
      baslik: triage.ozet,
      aciklama: "Canli hata duzeltmesi uygulanacak.",
      etiketler: triage.riskEtiketleri,
    });
    const jiraTaslagi = {
      kaynakTraceKimligi: paket.trace_kimligi,
      ozet: triage.ozet,
      yenidenUretmeTestKimligi: triage.yenidenUretmeTestKimligi,
      riskEtiketleri: triage.riskEtiketleri,
      invariantKimlikleri: triage.invariantKimlikleri,
    };

    this.#veritabani.exec("BEGIN IMMEDIATE");
    try {
      this.#veritabani.prepare(`
        UPDATE canli_hata_paketleri
        SET durum = ?, jira_taslagi = ?, insan_kapisi_gerekli = ?
        WHERE paket_kimligi = ?
      `).run(
        CANLI_HATA_DURUMLARI.JIRA_BUG_HAZIR,
        JSON.stringify(jiraTaslagi),
        risk.insanKapisiGerekliMi ? 1 : 0,
        triage.paketKimligi,
      );
      this.#denetimYaz(
        triage.paketKimligi,
        CANLI_HATA_DURUMLARI.PAKETLENDI,
        CANLI_HATA_DURUMLARI.JIRA_BUG_HAZIR,
        triage.yenidenUretmeTestKimligi,
      );
      this.#veritabani.exec("COMMIT");
    } catch (hata) {
      if (this.#veritabani.isTransaction) this.#veritabani.exec("ROLLBACK");
      throw hata;
    }
    return this.#paketGetir(triage.paketKimligi);
  }

  geriBeslemeGecisiUygula(girdi) {
    gecisDogrula(girdi);
    const paket = this.#paketSatiriGetir(girdi.paketKimligi);
    if (!paket) {
      throw new GozlemlenebilirlikHatasi("FEEDBACK_PACKAGE_NOT_FOUND", "Paket bulunamadi.");
    }
    if (!GECISLER.get(paket.durum)?.has(girdi.hedefDurum)) {
      throw new GozlemlenebilirlikHatasi(
        "FEEDBACK_TRANSITION_INVALID",
        "Canli hata geri besleme gecisi tanimli degil.",
      );
    }
    if (
      girdi.hedefDurum === CANLI_HATA_DURUMLARI.PRODUCTION_DOGRULANDI
      && paket.insan_kapisi_gerekli === 1
      && paket.durum !== CANLI_HATA_DURUMLARI.INSAN_ONAYI_VERILDI
    ) {
      throw new GozlemlenebilirlikHatasi(
        "FEEDBACK_HUMAN_GATE_REQUIRED",
        "Kritik duzeltme production oncesi Human Gate gerektirir.",
      );
    }
    this.#veritabani.exec("BEGIN IMMEDIATE");
    try {
      this.#veritabani.prepare(`
        UPDATE canli_hata_paketleri SET durum = ? WHERE paket_kimligi = ?
      `).run(girdi.hedefDurum, girdi.paketKimligi);
      this.#denetimYaz(girdi.paketKimligi, paket.durum, girdi.hedefDurum, girdi.kanitKimligi);
      this.#veritabani.exec("COMMIT");
    } catch (hata) {
      if (this.#veritabani.isTransaction) this.#veritabani.exec("ROLLBACK");
      throw hata;
    }
    return this.#paketGetir(girdi.paketKimligi);
  }

  geriBeslemeDenetiminiListele(paketKimligi) {
    doluMetinDogrula(paketKimligi, "paketKimligi");
    return this.#veritabani.prepare(`
      SELECT
        onceki_durum AS oncekiDurum,
        hedef_durum AS hedefDurum,
        kanit_kimligi AS kanitKimligi
      FROM geri_besleme_denetimi
      WHERE paket_kimligi = ?
      ORDER BY id
    `).all(paketKimligi).map((kayit) => ({ ...kayit }));
  }

  kapat() {
    this.#veritabani.close();
  }

  #olayVarMi(olayKimligi) {
    return Boolean(this.#veritabani
      .prepare("SELECT 1 FROM telemetry_kayitlari WHERE olay_kimligi = ?")
      .get(olayKimligi));
  }

  #spanVarMi(traceKimligi, spanKimligi) {
    return Boolean(this.#veritabani.prepare(`
      SELECT 1 FROM telemetry_kayitlari
      WHERE trace_kimligi = ? AND span_kimligi = ?
    `).get(traceKimligi, spanKimligi));
  }

  #paketSatiriGetir(paketKimligi) {
    return this.#veritabani
      .prepare("SELECT * FROM canli_hata_paketleri WHERE paket_kimligi = ?")
      .get(paketKimligi);
  }

  #paketGetir(paketKimligi) {
    const paket = this.#paketSatiriGetir(paketKimligi);
    return {
      paketKimligi: paket.paket_kimligi,
      traceKimligi: paket.trace_kimligi,
      durum: paket.durum,
      hataKodlari: JSON.parse(paket.hata_kodlari),
      referanslar: JSON.parse(paket.referanslar),
      olaylar: JSON.parse(paket.olaylar),
      jiraTaslagi: paket.jira_taslagi ? JSON.parse(paket.jira_taslagi) : null,
      insanKapisiGerekliMi: paket.insan_kapisi_gerekli === 1,
    };
  }

  #denetimYaz(paketKimligi, oncekiDurum, hedefDurum, kanitKimligi) {
    this.#veritabani.prepare(`
      INSERT INTO geri_besleme_denetimi
        (paket_kimligi, onceki_durum, hedef_durum, kanit_kimligi)
      VALUES (?, ?, ?, ?)
    `).run(paketKimligi, oncekiDurum, hedefDurum, kanitKimligi);
  }

  #semayiOlustur() {
    const durumlar = Object.values(CANLI_HATA_DURUMLARI)
      .map((durum) => `'${durum}'`)
      .join(", ");
    this.#veritabani.exec(`
      CREATE TABLE IF NOT EXISTS telemetry_kayitlari (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        olay_kimligi TEXT NOT NULL UNIQUE,
        sinyal_turu TEXT NOT NULL CHECK (sinyal_turu IN ('LOG', 'SPAN', 'METRIC')),
        olay_adi TEXT NOT NULL,
        seviye TEXT NOT NULL CHECK (seviye IN ('DEBUG', 'INFO', 'WARN', 'ERROR')),
        bilesen TEXT NOT NULL,
        giris_noktasi TEXT NOT NULL,
        islem TEXT NOT NULL,
        sonuc_kodu TEXT NOT NULL,
        trace_kimligi TEXT NOT NULL,
        span_kimligi TEXT NOT NULL,
        ust_span_kimligi TEXT,
        korelasyon_kimligi TEXT NOT NULL,
        neden_kimligi TEXT,
        is_anahtari TEXT,
        release_kimligi TEXT,
        commit_kimligi TEXT,
        deployment_kimligi TEXT,
        sure_milisaniye REAL NOT NULL CHECK (sure_milisaniye >= 0),
        zaman_damgasi TEXT NOT NULL
      ) STRICT;

      CREATE INDEX IF NOT EXISTS ix_telemetry_trace
        ON telemetry_kayitlari (trace_kimligi, zaman_damgasi, id);
      CREATE INDEX IF NOT EXISTS ix_telemetry_red
        ON telemetry_kayitlari (bilesen, islem, sinyal_turu, olay_adi);

      CREATE TRIGGER IF NOT EXISTS telemetry_update_yasak
      BEFORE UPDATE ON telemetry_kayitlari
      BEGIN SELECT RAISE(ABORT, 'TELEMETRY_IMMUTABLE'); END;
      CREATE TRIGGER IF NOT EXISTS telemetry_delete_yasak
      BEFORE DELETE ON telemetry_kayitlari
      BEGIN SELECT RAISE(ABORT, 'TELEMETRY_IMMUTABLE'); END;

      CREATE TABLE IF NOT EXISTS canli_hata_paketleri (
        paket_kimligi TEXT PRIMARY KEY,
        trace_kimligi TEXT NOT NULL UNIQUE,
        durum TEXT NOT NULL CHECK (durum IN (${durumlar})),
        hata_kodlari TEXT NOT NULL,
        referanslar TEXT NOT NULL,
        olaylar TEXT NOT NULL,
        jira_taslagi TEXT,
        insan_kapisi_gerekli INTEGER NOT NULL DEFAULT 0 CHECK (insan_kapisi_gerekli IN (0, 1))
      ) STRICT;

      CREATE TABLE IF NOT EXISTS geri_besleme_denetimi (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        paket_kimligi TEXT NOT NULL,
        onceki_durum TEXT NOT NULL,
        hedef_durum TEXT NOT NULL,
        kanit_kimligi TEXT NOT NULL,
        FOREIGN KEY (paket_kimligi) REFERENCES canli_hata_paketleri (paket_kimligi)
      ) STRICT;
    `);
  }
}

function telemetryDogrula(girdi) {
  if (!nesneMi(girdi)) {
    throw new GozlemlenebilirlikHatasi("TELEMETRY_FIELD_INVALID", "Telemetry kaydi nesne olmalidir.");
  }
  const bilinmeyenAlan = Object.keys(girdi).find((alan) => !TELEMETRY_ALANLARI.has(alan));
  if (bilinmeyenAlan) {
    throw new GozlemlenebilirlikHatasi(
      "TELEMETRY_FIELD_NOT_ALLOWED",
      `${bilinmeyenAlan} telemetry alan listesinde bulunmuyor.`,
    );
  }
  try {
    for (const alan of [
      "olayKimligi", "olayAdi", "bilesen", "girisNoktasi", "islem",
      "sonucKodu", "traceKimligi", "spanKimligi", "korelasyonKimligi",
    ]) {
      doluMetinDogrula(girdi[alan], alan);
    }
    for (const alan of [
      "ustSpanKimligi", "nedenKimligi", "isAnahtari", "releaseKimligi",
      "commitKimligi", "deploymentKimligi",
    ]) {
      istegeBagliMetinDogrula(girdi[alan], alan);
    }
    if (!SINYAL_TURLERI.has(girdi.sinyalTuru) || !SEVIYELER.has(girdi.seviye)) {
      throw new TypeError("sinyalTuru veya seviye gecersiz.");
    }
    if (girdi.isAnahtari !== null && girdi.isAnahtari !== undefined && !JIRA_KIMLIGI.test(girdi.isAnahtari)) {
      throw new TypeError("isAnahtari gecersiz.");
    }
    if (typeof girdi.sureMilisaniye !== "number" || !Number.isFinite(girdi.sureMilisaniye) || girdi.sureMilisaniye < 0) {
      throw new TypeError("sureMilisaniye gecersiz.");
    }
    utcZamanDogrula(girdi.zamanDamgasi);
  } catch (hata) {
    throw new GozlemlenebilirlikHatasi("TELEMETRY_FIELD_INVALID", hata.message);
  }
  return {
    ...girdi,
    ustSpanKimligi: girdi.ustSpanKimligi ?? null,
    nedenKimligi: girdi.nedenKimligi ?? null,
    isAnahtari: girdi.isAnahtari ?? null,
    releaseKimligi: girdi.releaseKimligi ?? null,
    commitKimligi: girdi.commitKimligi ?? null,
    deploymentKimligi: girdi.deploymentKimligi ?? null,
  };
}

function triageDogrula(girdi) {
  try {
    if (!nesneMi(girdi)) throw new TypeError("triage nesne olmalidir.");
    const bilinmeyenAlan = Object.keys(girdi).find((alan) => !TRIAGE_ALANLARI.has(alan));
    if (bilinmeyenAlan) throw new TypeError(`${bilinmeyenAlan} triage alan listesinde bulunmuyor.`);
    doluMetinDogrula(girdi.paketKimligi, "paketKimligi");
    doluMetinDogrula(girdi.ozet, "ozet", 160);
    if (!TEST_KIMLIGI.test(girdi.yenidenUretmeTestKimligi ?? "")) {
      throw new TypeError("yenidenUretmeTestKimligi gecersiz.");
    }
    if (!metinDizisiMi(girdi.riskEtiketleri) || girdi.riskEtiketleri.length === 0) {
      throw new TypeError("riskEtiketleri gecersiz.");
    }
    if (
      !Array.isArray(girdi.invariantKimlikleri)
      || girdi.invariantKimlikleri.length === 0
      || girdi.invariantKimlikleri.some((kimlik) => !INVARIANT_KIMLIGI.test(kimlik))
    ) {
      throw new TypeError("invariantKimlikleri gecersiz.");
    }
  } catch (hata) {
    throw new GozlemlenebilirlikHatasi("FEEDBACK_TRIAGE_INVALID", hata.message);
  }
  return {
    paketKimligi: girdi.paketKimligi,
    ozet: girdi.ozet,
    yenidenUretmeTestKimligi: girdi.yenidenUretmeTestKimligi,
    riskEtiketleri: [...new Set(girdi.riskEtiketleri)].sort(),
    invariantKimlikleri: [...new Set(girdi.invariantKimlikleri)].sort(),
  };
}

function gecisDogrula(girdi) {
  if (!nesneMi(girdi)) {
    throw new GozlemlenebilirlikHatasi("FEEDBACK_TRANSITION_INVALID", "Gecis nesne olmalidir.");
  }
  try {
    doluMetinDogrula(girdi.paketKimligi, "paketKimligi");
    doluMetinDogrula(girdi.hedefDurum, "hedefDurum");
    doluMetinDogrula(girdi.kanitKimligi, "kanitKimligi");
  } catch (hata) {
    throw new GozlemlenebilirlikHatasi("FEEDBACK_TRANSITION_INVALID", hata.message);
  }
}

function doluMetinDogrula(deger, alan, ustSinir = 256) {
  if (typeof deger !== "string" || deger.trim() === "" || deger.length > ustSinir) {
    throw new TypeError(`${alan} bos olmayan ve en fazla ${ustSinir} karakterlik metin olmalidir.`);
  }
}

function istegeBagliMetinDogrula(deger, alan) {
  if (deger !== null && deger !== undefined) doluMetinDogrula(deger, alan);
}

function utcZamanDogrula(deger) {
  doluMetinDogrula(deger, "zamanDamgasi");
  const zaman = new Date(deger);
  if (Number.isNaN(zaman.getTime()) || zaman.toISOString() !== deger) {
    throw new TypeError("zamanDamgasi kanonik UTC ISO-8601 biciminde olmalidir.");
  }
}

function yuzdelik(siraliDegerler, oran) {
  if (siraliDegerler.length === 0) return null;
  return siraliDegerler[Math.ceil(siraliDegerler.length * oran) - 1];
}

function tekilSirali(degerler) {
  return [...new Set(degerler.filter((deger) => deger !== null && deger !== undefined))].sort();
}

function metinDizisiMi(deger) {
  return Array.isArray(deger)
    && deger.every((oge) => typeof oge === "string" && oge.trim() !== "" && oge.length <= 128);
}

function nesneMi(deger) {
  return deger !== null && typeof deger === "object" && !Array.isArray(deger);
}
