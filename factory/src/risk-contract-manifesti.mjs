import { createHash } from "node:crypto";

const ORACLE_HASH = "5d7163157bd2f4cb4f3d4f1a3135c37466200c06f85019480ea6e24b54f73209";
const ALANLAR = [
  "surum", "isAnahtari", "testKimligi", "adaySha", "oracleSha256",
  "bridgeSha256", "adapterSha256", "imageDigest", "denemeKimligi",
  "argv", "cwd", "sureMs", "azamiGirdiByte", "azamiCiktiByte",
];
const SHA256 = /^[0-9a-f]{64}$/;
const hash = (baytlar) => createHash("sha256").update(baytlar).digest("hex");

// Pin ve bu kod adaydan ayri, onayli guven kokunden gelmedikce ESLESTI yetki vermez.
export function riskManifestiniDogrula(manifestBaytlari, onayliHash, oracleBaytlari) {
  if (!Buffer.isBuffer(manifestBaytlari) || manifestBaytlari.length > 4096
    || !Buffer.isBuffer(oracleBaytlari) || oracleBaytlari.length !== 1153
    || typeof onayliHash !== "string" || !SHA256.test(onayliHash)) return engel();

  // Paylasilan Buffer hash ile parse arasinda degistirilemesin.
  const manifestKopyasi = Buffer.from(manifestBaytlari);
  const oracleKopyasi = Buffer.from(oracleBaytlari);
  if (manifestKopyasi.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))
    || hash(manifestKopyasi) !== onayliHash || hash(oracleKopyasi) !== ORACLE_HASH) return engel();

  try {
    const metin = new TextDecoder("utf-8", { fatal: true }).decode(manifestKopyasi);
    const manifest = JSON.parse(metin);
    if (!nesneMi(manifest) || metin !== `${JSON.stringify(manifest)}\n`
      || Object.keys(manifest).length !== ALANLAR.length
      || !ALANLAR.every((alan) => Object.hasOwn(manifest, alan))
      || manifest.surum !== 1 || manifest.isAnahtari !== "TBP-36"
      || manifest.testKimligi !== "TEST-TBP-36-FACTORY-RISK-CONTRACT"
      || !/^[0-9a-f]{40}$/.test(manifest.adaySha)
      || manifest.oracleSha256 !== ORACLE_HASH
      || !SHA256.test(manifest.bridgeSha256 ?? "")
      || !SHA256.test(manifest.adapterSha256 ?? "")
      || !/^node@sha256:[0-9a-f]{64}$/.test(manifest.imageDigest ?? "")
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(manifest.denemeKimligi ?? "")
      || JSON.stringify(manifest.argv) !== '["/usr/local/bin/node","/trusted/risk-contract-bridge.mjs"]'
      || manifest.cwd !== "/workspace/factory" || manifest.sureMs !== 10000
      || manifest.azamiGirdiByte !== 4096 || manifest.azamiCiktiByte !== 4096) return engel();

    Object.freeze(manifest.argv);
    return { sonuc: "ESLESTI", manifest: Object.freeze(manifest) };
  } catch {
    return engel();
  }
}

function nesneMi(deger) {
  return deger !== null && typeof deger === "object" && !Array.isArray(deger);
}

function engel() {
  return { sonuc: "BLOCKED", manifest: null };
}
