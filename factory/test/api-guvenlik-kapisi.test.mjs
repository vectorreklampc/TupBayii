import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  API_GUVENLIK_KONTROLLERI,
  apiGuvenliginiDegerlendir,
  rateLimitKarariVer,
} from "../src/api-guvenlik-kapisi.mjs";

function gecerliEndpoint({ kritikMi = false, failOpen = false } = {}) {
  return {
    kimlik: "POST /api/satislar",
    kritikMi,
    failOpen,
    kontroller: Object.fromEntries(
      API_GUVENLIK_KONTROLLERI.map(({ alan }) => [
        alan,
        { durum: "PASS", kanitlar: [`${alan} contract testi`] },
      ]),
    ),
    rateLimitPolitikasi: {
      pencereMs: 60_000,
      kota: 100,
      burst: 20,
      sayacAnahtari: "tenant+kullanici+endpoint",
    },
  };
}

function gecerliSozlesme(endpoint = gecerliEndpoint()) {
  return {
    endpointler: [endpoint],
    kaliteKapilari: {
      securityTestleri: "PASS",
      contractTestleri: "PASS",
    },
  };
}

describe("API guvenlik kapisi", () => {
  test("butun zorunlu kontroller kanitli ve kalite kapilari yesilse kabul eder", () => {
    assert.deepEqual(apiGuvenliginiDegerlendir(gecerliSozlesme()), {
      sonuc: "ACCEPTED",
      nedenKodlari: [],
      bulgular: [],
    });
  });

  test("Jira'daki 17 hardening alanini kanonik sozlesmede tutar", () => {
    assert.deepEqual(
      API_GUVENLIK_KONTROLLERI.map(({ alan }) => alan),
      [
        "authentication",
        "authorization",
        "tenantIzolasyonu",
        "girdiDogrulamaVePayloadSiniri",
        "rateLimit",
        "idempotency",
        "timeoutVeCancellation",
        "retrySiniri",
        "corsVeCsrf",
        "secretYonetimi",
        "hataYanitiStandardi",
        "logRedaksiyonu",
        "webhookImzaDogrulama",
        "replayKoruma",
        "apiSurumlemeVeKullanimdanKaldirma",
        "openApiContractDogrulama",
        "abuseVeAnomaliTelemetry",
      ],
    );
  });

  for (const { alan, eksikKodu } of API_GUVENLIK_KONTROLLERI) {
    test(`${alan} eksikse fail-closed BLOCKED verir`, () => {
      const endpoint = gecerliEndpoint();
      delete endpoint.kontroller[alan];

      const sonuc = apiGuvenliginiDegerlendir(gecerliSozlesme(endpoint));

      assert.equal(sonuc.sonuc, "BLOCKED");
      assert.deepEqual(sonuc.nedenKodlari, [eksikKodu]);
      assert.equal(sonuc.bulgular[0].alan, `endpointler[0].kontroller.${alan}`);
    });
  }

  test("FAIL kontrolunu ve kanitsiz PASS sonucunu kabul etmez", () => {
    const endpoint = gecerliEndpoint();
    endpoint.kontroller.authorization = {
      durum: "FAIL",
      kanitlar: ["Yetki negatif testi kirmizi"],
    };
    endpoint.kontroller.tenantIzolasyonu = { durum: "PASS", kanitlar: [] };

    assert.deepEqual(
      apiGuvenliginiDegerlendir(gecerliSozlesme(endpoint)).nedenKodlari,
      ["AUTHORIZATION_BASARISIZ", "TENANT_IZOLASYONU_KANIT_EKSIK"],
    );
  });

  test("gerekceli NOT_APPLICABLE kontrolunu kabul eder", () => {
    const endpoint = gecerliEndpoint();
    endpoint.kontroller.webhookImzaDogrulama = {
      durum: "NOT_APPLICABLE",
      gerekce: "Endpoint webhook kabul etmiyor.",
      kanitlar: ["OpenAPI operasyon sinifi"],
    };

    assert.equal(apiGuvenliginiDegerlendir(gecerliSozlesme(endpoint)).sonuc, "ACCEPTED");
  });

  test("gerekcesiz NOT_APPLICABLE kontrolunu reddeder", () => {
    const endpoint = gecerliEndpoint();
    endpoint.kontroller.webhookImzaDogrulama = {
      durum: "NOT_APPLICABLE",
      kanitlar: ["OpenAPI operasyon sinifi"],
    };

    assert.deepEqual(
      apiGuvenliginiDegerlendir(gecerliSozlesme(endpoint)).nedenKodlari,
      ["WEBHOOK_IMZA_DOGRULAMA_GEREKCE_EKSIK"],
    );
  });

  test("security veya contract testi kirmiziysa merge ve release kapisini kapatir", () => {
    for (const alan of ["securityTestleri", "contractTestleri"]) {
      const sozlesme = gecerliSozlesme();
      sozlesme.kaliteKapilari[alan] = "FAIL";

      const sonuc = apiGuvenliginiDegerlendir(sozlesme);

      assert.equal(sonuc.sonuc, "BLOCKED");
      assert.equal(sonuc.bulgular[0].mergeEngelliMi, true);
      assert.equal(sonuc.bulgular[0].releaseEngelliMi, true);
    }
  });

  test("critical endpoint icin fail-open politikasini reddeder", () => {
    const endpoint = gecerliEndpoint({ kritikMi: true, failOpen: true });

    assert.deepEqual(
      apiGuvenliginiDegerlendir(gecerliSozlesme(endpoint)).nedenKodlari,
      ["KRITIK_ENDPOINT_FAIL_OPEN_YASAK"],
    );
  });

  test("endpoint kritiklik siniflandirmasi eksikse fail-closed reddeder", () => {
    const endpoint = gecerliEndpoint();
    delete endpoint.kritikMi;

    assert.deepEqual(
      apiGuvenliginiDegerlendir(gecerliSozlesme(endpoint)).nedenKodlari,
      ["API_ENDPOINT_KRITIKLIK_BELIRSIZ"],
    );
  });

  test("bozuk sozlesmeyi bos ve guvenli kabul etmez", () => {
    assert.deepEqual(apiGuvenliginiDegerlendir(null).nedenKodlari, [
      "API_GUVENLIK_SOZLESMESI_GECERSIZ",
    ]);
    assert.deepEqual(apiGuvenliginiDegerlendir({ endpointler: [] }).nedenKodlari, [
      "API_ENDPOINT_EKSIK",
      "SECURITY_TESTLERI_KIRMIZI",
      "CONTRACT_TESTLERI_KIRMIZI",
    ]);
  });
});

describe("Rate limit karari", () => {
  const politika = {
    pencereMs: 60_000,
    kota: 100,
    burst: 20,
    sayacAnahtari: "tenant+kullanici+endpoint",
  };

  test("kota ve burst sinirinda deterministik karar verir", () => {
    const girdi = { pencereYasiMs: 10_000, oncekiIstekSayisi: 119 };
    const ilk = rateLimitKarariVer(politika, girdi);

    assert.deepEqual(ilk, {
      izinliMi: true,
      limit: 120,
      kalan: 0,
      yeniIstekSayisi: 120,
      yenidenDeneMs: 0,
    });
    assert.deepEqual(rateLimitKarariVer(politika, girdi), ilk);
    assert.equal(
      rateLimitKarariVer(politika, {
        pencereYasiMs: 10_000,
        oncekiIstekSayisi: 120,
      }).izinliMi,
      false,
    );
  });

  test("pencere dolunca sayaci sifirlar", () => {
    assert.deepEqual(
      rateLimitKarariVer(politika, {
        pencereYasiMs: 60_000,
        oncekiIstekSayisi: 120,
      }),
      {
        izinliMi: true,
        limit: 120,
        kalan: 119,
        yeniIstekSayisi: 1,
        yenidenDeneMs: 0,
      },
    );
  });

  test("negatif veya eksik rate limit degerlerini reddeder", () => {
    assert.throws(
      () => rateLimitKarariVer({ ...politika, kota: 0 }, {
        pencereYasiMs: 0,
        oncekiIstekSayisi: 0,
      }),
      /RATE_LIMIT_POLITIKASI_GECERSIZ/,
    );
    assert.throws(
      () => rateLimitKarariVer(politika, {
        pencereYasiMs: -1,
        oncekiIstekSayisi: 0,
      }),
      /RATE_LIMIT_GIRDISI_GECERSIZ/,
    );
  });

  test("kota ve burst toplami guvenli tamsayiyi asamaz", () => {
    assert.throws(
      () => rateLimitKarariVer({
        ...politika,
        kota: Number.MAX_SAFE_INTEGER,
        burst: 1,
      }, {
        pencereYasiMs: 0,
        oncekiIstekSayisi: 0,
      }),
      /RATE_LIMIT_POLITIKASI_GECERSIZ/,
    );
  });
});
