import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, test } from "node:test";

import {
  TeslimatHatti,
  TeslimatHattiDeposu,
  TeslimatHattiHatasi,
  humanGateImzaMetniOlustur,
} from "../src/teslimat-hatti.mjs";

const { privateKey: onayOzelAnahtari, publicKey: onayAcikAnahtari } =
  generateKeyPairSync("ed25519");
const ONAY_ANAHTARLARI = {
  "jira-human-gate-1": {
    onaylayanKimligi: "atlassian-712020",
    publicKeyPem: onayAcikAnahtari.export({ type: "spki", format: "pem" }),
  },
};

const geciciDizinler = [];

afterEach(() => {
  for (const dizin of geciciDizinler.splice(0)) {
    rmSync(dizin, { recursive: true, force: true });
  }
});

function kurulum() {
  const dizin = mkdtempSync(join(tmpdir(), "tbp-238-"));
  geciciDizinler.push(dizin);
  const artefaktYolu = join(dizin, "tup-bayi.tar");
  writeFileSync(artefaktYolu, "immutable-release-artifact");
  const depoYolu = join(dizin, "teslimat.sqlite");
  return { dizin, artefaktYolu, depoYolu };
}

function plan(artefaktYolu, degisiklik = {}) {
  return {
    releaseKimligi: "release-2026.10.08.1",
    isAnahtarlari: ["TBP-238"],
    commitKimligi: "86ed8a7",
    artefaktYolu,
    artefaktSha256: createHash("sha256")
      .update("immutable-release-artifact")
      .digest("hex"),
    imzaKimligi: "sigstore-bundle-238",
    dagitimStratejisi: "ROLLING",
    migrationPlani: {
      dryRunKanitKimligi: "MIGRATION-DRY-RUN-238",
      forwardPlanKimligi: "FORWARD-PLAN-238",
      rollbackPlanKimligi: "ROLLBACK-PLAN-238",
    },
    backupRestoreKanitKimligi: "BACKUP-RESTORE-238",
    insanOnayi: null,
    recoveryOnayi: null,
    komutlar: {
      versionBuild: ["version-build"],
      sbomDependencySecurity: ["security"],
      migrationsDryRun: ["migration-dry-run"],
      fullTest: ["full-test"],
      acceptance: ["acceptance"],
      packageSign: ["package-sign"],
      stagingDeploy: ["staging-deploy"],
      stagingArtifactVerify: ["staging-artifact-verify"],
      stagingSmoke: ["staging-smoke"],
      stagingTelemetry: ["staging-telemetry"],
      productionDeploy: ["production-deploy"],
      productionArtifactVerify: ["production-artifact-verify"],
      productionSmoke: ["production-smoke"],
      productionTelemetry: ["production-telemetry"],
      rollback: ["rollback"],
    },
    ...degisiklik,
  };
}

function baglam(degisiklik = {}) {
  return {
    aktor: "codex",
    calistirici: "ship.sh",
    traceKimligi: "trace-tbp-238",
    korelasyonKimligi: "corr-tbp-238",
    zamanDamgasi: "2026-10-08T10:00:00.000Z",
    ...degisiklik,
  };
}

function basariliCalistirici(cagrilar, sonucDegistir = {}) {
  return async (ad, _komut, komutBaglami) => {
    cagrilar.push(ad);
    return sonucDegistir[ad] ?? {
      cikisKodu: 0,
      ...(ad.endsWith("ArtifactVerify")
        ? {
          dagitilanArtefaktSha256: komutBaglami.artefaktSha256,
          kilitKimligi: komutBaglami.kilitKimligi,
          fencingNesli: komutBaglami.fencingNesli,
          idempotencyAnahtari: komutBaglami.idempotencyAnahtari,
        }
        : {}),
    };
  };
}

function onayiImzala(onay) {
  return {
    ...onay,
    anahtarKimligi: "jira-human-gate-1",
    imza: sign(
      null,
      Buffer.from(humanGateImzaMetniOlustur({
        ...onay,
        anahtarKimligi: "jira-human-gate-1",
      })),
      onayOzelAnahtari,
    ).toString("base64url"),
  };
}

function insanOnayiEkle(releasePlani, stagingSonucu) {
  return {
    ...releasePlani,
    insanOnayi: onayiImzala({
      kanitKimligi: "HUMAN-GATE-238",
      onaylayanKimligi: "atlassian-712020",
      releaseKimligi: releasePlani.releaseKimligi,
      artefaktSha256: releasePlani.artefaktSha256,
      stagingKanitKimligi: stagingSonucu.stagingKanitKimligi,
      ortam: "production",
    }),
  };
}

describe("TBP-238 kontrollu teslimat hatti", () => {
  test("TEST-TBP-238-CLI-01 candidate staging ve imzali production akisi calisir", () => {
    const { dizin, artefaktYolu, depoYolu } = kurulum();
    const planYolu = join(dizin, "release-plan.json");
    const komut = [process.execPath, "-e", "process.exit(0)"];
    const releasePlani = plan(artefaktYolu);
    releasePlani.komutlar = Object.fromEntries(
      Object.keys(releasePlani.komutlar).map((ad) => [ad, komut]),
    );
    releasePlani.komutlar.stagingArtifactVerify = [
      process.execPath,
      "-e",
      "require('node:fs').writeFileSync(process.env.TBP_TARGET_ATTESTATION_PATH, JSON.stringify({artefaktSha256:require('node:crypto').createHash('sha256').update(require('node:fs').readFileSync(process.env.TBP_ARTIFACT_PATH)).digest('hex'),kilitKimligi:process.env.TBP_FENCE_TOKEN,fencingNesli:Number(process.env.TBP_FENCE_GENERATION),idempotencyAnahtari:process.env.TBP_IDEMPOTENCY_KEY}))",
    ];
    releasePlani.komutlar.productionArtifactVerify = [
      ...releasePlani.komutlar.stagingArtifactVerify,
    ];
    writeFileSync(planYolu, JSON.stringify(releasePlani));

    const sonuc = spawnSync(process.execPath, [
      "src/teslimat-hatti-cli.mjs",
      "candidate",
      "--plan", planYolu,
      "--database", depoYolu,
      "--actor", "codex",
      "--trace", "trace-cli-238",
      "--correlation", "corr-cli-238",
    ], { cwd: process.cwd(), encoding: "utf8" });

    assert.equal(sonuc.status, 0, sonuc.stderr);
    assert.equal(JSON.parse(sonuc.stdout).durum, "ADAY_HAZIR");

    const stagingSonucu = spawnSync(process.execPath, [
      "src/teslimat-hatti-cli.mjs",
      "staging",
      "--plan", planYolu,
      "--database", depoYolu,
      "--actor", "codex",
      "--trace", "trace-cli-238-staging",
      "--correlation", "corr-cli-238-staging",
    ], { cwd: process.cwd(), encoding: "utf8" });

    assert.equal(stagingSonucu.status, 0, stagingSonucu.stderr);
    const stagingCiktisi = JSON.parse(stagingSonucu.stdout);
    assert.equal(stagingCiktisi.durum, "STAGING_DOGRULANDI");

    releasePlani.insanOnayi = insanOnayiEkle(releasePlani, stagingCiktisi).insanOnayi;
    writeFileSync(planYolu, JSON.stringify(releasePlani));
    const onayAnahtarlariYolu = join(dizin, "approval-keys.json");
    writeFileSync(onayAnahtarlariYolu, JSON.stringify(ONAY_ANAHTARLARI));
    const productionSonucu = spawnSync(process.execPath, [
      "src/teslimat-hatti-cli.mjs",
      "production",
      "--plan", planYolu,
      "--database", depoYolu,
      "--actor", "codex",
      "--trace", "trace-cli-238-production",
      "--correlation", "corr-cli-238-production",
      "--approval-keys", onayAnahtarlariYolu,
    ], { cwd: process.cwd(), encoding: "utf8" });

    assert.equal(productionSonucu.status, 0, productionSonucu.stderr);
    assert.equal(JSON.parse(productionSonucu.stdout).durum, "PRODUCTION_DOGRULANDI");
  });

  test("TEST-TBP-238-CANDIDATE-01 aday kapilarini sirayla gecirip immutable artefakti kaydeder", async () => {
    const { artefaktYolu, depoYolu } = kurulum();
    const cagrilar = [];
    const hat = new TeslimatHatti({
      depoYolu,
      komutCalistir: basariliCalistirici(cagrilar),
    });

    const sonuc = await hat.calistir("candidate", plan(artefaktYolu), baglam());

    assert.equal(sonuc.durum, "ADAY_HAZIR");
    assert.deepEqual(cagrilar, [
      "versionBuild",
      "sbomDependencySecurity",
      "migrationsDryRun",
      "fullTest",
      "acceptance",
      "packageSign",
    ]);
    assert.deepEqual(sonuc.referanslar, {
      releaseKimligi: "release-2026.10.08.1",
      commitKimligi: "86ed8a7",
      isAnahtarlari: ["TBP-238"],
      artefaktSha256: plan(artefaktYolu).artefaktSha256,
    });
    assert.deepEqual(
      hat.denetimKayitlariniListele("release-2026.10.08.1")
        .filter(({ sonucKodu }) => sonucKodu === "RELEASE_GATE_PASSED")
        .map(({ kapi }) => kapi),
      [
        "versionBuild",
        "sbomDependencySecurity",
        "migrationsDryRun",
        "fullTest",
        "acceptance",
        "packageSign",
      ],
    );
    hat.kapat();
  });

  test("TEST-TBP-238-GATE-01 kirmizi aday kapisinda sonraki komutlari ve release ilerlemesini durdurur", async () => {
    const { artefaktYolu, depoYolu } = kurulum();
    const cagrilar = [];
    const hat = new TeslimatHatti({
      depoYolu,
      komutCalistir: basariliCalistirici(cagrilar, {
        sbomDependencySecurity: { cikisKodu: 9 },
      }),
    });

    await assert.rejects(
      hat.calistir("candidate", plan(artefaktYolu), baglam()),
      (hata) => hata instanceof TeslimatHattiHatasi
        && hata.kod === "RELEASE_GATE_FAILED",
    );
    assert.deepEqual(cagrilar, ["versionBuild", "sbomDependencySecurity"]);
    assert.equal(hat.releaseGetir("release-2026.10.08.1").durum, "ADAY_ENGELLENDI");
    hat.kapat();
  });

  test("TEST-TBP-238-SIGN-01 package sign artefakti degistirirse adayi engeller", async () => {
    const { artefaktYolu, depoYolu } = kurulum();
    const hat = new TeslimatHatti({
      depoYolu,
      komutCalistir: async (ad) => {
        if (ad === "packageSign") writeFileSync(artefaktYolu, "mutated-by-sign");
        return { cikisKodu: 0 };
      },
    });

    await assert.rejects(
      hat.calistir("candidate", plan(artefaktYolu), baglam()),
      (hata) => hata.kod === "RELEASE_ARTIFACT_CHANGED",
    );
    assert.equal(hat.releaseGetir("release-2026.10.08.1").durum, "ADAY_ENGELLENDI");
    hat.kapat();
  });

  test("TEST-TBP-238-FAILURE-01 komut baslatma hatasini fail-closed kapi hatasina cevirir", async () => {
    const { artefaktYolu, depoYolu } = kurulum();
    const hat = new TeslimatHatti({
      depoYolu,
      komutCalistir: async () => { throw new Error("spawn error"); },
    });

    await assert.rejects(
      hat.calistir("candidate", plan(artefaktYolu), baglam()),
      (hata) => hata.kod === "RELEASE_GATE_FAILED",
    );
    assert.equal(hat.releaseGetir("release-2026.10.08.1").durum, "ADAY_ENGELLENDI");
    hat.kapat();
  });

  test("TEST-TBP-238-STAGING-01 staging deploy smoke ve telemetry kapilarini ayni artefaktla tamamlar", async () => {
    const { artefaktYolu, depoYolu } = kurulum();
    const cagrilar = [];
    const hat = new TeslimatHatti({
      depoYolu,
      komutCalistir: basariliCalistirici(cagrilar),
    });
    const releasePlani = plan(artefaktYolu);
    await hat.calistir("candidate", releasePlani, baglam());
    cagrilar.length = 0;

    const sonuc = await hat.calistir("staging", releasePlani, baglam({
      zamanDamgasi: "2026-10-08T10:05:00.000Z",
    }));

    assert.equal(sonuc.durum, "STAGING_DOGRULANDI");
    assert.deepEqual(cagrilar, [
      "stagingDeploy",
      "stagingArtifactVerify",
      "stagingSmoke",
      "stagingTelemetry",
    ]);
    hat.kapat();
  });

  test("TEST-TBP-238-ARTIFACT-01 candidate sonrasi kaynak degisse de content-addressed snapshot dagitilir", async () => {
    const { artefaktYolu, depoYolu } = kurulum();
    const cagrilar = [];
    const dagitimYollari = [];
    const hat = new TeslimatHatti({
      depoYolu,
      komutCalistir: async (ad, _komut, komutBaglami) => {
        cagrilar.push(ad);
        if (ad === "stagingDeploy") {
          dagitimYollari.push(komutBaglami.artefaktYolu);
        }
        if (ad === "stagingArtifactVerify") {
          return {
            cikisKodu: 0,
            dagitilanArtefaktSha256: komutBaglami.artefaktSha256,
            kilitKimligi: komutBaglami.kilitKimligi,
            fencingNesli: komutBaglami.fencingNesli,
            idempotencyAnahtari: komutBaglami.idempotencyAnahtari,
          };
        }
        return { cikisKodu: 0 };
      },
    });
    const releasePlani = plan(artefaktYolu);
    await hat.calistir("candidate", releasePlani, baglam());
    cagrilar.length = 0;
    writeFileSync(artefaktYolu, "mutated");

    const sonuc = await hat.calistir("staging", releasePlani, baglam({
      zamanDamgasi: "2026-10-08T10:05:00.000Z",
    }));

    assert.equal(sonuc.durum, "STAGING_DOGRULANDI");
    assert.equal(dagitimYollari.length, 1);
    assert.notEqual(dagitimYollari[0], artefaktYolu);
    hat.kapat();
  });

  test("TEST-TBP-238-ARTIFACT-02 deploy sirasinda snapshot degisirse staging dogrulanmaz", async () => {
    const { artefaktYolu, depoYolu } = kurulum();
    const cagrilar = [];
    const hat = new TeslimatHatti({
      depoYolu,
      komutCalistir: async (ad, _komut, komutBaglami) => {
        cagrilar.push(ad);
        if (ad === "stagingDeploy") {
          chmodSync(komutBaglami.artefaktYolu, 0o644);
          writeFileSync(komutBaglami.artefaktYolu, "tampered-during-deploy");
          return {
            cikisKodu: 0,
            dagitilanArtefaktSha256: komutBaglami.artefaktSha256,
          };
        }
        return { cikisKodu: 0 };
      },
    });
    const releasePlani = plan(artefaktYolu);
    await hat.calistir("candidate", releasePlani, baglam());

    await assert.rejects(
      hat.calistir("staging", releasePlani, baglam({
        zamanDamgasi: "2026-10-08T10:05:00.000Z",
      })),
      (hata) => hata.kod === "RELEASE_ARTIFACT_CHANGED",
    );
    assert.deepEqual(cagrilar.slice(-1), ["stagingDeploy"]);
    assert.equal(hat.releaseGetir(releasePlani.releaseKimligi).durum, "STAGING_ENGELLENDI");
    hat.kapat();
  });

  test("TEST-TBP-238-MANIFEST-01 candidate sonrasi gate komutlari degistirilemez", async () => {
    const { artefaktYolu, depoYolu } = kurulum();
    const cagrilar = [];
    const hat = new TeslimatHatti({
      depoYolu,
      komutCalistir: basariliCalistirici(cagrilar),
    });
    const releasePlani = plan(artefaktYolu);
    await hat.calistir("candidate", releasePlani, baglam());
    const stagingSonucu = await hat.calistir("staging", releasePlani, baglam({
      zamanDamgasi: "2026-10-08T10:05:00.000Z",
    }));
    const degistirilmisPlan = insanOnayiEkle({
      ...releasePlani,
      komutlar: {
        ...releasePlani.komutlar,
        productionDeploy: ["unreviewed", "prod"],
        productionSmoke: ["always-true"],
        productionTelemetry: ["always-true"],
      },
    }, stagingSonucu);
    cagrilar.length = 0;

    await assert.rejects(
      hat.calistir("production", degistirilmisPlan, baglam({
        zamanDamgasi: "2026-10-08T10:10:00.000Z",
      })),
      (hata) => hata.kod === "RELEASE_IMMUTABLE_CONFLICT",
    );
    assert.deepEqual(cagrilar, []);
    hat.kapat();
  });

  test("TEST-TBP-238-HUMAN-01 Human Gate kaniti olmadan production deploy baslatmaz", async () => {
    const { artefaktYolu, depoYolu } = kurulum();
    const cagrilar = [];
    const hat = new TeslimatHatti({
      depoYolu,
      komutCalistir: basariliCalistirici(cagrilar),
    });
    const releasePlani = plan(artefaktYolu);
    await hat.calistir("candidate", releasePlani, baglam());
    const stagingSonucu = await hat.calistir("staging", releasePlani, baglam({
      zamanDamgasi: "2026-10-08T10:05:00.000Z",
    }));
    cagrilar.length = 0;

    await assert.rejects(
      hat.calistir("production", { ...releasePlani, insanOnayi: null }, baglam({
        zamanDamgasi: "2026-10-08T10:10:00.000Z",
      })),
      (hata) => hata.kod === "RELEASE_HUMAN_GATE_REQUIRED",
    );
    assert.deepEqual(cagrilar, []);
    hat.kapat();
  });

  test("TEST-TBP-238-HUMAN-02 self-asserted Human Gate production yetkisi vermez", async () => {
    const { artefaktYolu, depoYolu } = kurulum();
    const cagrilar = [];
    const hat = new TeslimatHatti({
      depoYolu,
      komutCalistir: basariliCalistirici(cagrilar),
      onayAnahtarlari: ONAY_ANAHTARLARI,
    });
    const releasePlani = plan(artefaktYolu);
    await hat.calistir("candidate", releasePlani, baglam());
    const stagingSonucu = await hat.calistir("staging", releasePlani, baglam({
      zamanDamgasi: "2026-10-08T10:05:00.000Z",
    }));
    cagrilar.length = 0;
    const sahteOnay = insanOnayiEkle(releasePlani, stagingSonucu);
    sahteOnay.insanOnayi = {
      ...sahteOnay.insanOnayi,
      imza: Buffer.alloc(64).toString("base64url"),
    };

    await assert.rejects(
      hat.calistir("production", sahteOnay, baglam({
        zamanDamgasi: "2026-10-08T10:10:00.000Z",
      })),
      (hata) => hata.kod === "RELEASE_HUMAN_GATE_UNTRUSTED",
    );
    assert.deepEqual(cagrilar, []);
    hat.kapat();
  });

  test("TEST-TBP-238-ROLLBACK-01 production smoke kirmiziysa rollback uygular ve basarili saymaz", async () => {
    const { artefaktYolu, depoYolu } = kurulum();
    const cagrilar = [];
    const hat = new TeslimatHatti({
      depoYolu,
      komutCalistir: basariliCalistirici(cagrilar, {
        productionSmoke: { cikisKodu: 2 },
      }),
      onayAnahtarlari: ONAY_ANAHTARLARI,
    });
    const releasePlani = plan(artefaktYolu);
    await hat.calistir("candidate", releasePlani, baglam());
    const stagingSonucu = await hat.calistir("staging", releasePlani, baglam({
      zamanDamgasi: "2026-10-08T10:05:00.000Z",
    }));
    cagrilar.length = 0;

    const sonuc = await hat.calistir(
      "production",
      insanOnayiEkle(releasePlani, stagingSonucu),
      baglam({
      zamanDamgasi: "2026-10-08T10:10:00.000Z",
      }),
    );

    assert.equal(sonuc.durum, "ROLLBACK_UYGULANDI");
    assert.equal(sonuc.basariliMi, false);
    assert.deepEqual(cagrilar, [
      "productionDeploy",
      "productionArtifactVerify",
      "productionSmoke",
      "rollback",
    ]);
    assert.equal(
      hat.denetimKayitlariniListele(releasePlani.releaseKimligi).at(-1).sonucKodu,
      "RELEASE_ROLLBACK_APPLIED",
    );
    hat.kapat();
  });

  test("TEST-TBP-238-PRODUCTION-01 Human Gate sonrasi production smoke ve telemetry ile dogrulanir", async () => {
    const { artefaktYolu, depoYolu } = kurulum();
    const cagrilar = [];
    const hat = new TeslimatHatti({
      depoYolu,
      komutCalistir: basariliCalistirici(cagrilar),
      onayAnahtarlari: ONAY_ANAHTARLARI,
    });
    const releasePlani = plan(artefaktYolu);
    await hat.calistir("candidate", releasePlani, baglam());
    const stagingSonucu = await hat.calistir("staging", releasePlani, baglam({
      zamanDamgasi: "2026-10-08T10:05:00.000Z",
    }));
    cagrilar.length = 0;

    const sonuc = await hat.calistir(
      "production",
      insanOnayiEkle(releasePlani, stagingSonucu),
      baglam({
      zamanDamgasi: "2026-10-08T10:10:00.000Z",
      }),
    );

    assert.equal(sonuc.durum, "PRODUCTION_DOGRULANDI");
    assert.equal(sonuc.basariliMi, true);
    assert.deepEqual(cagrilar, [
      "productionDeploy",
      "productionArtifactVerify",
      "productionSmoke",
      "productionTelemetry",
    ]);
    assert.equal(
      hat.denetimKayitlariniListele(releasePlani.releaseKimligi)
        .some(({ sonucKodu, kapi }) => sonucKodu === "RELEASE_HUMAN_GATE_VERIFIED"
          && kapi === "HUMAN-GATE-238"),
      true,
    );
    hat.kapat();
  });

  test("TEST-TBP-238-INCIDENT-01 rollback da kirmiziysa incident acik birakir", async () => {
    const { artefaktYolu, depoYolu } = kurulum();
    const hat = new TeslimatHatti({
      depoYolu,
      komutCalistir: basariliCalistirici([], {
        productionTelemetry: { cikisKodu: 4 },
        rollback: { cikisKodu: 5 },
      }),
      onayAnahtarlari: ONAY_ANAHTARLARI,
    });
    const releasePlani = plan(artefaktYolu);
    await hat.calistir("candidate", releasePlani, baglam());
    const stagingSonucu = await hat.calistir("staging", releasePlani, baglam({
      zamanDamgasi: "2026-10-08T10:05:00.000Z",
    }));

    const sonuc = await hat.calistir(
      "production",
      insanOnayiEkle(releasePlani, stagingSonucu),
      baglam({
      zamanDamgasi: "2026-10-08T10:10:00.000Z",
      }),
    );

    assert.equal(sonuc.durum, "INCIDENT_ACIK");
    assert.equal(sonuc.basariliMi, false);
    hat.kapat();
  });

  test("TEST-TBP-238-LOCK-01 ayni ortama eszamanli ikinci dagitimi reddeder", async () => {
    const { artefaktYolu, depoYolu } = kurulum();
    let stagingSerbestBirak;
    const stagingBeklet = new Promise((resolve) => { stagingSerbestBirak = resolve; });
    const ilkHat = new TeslimatHatti({
      depoYolu,
      komutCalistir: async (ad, _komut, komutBaglami) => {
        if (ad === "stagingDeploy") await stagingBeklet;
        return {
          cikisKodu: 0,
          ...(ad === "stagingArtifactVerify"
            ? {
              dagitilanArtefaktSha256: komutBaglami.artefaktSha256,
              kilitKimligi: komutBaglami.kilitKimligi,
              fencingNesli: komutBaglami.fencingNesli,
              idempotencyAnahtari: komutBaglami.idempotencyAnahtari,
            }
            : {}),
        };
      },
    });
    const ikinciHat = new TeslimatHatti({
      depoYolu,
      komutCalistir: basariliCalistirici([]),
    });
    const releasePlani = plan(artefaktYolu);
    await ilkHat.calistir("candidate", releasePlani, baglam());
    const ilkDagitim = ilkHat.calistir("staging", releasePlani, baglam({
      zamanDamgasi: "2026-10-08T10:05:00.000Z",
    }));
    await new Promise((resolve) => setImmediate(resolve));

    await assert.rejects(
      ikinciHat.calistir("staging", releasePlani, baglam({
        calistirici: "ship.sh-2",
        zamanDamgasi: "2026-10-08T10:05:01.000Z",
      })),
      (hata) => hata.kod === "RELEASE_DEPLOYMENT_LOCKED",
    );
    stagingSerbestBirak();
    await ilkDagitim;
    ilkHat.kapat();
    ikinciHat.kapat();
  });

  test("TEST-TBP-238-RECOVERY-01 suresi dolan lease Human Gate ile rollback edilir ve eski fencing token ilerleyemez", async () => {
    const { artefaktYolu, depoYolu } = kurulum();
    let simdi = new Date("2026-10-08T10:00:00.000Z");
    let stagingSerbestBirak;
    let stagingBasladi;
    const hedefOrtam = { fencingNesli: 0, durum: "ESKI_SURUM" };
    const stagingBeklet = new Promise((resolve) => { stagingSerbestBirak = resolve; });
    const stagingBaslangici = new Promise((resolve) => { stagingBasladi = resolve; });
    const releasePlani = plan(artefaktYolu);
    const ilkHat = new TeslimatHatti({
      depoYolu,
      saat: () => new Date(simdi),
      leaseSuresiMs: 30_000,
      heartbeatAraligiMs: 10_000,
      komutCalistir: async (ad, _komut, komutBaglami) => {
        if (ad === "stagingDeploy") {
          stagingBasladi();
          await stagingBeklet;
          if (komutBaglami.fencingNesli < hedefOrtam.fencingNesli) {
            return { cikisKodu: 3 };
          }
          hedefOrtam.fencingNesli = komutBaglami.fencingNesli;
          hedefOrtam.durum = "YENI_SURUM";
        }
        return {
          cikisKodu: 0,
          ...(ad === "stagingArtifactVerify"
            ? {
              dagitilanArtefaktSha256: komutBaglami.artefaktSha256,
              kilitKimligi: komutBaglami.kilitKimligi,
              fencingNesli: komutBaglami.fencingNesli,
              idempotencyAnahtari: komutBaglami.idempotencyAnahtari,
            }
            : {}),
        };
      },
    });
    await ilkHat.calistir("candidate", releasePlani, baglam());
    const eskiDagitim = ilkHat.calistir("staging", releasePlani, baglam({
      zamanDamgasi: "2026-10-08T10:00:01.000Z",
    }));
    await stagingBaslangici;
    simdi = new Date("2026-10-08T10:00:32.000Z");

    const kurtarmaPlani = {
      ...releasePlani,
      recoveryOnayi: onayiImzala({
        kanitKimligi: "RECOVERY-HUMAN-GATE-238",
        onaylayanKimligi: "atlassian-712020",
        releaseKimligi: releasePlani.releaseKimligi,
        artefaktSha256: releasePlani.artefaktSha256,
        ortam: "staging",
        kilitNesli: 1,
      }),
    };
    let rollbackSerbestBirak;
    let rollbackBasladi;
    const rollbackBeklet = new Promise((resolve) => { rollbackSerbestBirak = resolve; });
    const rollbackBaslangici = new Promise((resolve) => { rollbackBasladi = resolve; });
    const kurtarmaHatti = new TeslimatHatti({
      depoYolu,
      saat: () => new Date(simdi),
      leaseSuresiMs: 30_000,
      heartbeatAraligiMs: 100,
      komutCalistir: async (ad, _komut, komutBaglami) => {
        if (ad === "rollback") {
          assert.equal(komutBaglami.idempotencyAnahtari, "release-2026.10.08.1:staging:rollback");
          assert.equal(komutBaglami.fencingNesli, 2);
          rollbackBasladi();
          await rollbackBeklet;
          hedefOrtam.fencingNesli = komutBaglami.fencingNesli;
          hedefOrtam.durum = "ROLLBACK";
        }
        return { cikisKodu: 0 };
      },
      onayAnahtarlari: ONAY_ANAHTARLARI,
    });
    const kurtarmaIslemi = kurtarmaHatti.calistir(
      "recovery",
      kurtarmaPlani,
      baglam({
        calistirici: "ship.sh-recovery",
        zamanDamgasi: "2026-10-08T10:00:32.000Z",
      }),
    );
    await rollbackBaslangici;
    simdi = new Date("2026-10-08T10:00:50.000Z");
    await new Promise((resolve) => setTimeout(resolve, 150));
    simdi = new Date("2026-10-08T10:01:03.000Z");
    const ikinciKurtarmaPlani = {
      ...releasePlani,
      recoveryOnayi: onayiImzala({
        kanitKimligi: "RECOVERY-HUMAN-GATE-238-SECOND",
        onaylayanKimligi: "atlassian-712020",
        releaseKimligi: releasePlani.releaseKimligi,
        artefaktSha256: releasePlani.artefaktSha256,
        ortam: "staging",
        kilitNesli: 2,
      }),
    };
    const ikinciKurtarmaHatti = new TeslimatHatti({
      depoYolu,
      saat: () => new Date(simdi),
      leaseSuresiMs: 30_000,
      heartbeatAraligiMs: 100,
      komutCalistir: basariliCalistirici([]),
      onayAnahtarlari: ONAY_ANAHTARLARI,
    });
    await assert.rejects(
      ikinciKurtarmaHatti.calistir("recovery", ikinciKurtarmaPlani, baglam({
        calistirici: "ship.sh-recovery-2",
        zamanDamgasi: "2026-10-08T10:01:03.000Z",
      })),
      (hata) => hata.kod === "RELEASE_DEPLOYMENT_LOCKED",
    );
    rollbackSerbestBirak();
    const kurtarmaSonucu = await kurtarmaIslemi;

    assert.equal(kurtarmaSonucu.durum, "STAGING_ENGELLENDI");
    assert.equal(kurtarmaSonucu.basariliMi, false);
    stagingSerbestBirak();
    await assert.rejects(
      eskiDagitim,
      (hata) => hata.kod === "RELEASE_DEPLOYMENT_FENCE_LOST",
    );
    assert.deepEqual(hedefOrtam, { fencingNesli: 2, durum: "ROLLBACK" });
    assert.equal(kurtarmaHatti.releaseGetir(releasePlani.releaseKimligi).durum, "STAGING_ENGELLENDI");
    ilkHat.kapat();
    kurtarmaHatti.kapat();
    ikinciKurtarmaHatti.kapat();
  });

  test("TEST-TBP-238-FENCE-01 fencing nesli tamamlanan release'ler arasinda da monoton artar", async () => {
    const { artefaktYolu, depoYolu } = kurulum();
    const nesiller = [];
    const hat = new TeslimatHatti({
      depoYolu,
      komutCalistir: async (ad, _komut, komutBaglami) => {
        if (ad === "stagingDeploy") nesiller.push(komutBaglami.fencingNesli);
        return basariliCalistirici([])(ad, _komut, komutBaglami);
      },
    });
    const ilkPlan = plan(artefaktYolu);
    const ikinciPlan = plan(artefaktYolu, {
      releaseKimligi: "release-2026.10.08.2",
      commitKimligi: "86ed8a8",
    });

    await hat.calistir("candidate", ilkPlan, baglam());
    await hat.calistir("staging", ilkPlan, baglam());
    await hat.calistir("candidate", ikinciPlan, baglam());
    await hat.calistir("staging", ikinciPlan, baglam());

    assert.deepEqual(nesiller, [1, 2]);
    hat.kapat();
  });

  test("TEST-TBP-238-AUDIT-01 release audit kayitlari degistirilemez ve silinemez", async () => {
    const { artefaktYolu, depoYolu } = kurulum();
    const hat = new TeslimatHatti({
      depoYolu,
      komutCalistir: basariliCalistirici([]),
    });
    await hat.calistir("candidate", plan(artefaktYolu), baglam());
    hat.kapat();

    const depo = new TeslimatHattiDeposu(depoYolu);
    depo.kapat();
    const veritabani = new DatabaseSync(depoYolu);
    assert.throws(
      () => veritabani.exec("UPDATE release_denetimi SET sonuc_kodu = 'DEGISTI'"),
      /RELEASE_AUDIT_IMMUTABLE/,
    );
    assert.throws(
      () => veritabani.exec("DELETE FROM release_denetimi"),
      /RELEASE_AUDIT_IMMUTABLE/,
    );
    assert.throws(
      () => veritabani.exec("UPDATE release_kayitlari SET commit_kimligi = 'abcdef0'"),
      /RELEASE_MANIFEST_IMMUTABLE/,
    );
    veritabani.close();
  });
});
