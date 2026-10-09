import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, test } from "node:test";

import { sentetikRiskCiktisiniDogrula } from "../src/sentetik-risk-contract-adapter.mjs";

const BEKLENEN = {
  riskSeviyesi: "HIGH",
  nedenKodlari: ["YUKSEK_CONCURRENCY"],
  codexOnIncelemeGerekliMi: true,
  insanKapisiGerekliMi: false,
};
const DOGRU_CIKTI = Buffer.from(`${JSON.stringify(BEKLENEN)}\n`, "utf8");
const VAKALAR = [
  { kimlik: "RISK-01", girdi: { baslik: "README yazim duzeltmesi", aciklama: "Yalniz metin duzeltilecek.", etiketler: ["docs-only"] }, beklenen: { riskSeviyesi: "LOW", nedenKodlari: ["DOKUMANTASYON_VEYA_STIL"], codexOnIncelemeGerekliMi: false, insanKapisiGerekliMi: false } },
  { kimlik: "RISK-02", girdi: { baslik: "Eszamanli stok yarisi", aciklama: "Concurrency kontrolunu uygula.", etiketler: ["concurrency"] }, beklenen: BEKLENEN },
  { kimlik: "RISK-03", girdi: { baslik: "Tenant isolation mimarisini degistir", aciklama: "Veritabani sinirini yeniden tasarla.", etiketler: ["tenant-isolation", "architecture-change"] }, beklenen: { riskSeviyesi: "CRITICAL", nedenKodlari: ["KRITIK_TENANT_IZOLASYONU"], codexOnIncelemeGerekliMi: true, insanKapisiGerekliMi: true } },
  { kimlik: "RISK-04", girdi: { baslik: "Concurrency davranisini degistir", aciklama: "Paralel yarisi engelle.", etiketler: ["concurrency", 42] }, beklenen: { riskSeviyesi: "MEDIUM", nedenKodlari: ["RISK_GIRDISI_GECERSIZ"], codexOnIncelemeGerekliMi: false, insanKapisiGerekliMi: false } },
];

function gozlem(degisiklik = {}) {
  return {
    stdout: DOGRU_CIKTI,
    stderr: Buffer.alloc(0),
    exitKodu: 0,
    sinyal: null,
    zamanAsimi: false,
    kapandiMi: true,
    ...degisiklik,
  };
}

describe("TBP-36 sentetik risk contract dis dogrulayicisi", () => {
  test("dort onayli vaka taslak canonical byte ve hash ile aynidir", () => {
    const kanonik = Buffer.from(`${JSON.stringify(VAKALAR)}\n`, "utf8");
    assert.equal(kanonik.length, 1153);
    assert.equal(createHash("sha256").update(kanonik).digest("hex"),
      "5d7163157bd2f4cb4f3d4f1a3135c37466200c06f85019480ea6e24b54f73209");
    for (const vaka of VAKALAR) {
      const stdout = Buffer.from(`${JSON.stringify(vaka.beklenen)}\n`);
      assert.equal(sentetikRiskCiktisiniDogrula(gozlem({ stdout }), vaka.beklenen).sonuc, "DENEY_ESLESTI");
    }
  });

  test("tek tam JSON+LF ve dis surec gozlemi yalniz deney eslesmesi verir", () => {
    assert.deepEqual(sentetikRiskCiktisiniDogrula(gozlem(), BEKLENEN), {
      sonuc: "DENEY_ESLESTI", nedenKodu: null,
    });
    const farkliSira = Buffer.from('{"nedenKodlari":["YUKSEK_CONCURRENCY"],"insanKapisiGerekliMi":false,"riskSeviyesi":"HIGH","codexOnIncelemeGerekliMi":true}\n');
    assert.equal(sentetikRiskCiktisiniDogrula(gozlem({ stdout: farkliSira }), BEKLENEN).sonuc, "DENEY_ESLESTI");
  });

  test("sahte PASS, bos, ek satir, BOM, CR ve bozuk UTF-8 ciktiyi reddeder", () => {
    for (const stdout of [
      Buffer.alloc(0), Buffer.from("PASS\n"), Buffer.concat([DOGRU_CIKTI, Buffer.from("PASS\n")]),
      Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), DOGRU_CIKTI]),
      Buffer.from(JSON.stringify(BEKLENEN) + "\r\n"), Buffer.from([0xff, 0x0a]),
      Buffer.from(JSON.stringify(BEKLENEN) + " \n"),
    ]) {
      assert.equal(sentetikRiskCiktisiniDogrula(gozlem({ stdout }), BEKLENEN).sonuc, "BLOCKED");
    }
  });

  test("ust ve ic nesnede yinelenen JSON anahtarini kacirmaz", () => {
    for (const stdout of [
      Buffer.from('{"riskSeviyesi":"LOW","riskSeviyesi":"HIGH","nedenKodlari":["YUKSEK_CONCURRENCY"],"codexOnIncelemeGerekliMi":true,"insanKapisiGerekliMi":false}\n'),
      Buffer.from('{"riskSeviyesi":"HIGH","nedenKodlari":["YUKSEK_CONCURRENCY"],"codexOnIncelemeGerekliMi":true,"insanKapisiGerekliMi":false,"ek":{"a":1,"\\u0061":2}}\n'),
      Buffer.from('{"riskSeviyesi":"HIGH","nedenKodlari":["YUKSEK_CONCURRENCY"],"codexOnIncelemeGerekliMi":true,"insanKapisiGerekliMi":false,"ek":[{"x":1,"x":2}]}\n'),
    ]) {
      assert.equal(sentetikRiskCiktisiniDogrula(gozlem({ stdout }), BEKLENEN).sonuc, "BLOCKED");
    }
  });

  test("yanlis tur, dizi sirasi, fazla alan ve eksik alan reddedilir", () => {
    for (const sonuc of [
      { ...BEKLENEN, codexOnIncelemeGerekliMi: "true" },
      { ...BEKLENEN, nedenKodlari: ["BASKA", "YUKSEK_CONCURRENCY"] },
      { ...BEKLENEN, ek: true },
      { riskSeviyesi: "HIGH", nedenKodlari: ["YUKSEK_CONCURRENCY"], insanKapisiGerekliMi: false },
    ]) {
      assert.equal(sentetikRiskCiktisiniDogrula(gozlem({ stdout: Buffer.from(`${JSON.stringify(sonuc)}\n`) }), BEKLENEN).sonuc, "BLOCKED");
    }
  });

  test("stderr, nonzero, sinyal, timeout ve kapanis belirsizligi ret olur", () => {
    for (const degisiklik of [
      { stderr: Buffer.from("x") }, { exitKodu: 7 }, { sinyal: "SIGTERM" },
      { zamanAsimi: true }, { kapandiMi: false },
    ]) {
      assert.equal(sentetikRiskCiktisiniDogrula(gozlem(degisiklik), BEKLENEN).sonuc, "BLOCKED");
    }
  });

  test("4096 byte siniri kabul, 4097 byte ret; gecersiz gozlem ret", () => {
    const sabitUzunluk = Buffer.byteLength(JSON.stringify({ ...BEKLENEN, nedenKodlari: [""] }) + "\n");
    const sinirBeklenen = { ...BEKLENEN, nedenKodlari: ["X".repeat(4096 - sabitUzunluk)] };
    const sinirCikti = Buffer.from(`${JSON.stringify(sinirBeklenen)}\n`);
    assert.equal(sinirCikti.length, 4096);
    assert.equal(sentetikRiskCiktisiniDogrula(gozlem({ stdout: sinirCikti }), sinirBeklenen).sonuc, "DENEY_ESLESTI");
    assert.equal(sentetikRiskCiktisiniDogrula(gozlem({ stdout: Buffer.concat([sinirCikti, Buffer.from(" ")]) }), sinirBeklenen).sonuc, "BLOCKED");
    assert.equal(sentetikRiskCiktisiniDogrula(gozlem({ stdout: "PASS" }), BEKLENEN).sonuc, "BLOCKED");
    assert.equal(sentetikRiskCiktisiniDogrula(null, BEKLENEN).sonuc, "BLOCKED");
  });
});
