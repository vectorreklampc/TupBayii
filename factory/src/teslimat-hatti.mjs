import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const ADAY_KAPILARI = Object.freeze([
  "versionBuild",
  "sbomDependencySecurity",
  "migrationsDryRun",
  "fullTest",
  "acceptance",
  "packageSign",
]);
const STAGING_KAPILARI = Object.freeze([
  "stagingDeploy",
  "stagingSmoke",
  "stagingTelemetry",
]);
const PRODUCTION_KAPILARI = Object.freeze([
  "productionDeploy",
  "productionSmoke",
  "productionTelemetry",
]);
const DAGITIM_STRATEJILERI = new Set(["CANARY", "ROLLING", "RECREATE"]);
const ASAMALAR = new Set(["candidate", "staging", "production"]);

export class TeslimatHattiHatasi extends Error {
  constructor(kod, mesaj, { releaseKimligi = null, mevcutDurum = null } = {}) {
    super(mesaj);
    this.name = "TeslimatHattiHatasi";
    this.kod = kod;
    this.releaseKimligi = releaseKimligi;
    this.mevcutDurum = mevcutDurum;
  }
}

export class TeslimatHatti {
  #depo;
  #komutCalistir;

  constructor({ depoYolu, komutCalistir }) {
    if (typeof komutCalistir !== "function") {
      throw new TypeError("komutCalistir fonksiyon olmalidir.");
    }
    this.#depo = new TeslimatHattiDeposu(depoYolu);
    this.#komutCalistir = komutCalistir;
  }

  async calistir(asama, hamPlan, hamBaglam) {
    if (!ASAMALAR.has(asama)) {
      throw new TeslimatHattiHatasi(
        "RELEASE_STAGE_UNKNOWN",
        "Teslimat asamasi candidate, staging veya production olmalidir.",
      );
    }
    const plan = planDogrula(hamPlan);
    const baglam = baglamDogrula(hamBaglam);

    if (asama === "candidate") return this.#adayHazirla(plan, baglam);
    await artefaktDogrula(plan);
    if (asama === "staging") return this.#stagingDogrula(plan, baglam);
    return this.#productionDogrula(plan, baglam);
  }

  releaseGetir(releaseKimligi) {
    return this.#depo.releaseGetir(releaseKimligi);
  }

  denetimKayitlariniListele(releaseKimligi) {
    return this.#depo.denetimKayitlariniListele(releaseKimligi);
  }

  kapat() {
    this.#depo.kapat();
  }

  async #adayHazirla(plan, baglam) {
    const mevcut = this.#depo.releaseGetir(plan.releaseKimligi);
    if (mevcut) {
      tanimAyniMiDogrula(mevcut, plan);
      if (mevcut.durum === "ADAY_HAZIR") return sonucOlustur(mevcut, true);
      throw durumHatasi(plan.releaseKimligi, mevcut.durum, "BASLANGIC");
    }

    await artefaktDogrula(plan);
    this.#depo.releaseOlustur(plan, baglam);
    for (const kapi of ADAY_KAPILARI) {
      const sonuc = await this.#komutuCalistir(kapi, plan, baglam, "candidate");
      if (!basariliMi(sonuc)) {
        this.#depo.durumDegistir({
          releaseKimligi: plan.releaseKimligi,
          beklenenDurumlar: ["BASLANGIC"],
          hedefDurum: "ADAY_ENGELLENDI",
          sonucKodu: "RELEASE_GATE_FAILED",
          baglam,
          kapi,
        });
        throw new TeslimatHattiHatasi(
          "RELEASE_GATE_FAILED",
          `${kapi} kalite kapisi basarisiz oldu.`,
          { releaseKimligi: plan.releaseKimligi, mevcutDurum: "ADAY_ENGELLENDI" },
        );
      }
      this.#depo.denetimYaz({
        releaseKimligi: plan.releaseKimligi,
        asama: "candidate",
        sonucKodu: "RELEASE_GATE_PASSED",
        baglam,
        kapi,
      });
    }

    try {
      await artefaktDogrula(plan);
    } catch (hata) {
      this.#depo.durumDegistir({
        releaseKimligi: plan.releaseKimligi,
        beklenenDurumlar: ["BASLANGIC"],
        hedefDurum: "ADAY_ENGELLENDI",
        sonucKodu: hata.kod ?? "RELEASE_ARTIFACT_CHANGED",
        baglam,
        kapi: "packageSign",
      });
      throw hata;
    }

    this.#depo.durumDegistir({
      releaseKimligi: plan.releaseKimligi,
      beklenenDurumlar: ["BASLANGIC"],
      hedefDurum: "ADAY_HAZIR",
      sonucKodu: "RELEASE_CANDIDATE_READY",
      baglam,
    });
    return sonucOlustur(this.#depo.releaseGetir(plan.releaseKimligi));
  }

  async #stagingDogrula(plan, baglam) {
    const mevcut = releaseVeTanimDogrula(this.#depo, plan);
    if (mevcut.durum === "STAGING_DOGRULANDI") return sonucOlustur(mevcut, true);
    if (mevcut.durum === "STAGING_DAGITILIYOR") {
      throw kilitHatasi("staging", plan.releaseKimligi);
    }
    if (!new Set(["ADAY_HAZIR", "STAGING_ENGELLENDI"]).has(mevcut.durum)) {
      throw durumHatasi(plan.releaseKimligi, mevcut.durum, "ADAY_HAZIR");
    }
    return this.#kilitliDagitimCalistir({
      ortam: "staging",
      plan,
      baglam,
      kapilar: STAGING_KAPILARI,
      beklenenDurumlar: ["ADAY_HAZIR", "STAGING_ENGELLENDI"],
      calisanDurum: "STAGING_DAGITILIYOR",
      basariliDurum: "STAGING_DOGRULANDI",
      basariKodu: "RELEASE_STAGING_VERIFIED",
      hataDurumu: "STAGING_ENGELLENDI",
    });
  }

  async #productionDogrula(plan, baglam) {
    const mevcut = releaseVeTanimDogrula(this.#depo, plan);
    if (mevcut.durum === "PRODUCTION_DOGRULANDI") return sonucOlustur(mevcut, true);
    if (mevcut.durum === "PRODUCTION_DAGITILIYOR") {
      throw kilitHatasi("production", plan.releaseKimligi);
    }
    if (mevcut.durum !== "STAGING_DOGRULANDI") {
      throw durumHatasi(plan.releaseKimligi, mevcut.durum, "STAGING_DOGRULANDI");
    }
    if (!doluMetinMi(plan.insanOnayiKanitKimligi)) {
      this.#depo.denetimYaz({
        releaseKimligi: plan.releaseKimligi,
        asama: "production",
        sonucKodu: "RELEASE_HUMAN_GATE_REQUIRED",
        baglam,
      });
      throw new TeslimatHattiHatasi(
        "RELEASE_HUMAN_GATE_REQUIRED",
        "Production dagitimi icin Human Gate kaniti zorunludur.",
        { releaseKimligi: plan.releaseKimligi, mevcutDurum: mevcut.durum },
      );
    }
    this.#depo.denetimYaz({
      releaseKimligi: plan.releaseKimligi,
      asama: "production",
      sonucKodu: "RELEASE_HUMAN_GATE_VERIFIED",
      baglam,
      kapi: plan.insanOnayiKanitKimligi,
    });

    return this.#kilitliDagitimCalistir({
      ortam: "production",
      plan,
      baglam,
      kapilar: PRODUCTION_KAPILARI,
      beklenenDurumlar: ["STAGING_DOGRULANDI"],
      calisanDurum: "PRODUCTION_DAGITILIYOR",
      basariliDurum: "PRODUCTION_DOGRULANDI",
      basariKodu: "RELEASE_PRODUCTION_VERIFIED",
      hataDurumu: null,
      rollbackUygula: true,
    });
  }

  async #kilitliDagitimCalistir({
    ortam,
    plan,
    baglam,
    kapilar,
    beklenenDurumlar,
    calisanDurum,
    basariliDurum,
    basariKodu,
    hataDurumu,
    rollbackUygula = false,
  }) {
    const kilitKimligi = randomUUID();
    this.#depo.kilitAl({
      ortam,
      releaseKimligi: plan.releaseKimligi,
      sahip: baglam.calistirici,
      kilitKimligi,
      zamanDamgasi: baglam.zamanDamgasi,
    });
    try {
      this.#depo.durumDegistir({
        releaseKimligi: plan.releaseKimligi,
        beklenenDurumlar,
        hedefDurum: calisanDurum,
        sonucKodu: "RELEASE_DEPLOYMENT_STARTED",
        baglam,
      });
      for (const kapi of kapilar) {
        const sonuc = await this.#komutuCalistir(kapi, plan, baglam, ortam);
        if (basariliMi(sonuc)) {
          this.#depo.denetimYaz({
            releaseKimligi: plan.releaseKimligi,
            asama: ortam,
            sonucKodu: "RELEASE_GATE_PASSED",
            baglam,
            kapi,
          });
          continue;
        }

        if (rollbackUygula) {
          return this.#rollbackCalistir(plan, baglam, kapi, ortam);
        }
        this.#depo.durumDegistir({
          releaseKimligi: plan.releaseKimligi,
          beklenenDurumlar: [calisanDurum],
          hedefDurum: hataDurumu,
          sonucKodu: "RELEASE_GATE_FAILED",
          baglam,
          kapi,
        });
        throw new TeslimatHattiHatasi(
          "RELEASE_GATE_FAILED",
          `${kapi} kalite kapisi basarisiz oldu.`,
          { releaseKimligi: plan.releaseKimligi, mevcutDurum: hataDurumu },
        );
      }

      this.#depo.durumDegistir({
        releaseKimligi: plan.releaseKimligi,
        beklenenDurumlar: [calisanDurum],
        hedefDurum: basariliDurum,
        sonucKodu: basariKodu,
        baglam,
      });
      return sonucOlustur(this.#depo.releaseGetir(plan.releaseKimligi));
    } finally {
      this.#depo.kilitBirak({ ortam, kilitKimligi });
    }
  }

  async #rollbackCalistir(plan, baglam, basarisizKapi, ortam) {
    const rollbackSonucu = await this.#komutuCalistir(
      "rollback",
      plan,
      baglam,
      ortam,
    );
    const rollbackBasarili = basariliMi(rollbackSonucu);
    this.#depo.durumDegistir({
      releaseKimligi: plan.releaseKimligi,
      beklenenDurumlar: ["PRODUCTION_DAGITILIYOR"],
      hedefDurum: rollbackBasarili ? "ROLLBACK_UYGULANDI" : "INCIDENT_ACIK",
      sonucKodu: rollbackBasarili
        ? "RELEASE_ROLLBACK_APPLIED"
        : "RELEASE_INCIDENT_OPEN",
      baglam,
      kapi: basarisizKapi,
    });
    return sonucOlustur(this.#depo.releaseGetir(plan.releaseKimligi));
  }

  async #komutuCalistir(ad, plan, baglam, ortam) {
    const komut = plan.komutlar[ad];
    try {
      return await this.#komutCalistir(ad, [...komut], {
        ortam,
        releaseKimligi: plan.releaseKimligi,
        traceKimligi: baglam.traceKimligi,
        korelasyonKimligi: baglam.korelasyonKimligi,
      });
    } catch {
      return { cikisKodu: 1 };
    }
  }
}

export class TeslimatHattiDeposu {
  #veritabani;

  constructor(veritabaniYolu) {
    doluMetinDogrula(veritabaniYolu, "veritabaniYolu");
    this.#veritabani = new DatabaseSync(veritabaniYolu);
    this.#veritabani.exec(
      "PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 1000;",
    );
    this.#semayiOlustur();
  }

  releaseOlustur(plan, baglam) {
    this.#veritabani.exec("BEGIN IMMEDIATE");
    try {
      this.#veritabani.prepare(`
        INSERT INTO release_kayitlari (
          release_kimligi, durum, commit_kimligi, is_anahtarlari,
          artefakt_yolu, artefakt_sha256, imza_kimligi, dagitim_stratejisi,
          migration_plani, backup_restore_kaniti, insan_onayi_kaniti
        ) VALUES (?, 'BASLANGIC', ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        plan.releaseKimligi,
        plan.commitKimligi,
        JSON.stringify(plan.isAnahtarlari),
        plan.artefaktYolu,
        plan.artefaktSha256,
        plan.imzaKimligi,
        plan.dagitimStratejisi,
        JSON.stringify(plan.migrationPlani),
        plan.backupRestoreKanitKimligi,
        plan.insanOnayiKanitKimligi,
      );
      this.#denetimEkle({
        releaseKimligi: plan.releaseKimligi,
        asama: "candidate",
        oncekiDurum: null,
        hedefDurum: "BASLANGIC",
        sonucKodu: "RELEASE_CREATED",
        baglam,
      });
      this.#veritabani.exec("COMMIT");
    } catch (hata) {
      if (this.#veritabani.isTransaction) this.#veritabani.exec("ROLLBACK");
      throw hata;
    }
  }

  releaseGetir(releaseKimligi) {
    doluMetinDogrula(releaseKimligi, "releaseKimligi");
    const kayit = this.#veritabani.prepare(`
      SELECT release_kimligi AS releaseKimligi, durum,
        commit_kimligi AS commitKimligi, is_anahtarlari AS isAnahtarlari,
        artefakt_yolu AS artefaktYolu, artefakt_sha256 AS artefaktSha256,
        imza_kimligi AS imzaKimligi, dagitim_stratejisi AS dagitimStratejisi,
        migration_plani AS migrationPlani,
        backup_restore_kaniti AS backupRestoreKanitKimligi,
        insan_onayi_kaniti AS insanOnayiKanitKimligi
      FROM release_kayitlari WHERE release_kimligi = ?
    `).get(releaseKimligi);
    if (!kayit) return null;
    return {
      ...kayit,
      isAnahtarlari: JSON.parse(kayit.isAnahtarlari),
      migrationPlani: JSON.parse(kayit.migrationPlani),
    };
  }

  durumDegistir({
    releaseKimligi,
    beklenenDurumlar,
    hedefDurum,
    sonucKodu,
    baglam,
    kapi = null,
  }) {
    this.#veritabani.exec("BEGIN IMMEDIATE");
    try {
      const mevcut = this.#veritabani
        .prepare("SELECT durum FROM release_kayitlari WHERE release_kimligi = ?")
        .get(releaseKimligi);
      if (!mevcut || !beklenenDurumlar.includes(mevcut.durum)) {
        throw durumHatasi(
          releaseKimligi,
          mevcut?.durum ?? null,
          beklenenDurumlar.join(" veya "),
        );
      }
      this.#veritabani.prepare(`
        UPDATE release_kayitlari SET durum = ? WHERE release_kimligi = ?
      `).run(hedefDurum, releaseKimligi);
      this.#denetimEkle({
        releaseKimligi,
        asama: asamaBul(hedefDurum),
        oncekiDurum: mevcut.durum,
        hedefDurum,
        sonucKodu,
        baglam,
        kapi,
      });
      this.#veritabani.exec("COMMIT");
    } catch (hata) {
      if (this.#veritabani.isTransaction) this.#veritabani.exec("ROLLBACK");
      throw hata;
    }
  }

  denetimYaz({ releaseKimligi, asama, sonucKodu, baglam, kapi = null }) {
    const mevcut = this.#veritabani
      .prepare("SELECT durum FROM release_kayitlari WHERE release_kimligi = ?")
      .get(releaseKimligi);
    if (!mevcut) throw durumHatasi(releaseKimligi, null, "release kaydi");
    this.#denetimEkle({
      releaseKimligi,
      asama,
      oncekiDurum: mevcut.durum,
      hedefDurum: mevcut.durum,
      sonucKodu,
      baglam,
      kapi,
    });
  }

  denetimKayitlariniListele(releaseKimligi) {
    return this.#veritabani.prepare(`
      SELECT release_kimligi AS releaseKimligi, asama,
        onceki_durum AS oncekiDurum, hedef_durum AS hedefDurum,
        sonuc_kodu AS sonucKodu, kapi, aktor, calistirici,
        trace_kimligi AS traceKimligi,
        korelasyon_kimligi AS korelasyonKimligi,
        zaman_damgasi AS zamanDamgasi
      FROM release_denetimi WHERE release_kimligi = ? ORDER BY id
    `).all(releaseKimligi).map((kayit) => ({ ...kayit }));
  }

  kilitAl({ ortam, releaseKimligi, sahip, kilitKimligi, zamanDamgasi }) {
    try {
      this.#veritabani.prepare(`
        INSERT INTO deployment_kilitleri
          (ortam, release_kimligi, sahip, kilit_kimligi, alinma_zamani)
        VALUES (?, ?, ?, ?, ?)
      `).run(ortam, releaseKimligi, sahip, kilitKimligi, zamanDamgasi);
    } catch (hata) {
      if (String(hata.message).includes("UNIQUE constraint failed")) {
        throw new TeslimatHattiHatasi(
          "RELEASE_DEPLOYMENT_LOCKED",
          `${ortam} ortami baska bir teslimat tarafindan kilitli.`,
          { releaseKimligi },
        );
      }
      throw hata;
    }
  }

  kilitBirak({ ortam, kilitKimligi }) {
    this.#veritabani.prepare(`
      DELETE FROM deployment_kilitleri WHERE ortam = ? AND kilit_kimligi = ?
    `).run(ortam, kilitKimligi);
  }

  kapat() {
    this.#veritabani.close();
  }

  #denetimEkle({
    releaseKimligi,
    asama,
    oncekiDurum,
    hedefDurum,
    sonucKodu,
    baglam,
    kapi = null,
  }) {
    this.#veritabani.prepare(`
      INSERT INTO release_denetimi (
        release_kimligi, asama, onceki_durum, hedef_durum, sonuc_kodu,
        kapi, aktor, calistirici, trace_kimligi, korelasyon_kimligi,
        zaman_damgasi
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      releaseKimligi,
      asama,
      oncekiDurum,
      hedefDurum,
      sonucKodu,
      kapi,
      baglam.aktor,
      baglam.calistirici,
      baglam.traceKimligi,
      baglam.korelasyonKimligi,
      baglam.zamanDamgasi,
    );
  }

  #semayiOlustur() {
    this.#veritabani.exec(`
      CREATE TABLE IF NOT EXISTS release_kayitlari (
        release_kimligi TEXT PRIMARY KEY,
        durum TEXT NOT NULL,
        commit_kimligi TEXT NOT NULL,
        is_anahtarlari TEXT NOT NULL,
        artefakt_yolu TEXT NOT NULL,
        artefakt_sha256 TEXT NOT NULL,
        imza_kimligi TEXT NOT NULL,
        dagitim_stratejisi TEXT NOT NULL,
        migration_plani TEXT NOT NULL,
        backup_restore_kaniti TEXT NOT NULL,
        insan_onayi_kaniti TEXT
      ) STRICT;

      CREATE TABLE IF NOT EXISTS release_denetimi (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        release_kimligi TEXT NOT NULL,
        asama TEXT NOT NULL,
        onceki_durum TEXT,
        hedef_durum TEXT NOT NULL,
        sonuc_kodu TEXT NOT NULL,
        kapi TEXT,
        aktor TEXT NOT NULL,
        calistirici TEXT NOT NULL,
        trace_kimligi TEXT NOT NULL,
        korelasyon_kimligi TEXT NOT NULL,
        zaman_damgasi TEXT NOT NULL,
        FOREIGN KEY (release_kimligi) REFERENCES release_kayitlari (release_kimligi)
      ) STRICT;

      CREATE TABLE IF NOT EXISTS deployment_kilitleri (
        ortam TEXT PRIMARY KEY,
        release_kimligi TEXT NOT NULL,
        sahip TEXT NOT NULL,
        kilit_kimligi TEXT NOT NULL UNIQUE,
        alinma_zamani TEXT NOT NULL,
        FOREIGN KEY (release_kimligi) REFERENCES release_kayitlari (release_kimligi)
      ) STRICT;

      CREATE TRIGGER IF NOT EXISTS release_audit_update_yasak
      BEFORE UPDATE ON release_denetimi
      BEGIN SELECT RAISE(ABORT, 'RELEASE_AUDIT_IMMUTABLE'); END;

      CREATE TRIGGER IF NOT EXISTS release_audit_delete_yasak
      BEFORE DELETE ON release_denetimi
      BEGIN SELECT RAISE(ABORT, 'RELEASE_AUDIT_IMMUTABLE'); END;

      CREATE TRIGGER IF NOT EXISTS release_manifest_update_yasak
      BEFORE UPDATE OF commit_kimligi, is_anahtarlari, artefakt_yolu,
        artefakt_sha256, imza_kimligi, dagitim_stratejisi,
        migration_plani, backup_restore_kaniti
      ON release_kayitlari
      BEGIN SELECT RAISE(ABORT, 'RELEASE_MANIFEST_IMMUTABLE'); END;

      CREATE TRIGGER IF NOT EXISTS release_kaydi_delete_yasak
      BEFORE DELETE ON release_kayitlari
      BEGIN SELECT RAISE(ABORT, 'RELEASE_RECORD_IMMUTABLE'); END;
    `);
  }
}

function planDogrula(plan) {
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) {
    throw new TypeError("plan nesne olmalidir.");
  }
  const izinliPlanAlanlari = new Set([
    "releaseKimligi", "isAnahtarlari", "commitKimligi", "artefaktYolu",
    "artefaktSha256", "imzaKimligi", "dagitimStratejisi", "migrationPlani",
    "backupRestoreKanitKimligi", "insanOnayiKanitKimligi", "komutlar",
  ]);
  const bilinmeyenPlanAlani = Object.keys(plan)
    .find((alan) => !izinliPlanAlanlari.has(alan));
  if (bilinmeyenPlanAlani) {
    throw new TypeError(`${bilinmeyenPlanAlani} release planinda izinli degildir.`);
  }
  for (const alan of [
    "releaseKimligi",
    "commitKimligi",
    "artefaktYolu",
    "artefaktSha256",
    "imzaKimligi",
    "backupRestoreKanitKimligi",
  ]) {
    doluMetinDogrula(plan[alan], alan);
  }
  for (const alan of ["imzaKimligi", "backupRestoreKanitKimligi"]) {
    kanitKimligiDogrula(plan[alan], alan);
  }
  if (plan.insanOnayiKanitKimligi !== null
      && plan.insanOnayiKanitKimligi !== undefined) {
    kanitKimligiDogrula(
      plan.insanOnayiKanitKimligi,
      "insanOnayiKanitKimligi",
    );
  }
  if (!/^release-[A-Za-z0-9._-]+$/.test(plan.releaseKimligi)) {
    throw new TypeError("releaseKimligi kanonik release-* biciminde olmalidir.");
  }
  if (!/^[0-9a-f]{7,64}$/.test(plan.commitKimligi)) {
    throw new TypeError("commitKimligi Git SHA biciminde olmalidir.");
  }
  if (!/^[0-9a-f]{64}$/.test(plan.artefaktSha256)) {
    throw new TypeError("artefaktSha256 SHA-256 biciminde olmalidir.");
  }
  if (!Array.isArray(plan.isAnahtarlari)
      || plan.isAnahtarlari.length === 0
      || plan.isAnahtarlari.some((deger) => !/^TBP-[1-9][0-9]*$/.test(deger))) {
    throw new TypeError("isAnahtarlari en az bir kanonik Jira anahtari icermelidir.");
  }
  if (!DAGITIM_STRATEJILERI.has(plan.dagitimStratejisi)) {
    throw new TypeError("dagitimStratejisi CANARY, ROLLING veya RECREATE olmalidir.");
  }
  if (!plan.migrationPlani || typeof plan.migrationPlani !== "object") {
    throw new TypeError("migrationPlani zorunludur.");
  }
  for (const alan of [
    "dryRunKanitKimligi",
    "forwardPlanKimligi",
    "rollbackPlanKimligi",
  ]) {
    doluMetinDogrula(plan.migrationPlani[alan], `migrationPlani.${alan}`);
    kanitKimligiDogrula(
      plan.migrationPlani[alan],
      `migrationPlani.${alan}`,
    );
  }
  const izinliMigrationAlanlari = new Set([
    "dryRunKanitKimligi", "forwardPlanKimligi", "rollbackPlanKimligi",
  ]);
  if (Object.keys(plan.migrationPlani)
    .some((alan) => !izinliMigrationAlanlari.has(alan))) {
    throw new TypeError("migrationPlani bilinmeyen alan iceremez.");
  }
  if (!plan.komutlar || typeof plan.komutlar !== "object") {
    throw new TypeError("komutlar nesnesi zorunludur.");
  }
  const komutAdlari = [
    ...ADAY_KAPILARI,
    ...STAGING_KAPILARI,
    ...PRODUCTION_KAPILARI,
    "rollback",
  ];
  if (Object.keys(plan.komutlar).some((ad) => !komutAdlari.includes(ad))) {
    throw new TypeError("komutlar bilinmeyen kapi adi iceremez.");
  }
  for (const ad of komutAdlari) {
    const komut = plan.komutlar[ad];
    if (!Array.isArray(komut) || komut.length === 0 || komut.some((parca) => !doluMetinMi(parca))) {
      throw new TypeError(`komutlar.${ad} bos olmayan argv listesi olmalidir.`);
    }
  }
  return {
    ...plan,
    isAnahtarlari: [...new Set(plan.isAnahtarlari)].sort(),
    migrationPlani: { ...plan.migrationPlani },
    komutlar: Object.fromEntries(
      Object.entries(plan.komutlar).map(([ad, komut]) => [ad, [...komut]]),
    ),
  };
}

function baglamDogrula(baglam) {
  if (!baglam || typeof baglam !== "object") {
    throw new TypeError("baglam nesne olmalidir.");
  }
  for (const alan of [
    "aktor",
    "calistirici",
    "traceKimligi",
    "korelasyonKimligi",
    "zamanDamgasi",
  ]) {
    doluMetinDogrula(baglam[alan], alan);
  }
  for (const alan of ["aktor", "calistirici", "traceKimligi", "korelasyonKimligi"]) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(baglam[alan])) {
      throw new TypeError(`${alan} guvenli makine kimligi biciminde olmalidir.`);
    }
  }
  const zaman = new Date(baglam.zamanDamgasi);
  if (Number.isNaN(zaman.getTime()) || zaman.toISOString() !== baglam.zamanDamgasi) {
    throw new TypeError("zamanDamgasi kanonik UTC ISO-8601 biciminde olmalidir.");
  }
  return { ...baglam };
}

async function artefaktDogrula(plan) {
  let gercekOzet;
  try {
    gercekOzet = await dosyaOzetiHesapla(plan.artefaktYolu);
  } catch {
    throw new TeslimatHattiHatasi(
      "RELEASE_ARTIFACT_NOT_FOUND",
      "Release artefakti okunamadi.",
      { releaseKimligi: plan.releaseKimligi },
    );
  }
  if (gercekOzet !== plan.artefaktSha256) {
    throw new TeslimatHattiHatasi(
      "RELEASE_ARTIFACT_CHANGED",
      "Release artefakti kayitli SHA-256 ozetiyle eslesmiyor.",
      { releaseKimligi: plan.releaseKimligi },
    );
  }
}

function dosyaOzetiHesapla(dosyaYolu) {
  return new Promise((resolveSonuc, reject) => {
    const ozet = createHash("sha256");
    const akis = createReadStream(dosyaYolu);
    akis.on("data", (parca) => ozet.update(parca));
    akis.once("error", reject);
    akis.once("end", () => resolveSonuc(ozet.digest("hex")));
  });
}

function releaseVeTanimDogrula(depo, plan) {
  const mevcut = depo.releaseGetir(plan.releaseKimligi);
  if (!mevcut) {
    throw new TeslimatHattiHatasi(
      "RELEASE_NOT_FOUND",
      "Release candidate bulunamadi.",
      { releaseKimligi: plan.releaseKimligi },
    );
  }
  tanimAyniMiDogrula(mevcut, plan);
  return mevcut;
}

function tanimAyniMiDogrula(mevcut, plan) {
  const ayni = mevcut.commitKimligi === plan.commitKimligi
    && mevcut.artefaktYolu === plan.artefaktYolu
    && mevcut.artefaktSha256 === plan.artefaktSha256
    && mevcut.imzaKimligi === plan.imzaKimligi
    && mevcut.dagitimStratejisi === plan.dagitimStratejisi
    && mevcut.backupRestoreKanitKimligi === plan.backupRestoreKanitKimligi
    && JSON.stringify(mevcut.isAnahtarlari) === JSON.stringify(plan.isAnahtarlari)
    && JSON.stringify(mevcut.migrationPlani) === JSON.stringify(plan.migrationPlani);
  if (!ayni) {
    throw new TeslimatHattiHatasi(
      "RELEASE_IMMUTABLE_CONFLICT",
      "Ayni release kimligi farkli manifest ile kullanilamaz.",
      { releaseKimligi: plan.releaseKimligi, mevcutDurum: mevcut.durum },
    );
  }
}

function sonucOlustur(release, tekrar = false) {
  return {
    releaseKimligi: release.releaseKimligi,
    durum: release.durum,
    basariliMi: release.durum === "ADAY_HAZIR"
      || release.durum === "STAGING_DOGRULANDI"
      || release.durum === "PRODUCTION_DOGRULANDI",
    tekrar,
    referanslar: {
      releaseKimligi: release.releaseKimligi,
      commitKimligi: release.commitKimligi,
      isAnahtarlari: release.isAnahtarlari,
      artefaktSha256: release.artefaktSha256,
    },
  };
}

function basariliMi(sonuc) {
  return sonuc && Number.isInteger(sonuc.cikisKodu) && sonuc.cikisKodu === 0;
}

function asamaBul(durum) {
  if (durum.startsWith("ADAY") || durum === "BASLANGIC") return "candidate";
  if (durum.startsWith("STAGING")) return "staging";
  return "production";
}

function durumHatasi(releaseKimligi, mevcutDurum, beklenenDurum) {
  return new TeslimatHattiHatasi(
    "RELEASE_STATE_INVALID",
    `Release durumu ${beklenenDurum} olmali.`,
    { releaseKimligi, mevcutDurum },
  );
}

function kilitHatasi(ortam, releaseKimligi) {
  return new TeslimatHattiHatasi(
    "RELEASE_DEPLOYMENT_LOCKED",
    `${ortam} ortami baska bir teslimat tarafindan kilitli.`,
    { releaseKimligi },
  );
}

function doluMetinMi(deger) {
  return typeof deger === "string" && deger.trim() !== "";
}

function doluMetinDogrula(deger, alan) {
  if (!doluMetinMi(deger)) {
    throw new TypeError(`${alan} bos olmayan bir metin olmalidir.`);
  }
}

function kanitKimligiDogrula(deger, alan) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(deger)) {
    throw new TypeError(`${alan} guvenli kanit kimligi biciminde olmalidir.`);
  }
}
