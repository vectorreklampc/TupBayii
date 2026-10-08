#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { lstatSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { TeslimatHatti, TeslimatHattiHatasi } from "./teslimat-hatti.mjs";

const [asama, ...secenekler] = process.argv.slice(2);

try {
  const girdiler = secenekleriOku(secenekler);
  const plan = JSON.parse(readFileSync(resolve(girdiler.plan), "utf8"));
  const onayAnahtarlari = girdiler.approvalKeys
    ? JSON.parse(readFileSync(resolve(girdiler.approvalKeys), "utf8"))
    : {};
  const hat = new TeslimatHatti({
    depoYolu: resolve(girdiler.database),
    komutCalistir,
    onayAnahtarlari,
  });
  try {
    const sonuc = await hat.calistir(asama, plan, {
      aktor: girdiler.actor,
      calistirici: "ship.sh",
      traceKimligi: girdiler.trace ?? randomUUID(),
      korelasyonKimligi: girdiler.correlation ?? randomUUID(),
      zamanDamgasi: new Date().toISOString(),
    });
    process.stdout.write(`${JSON.stringify(sonuc)}\n`);
    if (!sonuc.basariliMi) process.exitCode = 2;
  } finally {
    hat.kapat();
  }
} catch (hata) {
  const guvenliHata = hata instanceof TeslimatHattiHatasi
    ? { kod: hata.kod, mesaj: hata.message, mevcutDurum: hata.mevcutDurum }
    : { kod: "RELEASE_INPUT_INVALID", mesaj: hata.message };
  process.stderr.write(`${JSON.stringify(guvenliHata)}\n`);
  process.exitCode = 1;
}

function secenekleriOku(secenekler) {
  const sonuc = {};
  const esleme = new Map([
    ["--plan", "plan"],
    ["--database", "database"],
    ["--actor", "actor"],
    ["--trace", "trace"],
    ["--correlation", "correlation"],
    ["--approval-keys", "approvalKeys"],
  ]);
  for (let index = 0; index < secenekler.length; index += 2) {
    const anahtar = esleme.get(secenekler[index]);
    const deger = secenekler[index + 1];
    if (!anahtar || !deger || deger.startsWith("--")) {
      throw new TypeError("Gecersiz ship.sh secenegi.");
    }
    sonuc[anahtar] = deger;
  }
  for (const zorunlu of ["plan", "database", "actor"]) {
    if (!sonuc[zorunlu]) {
      throw new TypeError(`--${zorunlu} secenegi zorunludur.`);
    }
  }
  return sonuc;
}

async function komutCalistir(ad, komut, baglam) {
  const [calistirilabilir, ...argumanlar] = komut;
  const hedefDogrulamaKomutuMu = ad.endsWith("ArtifactVerify");
  const kanitDizini = hedefDogrulamaKomutuMu
    ? mkdtempSync(join(tmpdir(), "tbp-deploy-attestation-"))
    : null;
  const kanitYolu = kanitDizini ? join(kanitDizini, "sha256") : null;
  return new Promise((resolveSonuc, reject) => {
    let tamamlandi = false;
    const bitir = (islem) => {
      if (tamamlandi) return;
      tamamlandi = true;
      try {
        islem();
      } finally {
        if (kanitDizini) rmSync(kanitDizini, { recursive: true, force: true });
      }
    };
    const altSurec = spawn(calistirilabilir, argumanlar, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        TBP_RELEASE_ID: baglam.releaseKimligi,
        TBP_DEPLOYMENT_ENVIRONMENT: baglam.ortam,
        TBP_TRACE_ID: baglam.traceKimligi,
        TBP_CORRELATION_ID: baglam.korelasyonKimligi,
        TBP_ARTIFACT_PATH: baglam.artefaktYolu,
        TBP_ARTIFACT_SHA256: baglam.artefaktSha256,
        ...(baglam.kilitKimligi
          ? {
            TBP_FENCE_TOKEN: baglam.kilitKimligi,
            TBP_FENCE_GENERATION: String(baglam.fencingNesli),
            TBP_IDEMPOTENCY_KEY: baglam.idempotencyAnahtari,
          }
          : {}),
        ...(kanitYolu
          ? { TBP_TARGET_ATTESTATION_PATH: kanitYolu }
          : {}),
      },
      shell: false,
      stdio: "inherit",
    });
    altSurec.once("error", (hata) => bitir(() => reject(hata)));
    altSurec.once("exit", (kod, sinyal) => {
      bitir(() => {
        try {
          const cikisKodu = Number.isInteger(kod) ? kod : 1;
          let dagitilanArtefaktSha256;
          let hedefKaniti;
          if (hedefDogrulamaKomutuMu && cikisKodu === 0) {
            const kanit = lstatSync(kanitYolu);
            if (!kanit.isFile() || kanit.size > 2048) {
              throw new Error("Hedef attestation gecerli bir JSON dosyasi degil.");
            }
            hedefKaniti = JSON.parse(readFileSync(kanitYolu, "utf8"));
            const izinliAlanlar = new Set([
              "artefaktSha256",
              "kilitKimligi",
              "fencingNesli",
              "idempotencyAnahtari",
            ]);
            if (!hedefKaniti || typeof hedefKaniti !== "object"
                || Array.isArray(hedefKaniti)
                || Object.keys(hedefKaniti).some((alan) => !izinliAlanlar.has(alan))
                || !/^[0-9a-f]{64}$/.test(hedefKaniti.artefaktSha256 ?? "")
                || hedefKaniti.kilitKimligi !== baglam.kilitKimligi
                || hedefKaniti.fencingNesli !== baglam.fencingNesli
                || hedefKaniti.idempotencyAnahtari !== baglam.idempotencyAnahtari) {
              throw new Error("Hedef attestation fence baglamiyla eslesmiyor.");
            }
            dagitilanArtefaktSha256 = hedefKaniti.artefaktSha256;
          }
          resolveSonuc({
            cikisKodu,
            sinyal,
            dagitilanArtefaktSha256,
            kilitKimligi: hedefKaniti?.kilitKimligi,
            fencingNesli: hedefKaniti?.fencingNesli,
            idempotencyAnahtari: hedefKaniti?.idempotencyAnahtari,
          });
        } catch (hata) {
          reject(hata);
        }
      });
    });
  });
}
