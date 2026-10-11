import { DatabaseSync } from "node:sqlite";

const DURUM_KATEGORILERI = new Set(["new", "indeterminate", "done"]);
// Neden kodlari kesif sirasina gore degil, bu sabit siraya gore raporlanir.
const DAG_NEDEN_SIRASI = Object.freeze([
  "DAG_DONGU",
  "DAG_COZULEMEYEN_BAGIMLILIK",
  "DAG_TAMAMLANMAMIS_ON_KOSUL",
  "DAG_FAZ_BELIRSIZ",
  "DAG_GATE_ATLAMA",
]);
// Rakip writer BEGIN IMMEDIATE kilidini tutarken hata yerine beklenir.
const MESGUL_BEKLEME_MS = 5_000;

/**
 * Jira Blocks graph'inda hedef isin claim edilebilirligini fail-closed hesaplar.
 * `engelleyen` blocks `engellenen` kenari engelleyenin on kosul oldugunu soyler.
 * Hedefin kendi on kosul kapanisi ve faz isinin giris on kosullari (GATE'ler)
 * ayri ayri gezilir; karar issue key siralamasina hic dayanmaz.
 */
export function dagUygunlugunuDegerlendir(grafik, isAnahtari) {
  const dizin = grafikDizini(grafik);
  if (!dizin || !gecerliMetinMi(isAnahtari)) {
    return engelli(["DAG_GIRDISI_GECERSIZ"]);
  }
  const hedef = dizin.isler.get(isAnahtari);
  if (!hedef) return engelli(["DAG_HEDEF_BULUNAMADI"]);

  const nedenler = new Set();
  kapanisiDenetle(dizin, isAnahtari, "DAG_TAMAMLANMAMIS_ON_KOSUL", nedenler);
  if (hedef.fazIsi === null) {
    nedenler.add("DAG_FAZ_BELIRSIZ");
  } else if (!dizin.isler.has(hedef.fazIsi)) {
    nedenler.add("DAG_COZULEMEYEN_BAGIMLILIK");
  } else {
    kapanisiDenetle(dizin, hedef.fazIsi, "DAG_GATE_ATLAMA", nedenler);
  }

  const nedenKodlari = DAG_NEDEN_SIRASI.filter((kod) => nedenler.has(kod));
  return nedenKodlari.length === 0
    ? { sonuc: "SAHIPLENMEYE_HAZIR", nedenKodlari }
    : engelli(nedenKodlari);
}

/**
 * Lease kararlari yalniz kurucuya verilen guvenilir saatle (epoch ms) verilir;
 * istek icindeki zaman bilgisi karara katilmaz. Varsayilan sistem saatidir.
 */
export class IsSahiplenmeKilidi {
  #veritabani;
  #zamanAsimiMs;
  #saat;

  constructor(veritabaniYolu, { zamanAsimiMs, saat = Date.now } = {}) {
    metinDogrula(veritabaniYolu, "veritabaniYolu");
    if (!Number.isSafeInteger(zamanAsimiMs) || zamanAsimiMs < 1) {
      throw new TypeError("zamanAsimiMs pozitif bir tam sayi olmalidir.");
    }
    if (typeof saat !== "function") {
      throw new TypeError("saat epoch milisaniye donduren bir fonksiyon olmalidir.");
    }
    this.#zamanAsimiMs = zamanAsimiMs;
    this.#saat = saat;
    this.#veritabani = new DatabaseSync(veritabaniYolu);
    this.#veritabani.exec(
      `PRAGMA busy_timeout = ${MESGUL_BEKLEME_MS}; PRAGMA journal_mode = WAL;`,
    );
    this.#veritabani.exec(`
      CREATE TABLE IF NOT EXISTS is_kilitleri (
        is_anahtari TEXT PRIMARY KEY,
        sahip TEXT NOT NULL,
        korelasyon_kimligi TEXT NOT NULL,
        sahiplenme_zamani TEXT NOT NULL,
        son_heartbeat TEXT NOT NULL,
        nesil INTEGER NOT NULL CHECK (nesil > 0)
      ) STRICT;
    `);
  }

  /**
   * DAG uygunsa isi atomik olarak sahiplenir. Aktif lock (sahibi kim olursa
   * olsun) devralinamaz; son heartbeat'ten zamanAsimiMs'den fazla gecmisse lock
   * stale sayilir ve nesil artirilarak devralinir.
   */
  sahiplen(istek) {
    const dogrulanmis = sahiplenmeIstegiDogrula(istek);
    const dag = dagUygunlugunuDegerlendir(
      dogrulanmis.grafik,
      dogrulanmis.isAnahtari,
    );
    if (dag.sonuc !== "SAHIPLENMEYE_HAZIR") {
      return sahiplenmeSonucu("REDDEDILDI", dag.nedenKodlari, null, null);
    }

    return this.#hemenYazTransactioninda((simdi) => {
      const mevcut = this.kilitGetir(dogrulanmis.isAnahtari);
      if (mevcut && !this.#suresiDolduMu(mevcut, simdi)) {
        return sahiplenmeSonucu("REDDEDILDI", ["KILIT_AKTIF"], mevcut, null);
      }

      const kilit = {
        isAnahtari: dogrulanmis.isAnahtari,
        sahip: dogrulanmis.sahip,
        korelasyonKimligi: dogrulanmis.korelasyonKimligi,
        sahiplenmeZamani: simdi,
        sonHeartbeat: simdi,
        nesil: (mevcut?.nesil ?? 0) + 1,
      };
      this.#veritabani
        .prepare(
          `INSERT INTO is_kilitleri
             (is_anahtari, sahip, korelasyon_kimligi, sahiplenme_zamani,
              son_heartbeat, nesil)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT (is_anahtari) DO UPDATE SET
             sahip = excluded.sahip,
             korelasyon_kimligi = excluded.korelasyon_kimligi,
             sahiplenme_zamani = excluded.sahiplenme_zamani,
             son_heartbeat = excluded.son_heartbeat,
             nesil = excluded.nesil`,
        )
        .run(
          kilit.isAnahtari,
          kilit.sahip,
          kilit.korelasyonKimligi,
          kilit.sahiplenmeZamani,
          kilit.sonHeartbeat,
          kilit.nesil,
        );
      return sahiplenmeSonucu("SAHIPLENILDI", [], kilit, mevcut?.sahip ?? null);
    });
  }

  /**
   * Yalniz ayni sahip ve ayni nesil (fencing anahtari) lease'i uzatabilir.
   * Suresi dolmus lease canlandirilmaz; sahip yeniden claim etmelidir.
   */
  heartbeatYenile(istek) {
    const dogrulanmis = heartbeatIstegiDogrula(istek);
    return this.#hemenYazTransactioninda((simdi) => {
      const mevcut = this.kilitGetir(dogrulanmis.isAnahtari);
      if (!mevcut) return heartbeatSonucu("KILIT_BULUNAMADI", null);
      if (
        mevcut.sahip !== dogrulanmis.sahip ||
        mevcut.nesil !== dogrulanmis.nesil
      ) {
        return heartbeatSonucu("KILIT_SAHIBI_DEGIL", mevcut);
      }
      if (this.#suresiDolduMu(mevcut, simdi)) {
        return heartbeatSonucu("KILIT_SURESI_DOLDU", mevcut);
      }

      // Geriye giden saat lease'i kisaltmasin diye heartbeat yalniz ileri gider.
      const sonHeartbeat =
        Date.parse(simdi) > Date.parse(mevcut.sonHeartbeat)
          ? simdi
          : mevcut.sonHeartbeat;
      this.#veritabani
        .prepare(
          `UPDATE is_kilitleri SET son_heartbeat = ?
           WHERE is_anahtari = ? AND sahip = ? AND nesil = ?`,
        )
        .run(sonHeartbeat, mevcut.isAnahtari, mevcut.sahip, mevcut.nesil);
      return heartbeatSonucu(null, { ...mevcut, sonHeartbeat });
    });
  }

  kilitGetir(isAnahtari) {
    metinDogrula(isAnahtari, "isAnahtari");
    const kayit = this.#veritabani
      .prepare(
        `SELECT
           is_anahtari AS isAnahtari,
           sahip,
           korelasyon_kimligi AS korelasyonKimligi,
           sahiplenme_zamani AS sahiplenmeZamani,
           son_heartbeat AS sonHeartbeat,
           nesil
         FROM is_kilitleri
         WHERE is_anahtari = ?`,
      )
      .get(isAnahtari);
    return kayit ? { ...kayit } : null;
  }

  kapat() {
    this.#veritabani.close();
  }

  #suresiDolduMu(kilit, simdi) {
    return Date.parse(simdi) - Date.parse(kilit.sonHeartbeat) > this.#zamanAsimiMs;
  }

  #saatiOku() {
    const simdiMs = this.#saat();
    if (!Number.isSafeInteger(simdiMs)) {
      throw new TypeError("saat epoch milisaniye tam sayisi dondurmelidir.");
    }
    return new Date(simdiMs).toISOString();
  }

  // Saat, yazma kilidi alindiktan sonra okunur; busy bekleme eski zamanla karar verdirmez.
  #hemenYazTransactioninda(islem) {
    this.#veritabani.exec("BEGIN IMMEDIATE");
    try {
      const sonuc = islem(this.#saatiOku());
      this.#veritabani.exec("COMMIT");
      return sonuc;
    } catch (hata) {
      if (this.#veritabani.isTransaction) {
        this.#veritabani.exec("ROLLBACK");
      }
      throw hata;
    }
  }
}

function grafikDizini(grafik) {
  if (
    !grafik ||
    typeof grafik !== "object" ||
    !Array.isArray(grafik.isler) ||
    !Array.isArray(grafik.engellemeler)
  ) {
    return null;
  }

  const isler = new Map();
  for (const is of grafik.isler) {
    if (
      !is ||
      typeof is !== "object" ||
      !gecerliMetinMi(is.anahtar) ||
      isler.has(is.anahtar) ||
      !DURUM_KATEGORILERI.has(is.durumKategorisi) ||
      !(is.fazIsi === null || gecerliMetinMi(is.fazIsi))
    ) {
      return null;
    }
    isler.set(is.anahtar, {
      durumKategorisi: is.durumKategorisi,
      fazIsi: is.fazIsi,
    });
  }

  const onKosullar = new Map();
  for (const kenar of grafik.engellemeler) {
    if (
      !kenar ||
      typeof kenar !== "object" ||
      !gecerliMetinMi(kenar.engelleyen) ||
      !gecerliMetinMi(kenar.engellenen)
    ) {
      return null;
    }
    if (!onKosullar.has(kenar.engellenen)) {
      onKosullar.set(kenar.engellenen, new Set());
    }
    onKosullar.get(kenar.engellenen).add(kenar.engelleyen);
  }

  return { isler, onKosullar };
}

/**
 * Baslangic isinin gecisli on kosul kapanisini gezer. Eksik dugum, kapanis
 * icinde cycle ve tamamlanmamis on kosul ilgili neden kodunu ekler. Baslangic
 * isinin kendi durumu karara katilmaz.
 */
function kapanisiDenetle(dizin, baslangic, tamamlanmamisKodu, nedenler) {
  const kapanis = new Set([baslangic]);
  const kuyruk = [baslangic];
  while (kuyruk.length > 0) {
    for (const onKosul of dizin.onKosullar.get(kuyruk.pop()) ?? []) {
      if (!dizin.isler.has(onKosul)) {
        nedenler.add("DAG_COZULEMEYEN_BAGIMLILIK");
      } else if (!kapanis.has(onKosul)) {
        kapanis.add(onKosul);
        kuyruk.push(onKosul);
      }
    }
  }

  for (const anahtar of kapanis) {
    if (
      anahtar !== baslangic &&
      dizin.isler.get(anahtar).durumKategorisi !== "done"
    ) {
      nedenler.add(tamamlanmamisKodu);
    }
  }
  if (donguVarMi(dizin, kapanis)) nedenler.add("DAG_DONGU");
}

// Kahn topolojik siralamasi: siralanamayan dugum kalirsa kapanis cycle icerir.
function donguVarMi(dizin, kapanis) {
  const kalanOnKosulSayisi = new Map();
  const bagimlilar = new Map();
  for (const anahtar of kapanis) {
    const mevcutOnKosullar = [...(dizin.onKosullar.get(anahtar) ?? [])].filter(
      (onKosul) => dizin.isler.has(onKosul),
    );
    kalanOnKosulSayisi.set(anahtar, mevcutOnKosullar.length);
    for (const onKosul of mevcutOnKosullar) {
      if (!bagimlilar.has(onKosul)) bagimlilar.set(onKosul, []);
      bagimlilar.get(onKosul).push(anahtar);
    }
  }

  const kuyruk = [...kapanis].filter(
    (anahtar) => kalanOnKosulSayisi.get(anahtar) === 0,
  );
  let siralanan = 0;
  while (kuyruk.length > 0) {
    const anahtar = kuyruk.pop();
    siralanan += 1;
    for (const bagimli of bagimlilar.get(anahtar) ?? []) {
      const kalan = kalanOnKosulSayisi.get(bagimli) - 1;
      kalanOnKosulSayisi.set(bagimli, kalan);
      if (kalan === 0) kuyruk.push(bagimli);
    }
  }
  return siralanan < kapanis.size;
}

function engelli(nedenKodlari) {
  return { sonuc: "ENGELLI", nedenKodlari };
}

function sahiplenmeSonucu(sonuc, nedenKodlari, kilit, devralinanSahip) {
  return { sonuc, nedenKodlari, kilit, devralinanSahip };
}

function heartbeatSonucu(nedenKodu, kilit) {
  return nedenKodu === null
    ? { sonuc: "YENILENDI", nedenKodlari: [], kilit }
    : { sonuc: "REDDEDILDI", nedenKodlari: [nedenKodu], kilit };
}

function sahiplenmeIstegiDogrula(istek) {
  nesneDogrula(istek);
  metinDogrula(istek.isAnahtari, "isAnahtari");
  metinDogrula(istek.sahip, "sahip");
  metinDogrula(istek.korelasyonKimligi, "korelasyonKimligi");
  const { isAnahtari, sahip, korelasyonKimligi, grafik } = istek;
  return { isAnahtari, sahip, korelasyonKimligi, grafik };
}

function heartbeatIstegiDogrula(istek) {
  nesneDogrula(istek);
  metinDogrula(istek.isAnahtari, "isAnahtari");
  metinDogrula(istek.sahip, "sahip");
  if (!Number.isSafeInteger(istek.nesil) || istek.nesil < 1) {
    throw new TypeError("nesil pozitif bir tam sayi olmalidir.");
  }
  const { isAnahtari, sahip, nesil } = istek;
  return { isAnahtari, sahip, nesil };
}

function nesneDogrula(istek) {
  if (!istek || typeof istek !== "object") {
    throw new TypeError("istek nesne olmalidir.");
  }
}

function gecerliMetinMi(deger) {
  return typeof deger === "string" && deger.trim() !== "";
}

function metinDogrula(deger, alan) {
  if (!gecerliMetinMi(deger)) {
    throw new TypeError(`${alan} bos olmayan bir metin olmalidir.`);
  }
}
