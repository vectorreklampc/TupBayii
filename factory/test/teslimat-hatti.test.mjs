import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, test } from "node:test";

import {
  TeslimatHatti,
  TeslimatHattiDeposu,
  TeslimatHattiHatasi,
} from "../src/teslimat-hatti.mjs";

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
    insanOnayiKanitKimligi: "HUMAN-GATE-238",
    komutlar: {
      versionBuild: ["version-build"],
      sbomDependencySecurity: ["security"],
      migrationsDryRun: ["migration-dry-run"],
      fullTest: ["full-test"],
      acceptance: ["acceptance"],
      packageSign: ["package-sign"],
      stagingDeploy: ["staging-deploy"],
      stagingSmoke: ["staging-smoke"],
      stagingTelemetry: ["staging-telemetry"],
      productionDeploy: ["production-deploy"],
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
  return async (ad) => {
    cagrilar.push(ad);
    return sonucDegistir[ad] ?? { cikisKodu: 0 };
  };
}

describe("TBP-238 kontrollu teslimat hatti", () => {
  test("TEST-TBP-238-CLI-01 candidate komutu plan dosyasini calistirir", () => {
    const { dizin, artefaktYolu, depoYolu } = kurulum();
    const planYolu = join(dizin, "release-plan.json");
    const komut = [process.execPath, "-e", "process.exit(0)"];
    const releasePlani = plan(artefaktYolu);
    releasePlani.komutlar = Object.fromEntries(
      Object.keys(releasePlani.komutlar).map((ad) => [ad, komut]),
    );
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
      "stagingSmoke",
      "stagingTelemetry",
    ]);
    hat.kapat();
  });

  test("TEST-TBP-238-ARTIFACT-01 degistirilmis artefakti staginge dagitmaz", async () => {
    const { artefaktYolu, depoYolu } = kurulum();
    const cagrilar = [];
    const hat = new TeslimatHatti({
      depoYolu,
      komutCalistir: basariliCalistirici(cagrilar),
    });
    const releasePlani = plan(artefaktYolu);
    await hat.calistir("candidate", releasePlani, baglam());
    cagrilar.length = 0;
    writeFileSync(artefaktYolu, "mutated");

    await assert.rejects(
      hat.calistir("staging", releasePlani, baglam({
        zamanDamgasi: "2026-10-08T10:05:00.000Z",
      })),
      (hata) => hata.kod === "RELEASE_ARTIFACT_CHANGED",
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
    const releasePlani = plan(artefaktYolu, { insanOnayiKanitKimligi: null });
    await hat.calistir("candidate", releasePlani, baglam());
    await hat.calistir("staging", releasePlani, baglam({
      zamanDamgasi: "2026-10-08T10:05:00.000Z",
    }));
    cagrilar.length = 0;

    await assert.rejects(
      hat.calistir("production", releasePlani, baglam({
        zamanDamgasi: "2026-10-08T10:10:00.000Z",
      })),
      (hata) => hata.kod === "RELEASE_HUMAN_GATE_REQUIRED",
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
    });
    const releasePlani = plan(artefaktYolu);
    await hat.calistir("candidate", releasePlani, baglam());
    await hat.calistir("staging", releasePlani, baglam({
      zamanDamgasi: "2026-10-08T10:05:00.000Z",
    }));
    cagrilar.length = 0;

    const sonuc = await hat.calistir("production", releasePlani, baglam({
      zamanDamgasi: "2026-10-08T10:10:00.000Z",
    }));

    assert.equal(sonuc.durum, "ROLLBACK_UYGULANDI");
    assert.equal(sonuc.basariliMi, false);
    assert.deepEqual(cagrilar, [
      "productionDeploy",
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
    });
    const releasePlani = plan(artefaktYolu);
    await hat.calistir("candidate", releasePlani, baglam());
    await hat.calistir("staging", releasePlani, baglam({
      zamanDamgasi: "2026-10-08T10:05:00.000Z",
    }));
    cagrilar.length = 0;

    const sonuc = await hat.calistir("production", releasePlani, baglam({
      zamanDamgasi: "2026-10-08T10:10:00.000Z",
    }));

    assert.equal(sonuc.durum, "PRODUCTION_DOGRULANDI");
    assert.equal(sonuc.basariliMi, true);
    assert.deepEqual(cagrilar, [
      "productionDeploy",
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
    });
    const releasePlani = plan(artefaktYolu);
    await hat.calistir("candidate", releasePlani, baglam());
    await hat.calistir("staging", releasePlani, baglam({
      zamanDamgasi: "2026-10-08T10:05:00.000Z",
    }));

    const sonuc = await hat.calistir("production", releasePlani, baglam({
      zamanDamgasi: "2026-10-08T10:10:00.000Z",
    }));

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
      komutCalistir: async (ad) => {
        if (ad === "stagingDeploy") await stagingBeklet;
        return { cikisKodu: 0 };
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
