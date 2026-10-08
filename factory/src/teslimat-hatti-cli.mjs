#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

import { TeslimatHatti, TeslimatHattiHatasi } from "./teslimat-hatti.mjs";

const [asama, ...secenekler] = process.argv.slice(2);

try {
  const girdiler = secenekleriOku(secenekler);
  const plan = JSON.parse(readFileSync(resolve(girdiler.plan), "utf8"));
  const hat = new TeslimatHatti({
    depoYolu: resolve(girdiler.database),
    komutCalistir,
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

async function komutCalistir(_ad, komut, baglam) {
  const [calistirilabilir, ...argumanlar] = komut;
  return new Promise((resolveSonuc, reject) => {
    const altSurec = spawn(calistirilabilir, argumanlar, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        TBP_RELEASE_ID: baglam.releaseKimligi,
        TBP_DEPLOYMENT_ENVIRONMENT: baglam.ortam,
        TBP_TRACE_ID: baglam.traceKimligi,
        TBP_CORRELATION_ID: baglam.korelasyonKimligi,
      },
      shell: false,
      stdio: "inherit",
    });
    altSurec.once("error", reject);
    altSurec.once("exit", (kod, sinyal) => {
      resolveSonuc({ cikisKodu: Number.isInteger(kod) ? kod : 1, sinyal });
    });
  });
}
