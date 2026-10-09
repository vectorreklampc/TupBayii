import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { riskManifestiniDogrula } from "../src/risk-contract-manifesti.mjs";

const oracle = readFileSync(new URL("../oracle/risk-contract.v1.json", import.meta.url));
const oracleHash = "5d7163157bd2f4cb4f3d4f1a3135c37466200c06f85019480ea6e24b54f73209";
const hash = (baytlar) => createHash("sha256").update(baytlar).digest("hex");
const temel = {
  surum: 1, isAnahtari: "TBP-36", testKimligi: "TEST-TBP-36-FACTORY-RISK-CONTRACT",
  adaySha: "a".repeat(40), oracleSha256: oracleHash,
  bridgeSha256: "b".repeat(64), adapterSha256: "c".repeat(64),
  imageDigest: "node@sha256:" + "d".repeat(64),
  denemeKimligi: "11111111-2222-4333-8444-555555555555",
  argv: ["/usr/local/bin/node", "/trusted/risk-contract-bridge.mjs"],
  cwd: "/workspace/factory", sureMs: 10000, azamiGirdiByte: 4096, azamiCiktiByte: 4096,
};
const bayt = (nesne) => Buffer.from(`${JSON.stringify(nesne)}\n`);

test("kanonik dort vakayi disaridan pinlenen hash ile baglar, PASS uretmez", () => {
  assert.equal(oracle.length, 1153);
  assert.equal(hash(oracle), oracleHash);
  const manifest = bayt(temel);
  const sonuc = riskManifestiniDogrula(manifest, hash(manifest), oracle);
  assert.equal(sonuc.sonuc, "ESLESTI");
  assert.equal(sonuc.manifest.adaySha, temel.adaySha);
  assert.equal(Object.isFrozen(sonuc.manifest), true);
  assert.equal(Object.isFrozen(sonuc.manifest.argv), true);
});

test("pin, oracle veya manifest bayti degisirse fail-closed", () => {
  const manifest = bayt(temel);
  const bomlu = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), manifest]);
  for (const [kayit, pin, katalog] of [
    [manifest, undefined, oracle],
    [manifest, "0".repeat(64), oracle],
    [bayt({ ...temel, adaySha: "f".repeat(40) }), hash(manifest), oracle],
    [manifest, hash(manifest), Buffer.concat([oracle, Buffer.from(" ")])],
    [bomlu, hash(bomlu), oracle],
    [Buffer.from([0xff, 0x0a]), hash(Buffer.from([0xff, 0x0a])), oracle],
  ]) {
    assert.equal(riskManifestiniDogrula(kayit, pin, katalog).sonuc, "BLOCKED");
  }
});

test("hatali sema onayli hash ile bile calisma girdisi olamaz", () => {
  for (const degisiklik of [
    { adaySha: "branch-main" }, { argv: ["npm", "test"] },
    { cwd: "/tmp" }, { sureMs: 0 }, { azamiCiktiByte: 4097 },
    { extra: true }, { oracleSha256: "0".repeat(64) },
  ]) {
    const manifest = bayt({ ...temel, ...degisiklik });
    assert.equal(riskManifestiniDogrula(manifest, hash(manifest), oracle).sonuc, "BLOCKED");
  }
  const tekrarli = Buffer.from(`${JSON.stringify(temel).replace('"surum":1', '"surum":1,"surum":1')}\n`);
  assert.equal(riskManifestiniDogrula(tekrarli, hash(tekrarli), oracle).sonuc, "BLOCKED");
});
