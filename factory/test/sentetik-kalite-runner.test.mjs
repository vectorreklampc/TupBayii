import assert from "node:assert/strict";
import { ChildProcess } from "node:child_process";
import { describe, mock, test } from "node:test";

import { sentetikKomutuCalistir } from "../src/sentetik-kalite-runner.mjs";

describe("TBP-36 sentetik kalite runner kaniti", () => {
  test("yalniz sabit basarili komutun gercek exit kodunu deney kaniti sayar", async () => {
    const sonuc = await sentetikKomutuCalistir("BASARILI");
    assert.deepEqual(sonuc, {
      komutKimligi: "BASARILI",
      sonuc: "DENEY_PASS",
      exitKodu: 0,
      nedenKodu: null,
    });
  });

  test("stdout PASS beyan etse de nonzero exit fail-closed kalir", async () => {
    const sonuc = await sentetikKomutuCalistir("SAHTE_PASS");
    assert.equal(sonuc.sonuc, "BLOCKED");
    assert.equal(sonuc.exitKodu, 7);
    assert.equal(sonuc.nedenKodu, "KOMUT_BASARISIZ");
    assert.equal(JSON.stringify(sonuc).includes("PASS\n"), false);
  });

  test("takilan komutu sure sonunda engeller", async () => {
    const sonuc = await sentetikKomutuCalistir("ZAMAN_ASIMI");
    assert.equal(sonuc.sonuc, "BLOCKED");
    assert.equal(sonuc.nedenKodu, "ZAMAN_ASIMI");
  });

  test("sonlandirma reddedilirse sonuc suresiz beklemez ve basari sayilmaz", async () => {
    const gercekKill = ChildProcess.prototype.kill;
    let altSurec;
    const killTaklidi = mock.method(ChildProcess.prototype, "kill", function () {
      altSurec = this;
      return false;
    });
    let disSure;
    try {
      const sonuc = await Promise.race([
        sentetikKomutuCalistir("ZAMAN_ASIMI"),
        new Promise((resolve) => { disSure = setTimeout(() => resolve("ASKIDA"), 1500); }),
      ]);
      assert.notEqual(sonuc, "ASKIDA");
      assert.equal(sonuc.sonuc, "BLOCKED");
      assert.equal(sonuc.nedenKodu, "SUREC_SONLANDIRILAMADI");
    } finally {
      clearTimeout(disSure);
      killTaklidi.mock.restore();
      if (altSurec) gercekKill.call(altSurec);
    }
  });

  test("sonlandirma kabul edilse de kapanis gelmezse engeller", async () => {
    const gercekKill = ChildProcess.prototype.kill;
    let altSurec;
    const killTaklidi = mock.method(ChildProcess.prototype, "kill", function () {
      altSurec = this;
      return true;
    });
    let disSure;
    try {
      const sonuc = await Promise.race([
        sentetikKomutuCalistir("ZAMAN_ASIMI"),
        new Promise((resolve) => { disSure = setTimeout(() => resolve("ASKIDA"), 1800); }),
      ]);
      assert.notEqual(sonuc, "ASKIDA");
      assert.equal(sonuc.sonuc, "BLOCKED");
      assert.equal(sonuc.nedenKodu, "SUREC_SONLANDIRILAMADI");
    } finally {
      clearTimeout(disSure);
      killTaklidi.mock.restore();
      if (altSurec) gercekKill.call(altSurec);
    }
  });

  test("bilinmeyen kimligi komut veya shell olarak calistirmaz", async () => {
    const sonuc = await sentetikKomutuCalistir("node -e process.exit(0)");
    assert.deepEqual(sonuc, {
      komutKimligi: null,
      sonuc: "BLOCKED",
      exitKodu: null,
      nedenKodu: "KOMUT_BILINMIYOR",
    });
  });

  test("ebeveyn surecin ortam degiskenini alt surece tasimaz", async () => {
    const onceki = process.env.TBP36_SENTETIK_SIR;
    process.env.TBP36_SENTETIK_SIR = "yalniz-test-fixture";
    try {
      const sonuc = await sentetikKomutuCalistir("ORTAM_BOS");
      assert.equal(sonuc.sonuc, "DENEY_PASS");
    } finally {
      if (onceki === undefined) delete process.env.TBP36_SENTETIK_SIR;
      else process.env.TBP36_SENTETIK_SIR = onceki;
    }
  });

  test("paralel denemelerin sonucunu karistirmaz", async () => {
    const [basarili, basarisiz] = await Promise.all([
      sentetikKomutuCalistir("BASARILI"),
      sentetikKomutuCalistir("SAHTE_PASS"),
    ]);
    assert.equal(basarili.sonuc, "DENEY_PASS");
    assert.equal(basarisiz.sonuc, "BLOCKED");
  });
});
