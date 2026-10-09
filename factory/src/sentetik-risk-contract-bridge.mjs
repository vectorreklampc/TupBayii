// Bu bridge aday surecindedir; PASS karari veya dis surec gozlemi uretmez.
const AZAMI_GIRDI_BYTE = 4096;

async function girdiOku() {
  const parcalar = [];
  let uzunluk = 0;
  for await (const parca of process.stdin) {
    uzunluk += parca.length;
    if (uzunluk > AZAMI_GIRDI_BYTE) return null;
    parcalar.push(parca);
  }
  const ham = Buffer.concat(parcalar);
  if (ham.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))) return null;
  const metin = new TextDecoder("utf-8", { fatal: true }).decode(ham);
  if (!metin.endsWith("\n") || metin.includes("\r") || metin.slice(0, -1).includes("\n")) return null;
  const girdi = JSON.parse(metin.slice(0, -1));
  if (!girdi || typeof girdi !== "object" || Array.isArray(girdi)) return null;
  return girdi;
}

try {
  const girdi = await girdiOku();
  if (girdi === null) process.exitCode = 1;
  else {
    const { riskiDegerlendir } = await import("/workspace/factory/src/risk-degerlendirme-motoru.mjs");
    process.stdout.write(`${JSON.stringify(riskiDegerlendir(girdi))}\n`);
  }
} catch {
  process.exitCode = 1;
}
