import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, test } from "node:test";

import {
  CANLI_HATA_DURUMLARI,
  GozlemlenebilirlikDeposu,
  GozlemlenebilirlikHatasi,
} from "../src/gozlemlenebilirlik.mjs";

const geciciDizinler = [];

afterEach(() => {
  for (const dizin of geciciDizinler.splice(0)) {
    rmSync(dizin, { recursive: true, force: true });
  }
});

function depoOlustur() {
  const dizin = mkdtempSync(join(tmpdir(), "tbp-239-"));
  geciciDizinler.push(dizin);
  const yol = join(dizin, "gozlemlenebilirlik.sqlite");
  return { depo: new GozlemlenebilirlikDeposu(yol), yol };
}

function kayit(degisiklik = {}) {
  return {
    olayKimligi: "olay-1",
    sinyalTuru: "SPAN",
    olayAdi: "factory_run",
    seviye: "INFO",
    bilesen: "factory",
    girisNoktasi: "worker",
    islem: "jira_issue_run",
    sonucKodu: "BASARILI",
    traceKimligi: "trace-1",
    spanKimligi: "span-root",
    ustSpanKimligi: null,
    korelasyonKimligi: "corr-1",
    nedenKimligi: null,
    isAnahtari: "TBP-239",
    releaseKimligi: "release-2026.10.08",
    commitKimligi: "abcdef1",
    deploymentKimligi: "deploy-1",
    sureMilisaniye: 12,
    zamanDamgasi: "2026-10-08T09:00:00.000Z",
    ...degisiklik,
  };
}

describe("Vendor bagimsiz telemetry kaydi", () => {
  test("TEST-TBP-239-TRACE-01 trace zincirini release commit deployment ve Jira referanslariyla kalici saklar", () => {
    const { depo, yol } = depoOlustur();
    depo.kaydet(kayit());
    depo.kaydet(kayit({
      olayKimligi: "olay-2",
      olayAdi: "quality_gate",
      spanKimligi: "span-child",
      ustSpanKimligi: "span-root",
      sureMilisaniye: 34,
    }));
    depo.kapat();

    const yenidenAcilan = new GozlemlenebilirlikDeposu(yol);
    const iz = yenidenAcilan.izGetir("trace-1");

    assert.deepEqual(iz.referanslar, {
      isAnahtarlari: ["TBP-239"],
      releaseKimlikleri: ["release-2026.10.08"],
      commitKimlikleri: ["abcdef1"],
      deploymentKimlikleri: ["deploy-1"],
    });
    assert.deepEqual(
      iz.kayitlar.map(({ spanKimligi, ustSpanKimligi }) => ({ spanKimligi, ustSpanKimligi })),
      [
        { spanKimligi: "span-root", ustSpanKimligi: null },
        { spanKimligi: "span-child", ustSpanKimligi: "span-root" },
      ],
    );
    yenidenAcilan.kapat();
  });

  test("TEST-TBP-239-TRACE-02 eksik iz kimligini kopuk parent span'i ve tekrar eden olayi reddeder", () => {
    const { depo } = depoOlustur();

    assert.throws(
      () => depo.kaydet(kayit({ traceKimligi: "" })),
      (hata) => hata instanceof GozlemlenebilirlikHatasi
        && hata.kod === "TELEMETRY_FIELD_INVALID",
    );
    assert.throws(
      () => depo.kaydet(kayit({ ustSpanKimligi: "span-yok" })),
      (hata) => hata instanceof GozlemlenebilirlikHatasi
        && hata.kod === "TELEMETRY_PARENT_SPAN_NOT_FOUND",
    );

    depo.kaydet(kayit());
    assert.throws(
      () => depo.kaydet(kayit()),
      (hata) => hata instanceof GozlemlenebilirlikHatasi
        && hata.kod === "TELEMETRY_EVENT_DUPLICATE",
    );
    depo.kapat();
  });

  test("TEST-TBP-239-SEC-01 serbest metadata secret ve PII alanlarini kabul etmez", () => {
    const { depo } = depoOlustur();

    for (const ekAlan of [
      { requestBody: { kart: "4111111111111111" } },
      { token: "gizli" },
      { email: "kisi@example.com" },
    ]) {
      assert.throws(
        () => depo.kaydet({ ...kayit(), ...ekAlan }),
        (hata) => hata instanceof GozlemlenebilirlikHatasi
          && hata.kod === "TELEMETRY_FIELD_NOT_ALLOWED",
      );
    }
    depo.kapat();
  });

  test("TEST-TBP-239-TRACE-03 istege bagli referanslari olmayan kaydi null olarak saklar", () => {
    const { depo } = depoOlustur();
    const zorunluAlanlar = kayit();
    for (const alan of [
      "ustSpanKimligi",
      "nedenKimligi",
      "isAnahtari",
      "releaseKimligi",
      "commitKimligi",
      "deploymentKimligi",
    ]) {
      delete zorunluAlanlar[alan];
    }

    depo.kaydet(zorunluAlanlar);

    const [saklanan] = depo.izGetir("trace-1").kayitlar;
    assert.equal(saklanan.isAnahtari, null);
    assert.equal(saklanan.releaseKimligi, null);
    assert.equal(saklanan.ustSpanKimligi, null);
    depo.kapat();
  });

  test("TEST-TBP-239-METRIC-01 RED ozetini dusuk cardinality ve percentile ile uretir", () => {
    const { depo } = depoOlustur();
    const sureler = [10, 20, 30, 40, 100];
    for (const [index, sureMilisaniye] of sureler.entries()) {
      depo.kaydet(kayit({
        olayKimligi: `olay-${index}`,
        sinyalTuru: "METRIC",
        olayAdi: "request_completed",
        seviye: index === 4 ? "ERROR" : "INFO",
        sonucKodu: index === 4 ? "HATA" : "BASARILI",
        spanKimligi: `span-${index}`,
        ustSpanKimligi: null,
        sureMilisaniye,
        zamanDamgasi: `2026-10-08T09:00:0${index}.000Z`,
      }));
    }

    assert.deepEqual(depo.redOzetiGetir({ bilesen: "factory", islem: "jira_issue_run" }), {
      istekSayisi: 5,
      hataSayisi: 1,
      hataOrani: 0.2,
      p50Milisaniye: 30,
      p95Milisaniye: 100,
      p99Milisaniye: 100,
    });
    depo.kapat();
  });
});

describe("Canli hata geri besleme dongusu", () => {
  test("TEST-TBP-239-FEEDBACK-01 yalniz hata trace'inden maskelenmis diagnostic bundle uretir", () => {
    const { depo } = depoOlustur();
    depo.kaydet(kayit());
    depo.kaydet(kayit({
      olayKimligi: "olay-hata",
      olayAdi: "factory_run_failed",
      seviye: "ERROR",
      sonucKodu: "FACTORY_TEST_FAILED",
      spanKimligi: "span-error",
      ustSpanKimligi: "span-root",
      sureMilisaniye: 50,
    }));

    const paket = depo.canliHataPaketiOlustur("trace-1");

    assert.equal(paket.durum, CANLI_HATA_DURUMLARI.PAKETLENDI);
    assert.equal(paket.traceKimligi, "trace-1");
    assert.deepEqual(paket.hataKodlari, ["FACTORY_TEST_FAILED"]);
    assert.deepEqual(paket.referanslar.isAnahtarlari, ["TBP-239"]);
    assert.deepEqual(
      paket.olaylar.map(({ olayAdi, spanKimligi, ustSpanKimligi, sonucKodu }) => ({
        olayAdi,
        spanKimligi,
        ustSpanKimligi,
        sonucKodu,
      })),
      [
        {
          olayAdi: "factory_run",
          spanKimligi: "span-root",
          ustSpanKimligi: null,
          sonucKodu: "BASARILI",
        },
        {
          olayAdi: "factory_run_failed",
          spanKimligi: "span-error",
          ustSpanKimligi: "span-root",
          sonucKodu: "FACTORY_TEST_FAILED",
        },
      ],
    );
    assert.equal(JSON.stringify(paket).includes("requestBody"), false);
    assert.throws(
      () => depo.canliHataPaketiOlustur("trace-yok"),
      (hata) => hata.kod === "TELEMETRY_TRACE_NOT_FOUND",
    );
    depo.kapat();
  });

  test("TEST-TBP-239-FEEDBACK-02 LLM triage ciktisini veri olarak dogrular", () => {
    const { depo } = depoOlustur();
    depo.kaydet(kayit({ seviye: "ERROR", sonucKodu: "FACTORY_TEST_FAILED" }));
    const paket = depo.canliHataPaketiOlustur("trace-1");

    const triage = depo.triageKaydet({
      paketKimligi: paket.paketKimligi,
      ozet: "Factory kalite kapisi hata verdi",
      yenidenUretmeTestKimligi: "TEST-TBP-239-REPRO-01",
      riskEtiketleri: ["runtime-change"],
      invariantKimlikleri: ["INV-AUD-001"],
    });

    assert.equal(triage.durum, CANLI_HATA_DURUMLARI.JIRA_BUG_HAZIR);
    assert.deepEqual(triage.jiraTaslagi, {
      kaynakTraceKimligi: "trace-1",
      ozet: "Factory kalite kapisi hata verdi",
      yenidenUretmeTestKimligi: "TEST-TBP-239-REPRO-01",
      riskEtiketleri: ["runtime-change"],
      invariantKimlikleri: ["INV-AUD-001"],
    });
    assert.throws(
      () => depo.triageKaydet({
        paketKimligi: paket.paketKimligi,
        ozet: "rm -rf /",
        yenidenUretmeTestKimligi: "test",
        riskEtiketleri: [],
        invariantKimlikleri: [],
      }),
      (hata) => hata.kod === "FEEDBACK_TRIAGE_INVALID",
    );
    assert.throws(
      () => depo.triageKaydet({
        paketKimligi: paket.paketKimligi,
        ozet: "Factory kalite kapisi hata verdi",
        yenidenUretmeTestKimligi: "TEST-TBP-239-REPRO-02",
        riskEtiketleri: ["runtime-change"],
        invariantKimlikleri: ["INV-AUD-001"],
        shellCommand: "echo model-output",
      }),
      (hata) => hata.kod === "FEEDBACK_TRIAGE_INVALID",
    );
    depo.kapat();
  });

  test("TEST-TBP-239-FEEDBACK-03 kritik bugfix'i Human Gate olmadan production'a ilerletmez", () => {
    const { depo } = depoOlustur();
    depo.kaydet(kayit({ seviye: "ERROR", sonucKodu: "FACTORY_TEST_FAILED" }));
    const paket = depo.canliHataPaketiOlustur("trace-1");
    depo.triageKaydet({
      paketKimligi: paket.paketKimligi,
      ozet: "Factory kalite kapisi hata verdi",
      yenidenUretmeTestKimligi: "TEST-TBP-239-REPRO-01",
      riskEtiketleri: ["production-deploy"],
      invariantKimlikleri: ["INV-GOV-001"],
    });

    depo.geriBeslemeGecisiUygula({
      paketKimligi: paket.paketKimligi,
      hedefDurum: CANLI_HATA_DURUMLARI.BAGIMSIZ_TEST_GECTI,
      kanitKimligi: "TEST-TBP-239-FIX-01",
    });
    depo.geriBeslemeGecisiUygula({
      paketKimligi: paket.paketKimligi,
      hedefDurum: CANLI_HATA_DURUMLARI.CODEX_ONAYLADI,
      kanitKimligi: "REVIEW-TBP-239-01",
    });
    depo.geriBeslemeGecisiUygula({
      paketKimligi: paket.paketKimligi,
      hedefDurum: CANLI_HATA_DURUMLARI.STAGING_SMOKE_GECTI,
      kanitKimligi: "SMOKE-TBP-239-01",
    });

    assert.throws(
      () => depo.geriBeslemeGecisiUygula({
        paketKimligi: paket.paketKimligi,
        hedefDurum: CANLI_HATA_DURUMLARI.PRODUCTION_DOGRULANDI,
        kanitKimligi: "DEPLOY-TBP-239-01",
      }),
      (hata) => hata.kod === "FEEDBACK_HUMAN_GATE_REQUIRED",
    );

    depo.geriBeslemeGecisiUygula({
      paketKimligi: paket.paketKimligi,
      hedefDurum: CANLI_HATA_DURUMLARI.INSAN_ONAYI_VERILDI,
      kanitKimligi: "HUMAN-GATE-239",
    });
    const sonuc = depo.geriBeslemeGecisiUygula({
      paketKimligi: paket.paketKimligi,
      hedefDurum: CANLI_HATA_DURUMLARI.PRODUCTION_DOGRULANDI,
      kanitKimligi: "DEPLOY-TBP-239-01",
    });

    assert.equal(sonuc.durum, CANLI_HATA_DURUMLARI.PRODUCTION_DOGRULANDI);
    assert.deepEqual(
      depo.geriBeslemeDenetiminiListele(paket.paketKimligi).map(({ hedefDurum }) => hedefDurum),
      [
        CANLI_HATA_DURUMLARI.JIRA_BUG_HAZIR,
        CANLI_HATA_DURUMLARI.BAGIMSIZ_TEST_GECTI,
        CANLI_HATA_DURUMLARI.CODEX_ONAYLADI,
        CANLI_HATA_DURUMLARI.STAGING_SMOKE_GECTI,
        CANLI_HATA_DURUMLARI.INSAN_ONAYI_VERILDI,
        CANLI_HATA_DURUMLARI.PRODUCTION_DOGRULANDI,
      ],
    );
    depo.kapat();
  });
});
