import { createHash, randomUUID } from "node:crypto";
import { constants as dosyaSistemiSabitleri, createReadStream } from "node:fs";
import { chmod, copyFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
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
const ASAMALAR = new Set(["candidate", "staging", "production", "recovery"]);
const KOMUT_ADLARI = Object.freeze([
  ...ADAY_KAPILARI,
  ...STAGING_KAPILARI,
  ...PRODUCTION_KAPILARI,
  "rollback",
]);

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
  #saat;
  #leaseSuresiMs;
  #heartbeatAraligiMs;
  #artefaktDepoDizini;

  constructor({
    depoYolu,
    komutCalistir,
    saat = () => new Date(),
    leaseSuresiMs = 30_000,
    heartbeatAraligiMs = 10_000,
  }) {
    if (typeof komutCalistir !== "function") {
      throw new TypeError("komutCalistir fonksiyon olmalidir.");
    }
    if (typeof saat !== "function") throw new TypeError("saat fonksiyon olmalidir.");
    if (!Number.isInteger(leaseSuresiMs) || leaseSuresiMs < 1_000) {
      throw new TypeError("leaseSuresiMs en az 1000 olmalidir.");
    }
    if (!Number.isInteger(heartbeatAraligiMs)
        || heartbeatAraligiMs < 100
        || heartbeatAraligiMs >= leaseSuresiMs) {
      throw new TypeError("heartbeatAraligiMs lease suresinden kisa olmalidir.");
    }
    this.#depo = new TeslimatHattiDeposu(depoYolu);
    this.#komutCalistir = komutCalistir;
    this.#saat = saat;
    this.#leaseSuresiMs = leaseSuresiMs;
    this.#heartbeatAraligiMs = heartbeatAraligiMs;
    this.#artefaktDepoDizini = `${depoYolu}.artifacts`;
  }

  async calistir(asama, hamPlan, hamBaglam) {
    if (!ASAMALAR.has(asama)) {
      throw new TeslimatHattiHatasi(
        "RELEASE_STAGE_UNKNOWN",
        "Teslimat asamasi candidate, staging, production veya recovery olmalidir.",
      );
    }
    const plan = planDogrula(hamPlan);
    const baglam = baglamDogrula(hamBaglam);

    if (asama === "candidate") return this.#adayHazirla(plan, baglam);
    if (asama === "staging") return this.#stagingDogrula(plan, baglam);
    if (asama === "recovery") return this.#recoveryUygula(plan, baglam);
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

    await artefaktDogrula(plan.artefaktYolu, plan.artefaktSha256, plan.releaseKimligi);
    const dagitimArtefaktYolu = await artefaktSnapshotOlustur(
      plan,
      this.#artefaktDepoDizini,
    );
    const kaliciPlan = { ...plan, dagitimArtefaktYolu };
    this.#depo.releaseOlustur(kaliciPlan, baglam);
    for (const kapi of ADAY_KAPILARI) {
      const sonuc = await this.#komutuCalistir(kapi, kaliciPlan, baglam, "candidate");
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
      await artefaktDogrula(
        plan.artefaktYolu,
        plan.artefaktSha256,
        plan.releaseKimligi,
      );
      await artefaktDogrula(
        dagitimArtefaktYolu,
        plan.artefaktSha256,
        plan.releaseKimligi,
      );
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
    await artefaktDogrula(
      mevcut.dagitimArtefaktYolu,
      mevcut.artefaktSha256,
      mevcut.releaseKimligi,
    );
    if (mevcut.durum === "STAGING_DOGRULANDI") return sonucOlustur(mevcut, true);
    if (mevcut.durum === "STAGING_DAGITILIYOR") {
      throw kilitHatasi("staging", plan.releaseKimligi);
    }
    if (!new Set(["ADAY_HAZIR", "STAGING_ENGELLENDI"]).has(mevcut.durum)) {
      throw durumHatasi(plan.releaseKimligi, mevcut.durum, "ADAY_HAZIR");
    }
    return this.#kilitliDagitimCalistir({
      ortam: "staging",
      plan: { ...plan, dagitimArtefaktYolu: mevcut.dagitimArtefaktYolu },
      baglam,
      kapilar: STAGING_KAPILARI,
      beklenenDurumlar: ["ADAY_HAZIR", "STAGING_ENGELLENDI"],
      calisanDurum: "STAGING_DAGITILIYOR",
      basariliDurum: "STAGING_DOGRULANDI",
      basariKodu: "RELEASE_STAGING_VERIFIED",
      hataDurumu: "STAGING_ENGELLENDI",
      stagingKanitKimligi: stagingKanitKimligiOlustur(mevcut),
    });
  }

  async #productionDogrula(plan, baglam) {
    const mevcut = releaseVeTanimDogrula(this.#depo, plan);
    await artefaktDogrula(
      mevcut.dagitimArtefaktYolu,
      mevcut.artefaktSha256,
      mevcut.releaseKimligi,
    );
    if (mevcut.durum === "PRODUCTION_DOGRULANDI") return sonucOlustur(mevcut, true);
    if (mevcut.durum === "PRODUCTION_DAGITILIYOR") {
      throw kilitHatasi("production", plan.releaseKimligi);
    }
    if (mevcut.durum !== "STAGING_DOGRULANDI") {
      throw durumHatasi(plan.releaseKimligi, mevcut.durum, "STAGING_DOGRULANDI");
    }
    if (!plan.insanOnayi) {
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
    onayBaginiDogrula(plan.insanOnayi, mevcut, true);
    this.#depo.onayKaydet({
      releaseKimligi: plan.releaseKimligi,
      onayTuru: "PRODUCTION",
      onay: plan.insanOnayi,
      baglam,
    });
    this.#depo.denetimYaz({
      releaseKimligi: plan.releaseKimligi,
      asama: "production",
      sonucKodu: "RELEASE_HUMAN_GATE_VERIFIED",
      baglam,
      kapi: plan.insanOnayi.kanitKimligi,
    });

    return this.#kilitliDagitimCalistir({
      ortam: "production",
      plan: { ...plan, dagitimArtefaktYolu: mevcut.dagitimArtefaktYolu },
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

  async #recoveryUygula(plan, baglam) {
    const mevcut = releaseVeTanimDogrula(this.#depo, plan);
    const ortam = mevcut.durum === "STAGING_DAGITILIYOR"
      ? "staging"
      : mevcut.durum === "PRODUCTION_DAGITILIYOR"
        ? "production"
        : null;
    if (!ortam) {
      throw durumHatasi(
        plan.releaseKimligi,
        mevcut.durum,
        "STAGING_DAGITILIYOR veya PRODUCTION_DAGITILIYOR",
      );
    }
    if (!plan.recoveryOnayi) {
      throw new TeslimatHattiHatasi(
        "RELEASE_HUMAN_GATE_REQUIRED",
        "Crash recovery icin Human Gate kaniti zorunludur.",
        { releaseKimligi: plan.releaseKimligi, mevcutDurum: mevcut.durum },
      );
    }
    onayBaginiDogrula(plan.recoveryOnayi, mevcut, false);
    const leaseZamanlari = this.#leaseZamanlari();
    const kilit = this.#depo.kilitKurtarmaIcinDevral({
      ortam,
      releaseKimligi: plan.releaseKimligi,
      sahip: baglam.calistirici,
      kilitKimligi: randomUUID(),
      ...leaseZamanlari,
    });
    try {
      this.#depo.onayKaydet({
        releaseKimligi: plan.releaseKimligi,
        onayTuru: "RECOVERY",
        onay: plan.recoveryOnayi,
        baglam,
      });
      const rollbackSonucu = await this.#komutuCalistir(
        "rollback",
        { ...plan, dagitimArtefaktYolu: mevcut.dagitimArtefaktYolu },
        baglam,
        ortam,
      );
      this.#depo.kilitDogrula(this.#kilitBaglami(kilit));
      const rollbackBasarili = basariliMi(rollbackSonucu);
      const hedefDurum = rollbackBasarili
        ? ortam === "staging" ? "STAGING_ENGELLENDI" : "ROLLBACK_UYGULANDI"
        : "INCIDENT_ACIK";
      this.#depo.durumDegistir({
        releaseKimligi: plan.releaseKimligi,
        beklenenDurumlar: [mevcut.durum],
        hedefDurum,
        sonucKodu: rollbackBasarili
          ? "RELEASE_RECOVERY_ROLLBACK_APPLIED"
          : "RELEASE_INCIDENT_OPEN",
        baglam,
        kapi: plan.recoveryOnayi.kanitKimligi,
        kilit: this.#kilitBaglami(kilit),
      });
      return sonucOlustur(this.#depo.releaseGetir(plan.releaseKimligi));
    } finally {
      this.#depo.kilitBirak(kilit);
    }
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
    stagingKanitKimligi = null,
  }) {
    const leaseZamanlari = this.#leaseZamanlari();
    const kilit = this.#depo.kilitAl({
      ortam,
      releaseKimligi: plan.releaseKimligi,
      sahip: baglam.calistirici,
      kilitKimligi: randomUUID(),
      ...leaseZamanlari,
    });
    let heartbeatHatasi = null;
    const heartbeat = setInterval(() => {
      try {
        const heartbeatZamanlari = this.#leaseZamanlari();
        this.#depo.kilitYenile({
          ...kilit,
          ...heartbeatZamanlari,
        });
      } catch (hata) {
        heartbeatHatasi = hata;
      }
    }, this.#heartbeatAraligiMs);
    heartbeat.unref();
    try {
      this.#depo.durumDegistir({
        releaseKimligi: plan.releaseKimligi,
        beklenenDurumlar,
        hedefDurum: calisanDurum,
        sonucKodu: "RELEASE_DEPLOYMENT_STARTED",
        baglam,
        kilit: this.#kilitBaglami(kilit),
      });
      for (const kapi of kapilar) {
        const sonuc = await this.#komutuCalistir(kapi, plan, baglam, ortam);
        if (heartbeatHatasi) throw heartbeatHatasi;
        this.#depo.kilitDogrula(this.#kilitBaglami(kilit));
        let kapiBasarili = basariliMi(sonuc);
        let artefaktHatasi = null;
        if (kapiBasarili && kapi.endsWith("Deploy")) {
          kapiBasarili = sonuc.dagitilanArtefaktSha256 === plan.artefaktSha256;
          try {
            await artefaktDogrula(
              plan.dagitimArtefaktYolu,
              plan.artefaktSha256,
              plan.releaseKimligi,
            );
          } catch (hata) {
            kapiBasarili = false;
            artefaktHatasi = hata;
          }
        }
        if (kapiBasarili) {
          this.#depo.denetimYaz({
            releaseKimligi: plan.releaseKimligi,
            asama: ortam,
            sonucKodu: "RELEASE_GATE_PASSED",
            baglam,
            kapi,
            kilit: this.#kilitBaglami(kilit),
          });
          continue;
        }

        if (rollbackUygula) {
          return await this.#rollbackCalistir(plan, baglam, kapi, ortam, kilit);
        }
        this.#depo.durumDegistir({
          releaseKimligi: plan.releaseKimligi,
          beklenenDurumlar: [calisanDurum],
          hedefDurum: hataDurumu,
          sonucKodu: "RELEASE_GATE_FAILED",
          baglam,
          kapi,
          kilit: this.#kilitBaglami(kilit),
        });
        if (artefaktHatasi) throw artefaktHatasi;
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
        kilit: this.#kilitBaglami(kilit),
        stagingKanitKimligi,
      });
      return sonucOlustur(this.#depo.releaseGetir(plan.releaseKimligi));
    } finally {
      clearInterval(heartbeat);
      this.#depo.kilitBirak(kilit);
    }
  }

  async #rollbackCalistir(plan, baglam, basarisizKapi, ortam, kilit) {
    const rollbackSonucu = await this.#komutuCalistir(
      "rollback",
      plan,
      baglam,
      ortam,
    );
    this.#depo.kilitDogrula(this.#kilitBaglami(kilit));
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
      kilit: this.#kilitBaglami(kilit),
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
        artefaktYolu: plan.dagitimArtefaktYolu ?? plan.artefaktYolu,
        artefaktSha256: plan.artefaktSha256,
      });
    } catch {
      return { cikisKodu: 1 };
    }
  }

  #simdiIso() {
    const simdi = this.#saat();
    if (!(simdi instanceof Date) || Number.isNaN(simdi.getTime())) {
      throw new TypeError("saat gecerli Date dondurmelidir.");
    }
    return simdi.toISOString();
  }

  #leaseZamanlari() {
    const simdi = this.#saat();
    if (!(simdi instanceof Date) || Number.isNaN(simdi.getTime())) {
      throw new TypeError("saat gecerli Date dondurmelidir.");
    }
    return {
      simdi: simdi.toISOString(),
      leaseBitis: new Date(simdi.getTime() + this.#leaseSuresiMs).toISOString(),
    };
  }

  #kilitBaglami(kilit) {
    return { ...kilit, simdi: this.#simdiIso() };
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
          kaynak_artefakt_yolu, dagitim_artefakt_yolu, artefakt_sha256,
          komut_plani_sha256, imza_kimligi, dagitim_stratejisi,
          migration_plani, backup_restore_kaniti
        ) VALUES (?, 'BASLANGIC', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        plan.releaseKimligi,
        plan.commitKimligi,
        JSON.stringify(plan.isAnahtarlari),
        plan.artefaktYolu,
        plan.dagitimArtefaktYolu,
        plan.artefaktSha256,
        plan.komutPlaniSha256,
        plan.imzaKimligi,
        plan.dagitimStratejisi,
        JSON.stringify(plan.migrationPlani),
        plan.backupRestoreKanitKimligi,
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
        kaynak_artefakt_yolu AS artefaktYolu,
        dagitim_artefakt_yolu AS dagitimArtefaktYolu,
        artefakt_sha256 AS artefaktSha256,
        komut_plani_sha256 AS komutPlaniSha256,
        imza_kimligi AS imzaKimligi, dagitim_stratejisi AS dagitimStratejisi,
        migration_plani AS migrationPlani,
        backup_restore_kaniti AS backupRestoreKanitKimligi,
        staging_kanit_kimligi AS stagingKanitKimligi
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
    kilit = null,
    stagingKanitKimligi = null,
  }) {
    this.#veritabani.exec("BEGIN IMMEDIATE");
    try {
      const mevcut = this.#veritabani
        .prepare(`SELECT durum, staging_kanit_kimligi AS stagingKanitKimligi
                  FROM release_kayitlari WHERE release_kimligi = ?`)
        .get(releaseKimligi);
      if (!mevcut || !beklenenDurumlar.includes(mevcut.durum)) {
        throw durumHatasi(
          releaseKimligi,
          mevcut?.durum ?? null,
          beklenenDurumlar.join(" veya "),
        );
      }
      if (kilit) this.#kilitDogrula(kilit);
      if (stagingKanitKimligi
          && mevcut.stagingKanitKimligi
          && mevcut.stagingKanitKimligi !== stagingKanitKimligi) {
        throw new TeslimatHattiHatasi(
          "RELEASE_IMMUTABLE_CONFLICT",
          "Staging kaniti sonradan degistirilemez.",
          { releaseKimligi, mevcutDurum: mevcut.durum },
        );
      }
      this.#veritabani.prepare(`
        UPDATE release_kayitlari
        SET durum = ?, staging_kanit_kimligi = COALESCE(staging_kanit_kimligi, ?)
        WHERE release_kimligi = ?
      `).run(hedefDurum, stagingKanitKimligi, releaseKimligi);
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

  denetimYaz({
    releaseKimligi,
    asama,
    sonucKodu,
    baglam,
    kapi = null,
    kilit = null,
  }) {
    if (kilit) this.#kilitDogrula(kilit);
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

  onayKaydet({ releaseKimligi, onayTuru, onay, baglam }) {
    const mevcut = this.#veritabani.prepare(`
      SELECT kanit_kimligi AS kanitKimligi,
        onaylayan_kimligi AS onaylayanKimligi,
        artefakt_sha256 AS artefaktSha256,
        staging_kanit_kimligi AS stagingKanitKimligi
      FROM human_gate_onaylari
      WHERE release_kimligi = ? AND onay_turu = ?
    `).get(releaseKimligi, onayTuru);
    if (mevcut) {
      const ayni = mevcut.kanitKimligi === onay.kanitKimligi
        && mevcut.onaylayanKimligi === onay.onaylayanKimligi
        && mevcut.artefaktSha256 === onay.artefaktSha256
        && mevcut.stagingKanitKimligi === (onay.stagingKanitKimligi ?? null);
      if (ayni) return;
      throw new TeslimatHattiHatasi(
        "RELEASE_IMMUTABLE_CONFLICT",
        "Human Gate kaniti sonradan degistirilemez.",
        { releaseKimligi },
      );
    }
    this.#veritabani.prepare(`
      INSERT INTO human_gate_onaylari (
        release_kimligi, onay_turu, kanit_kimligi, onaylayan_kimligi,
        artefakt_sha256, staging_kanit_kimligi, aktor,
        korelasyon_kimligi, zaman_damgasi
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      releaseKimligi,
      onayTuru,
      onay.kanitKimligi,
      onay.onaylayanKimligi,
      onay.artefaktSha256,
      onay.stagingKanitKimligi ?? null,
      baglam.aktor,
      baglam.korelasyonKimligi,
      baglam.zamanDamgasi,
    );
  }

  kilitAl({
    ortam,
    releaseKimligi,
    sahip,
    kilitKimligi,
    simdi,
    leaseBitis,
  }) {
    try {
      this.#veritabani.prepare(`
        INSERT INTO deployment_kilitleri
          (ortam, release_kimligi, sahip, kilit_kimligi, nesil,
           alinma_zamani, lease_bitis_zamani)
        VALUES (?, ?, ?, ?, 1, ?, ?)
      `).run(ortam, releaseKimligi, sahip, kilitKimligi, simdi, leaseBitis);
      return { ortam, releaseKimligi, kilitKimligi, nesil: 1 };
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

  kilitKurtarmaIcinDevral({
    ortam,
    releaseKimligi,
    sahip,
    kilitKimligi,
    simdi,
    leaseBitis,
  }) {
    this.#veritabani.exec("BEGIN IMMEDIATE");
    try {
      const mevcut = this.#veritabani.prepare(`
        SELECT release_kimligi AS releaseKimligi, nesil, lease_bitis_zamani AS leaseBitis
        FROM deployment_kilitleri WHERE ortam = ?
      `).get(ortam);
      if (!mevcut || mevcut.releaseKimligi !== releaseKimligi) {
        throw new TeslimatHattiHatasi(
          "RELEASE_RECOVERY_LOCK_NOT_FOUND",
          "Recovery icin beklenen deployment lock bulunamadi.",
          { releaseKimligi },
        );
      }
      if (mevcut.leaseBitis >= simdi) {
        throw kilitHatasi(ortam, releaseKimligi);
      }
      const nesil = mevcut.nesil + 1;
      this.#veritabani.prepare(`
        UPDATE deployment_kilitleri
        SET sahip = ?, kilit_kimligi = ?, nesil = ?,
            alinma_zamani = ?, lease_bitis_zamani = ?
        WHERE ortam = ? AND nesil = ?
      `).run(sahip, kilitKimligi, nesil, simdi, leaseBitis, ortam, mevcut.nesil);
      this.#veritabani.exec("COMMIT");
      return { ortam, releaseKimligi, kilitKimligi, nesil };
    } catch (hata) {
      if (this.#veritabani.isTransaction) this.#veritabani.exec("ROLLBACK");
      throw hata;
    }
  }

  kilitYenile({ ortam, releaseKimligi, kilitKimligi, nesil, simdi, leaseBitis }) {
    const sonuc = this.#veritabani.prepare(`
      UPDATE deployment_kilitleri
      SET lease_bitis_zamani = ?
      WHERE ortam = ? AND release_kimligi = ? AND kilit_kimligi = ?
        AND nesil = ? AND lease_bitis_zamani >= ?
    `).run(leaseBitis, ortam, releaseKimligi, kilitKimligi, nesil, simdi);
    if (sonuc.changes !== 1) throw fencingHatasi(releaseKimligi);
  }

  kilitDogrula(kilit) {
    this.#kilitDogrula(kilit);
  }

  kilitBirak({ ortam, releaseKimligi, kilitKimligi, nesil }) {
    this.#veritabani.prepare(`
      DELETE FROM deployment_kilitleri
      WHERE ortam = ? AND release_kimligi = ? AND kilit_kimligi = ? AND nesil = ?
    `).run(ortam, releaseKimligi, kilitKimligi, nesil);
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

  #kilitDogrula({ ortam, releaseKimligi, kilitKimligi, nesil, simdi }) {
    const mevcut = this.#veritabani.prepare(`
      SELECT 1 FROM deployment_kilitleri
      WHERE ortam = ? AND release_kimligi = ? AND kilit_kimligi = ? AND nesil = ?
        AND lease_bitis_zamani >= ?
    `).get(ortam, releaseKimligi, kilitKimligi, nesil, simdi);
    if (!mevcut) throw fencingHatasi(releaseKimligi);
  }

  #semayiOlustur() {
    this.#veritabani.exec(`
      CREATE TABLE IF NOT EXISTS release_kayitlari (
        release_kimligi TEXT PRIMARY KEY,
        durum TEXT NOT NULL,
        commit_kimligi TEXT NOT NULL,
        is_anahtarlari TEXT NOT NULL,
        kaynak_artefakt_yolu TEXT NOT NULL,
        dagitim_artefakt_yolu TEXT NOT NULL,
        artefakt_sha256 TEXT NOT NULL,
        komut_plani_sha256 TEXT NOT NULL,
        imza_kimligi TEXT NOT NULL,
        dagitim_stratejisi TEXT NOT NULL,
        migration_plani TEXT NOT NULL,
        backup_restore_kaniti TEXT NOT NULL,
        staging_kanit_kimligi TEXT
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
        nesil INTEGER NOT NULL CHECK (nesil > 0),
        alinma_zamani TEXT NOT NULL,
        lease_bitis_zamani TEXT NOT NULL,
        FOREIGN KEY (release_kimligi) REFERENCES release_kayitlari (release_kimligi)
      ) STRICT;

      CREATE TABLE IF NOT EXISTS human_gate_onaylari (
        release_kimligi TEXT NOT NULL,
        onay_turu TEXT NOT NULL CHECK (onay_turu IN ('PRODUCTION', 'RECOVERY')),
        kanit_kimligi TEXT NOT NULL,
        onaylayan_kimligi TEXT NOT NULL,
        artefakt_sha256 TEXT NOT NULL,
        staging_kanit_kimligi TEXT,
        aktor TEXT NOT NULL,
        korelasyon_kimligi TEXT NOT NULL,
        zaman_damgasi TEXT NOT NULL,
        PRIMARY KEY (release_kimligi, onay_turu),
        FOREIGN KEY (release_kimligi) REFERENCES release_kayitlari (release_kimligi)
      ) STRICT;

      CREATE TRIGGER IF NOT EXISTS release_audit_update_yasak
      BEFORE UPDATE ON release_denetimi
      BEGIN SELECT RAISE(ABORT, 'RELEASE_AUDIT_IMMUTABLE'); END;

      CREATE TRIGGER IF NOT EXISTS release_audit_delete_yasak
      BEFORE DELETE ON release_denetimi
      BEGIN SELECT RAISE(ABORT, 'RELEASE_AUDIT_IMMUTABLE'); END;

      CREATE TRIGGER IF NOT EXISTS release_manifest_update_yasak
      BEFORE UPDATE OF commit_kimligi, is_anahtarlari, kaynak_artefakt_yolu,
        dagitim_artefakt_yolu, artefakt_sha256, komut_plani_sha256,
        imza_kimligi, dagitim_stratejisi,
        migration_plani, backup_restore_kaniti
      ON release_kayitlari
      BEGIN SELECT RAISE(ABORT, 'RELEASE_MANIFEST_IMMUTABLE'); END;

      CREATE TRIGGER IF NOT EXISTS release_kaydi_delete_yasak
      BEFORE DELETE ON release_kayitlari
      BEGIN SELECT RAISE(ABORT, 'RELEASE_RECORD_IMMUTABLE'); END;

      CREATE TRIGGER IF NOT EXISTS human_gate_update_yasak
      BEFORE UPDATE ON human_gate_onaylari
      BEGIN SELECT RAISE(ABORT, 'HUMAN_GATE_IMMUTABLE'); END;

      CREATE TRIGGER IF NOT EXISTS human_gate_delete_yasak
      BEFORE DELETE ON human_gate_onaylari
      BEGIN SELECT RAISE(ABORT, 'HUMAN_GATE_IMMUTABLE'); END;
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
    "backupRestoreKanitKimligi", "insanOnayi", "recoveryOnayi", "komutlar",
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
  onayYapisiDogrula(plan.insanOnayi, "insanOnayi", true);
  onayYapisiDogrula(plan.recoveryOnayi, "recoveryOnayi", false);
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
  if (Object.keys(plan.komutlar).some((ad) => !KOMUT_ADLARI.includes(ad))) {
    throw new TypeError("komutlar bilinmeyen kapi adi iceremez.");
  }
  for (const ad of KOMUT_ADLARI) {
    const komut = plan.komutlar[ad];
    if (!Array.isArray(komut) || komut.length === 0 || komut.some((parca) => !doluMetinMi(parca))) {
      throw new TypeError(`komutlar.${ad} bos olmayan argv listesi olmalidir.`);
    }
  }
  const komutlar = Object.fromEntries(
    KOMUT_ADLARI.map((ad) => [ad, [...plan.komutlar[ad]]]),
  );
  return {
    ...plan,
    isAnahtarlari: [...new Set(plan.isAnahtarlari)].sort(),
    migrationPlani: { ...plan.migrationPlani },
    insanOnayi: plan.insanOnayi ? { ...plan.insanOnayi } : null,
    recoveryOnayi: plan.recoveryOnayi ? { ...plan.recoveryOnayi } : null,
    komutlar,
    komutPlaniSha256: createHash("sha256")
      .update(JSON.stringify(komutlar))
      .digest("hex"),
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

async function artefaktDogrula(dosyaYolu, beklenenOzet, releaseKimligi) {
  let gercekOzet;
  try {
    gercekOzet = await dosyaOzetiHesapla(dosyaYolu);
  } catch {
    throw new TeslimatHattiHatasi(
      "RELEASE_ARTIFACT_NOT_FOUND",
      "Release artefakti okunamadi.",
      { releaseKimligi },
    );
  }
  if (gercekOzet !== beklenenOzet) {
    throw new TeslimatHattiHatasi(
      "RELEASE_ARTIFACT_CHANGED",
      "Release artefakti kayitli SHA-256 ozetiyle eslesmiyor.",
      { releaseKimligi },
    );
  }
}

async function artefaktSnapshotOlustur(plan, depoDizini) {
  await mkdir(depoDizini, { recursive: true });
  const hedef = join(depoDizini, `${plan.artefaktSha256}.artifact`);
  try {
    await copyFile(
      plan.artefaktYolu,
      hedef,
      dosyaSistemiSabitleri.COPYFILE_EXCL,
    );
  } catch (hata) {
    if (hata?.code !== "EEXIST") throw hata;
  }
  await artefaktDogrula(hedef, plan.artefaktSha256, plan.releaseKimligi);
  await chmod(hedef, 0o444);
  return hedef;
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
    && mevcut.komutPlaniSha256 === plan.komutPlaniSha256
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
    stagingKanitKimligi: release.stagingKanitKimligi,
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

function fencingHatasi(releaseKimligi) {
  return new TeslimatHattiHatasi(
    "RELEASE_DEPLOYMENT_FENCE_LOST",
    "Deployment lease veya fencing token artik gecerli degil.",
    { releaseKimligi },
  );
}

function stagingKanitKimligiOlustur(release) {
  const ozet = createHash("sha256")
    .update(`${release.releaseKimligi}:${release.commitKimligi}:${release.artefaktSha256}`)
    .digest("hex")
    .slice(0, 24);
  return `STAGING-${ozet}`;
}

function onayYapisiDogrula(onay, alan, stagingZorunluMu) {
  if (onay === null || onay === undefined) return;
  if (!onay || typeof onay !== "object" || Array.isArray(onay)) {
    throw new TypeError(`${alan} nesne olmalidir.`);
  }
  const izinliAlanlar = new Set([
    "kanitKimligi",
    "onaylayanKimligi",
    "releaseKimligi",
    "artefaktSha256",
    ...(stagingZorunluMu ? ["stagingKanitKimligi"] : []),
  ]);
  if (Object.keys(onay).some((anahtar) => !izinliAlanlar.has(anahtar))) {
    throw new TypeError(`${alan} bilinmeyen alan iceremez.`);
  }
  for (const anahtar of ["kanitKimligi", "onaylayanKimligi", "releaseKimligi"]) {
    kanitKimligiDogrula(onay[anahtar], `${alan}.${anahtar}`);
  }
  if (!/^[0-9a-f]{64}$/.test(onay.artefaktSha256 ?? "")) {
    throw new TypeError(`${alan}.artefaktSha256 SHA-256 biciminde olmalidir.`);
  }
  if (stagingZorunluMu) {
    kanitKimligiDogrula(onay.stagingKanitKimligi, `${alan}.stagingKanitKimligi`);
  }
}

function onayBaginiDogrula(onay, release, stagingZorunluMu) {
  const gecerli = onay.releaseKimligi === release.releaseKimligi
    && onay.artefaktSha256 === release.artefaktSha256
    && (!stagingZorunluMu
      || onay.stagingKanitKimligi === release.stagingKanitKimligi);
  if (!gecerli) {
    throw new TeslimatHattiHatasi(
      "RELEASE_HUMAN_GATE_MISMATCH",
      "Human Gate kaniti release, artefakt ve staging kanitina bagli olmalidir.",
      { releaseKimligi: release.releaseKimligi, mevcutDurum: release.durum },
    );
  }
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
  if (typeof deger !== "string"
      || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(deger)) {
    throw new TypeError(`${alan} guvenli kanit kimligi biciminde olmalidir.`);
  }
}
