export const TEST_PIRAMIDI = Object.freeze({
  HIZLI_GERI_BILDIRIM: Object.freeze([
    "UNIT",
    "DOMAIN_PROPERTY_BASED",
    "INVARIANT_ARCHITECTURE",
  ]),
  SINIR_VE_ALTYAPI: Object.freeze([
    "INTEGRATION",
    "DATABASE_TRANSACTION",
    "CONCURRENCY",
    "IDEMPOTENCY",
    "CONTRACT_OPENAPI",
    "AUTHORIZATION_SECURITY",
    "UI_COMPONENT",
  ]),
  SISTEM_VE_RELEASE: Object.freeze([
    "END_TO_END",
    "MIGRATION_ROLLBACK",
    "PERFORMANCE_BUDGET",
    "SMOKE",
    "PRODUCTION_SYNTHETIC",
  ]),
});

export const TEST_TURLERI = Object.freeze(Object.values(TEST_PIRAMIDI).flat());

const RISK_SEVIYELERI = Object.freeze(["DUSUK", "ORTA", "YUKSEK", "KRITIK"]);
const KAYNAK_KIMLIGI = /^(REQ|BR|INV|AC|GS)-[A-Z0-9][A-Z0-9-]*$/;
const TEST_KIMLIGI = /^TEST-[A-Z0-9][A-Z0-9-]*$/;

export function kabulTestPlaniOlustur(girdi) {
  if (!nesneMi(girdi)) {
    return engelliPlan([bulgu("KABUL_TESTI_GIRDISI_GECERSIZ", "girdi")]);
  }

  const bulgular = [];
  if (!gecerliOracleMi(girdi.testOracle)) {
    bulgular.push(bulgu("TEST_ORACLE_GECERSIZ", "testOracle"));
  }
  const kriterler = Array.isArray(girdi.kabulKriterleri)
    ? girdi.kabulKriterleri
    : [];
  if (kriterler.length === 0) {
    bulgular.push(bulgu("KABUL_KRITERI_EKSIK", "kabulKriterleri"));
  }

  const testler = [];
  const izlenebilirlik = new Map();
  const testKimlikleri = new Set();

  for (const [kriterIndex, kriter] of kriterler.entries()) {
    const kok = `kabulKriterleri[${kriterIndex}]`;
    if (!gecerliKriterMetniMi(kriter)) {
      bulgular.push(bulgu("KABUL_KRITERI_GECERSIZ", kok));
      continue;
    }
    if (kriter.testOracle !== undefined) {
      bulgular.push(bulgu("TEST_ORACLE_DEGISIKLIGI_YASAK", `${kok}.testOracle`));
    }
    if (!RISK_SEVIYELERI.includes(kriter.riskSeviyesi)) {
      bulgular.push(bulgu("RISK_SEVIYESI_GECERSIZ", `${kok}.riskSeviyesi`));
    }

    const kaynaklar = Array.isArray(kriter.kaynakKimlikleri)
      ? kriter.kaynakKimlikleri
      : [];
    if (kaynaklar.length === 0 || kaynaklar.some((kimlik) => !gecerliKaynakKimligiMi(kimlik))) {
      bulgular.push(bulgu("KAYNAK_KIMLIGI_GECERSIZ", `${kok}.kaynakKimlikleri`));
    }

    if (!Array.isArray(kriter.testler) || kriter.testler.length === 0) {
      bulgular.push(bulgu("KABUL_KRITERI_TESTSIZ", `${kok}.testler`));
      continue;
    }

    const kriterTestKimlikleri = [];
    for (const [testIndex, testTanimi] of kriter.testler.entries()) {
      const testAlani = `${kok}.testler[${testIndex}]`;
      if (!nesneMi(testTanimi) || !TEST_KIMLIGI.test(testTanimi.kimlik ?? "")) {
        bulgular.push(bulgu("TEST_KIMLIGI_GECERSIZ", `${testAlani}.kimlik`));
        continue;
      }
      if (testKimlikleri.has(testTanimi.kimlik)) {
        bulgular.push(bulgu("TEST_KIMLIGI_TEKRARLI", `${testAlani}.kimlik`));
        continue;
      }
      if (!TEST_TURLERI.includes(testTanimi.tur)) {
        bulgular.push(bulgu("TEST_TURU_GECERSIZ", `${testAlani}.tur`));
        continue;
      }

      testKimlikleri.add(testTanimi.kimlik);
      kriterTestKimlikleri.push(testTanimi.kimlik);
      testler.push({
        kimlik: testTanimi.kimlik,
        tur: testTanimi.tur,
        kabulKriteriKimligi: kriter.kimlik,
        riskSeviyesi: kriter.riskSeviyesi,
      });
    }

    for (const kaynakKimligi of [kriter.kimlik, ...kaynaklar]) {
      const mevcut = izlenebilirlik.get(kaynakKimligi) ?? [];
      mevcut.push(...kriterTestKimlikleri);
      izlenebilirlik.set(kaynakKimligi, mevcut);
    }
  }

  if (bulgular.length > 0) return engelliPlan(bulgular);

  return {
    sonuc: "HAZIR",
    nedenKodlari: [],
    bulgular: [],
    testOracle: { ...girdi.testOracle },
    testler,
    izlenebilirlik: [...izlenebilirlik.entries()]
      .sort(([sol], [sag]) => sol.localeCompare(sag))
      .map(([kaynakKimligi, kimlikler]) => ({
        kaynakKimligi,
        testKimlikleri: [...new Set(kimlikler)].sort(),
      })),
  };
}

export function kaliteKapisiniDegerlendir(girdi) {
  if (!nesneMi(girdi) || girdi.plan?.sonuc !== "HAZIR") {
    return engelliKapi(
      [bulgu("TEST_PLANI_HAZIR_DEGIL", "plan")],
      bosKapsama(),
    );
  }

  const plan = girdi.plan;
  if (!gecerliPlanYapisiMi(plan)) {
    return engelliKapi(
      [bulgu("TEST_PLANI_GECERSIZ", "plan")],
      bosKapsama(),
    );
  }
  const sonuclar = Array.isArray(girdi.testSonuclari) ? girdi.testSonuclari : [];
  const planTestleri = new Map(plan.testler.map((testTanimi) => [testTanimi.kimlik, testTanimi]));
  const sonucSayilari = new Map();
  const bulgular = [];

  for (const [sonucIndex, testSonucu] of sonuclar.entries()) {
    const kok = `testSonuclari[${sonucIndex}]`;
    if (!nesneMi(testSonucu) || !planTestleri.has(testSonucu.testKimligi)) {
      bulgular.push(bulgu("TEST_SONUCU_BILINMIYOR", kok));
      continue;
    }
    sonucSayilari.set(
      testSonucu.testKimligi,
      (sonucSayilari.get(testSonucu.testKimligi) ?? 0) + 1,
    );
    if (!new Set(["PASS", "FAIL", "FLAKY"]).has(testSonucu.durum)) {
      bulgular.push(bulgu("TEST_SONUCU_GECERSIZ", `${kok}.durum`));
      continue;
    }
    if (testSonucu.durum === "FAIL") {
      bulgular.push(bulgu("TEST_BASARISIZ", kok));
    }
    if (testSonucu.durum === "FLAKY") {
      const testTanimi = planTestleri.get(testSonucu.testKimligi);
      if (testTanimi.riskSeviyesi === "KRITIK") {
        bulgular.push(bulgu("KRITIK_TEST_KARANTINA_YASAK", kok));
      } else if (!gecerliKarantinaMi(testSonucu.karantina)) {
        bulgular.push(bulgu("FLAKY_TEST_KARANTINA_GECERSIZ", `${kok}.karantina`));
      }
    }
  }

  if ([...sonucSayilari.values()].some((sayi) => sayi > 1)) {
    bulgular.push(bulgu("TEST_SONUCU_TEKRARLI", "testSonuclari"));
  }
  if ([...planTestleri.keys()].some((kimlik) => !sonucSayilari.has(kimlik))) {
    bulgular.push(bulgu("TEST_SONUCU_EKSIK", "testSonuclari"));
  }

  const kapsama = kapsamaOlustur(plan, sonuclar);
  return bulgular.length === 0
    ? {
        sonuc: "ACCEPTED",
        tamamlanabilirMi: true,
        nedenKodlari: [],
        bulgular: [],
        kapsama,
      }
    : engelliKapi(tekilBulgular(bulgular), kapsama);
}

function gecerliKriterMetniMi(kriter) {
  if (!nesneMi(kriter) || !/^AC-[A-Z0-9][A-Z0-9-]*$/.test(kriter.kimlik ?? "")) {
    return false;
  }
  if (kriter.bicim === "GHERKIN") {
    return [kriter.given, kriter.when, kriter.then].every(doluMetinMi);
  }
  if (kriter.bicim === "STRUCTURED") {
    return [kriter.kosul, kriter.eylem, kriter.beklenen].every(doluMetinMi);
  }
  return false;
}

function gecerliOracleMi(testOracle) {
  return nesneMi(testOracle)
    && doluMetinMi(testOracle.kimlik)
    && doluMetinMi(testOracle.surum)
    && doluMetinMi(testOracle.ozet);
}

function gecerliPlanYapisiMi(plan) {
  if (!Array.isArray(plan.testler) || plan.testler.length === 0) return false;
  const testKimlikleri = new Set(plan.testler.map((testTanimi) => testTanimi?.kimlik));
  return testKimlikleri.size === plan.testler.length
    && plan.testler.every((testTanimi) => nesneMi(testTanimi)
      && TEST_KIMLIGI.test(testTanimi.kimlik ?? "")
      && TEST_TURLERI.includes(testTanimi.tur)
      && RISK_SEVIYELERI.includes(testTanimi.riskSeviyesi))
    && Array.isArray(plan.izlenebilirlik)
    && plan.izlenebilirlik.length > 0
    && plan.izlenebilirlik.every((kayit) => nesneMi(kayit)
      && gecerliKaynakKimligiMi(kayit.kaynakKimligi)
      && Array.isArray(kayit.testKimlikleri)
      && kayit.testKimlikleri.length > 0
      && kayit.testKimlikleri.every((kimlik) => testKimlikleri.has(kimlik)));
}

function gecerliKaynakKimligiMi(kimlik) {
  return typeof kimlik === "string" && KAYNAK_KIMLIGI.test(kimlik);
}

function gecerliKarantinaMi(karantina) {
  return nesneMi(karantina)
    && doluMetinMi(karantina.gerekce)
    && /^TBP-[1-9][0-9]*$/.test(karantina.takipIsAnahtari ?? "");
}

function kapsamaOlustur(plan, sonuclar) {
  const sonucKimlikleri = new Set(
    sonuclar
      .filter((sonuc) => sonuc?.durum === "PASS" || sonuc?.durum === "FLAKY")
      .map((sonuc) => sonuc.testKimligi),
  );
  const eksikKaynakKimlikleri = plan.izlenebilirlik
    .filter(({ testKimlikleri }) => !testKimlikleri.some((kimlik) => sonucKimlikleri.has(kimlik)))
    .map(({ kaynakKimligi }) => kaynakKimligi);
  return {
    kaynakSayisi: plan.izlenebilirlik.length,
    kapsananKaynakSayisi: plan.izlenebilirlik.length - eksikKaynakKimlikleri.length,
    eksikKaynakKimlikleri,
  };
}

function bosKapsama() {
  return { kaynakSayisi: 0, kapsananKaynakSayisi: 0, eksikKaynakKimlikleri: [] };
}

function bulgu(kod, alan) {
  return { kod, alan };
}

function tekilBulgular(bulgular) {
  const gorulen = new Set();
  return bulgular.filter(({ kod }) => {
    if (gorulen.has(kod)) return false;
    gorulen.add(kod);
    return true;
  });
}

function engelliPlan(bulgular) {
  const tekil = tekilBulgular(bulgular);
  return {
    sonuc: "BLOCKED",
    nedenKodlari: tekil.map(({ kod }) => kod),
    bulgular: tekil,
  };
}

function engelliKapi(bulgular, kapsama) {
  return {
    sonuc: "BLOCKED",
    tamamlanabilirMi: false,
    nedenKodlari: bulgular.map(({ kod }) => kod),
    bulgular,
    kapsama,
  };
}

function doluMetinMi(deger) {
  return typeof deger === "string" && deger.trim() !== "";
}

function nesneMi(deger) {
  return deger !== null && typeof deger === "object" && !Array.isArray(deger);
}
