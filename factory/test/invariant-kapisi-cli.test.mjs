import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, describe, test } from "node:test";

import { CIKIS_KODLARI, cliCalistir } from "../src/invariant-kapisi-cli.mjs";

const cliYolu = fileURLToPath(new URL("../src/invariant-kapisi-cli.mjs", import.meta.url));
const fixtureDizini = fileURLToPath(new URL("./fixtures/", import.meta.url));
const gecerliYol = join(fixtureDizini, "is-kalemi-gecerli.json");
const ihlalYol = join(fixtureDizini, "is-kalemi-ihlal.json");
// Komut factory disindaki bir dizinden calistirilir; kanonik kaynaklar yine
// import.meta.url uzerinden bulunmalidir.
const yabanciDizin = mkdtempSync(join(tmpdir(), "tbp233-cli-"));
const RISK_SON_GECERLILIK = "2026-11-07";

after(() => rmSync(yabanciDizin, { recursive: true, force: true }));

function calistir(argumanlar, cwd = yabanciDizin) {
  const sonuc = spawnSync(process.execPath, [cliYolu, ...argumanlar], { cwd, encoding: "utf8" });
  return { cikisKodu: sonuc.status, cikti: JSON.parse(sonuc.stdout), stderr: sonuc.stderr };
}

function geciciGirdi(ad, icerik) {
  const yol = join(yabanciDizin, ad);
  writeFileSync(yol, typeof icerik === "string" ? icerik : JSON.stringify(icerik));
  return yol;
}

describe("invariant kapisi CLI - kayit defteri modu", () => {
  test("gercek surec factory disindan calisir ve gunun risk durumuna gore karar verir", () => {
    const bugun = new Date().toISOString().slice(0, 10);
    const { cikisKodu, cikti } = calistir(["kayit-defteri"]);

    assert.equal(cikti.mod, "kayit-defteri");
    assert.deepEqual(cikti, cliCalistir(["kayit-defteri"], { bugun }).cikti);
    if (bugun < RISK_SON_GECERLILIK) {
      assert.equal(cikisKodu, CIKIS_KODLARI.ACCEPTED);
      assert.equal(cikti.sonuc, "ACCEPTED");
      assert.deepEqual(cikti.kabulEdilmisRiskler.map(({ kimlik, durum, duzeltildi }) => [kimlik, durum, duzeltildi]), [
        ["GHSA-vfj7-8cjw-p6xm", "KABUL_EDILMIS_RISK", false],
      ]);
    } else {
      assert.equal(cikisKodu, CIKIS_KODLARI.BLOCKED);
      assert.ok(cikti.bulgular.some(({ nedenKodu }) => nedenKodu === "RISK_ISTISNASI_SURESI_DOLDU"));
    }
  });

  test("risk istisnasi son gecerlilik gununde ve sonrasinda cikis kodu 1 uretir", () => {
    assert.equal(cliCalistir(["kayit-defteri"], { bugun: "2026-11-06" }).cikisKodu, CIKIS_KODLARI.ACCEPTED);
    for (const bugun of [RISK_SON_GECERLILIK, "2026-12-01"]) {
      const { cikisKodu, cikti } = cliCalistir(["kayit-defteri"], { bugun });
      assert.equal(cikisKodu, CIKIS_KODLARI.BLOCKED, bugun);
      assert.equal(cikti.sonuc, "BLOCKED", bugun);
      assert.deepEqual(cikti.bulgular.map(({ nedenKodu }) => nedenKodu), ["RISK_ISTISNASI_SURESI_DOLDU"], bugun);
      assert.deepEqual(cikti.kabulEdilmisRiskler, [], bugun);
    }
  });
});

describe("invariant kapisi CLI - is kalemi modu", () => {
  test("gecerli yurutulmus invariant kaniti cikis kodu 0 ve ACCEPTED uretir", () => {
    const { cikisKodu, cikti } = calistir(["is-kalemi", gecerliYol]);

    assert.equal(cikisKodu, CIKIS_KODLARI.ACCEPTED);
    assert.equal(cikti.mod, "is-kalemi");
    assert.equal(cikti.sonuc, "ACCEPTED");
    assert.equal(cikti.tamamlanabilirMi, true);
  });

  test("goreli girdi yolu calisma dizinine gore cozulur", () => {
    assert.equal(calistir(["is-kalemi", "is-kalemi-gecerli.json"], fixtureDizini).cikisKodu, CIKIS_KODLARI.ACCEPTED);
    assert.equal(calistir(["is-kalemi", "is-kalemi-gecerli.json"]).cikisKodu, CIKIS_KODLARI.BLOCKED);
  });

  test("ihlal gozlemi cikis kodu 1 ve invariant bulgulari uretir", () => {
    const { cikisKodu, cikti } = calistir(["is-kalemi", ihlalYol]);

    assert.equal(cikisKodu, CIKIS_KODLARI.BLOCKED);
    assert.equal(cikti.sonuc, "BLOCKED");
    assert.equal(cikti.tamamlanabilirMi, false);
    assert.deepEqual(cikti.bulgular, [
      { kod: "INVARIANT_IHLALI", alan: "invariantKanitlari.INV-AUD-005" },
      { kod: "INVARIANT_IHLALI", alan: "invariantKanitlari.INV-GOV-003" },
    ]);
  });

  test("istemcinin verdigi plan yok sayilir; invariant kaniti olmadan BLOCKED olur", () => {
    const girdi = JSON.parse(readFileSync(gecerliYol, "utf8"));
    delete girdi.invariantKanitlari;
    girdi.plan = { sonuc: "HAZIR", testler: [], izlenebilirlik: [] };

    const { cikisKodu, cikti } = calistir(["is-kalemi", geciciGirdi("plan-enjeksiyonu.json", girdi)]);
    assert.equal(cikisKodu, CIKIS_KODLARI.BLOCKED);
    assert.deepEqual(cikti.nedenKodlari, ["INVARIANT_KANITI_EKSIK"]);
  });

  test("eksik, bos, bozuk veya JSON olmayan girdi istisna yerine BLOCKED uretir", () => {
    for (const [ad, icerik] of [
      ["bos.json", ""],
      ["kesik.json", "{\"isKimligi\": \"TBP-233\""],
      ["null.json", "null"],
      ["dizi.json", "[]"],
    ]) {
      const { cikisKodu, cikti, stderr } = calistir(["is-kalemi", geciciGirdi(ad, icerik)]);
      assert.equal(cikisKodu, CIKIS_KODLARI.BLOCKED, ad);
      assert.equal(cikti.sonuc, "BLOCKED", ad);
      assert.equal(stderr, "", ad);
    }
    assert.equal(calistir(["is-kalemi", join(yabanciDizin, "olmayan.json")]).cikisKodu, CIKIS_KODLARI.BLOCKED);
  });

  test("bilinmeyen mod veya hatali arguman sayisi kullanim hatasi (2) uretir", () => {
    for (const argumanlar of [[], ["bilinmeyen"], ["kayit-defteri", "fazla"], ["is-kalemi"], ["is-kalemi", gecerliYol, ihlalYol]]) {
      const { cikisKodu, cikti } = calistir(argumanlar);
      assert.equal(cikisKodu, CIKIS_KODLARI.KULLANIM, JSON.stringify(argumanlar));
      assert.match(cikti.hata, /Kullanim/);
    }
  });
});
