import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const DIZIN = dirname(fileURLToPath(import.meta.url));
const KOK = resolve(DIZIN, "..");
const IMAJ = "node@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20";
// Genel test kosusu Docker daemon'a erisemez; yalniz acik sentetik opt-in.
const dockerTest = process.env.TBP36_SENTETIK_DOCKER === "1" ? test : test.skip;

function sentetikContainer(girdi) {
  const ad = `tbp36-sentetik-${randomUUID()}`;
  const sonuc = spawnSync("docker", [
    "run", "--rm", "-i", "--name", ad, "--pull", "never", "--network", "none", "--read-only",
    "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
    "--user", "65534:65534", "--pids-limit", "64", "--memory", "256m", "--cpus", "1",
    "--mount", `type=bind,source=${resolve(KOK, "src/sentetik-risk-contract-bridge.mjs")},target=/trusted/risk-contract-bridge.mjs,readonly`,
    "--mount", `type=bind,source=${resolve(DIZIN, "fixtures/sentetik-risk-modulu.mjs")},target=/workspace/factory/src/risk-degerlendirme-motoru.mjs,readonly`,
    "--workdir", "/workspace/factory", IMAJ,
    "/usr/local/bin/node", "/trusted/risk-contract-bridge.mjs",
  ], { input: girdi, encoding: "buffer", timeout: 10000, maxBuffer: 8192 });
  if (sonuc.error) {
    const temizlik = spawnSync("docker", ["rm", "--force", ad], { timeout: 3000 });
    if (temizlik.status !== 0) throw new Error(`Sentetik container kapanisi dogrulanamadi: ${ad}`);
  }
  return sonuc;
}

dockerTest("sentetik bridge tek stdin JSON satirini sabit export'a iletir", () => {
  const girdi = Buffer.from('{"baslik":"HIGH","etiketler":["NEDEN"]}\n');
  const sonuc = sentetikContainer(girdi);
  assert.equal(sonuc.error, undefined);
  assert.equal(sonuc.status, 0, sonuc.stderr.toString("utf8"));
  assert.equal(sonuc.stderr.length, 0);
  const beklenen = {
    riskSeviyesi: "HIGH", nedenKodlari: ["NEDEN"],
    codexOnIncelemeGerekliMi: true, insanKapisiGerekliMi: false,
  };
  assert.deepEqual(JSON.parse(sonuc.stdout.toString("utf8")), beklenen);
  assert.equal(sonuc.stdout.at(-1), 10);
});

dockerTest("sentetik bridge bozuk ve 4097 byte stdin'i reddeder", () => {
  const sabit = Buffer.byteLength('{"baslik":"","etiketler":[]}\n');
  const sinirGirdisi = Buffer.from(`${JSON.stringify({ baslik: "X".repeat(4096 - sabit), etiketler: [] })}\n`);
  assert.equal(sinirGirdisi.length, 4096);
  assert.equal(sentetikContainer(sinirGirdisi).status, 0);
  for (const girdi of [
    Buffer.from("PASS\n"), Buffer.from([0xff, 0x0a]),
    Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("{}\n")]),
    Buffer.concat([sinirGirdisi, Buffer.from(" ")]),
  ]) {
    const sonuc = sentetikContainer(girdi);
    assert.equal(sonuc.error, undefined);
    assert.notEqual(sonuc.status, 0);
    assert.equal(sonuc.stdout.length, 0);
  }
});
