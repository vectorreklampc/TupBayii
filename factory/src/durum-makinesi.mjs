import { DatabaseSync } from "node:sqlite";

export const DURUMLAR = Object.freeze({
  PLAN_IS_LISTESI: "PLAN_IS_LISTESI",
  HAZIRLIK_KONTROLU: "HAZIRLIK_KONTROLU",
  CODEX_ON_INCELEME: "CODEX_ON_INCELEME",
  CLAUDE_UYGULAMA: "CLAUDE_UYGULAMA",
  BAGIMSIZ_TEST: "BAGIMSIZ_TEST",
  CODEX_SON_INCELEME: "CODEX_SON_INCELEME",
  SENARYO_DOGRULAMA: "SENARYO_DOGRULAMA",
  TAMAMLANDI: "TAMAMLANDI",
  DEGISIKLIK_ISTENDI: "DEGISIKLIK_ISTENDI",
  ENGELLENDI: "ENGELLENDI",
  INSAN_ONAYI_GEREKLI: "INSAN_ONAYI_GEREKLI",
  HATA: "HATA",
});

const HATA_DURUMLARI = Object.freeze([
  DURUMLAR.DEGISIKLIK_ISTENDI,
  DURUMLAR.ENGELLENDI,
  DURUMLAR.INSAN_ONAYI_GEREKLI,
  DURUMLAR.HATA,
]);

export const GECIS_TABLOSU = Object.freeze([
  Object.freeze([
    DURUMLAR.PLAN_IS_LISTESI,
    Object.freeze([DURUMLAR.HAZIRLIK_KONTROLU, ...HATA_DURUMLARI]),
  ]),
  Object.freeze([
    DURUMLAR.HAZIRLIK_KONTROLU,
    Object.freeze([
      DURUMLAR.CODEX_ON_INCELEME,
      DURUMLAR.CLAUDE_UYGULAMA,
      ...HATA_DURUMLARI,
    ]),
  ]),
  Object.freeze([
    DURUMLAR.CODEX_ON_INCELEME,
    Object.freeze([DURUMLAR.CLAUDE_UYGULAMA, ...HATA_DURUMLARI]),
  ]),
  Object.freeze([
    DURUMLAR.CLAUDE_UYGULAMA,
    Object.freeze([DURUMLAR.BAGIMSIZ_TEST, ...HATA_DURUMLARI]),
  ]),
  Object.freeze([
    DURUMLAR.BAGIMSIZ_TEST,
    Object.freeze([DURUMLAR.CODEX_SON_INCELEME, ...HATA_DURUMLARI]),
  ]),
  Object.freeze([
    DURUMLAR.CODEX_SON_INCELEME,
    Object.freeze([DURUMLAR.SENARYO_DOGRULAMA, ...HATA_DURUMLARI]),
  ]),
  Object.freeze([
    DURUMLAR.SENARYO_DOGRULAMA,
    Object.freeze([DURUMLAR.TAMAMLANDI, ...HATA_DURUMLARI]),
  ]),
]);

const GECIS_KUMELERI = new Map(
  GECIS_TABLOSU.map(([kaynak, hedefler]) => [kaynak, new Set(hedefler)]),
);
const DURUM_KUMESI = new Set(Object.values(DURUMLAR));

export function gecisGecerliMi(kaynakDurum, hedefDurum) {
  return GECIS_KUMELERI.get(kaynakDurum)?.has(hedefDurum) ?? false;
}

export class DurumMakinesiHatasi extends Error {
  constructor(kod, mesaj, { mevcutDurum = null, korelasyonKimligi } = {}) {
    super(mesaj);
    this.name = "DurumMakinesiHatasi";
    this.kod = kod;
    this.mevcutDurum = mevcutDurum;
    this.korelasyonKimligi = korelasyonKimligi;
  }
}

export class YazilimFabrikasiDurumMakinesi {
  #veritabani;

  constructor(veritabaniYolu) {
    metinDogrula(veritabaniYolu, "veritabaniYolu");
    this.#veritabani = new DatabaseSync(veritabaniYolu);
    this.#veritabani.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
    this.#semayiOlustur();
  }

  isiBaslat(isAnahtari) {
    metinDogrula(isAnahtari, "isAnahtari");
    this.#veritabani
      .prepare(
        `INSERT OR IGNORE INTO fabrika_isleri (is_anahtari, durum)
         VALUES (?, ?)`,
      )
      .run(isAnahtari, DURUMLAR.PLAN_IS_LISTESI);
    return this.durumGetir(isAnahtari);
  }

  durumGetir(isAnahtari) {
    metinDogrula(isAnahtari, "isAnahtari");
    const kayit = this.#veritabani
      .prepare("SELECT durum FROM fabrika_isleri WHERE is_anahtari = ?")
      .get(isAnahtari);
    return kayit?.durum ?? null;
  }

  denetimKayitlariniListele(isAnahtari) {
    metinDogrula(isAnahtari, "isAnahtari");
    const kayitlar = this.#veritabani
      .prepare(
        `SELECT
           is_anahtari AS isAnahtari,
           onceki_durum AS oncekiDurum,
           hedef_durum AS hedefDurum,
           sonuc,
           neden_kodu AS nedenKodu,
           aktor,
           calistirici,
           deneme,
           korelasyon_kimligi AS korelasyonKimligi,
           zaman_damgasi AS zamanDamgasi
         FROM durum_denetimi
         WHERE is_anahtari = ?
         ORDER BY id`,
      )
      .all(isAnahtari);
    return kayitlar.map((kayit) => ({ ...kayit }));
  }

  gecisUygula(istek) {
    const dogrulanmis = istekDogrula(istek);
    this.#veritabani.exec("BEGIN IMMEDIATE");
    try {
      const oncekiSonuc = this.#idempotencySonucuGetir(dogrulanmis);
      if (oncekiSonuc) {
        if (oncekiSonuc.hedef_durum !== dogrulanmis.hedefDurum) {
          this.#denetimYaz(
            dogrulanmis,
            oncekiSonuc.hedef_durum,
            "RED",
            "FACTORY_STATE_IDEMPOTENCY_CONFLICT",
          );
          this.#veritabani.exec("COMMIT");
          throw new DurumMakinesiHatasi(
            "FACTORY_STATE_IDEMPOTENCY_CONFLICT",
            "Ayni idempotency anahtari farkli bir gecis icin kullanilamaz.",
            {
              mevcutDurum: oncekiSonuc.hedef_durum,
              korelasyonKimligi: dogrulanmis.korelasyonKimligi,
            },
          );
        }

        this.#veritabani.exec("COMMIT");
        return {
          isAnahtari: dogrulanmis.isAnahtari,
          oncekiDurum: oncekiSonuc.onceki_durum,
          durum: oncekiSonuc.hedef_durum,
          tekrar: true,
        };
      }

      const isKaydi = this.#veritabani
        .prepare("SELECT durum FROM fabrika_isleri WHERE is_anahtari = ?")
        .get(dogrulanmis.isAnahtari);

      if (!isKaydi) {
        this.#denetimYaz(dogrulanmis, null, "RED", "FACTORY_STATE_NOT_FOUND");
        this.#veritabani.exec("COMMIT");
        throw new DurumMakinesiHatasi(
          "FACTORY_STATE_NOT_FOUND",
          "Yazilim fabrikasi isi bulunamadi.",
          { korelasyonKimligi: dogrulanmis.korelasyonKimligi },
        );
      }

      if (!DURUM_KUMESI.has(dogrulanmis.hedefDurum)) {
        this.#denetimYaz(
          dogrulanmis,
          isKaydi.durum,
          "RED",
          "FACTORY_STATE_UNKNOWN",
        );
        this.#veritabani.exec("COMMIT");
        throw new DurumMakinesiHatasi(
          "FACTORY_STATE_UNKNOWN",
          "Hedef durum tanimli durum modelinde bulunmuyor.",
          {
            mevcutDurum: isKaydi.durum,
            korelasyonKimligi: dogrulanmis.korelasyonKimligi,
          },
        );
      }

      if (!gecisGecerliMi(isKaydi.durum, dogrulanmis.hedefDurum)) {
        this.#denetimYaz(
          dogrulanmis,
          isKaydi.durum,
          "RED",
          "FACTORY_STATE_INVALID_TRANSITION",
        );
        this.#veritabani.exec("COMMIT");
        throw new DurumMakinesiHatasi(
          "FACTORY_STATE_INVALID_TRANSITION",
          "Mevcut durumdan hedef duruma gecis tanimli degil.",
          {
            mevcutDurum: isKaydi.durum,
            korelasyonKimligi: dogrulanmis.korelasyonKimligi,
          },
        );
      }

      this.#veritabani
        .prepare(
          `UPDATE fabrika_isleri
           SET durum = ?, surum = surum + 1, guncellenme_zamani = ?
           WHERE is_anahtari = ?`,
        )
        .run(
          dogrulanmis.hedefDurum,
          dogrulanmis.zamanDamgasi,
          dogrulanmis.isAnahtari,
        );
      this.#denetimYaz(dogrulanmis, isKaydi.durum, "KABUL", null);
      this.#veritabani
        .prepare(
          `INSERT INTO idempotency_sonuclari
             (is_anahtari, idempotency_anahtari, onceki_durum, hedef_durum)
           VALUES (?, ?, ?, ?)`,
        )
        .run(
          dogrulanmis.isAnahtari,
          dogrulanmis.idempotencyAnahtari,
          isKaydi.durum,
          dogrulanmis.hedefDurum,
        );
      this.#veritabani.exec("COMMIT");

      return {
        isAnahtari: dogrulanmis.isAnahtari,
        oncekiDurum: isKaydi.durum,
        durum: dogrulanmis.hedefDurum,
        tekrar: false,
      };
    } catch (hata) {
      if (this.#veritabani.isTransaction) {
        this.#veritabani.exec("ROLLBACK");
      }
      throw hata;
    }
  }

  kapat() {
    this.#veritabani.close();
  }

  #idempotencySonucuGetir({ isAnahtari, idempotencyAnahtari }) {
    return this.#veritabani
      .prepare(
        `SELECT onceki_durum, hedef_durum
         FROM idempotency_sonuclari
         WHERE is_anahtari = ? AND idempotency_anahtari = ?`,
      )
      .get(isAnahtari, idempotencyAnahtari);
  }

  #denetimYaz(istek, oncekiDurum, sonuc, nedenKodu) {
    this.#veritabani
      .prepare(
        `INSERT INTO durum_denetimi
           (is_anahtari, onceki_durum, hedef_durum, sonuc, neden_kodu,
            aktor, calistirici, deneme, korelasyon_kimligi, zaman_damgasi)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        istek.isAnahtari,
        oncekiDurum,
        istek.hedefDurum,
        sonuc,
        nedenKodu,
        istek.aktor,
        istek.calistirici,
        istek.deneme,
        istek.korelasyonKimligi,
        istek.zamanDamgasi,
      );
  }

  #semayiOlustur() {
    const durumlar = Object.values(DURUMLAR)
      .map((durum) => `'${durum}'`)
      .join(", ");
    this.#veritabani.exec(`
      CREATE TABLE IF NOT EXISTS fabrika_isleri (
        is_anahtari TEXT PRIMARY KEY,
        durum TEXT NOT NULL CHECK (durum IN (${durumlar})),
        surum INTEGER NOT NULL DEFAULT 0 CHECK (surum >= 0),
        guncellenme_zamani TEXT
      ) STRICT;

      CREATE TABLE IF NOT EXISTS durum_denetimi (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        is_anahtari TEXT NOT NULL,
        onceki_durum TEXT,
        hedef_durum TEXT NOT NULL,
        sonuc TEXT NOT NULL CHECK (sonuc IN ('KABUL', 'RED')),
        neden_kodu TEXT,
        aktor TEXT NOT NULL,
        calistirici TEXT NOT NULL,
        deneme INTEGER NOT NULL CHECK (deneme > 0),
        korelasyon_kimligi TEXT NOT NULL,
        zaman_damgasi TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS idempotency_sonuclari (
        is_anahtari TEXT NOT NULL,
        idempotency_anahtari TEXT NOT NULL,
        onceki_durum TEXT NOT NULL,
        hedef_durum TEXT NOT NULL,
        PRIMARY KEY (is_anahtari, idempotency_anahtari),
        FOREIGN KEY (is_anahtari) REFERENCES fabrika_isleri (is_anahtari)
      ) STRICT;
    `);
  }
}

function istekDogrula(istek) {
  if (!istek || typeof istek !== "object") {
    throw new TypeError("istek nesne olmalidir.");
  }
  metinDogrula(istek.isAnahtari, "isAnahtari");
  metinDogrula(istek.hedefDurum, "hedefDurum");
  metinDogrula(istek.aktor, "aktor");
  metinDogrula(istek.calistirici, "calistirici");
  metinDogrula(istek.korelasyonKimligi, "korelasyonKimligi");
  metinDogrula(istek.idempotencyAnahtari, "idempotencyAnahtari");
  metinDogrula(istek.zamanDamgasi, "zamanDamgasi");
  if (!Number.isInteger(istek.deneme) || istek.deneme < 1) {
    throw new TypeError("deneme pozitif bir tam sayi olmalidir.");
  }
  const zaman = new Date(istek.zamanDamgasi);
  if (
    Number.isNaN(zaman.getTime()) ||
    zaman.toISOString() !== istek.zamanDamgasi
  ) {
    throw new TypeError("zamanDamgasi kanonik UTC ISO-8601 biciminde olmalidir.");
  }
  return { ...istek };
}

function metinDogrula(deger, alan) {
  if (typeof deger !== "string" || deger.trim() === "") {
    throw new TypeError(`${alan} bos olmayan bir metin olmalidir.`);
  }
}
