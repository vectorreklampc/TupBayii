import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, test } from "node:test";
import { Worker } from "node:worker_threads";

import {
  IsSahiplenmeKilidi,
  dagUygunlugunuDegerlendir,
} from "../src/is-sahiplenme.mjs";

const MODUL_URL = new URL("../src/is-sahiplenme.mjs", import.meta.url).href;
const ZAMAN_ASIMI_MS = 30_000;
const BASLANGIC = "2026-10-07T10:00:00.000Z";
const geciciDizinler = [];

afterEach(() => {
  for (const dizin of geciciDizinler.splice(0)) {
    rmSync(dizin, { recursive: true, force: true });
  }
});

function zaman(eklenecekMs) {
  return new Date(Date.parse(BASLANGIC) + eklenecekMs).toISOString();
}

function isDugumu(anahtar, durumKategorisi = "done", ek = {}) {
  return { anahtar, durumKategorisi, fazIsi: "TBP-28", ...ek };
}

// Fixture, faz giris gate'i ile hedefe ait dogrudan on kosulu birlikte modeller.
function temelGrafik({ isler = [], engellemeler = [] } = {}) {
  return {
    isler: [
      isDugumu("TBP-27", "done", { fazIsi: "TBP-13" }),
      isDugumu("TBP-28", "indeterminate", { fazIsi: null }),
      isDugumu("TBP-30"),
      isDugumu("TBP-31", "new"),
      ...isler,
    ],
    engellemeler: [
      { engelleyen: "TBP-27", engellenen: "TBP-28" },
      { engelleyen: "TBP-30", engellenen: "TBP-31" },
      ...engellemeler,
    ],
  };
}

function karistir(grafik) {
  return {
    isler: [...grafik.isler].reverse(),
    engellemeler: [...grafik.engellemeler].reverse(),
  };
}

function veritabaniYoluOlustur() {
  const dizin = mkdtempSync(join(tmpdir(), "tbp-sahiplenme-"));
  geciciDizinler.push(dizin);
  return join(dizin, "factory.sqlite");
}

// Testlerde lease zamani yalniz bu kontrollu saatle ilerler.
function sahteSaat(baslangicMs = Date.parse(BASLANGIC)) {
  let simdiMs = baslangicMs;
  return {
    oku: () => simdiMs,
    ilerlet: (ms) => {
      simdiMs += ms;
    },
  };
}

function kilitOlustur({
  veritabaniYolu = veritabaniYoluOlustur(),
  saat = sahteSaat(),
} = {}) {
  return new IsSahiplenmeKilidi(veritabaniYolu, {
    zamanAsimiMs: ZAMAN_ASIMI_MS,
    saat: saat.oku,
  });
}

function sahiplenmeIstegi(ek = {}) {
  return {
    isAnahtari: "TBP-31",
    sahip: "factory-worker-1",
    korelasyonKimligi: "corr-1",
    grafik: temelGrafik(),
    ...ek,
  };
}

function heartbeatIstegi(ek = {}) {
  return { isAnahtari: "TBP-31", sahip: "factory-worker-1", nesil: 1, ...ek };
}

const GELECEK = "2099-01-01T00:00:00.000Z";

describe("Guvenilir saat ile lease kararlari", () => {
  test("claimant ileri tarih gondererek aktif lock'u devralamaz", () => {
    const saat = sahteSaat();
    const kilit = kilitOlustur({ saat });
    const { kilit: ilkKilit } = kilit.sahiplen(sahiplenmeIstegi());

    const sonuc = kilit.sahiplen(
      sahiplenmeIstegi({ sahip: "factory-worker-2", zamanDamgasi: GELECEK }),
    );

    assert.deepEqual(sonuc.nedenKodlari, ["KILIT_AKTIF"]);
    assert.deepEqual(kilit.kilitGetir("TBP-31"), ilkKilit);
    kilit.kapat();
  });

  test("sahip ileri tarihli heartbeat ile lease'i saatin otesine uzatamaz", () => {
    const saat = sahteSaat();
    const kilit = kilitOlustur({ saat });
    kilit.sahiplen(sahiplenmeIstegi());

    const heartbeat = kilit.heartbeatYenile(
      heartbeatIstegi({ zamanDamgasi: GELECEK }),
    );
    assert.equal(heartbeat.kilit.sonHeartbeat, BASLANGIC);

    saat.ilerlet(ZAMAN_ASIMI_MS + 1);
    const devralma = kilit.sahiplen(
      sahiplenmeIstegi({ sahip: "factory-worker-2" }),
    );
    assert.equal(devralma.sonuc, "SAHIPLENILDI");
    assert.equal(devralma.kilit.nesil, 2);
    kilit.kapat();
  });

  test("gecersiz saat saglayicisi ve saat degeri fail-closed reddedilir", () => {
    assert.throws(
      () =>
        new IsSahiplenmeKilidi(veritabaniYoluOlustur(), {
          zamanAsimiMs: ZAMAN_ASIMI_MS,
          saat: "simdi",
        }),
      TypeError,
    );
    const kilit = kilitOlustur({ saat: { oku: () => Number.NaN } });
    assert.throws(() => kilit.sahiplen(sahiplenmeIstegi()), TypeError);
    assert.equal(kilit.kilitGetir("TBP-31"), null);
    kilit.kapat();
  });
});

describe("Jira Blocks DAG dogrulayici", () => {
  test("tum on kosullar ve faz gate'i tamamlandiysa is sahiplenmeye hazirdir", () => {
    assert.deepEqual(dagUygunlugunuDegerlendir(temelGrafik(), "TBP-31"), {
      sonuc: "SAHIPLENMEYE_HAZIR",
      nedenKodlari: [],
    });
  });

  test("on kosul zincirindeki cycle fail-closed reddedilir", () => {
    const grafik = temelGrafik({
      isler: [isDugumu("TBP-32"), isDugumu("TBP-33")],
      engellemeler: [
        { engelleyen: "TBP-32", engellenen: "TBP-30" },
        { engelleyen: "TBP-33", engellenen: "TBP-32" },
        { engelleyen: "TBP-32", engellenen: "TBP-33" },
      ],
    });

    assert.deepEqual(dagUygunlugunuDegerlendir(grafik, "TBP-31"), {
      sonuc: "ENGELLI",
      nedenKodlari: ["DAG_DONGU"],
    });
  });

  test("self-loop ve hedefin kendisini iceren cycle reddedilir", () => {
    const selfLoop = temelGrafik({
      engellemeler: [{ engelleyen: "TBP-31", engellenen: "TBP-31" }],
    });
    const hedefDongusu = temelGrafik({
      engellemeler: [{ engelleyen: "TBP-31", engellenen: "TBP-30" }],
    });

    for (const grafik of [selfLoop, hedefDongusu]) {
      assert.deepEqual(
        dagUygunlugunuDegerlendir(grafik, "TBP-31").nedenKodlari,
        ["DAG_DONGU"],
      );
    }
  });

  test("hedefle iliskisiz cycle hedefi engellemez", () => {
    const grafik = temelGrafik({
      isler: [isDugumu("TBP-50", "new"), isDugumu("TBP-51", "new")],
      engellemeler: [
        { engelleyen: "TBP-50", engellenen: "TBP-51" },
        { engelleyen: "TBP-51", engellenen: "TBP-50" },
      ],
    });

    assert.equal(
      dagUygunlugunuDegerlendir(grafik, "TBP-31").sonuc,
      "SAHIPLENMEYE_HAZIR",
    );
  });

  test("grafikte bulunmayan on kosul cozulemeyen bagimlilik olarak reddedilir", () => {
    const grafik = temelGrafik({
      engellemeler: [{ engelleyen: "TBP-99", engellenen: "TBP-30" }],
    });

    assert.deepEqual(dagUygunlugunuDegerlendir(grafik, "TBP-31"), {
      sonuc: "ENGELLI",
      nedenKodlari: ["DAG_COZULEMEYEN_BAGIMLILIK"],
    });
  });

  test("dogrudan veya gecisli tamamlanmamis on kosul reddedilir", () => {
    const dogrudan = temelGrafik();
    dogrudan.isler[2] = isDugumu("TBP-30", "indeterminate");
    const gecisli = temelGrafik({
      isler: [isDugumu("TBP-29", "new")],
      engellemeler: [{ engelleyen: "TBP-29", engellenen: "TBP-30" }],
    });

    for (const grafik of [dogrudan, gecisli]) {
      assert.deepEqual(dagUygunlugunuDegerlendir(grafik, "TBP-31"), {
        sonuc: "ENGELLI",
        nedenKodlari: ["DAG_TAMAMLANMAMIS_ON_KOSUL"],
      });
    }
  });

  test("dogrudan on kosullar tamam olsa da faz giris gate'i atlanamaz", () => {
    const grafik = temelGrafik();
    grafik.isler[0] = isDugumu("TBP-27", "indeterminate", { fazIsi: "TBP-13" });

    assert.deepEqual(dagUygunlugunuDegerlendir(grafik, "TBP-31"), {
      sonuc: "ENGELLI",
      nedenKodlari: ["DAG_GATE_ATLAMA"],
    });
  });

  test("issue key sirasi bagimlilik karari olarak kullanilmaz", () => {
    const yuksekNumaraliOnKosul = temelGrafik({
      isler: [isDugumu("TBP-40", "new")],
      engellemeler: [{ engelleyen: "TBP-40", engellenen: "TBP-31" }],
    });
    const baglantisizDusukNumara = temelGrafik({
      isler: [isDugumu("TBP-5", "new")],
    });

    assert.deepEqual(
      dagUygunlugunuDegerlendir(yuksekNumaraliOnKosul, "TBP-31").nedenKodlari,
      ["DAG_TAMAMLANMAMIS_ON_KOSUL"],
    );
    assert.equal(
      dagUygunlugunuDegerlendir(baglantisizDusukNumara, "TBP-31").sonuc,
      "SAHIPLENMEYE_HAZIR",
    );
  });

  test("birden fazla ihlal girdi sirasindan bagimsiz ayni sirayla raporlanir", () => {
    const grafik = temelGrafik({
      isler: [isDugumu("TBP-32", "new"), isDugumu("TBP-33")],
      engellemeler: [
        { engelleyen: "TBP-32", engellenen: "TBP-31" },
        { engelleyen: "TBP-33", engellenen: "TBP-32" },
        { engelleyen: "TBP-32", engellenen: "TBP-33" },
        { engelleyen: "TBP-98", engellenen: "TBP-28" },
      ],
    });
    grafik.isler[0] = isDugumu("TBP-27", "new", { fazIsi: "TBP-13" });
    const beklenen = {
      sonuc: "ENGELLI",
      nedenKodlari: [
        "DAG_DONGU",
        "DAG_COZULEMEYEN_BAGIMLILIK",
        "DAG_TAMAMLANMAMIS_ON_KOSUL",
        "DAG_GATE_ATLAMA",
      ],
    };

    assert.deepEqual(dagUygunlugunuDegerlendir(grafik, "TBP-31"), beklenen);
    assert.deepEqual(
      dagUygunlugunuDegerlendir(karistir(grafik), "TBP-31"),
      beklenen,
    );
  });

  test("gecersiz, eksik veya belirsiz graph girdisi fail-closed reddedilir", () => {
    const yinelenenAnahtar = temelGrafik({ isler: [isDugumu("TBP-30")] });
    const gecersizDurum = temelGrafik({ isler: [isDugumu("TBP-34", "Done")] });
    const gecersizKenar = temelGrafik({
      engellemeler: [{ engelleyen: 30, engellenen: "TBP-31" }],
    });

    for (const grafik of [
      null,
      {},
      { isler: [], engellemeler: null },
      yinelenenAnahtar,
      gecersizDurum,
      gecersizKenar,
    ]) {
      assert.deepEqual(dagUygunlugunuDegerlendir(grafik, "TBP-31"), {
        sonuc: "ENGELLI",
        nedenKodlari: ["DAG_GIRDISI_GECERSIZ"],
      });
    }

    assert.deepEqual(
      dagUygunlugunuDegerlendir(temelGrafik(), "TBP-77").nedenKodlari,
      ["DAG_HEDEF_BULUNAMADI"],
    );

    const fazsiz = temelGrafik();
    fazsiz.isler[3] = isDugumu("TBP-31", "new", { fazIsi: null });
    assert.deepEqual(dagUygunlugunuDegerlendir(fazsiz, "TBP-31").nedenKodlari, [
      "DAG_FAZ_BELIRSIZ",
    ]);

    const bilinmeyenFaz = temelGrafik();
    bilinmeyenFaz.isler[3] = isDugumu("TBP-31", "new", { fazIsi: "TBP-404" });
    assert.deepEqual(
      dagUygunlugunuDegerlendir(bilinmeyenFaz, "TBP-31").nedenKodlari,
      ["DAG_COZULEMEYEN_BAGIMLILIK"],
    );
  });
});

describe("SQLite tabanli atomik claim ve lock", () => {
  test("ilk claim kalici lock ve nesil 1 fencing anahtari uretir", () => {
    const veritabaniYolu = veritabaniYoluOlustur();
    const kilit = kilitOlustur({ veritabaniYolu });

    const sonuc = kilit.sahiplen(sahiplenmeIstegi());
    kilit.kapat();

    const beklenenKilit = {
      isAnahtari: "TBP-31",
      sahip: "factory-worker-1",
      korelasyonKimligi: "corr-1",
      sahiplenmeZamani: BASLANGIC,
      sonHeartbeat: BASLANGIC,
      nesil: 1,
    };
    assert.deepEqual(sonuc, {
      sonuc: "SAHIPLENILDI",
      nedenKodlari: [],
      kilit: beklenenKilit,
      devralinanSahip: null,
    });

    const yenidenAcilan = kilitOlustur({ veritabaniYolu });
    assert.deepEqual(yenidenAcilan.kilitGetir("TBP-31"), beklenenKilit);
    yenidenAcilan.kapat();
  });

  test("DAG uygun degilse claim lock yazmadan ayni neden kodlariyla reddedilir", () => {
    const kilit = kilitOlustur();
    const grafik = temelGrafik();
    grafik.isler[0] = isDugumu("TBP-27", "new", { fazIsi: "TBP-13" });

    assert.deepEqual(kilit.sahiplen(sahiplenmeIstegi({ grafik })), {
      sonuc: "REDDEDILDI",
      nedenKodlari: ["DAG_GATE_ATLAMA"],
      kilit: null,
      devralinanSahip: null,
    });
    assert.equal(kilit.kilitGetir("TBP-31"), null);
    kilit.kapat();
  });

  test("aktif lock ayri baglantidan da ayni sahip tarafindan da devralinamaz", () => {
    const veritabaniYolu = veritabaniYoluOlustur();
    const saat = sahteSaat();
    const birinci = kilitOlustur({ veritabaniYolu, saat });
    const ikinci = kilitOlustur({ veritabaniYolu, saat });
    const ilkSonuc = birinci.sahiplen(sahiplenmeIstegi());
    saat.ilerlet(ZAMAN_ASIMI_MS);

    for (const sahip of ["factory-worker-2", "factory-worker-1"]) {
      const sonuc = ikinci.sahiplen(
        sahiplenmeIstegi({ sahip, korelasyonKimligi: "corr-2" }),
      );
      assert.deepEqual(sonuc, {
        sonuc: "REDDEDILDI",
        nedenKodlari: ["KILIT_AKTIF"],
        kilit: ilkSonuc.kilit,
        devralinanSahip: null,
      });
    }

    assert.deepEqual(birinci.kilitGetir("TBP-31"), ilkSonuc.kilit);
    birinci.kapat();
    ikinci.kapat();
  });

  test("timeout sonrasi stale lock yeni nesille guvenle devralinir", () => {
    const saat = sahteSaat();
    const kilit = kilitOlustur({ saat });
    kilit.sahiplen(sahiplenmeIstegi());
    saat.ilerlet(ZAMAN_ASIMI_MS + 1);

    const sonuc = kilit.sahiplen(
      sahiplenmeIstegi({ sahip: "factory-worker-2", korelasyonKimligi: "corr-2" }),
    );

    assert.deepEqual(sonuc, {
      sonuc: "SAHIPLENILDI",
      nedenKodlari: [],
      kilit: {
        isAnahtari: "TBP-31",
        sahip: "factory-worker-2",
        korelasyonKimligi: "corr-2",
        sahiplenmeZamani: zaman(ZAMAN_ASIMI_MS + 1),
        sonHeartbeat: zaman(ZAMAN_ASIMI_MS + 1),
        nesil: 2,
      },
      devralinanSahip: "factory-worker-1",
    });
    kilit.kapat();
  });

  test("gecersiz claim istegi TypeError ile reddedilir", () => {
    const kilit = kilitOlustur();
    for (const istek of [
      null,
      sahiplenmeIstegi({ sahip: " " }),
      sahiplenmeIstegi({ korelasyonKimligi: undefined }),
    ]) {
      assert.throws(() => kilit.sahiplen(istek), TypeError);
    }
    assert.throws(
      () => kilit.heartbeatYenile(heartbeatIstegi({ nesil: 0 })),
      TypeError,
    );
    assert.throws(
      () => new IsSahiplenmeKilidi(veritabaniYoluOlustur(), { zamanAsimiMs: 0 }),
      TypeError,
    );
    kilit.kapat();
  });
});

describe("Heartbeat ve stale recovery", () => {
  test("mevcut sahip heartbeat ile lease suresini uzatir", () => {
    const saat = sahteSaat();
    const kilit = kilitOlustur({ saat });
    const { kilit: ilkKilit } = kilit.sahiplen(sahiplenmeIstegi());
    saat.ilerlet(20_000);

    const heartbeat = kilit.heartbeatYenile(
      heartbeatIstegi({ nesil: ilkKilit.nesil }),
    );
    assert.deepEqual(heartbeat, {
      sonuc: "YENILENDI",
      nedenKodlari: [],
      kilit: { ...ilkKilit, sonHeartbeat: zaman(20_000) },
    });

    saat.ilerlet(15_000);
    const devralma = kilit.sahiplen(
      sahiplenmeIstegi({ sahip: "factory-worker-2" }),
    );
    assert.deepEqual(devralma.nedenKodlari, ["KILIT_AKTIF"]);
    kilit.kapat();
  });

  test("sahip olmayan veya eski nesil heartbeat'i lock'u degistiremez", () => {
    const saat = sahteSaat();
    const kilit = kilitOlustur({ saat });
    kilit.sahiplen(sahiplenmeIstegi());
    saat.ilerlet(ZAMAN_ASIMI_MS + 1);
    const { kilit: yeniKilit } = kilit.sahiplen(
      sahiplenmeIstegi({ sahip: "factory-worker-2" }),
    );
    saat.ilerlet(1);

    for (const istek of [
      { sahip: "factory-worker-1", nesil: 2 },
      { sahip: "factory-worker-1", nesil: 1 },
      { sahip: "factory-worker-2", nesil: 1 },
    ]) {
      assert.deepEqual(kilit.heartbeatYenile(heartbeatIstegi(istek)), {
        sonuc: "REDDEDILDI",
        nedenKodlari: ["KILIT_SAHIBI_DEGIL"],
        kilit: yeniKilit,
      });
    }
    assert.deepEqual(kilit.kilitGetir("TBP-31"), yeniKilit);
    kilit.kapat();
  });

  test("heartbeat kaybedilen lease'i canlandiramaz ve olmayan lock yenilenemez", () => {
    const saat = sahteSaat();
    const kilit = kilitOlustur({ saat });
    const { kilit: ilkKilit } = kilit.sahiplen(sahiplenmeIstegi());
    saat.ilerlet(ZAMAN_ASIMI_MS + 1);

    assert.deepEqual(kilit.heartbeatYenile(heartbeatIstegi()), {
      sonuc: "REDDEDILDI",
      nedenKodlari: ["KILIT_SURESI_DOLDU"],
      kilit: ilkKilit,
    });
    assert.deepEqual(
      kilit.heartbeatYenile(heartbeatIstegi({ isAnahtari: "TBP-32" })),
      { sonuc: "REDDEDILDI", nedenKodlari: ["KILIT_BULUNAMADI"], kilit: null },
    );
    kilit.kapat();
  });

  test("timeout sinirinda lock hala aktiftir ve geriye giden saat heartbeat'i geri almaz", () => {
    const saat = sahteSaat();
    const kilit = kilitOlustur({ saat });
    saat.ilerlet(10_000);
    kilit.sahiplen(sahiplenmeIstegi());

    saat.ilerlet(-5_000);
    const geriSaat = kilit.heartbeatYenile(heartbeatIstegi());
    assert.equal(geriSaat.sonuc, "YENILENDI");
    assert.equal(geriSaat.kilit.sonHeartbeat, zaman(10_000));
    assert.equal(kilit.kilitGetir("TBP-31").sonHeartbeat, zaman(10_000));

    saat.ilerlet(5_000 + ZAMAN_ASIMI_MS);
    const sinirda = kilit.sahiplen(
      sahiplenmeIstegi({ sahip: "factory-worker-2" }),
    );
    assert.deepEqual(sinirda.nedenKodlari, ["KILIT_AKTIF"]);

    saat.ilerlet(1);
    const devralma = kilit.sahiplen(
      sahiplenmeIstegi({ sahip: "factory-worker-2" }),
    );
    assert.equal(devralma.sonuc, "SAHIPLENILDI");
    assert.equal(devralma.kilit.nesil, 2);
    kilit.kapat();
  });
});

// Her yarisci ayri thread'de kendi SQLite baglantisini acar; bariyerle ayni anda claim eder.
// Tum yariscilar ayni sabit epoch ms degerini saat olarak kullanir.
const YARISCI_KODU = `
const { workerData, parentPort } = require("node:worker_threads");
(async () => {
  const { IsSahiplenmeKilidi } = await import(workerData.modulUrl);
  const kilit = new IsSahiplenmeKilidi(workerData.veritabaniYolu, {
    zamanAsimiMs: workerData.zamanAsimiMs,
    saat: () => workerData.simdiMs,
  });
  const bariyer = new Int32Array(workerData.bariyer);
  Atomics.add(bariyer, 1, 1);
  Atomics.wait(bariyer, 0, 0);
  try {
    parentPort.postMessage({ sonuc: kilit.sahiplen(workerData.istek) });
  } catch (hata) {
    parentPort.postMessage({ hata: String(hata) });
  } finally {
    kilit.kapat();
  }
})();
`;

async function eszamanliSahiplen(veritabaniYolu, istekler, simdiMs) {
  const bariyer = new SharedArrayBuffer(8);
  const bayraklar = new Int32Array(bariyer);
  const sonuclar = istekler.map(
    (istek) =>
      new Promise((coz, reddet) => {
        const isci = new Worker(YARISCI_KODU, {
          eval: true,
          workerData: {
            modulUrl: MODUL_URL,
            veritabaniYolu,
            zamanAsimiMs: ZAMAN_ASIMI_MS,
            simdiMs,
            bariyer,
            istek,
          },
        });
        isci.once("message", coz);
        isci.once("error", reddet);
      }),
  );

  while (Atomics.load(bayraklar, 1) < istekler.length) {
    await new Promise((coz) => setTimeout(coz, 2));
  }
  Atomics.store(bayraklar, 0, 1);
  Atomics.notify(bayraklar, 0);
  return Promise.all(sonuclar);
}

function yarisciIstekleri(sayi) {
  return Array.from({ length: sayi }, (_, sira) =>
    sahiplenmeIstegi({
      sahip: `factory-worker-${sira + 1}`,
      korelasyonKimligi: `corr-${sira + 1}`,
    }),
  );
}

function tekKazananDogrula(cevaplar, beklenenNesil) {
  assert.deepEqual(
    cevaplar.filter((cevap) => cevap.hata),
    [],
  );
  const kazananlar = cevaplar.filter(
    (cevap) => cevap.sonuc.sonuc === "SAHIPLENILDI",
  );
  const kaybedenler = cevaplar.filter(
    (cevap) => cevap.sonuc.sonuc === "REDDEDILDI",
  );
  assert.equal(kazananlar.length, 1);
  assert.equal(kaybedenler.length, cevaplar.length - 1);
  const [{ sonuc: kazanan }] = kazananlar;
  assert.equal(kazanan.kilit.nesil, beklenenNesil);
  for (const { sonuc } of kaybedenler) {
    assert.deepEqual(sonuc.nedenKodlari, ["KILIT_AKTIF"]);
    assert.deepEqual(sonuc.kilit, kazanan.kilit);
  }
  return kazanan;
}

describe("Ayri SQLite baglantilariyla eszamanli claim", () => {
  test("ayni bos ise eszamanli claim'de yalniz bir kazanan olur", async () => {
    for (let tur = 0; tur < 5; tur += 1) {
      const veritabaniYolu = veritabaniYoluOlustur();
      kilitOlustur({ veritabaniYolu }).kapat();

      const cevaplar = await eszamanliSahiplen(
        veritabaniYolu,
        yarisciIstekleri(4),
        Date.parse(BASLANGIC),
      );
      const kazanan = tekKazananDogrula(cevaplar, 1);
      assert.equal(kazanan.kilit.sahiplenmeZamani, BASLANGIC);

      const kontrol = kilitOlustur({ veritabaniYolu });
      assert.deepEqual(kontrol.kilitGetir("TBP-31"), kazanan.kilit);
      kontrol.kapat();
    }
  });

  test("stale lock'u eszamanli devralmada yalniz bir kazanan olur", async () => {
    for (let tur = 0; tur < 5; tur += 1) {
      const veritabaniYolu = veritabaniYoluOlustur();
      const hazirlik = kilitOlustur({ veritabaniYolu });
      hazirlik.sahiplen(sahiplenmeIstegi({ sahip: "olu-worker" }));
      hazirlik.kapat();

      const cevaplar = await eszamanliSahiplen(
        veritabaniYolu,
        yarisciIstekleri(4),
        Date.parse(zaman(ZAMAN_ASIMI_MS + 1)),
      );
      const kazanan = tekKazananDogrula(cevaplar, 2);
      assert.equal(kazanan.devralinanSahip, "olu-worker");

      const kontrol = kilitOlustur({ veritabaniYolu });
      assert.deepEqual(kontrol.kilitGetir("TBP-31"), kazanan.kilit);
      kontrol.kapat();
    }
  });
});
