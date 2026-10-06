import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, test } from "node:test";

import {
  DURUMLAR,
  DurumMakinesiHatasi,
  GECIS_TABLOSU,
  YazilimFabrikasiDurumMakinesi,
  gecisGecerliMi,
} from "../src/durum-makinesi.mjs";

const geciciDizinler = [];
const BEKLENEN_HATA_DURUMLARI = [
  DURUMLAR.DEGISIKLIK_ISTENDI,
  DURUMLAR.ENGELLENDI,
  DURUMLAR.INSAN_ONAYI_GEREKLI,
  DURUMLAR.HATA,
];
const BEKLENEN_GECIS_TABLOSU = [
  [
    DURUMLAR.PLAN_IS_LISTESI,
    [DURUMLAR.HAZIRLIK_KONTROLU, ...BEKLENEN_HATA_DURUMLARI],
  ],
  [
    DURUMLAR.HAZIRLIK_KONTROLU,
    [
      DURUMLAR.CODEX_ON_INCELEME,
      DURUMLAR.CLAUDE_UYGULAMA,
      ...BEKLENEN_HATA_DURUMLARI,
    ],
  ],
  [
    DURUMLAR.CODEX_ON_INCELEME,
    [DURUMLAR.CLAUDE_UYGULAMA, ...BEKLENEN_HATA_DURUMLARI],
  ],
  [
    DURUMLAR.CLAUDE_UYGULAMA,
    [DURUMLAR.BAGIMSIZ_TEST, ...BEKLENEN_HATA_DURUMLARI],
  ],
  [
    DURUMLAR.BAGIMSIZ_TEST,
    [DURUMLAR.CODEX_SON_INCELEME, ...BEKLENEN_HATA_DURUMLARI],
  ],
  [
    DURUMLAR.CODEX_SON_INCELEME,
    [DURUMLAR.SENARYO_DOGRULAMA, ...BEKLENEN_HATA_DURUMLARI],
  ],
  [
    DURUMLAR.SENARYO_DOGRULAMA,
    [DURUMLAR.TAMAMLANDI, ...BEKLENEN_HATA_DURUMLARI],
  ],
];

afterEach(() => {
  for (const dizin of geciciDizinler.splice(0)) {
    rmSync(dizin, { recursive: true, force: true });
  }
});

function makineOlustur() {
  const dizin = mkdtempSync(join(tmpdir(), "tbp-factory-"));
  geciciDizinler.push(dizin);
  const veritabaniYolu = join(dizin, "factory.sqlite");
  return {
    makine: new YazilimFabrikasiDurumMakinesi(veritabaniYolu),
    veritabaniYolu,
  };
}

function gecisIstegi(hedefDurum, ek = {}) {
  return {
    isAnahtari: "TBP-29",
    hedefDurum,
    aktor: "codex",
    calistirici: "factory-test",
    deneme: 1,
    korelasyonKimligi: `corr-${hedefDurum}`,
    idempotencyAnahtari: `idem-${hedefDurum}`,
    zamanDamgasi: "2026-10-06T13:00:00.000Z",
    ...ek,
  };
}

describe("gecis tablosu", () => {
  test("beklenen geçişlerin tamamını ve yalnız onları kabul eder", () => {
    assert.deepEqual(GECIS_TABLOSU, BEKLENEN_GECIS_TABLOSU);
    const beklenenler = new Map(
      BEKLENEN_GECIS_TABLOSU.map(([kaynak, hedefler]) => [
        kaynak,
        new Set(hedefler),
      ]),
    );

    for (const kaynak of Object.values(DURUMLAR)) {
      for (const hedef of Object.values(DURUMLAR)) {
        assert.equal(
          gecisGecerliMi(kaynak, hedef),
          beklenenler.get(kaynak)?.has(hedef) ?? false,
          `${kaynak} -> ${hedef}`,
        );
      }
    }
  });

  test("atlanmış ve terminal durumdan çıkan geçişleri reddeder", () => {
    assert.equal(
      gecisGecerliMi(DURUMLAR.PLAN_IS_LISTESI, DURUMLAR.CLAUDE_UYGULAMA),
      false,
    );
    assert.equal(
      gecisGecerliMi(DURUMLAR.TAMAMLANDI, DURUMLAR.HAZIRLIK_KONTROLU),
      false,
    );
    assert.equal(
      gecisGecerliMi(DURUMLAR.HATA, DURUMLAR.CLAUDE_UYGULAMA),
      false,
    );
  });
});

describe("kalıcı durum makinesi", () => {
  test("geçerli ana akışı kalıcılaştırır ve zorunlu denetim alanlarını yazar", () => {
    const { makine } = makineOlustur();
    makine.isiBaslat("TBP-29");

    const sonuc = makine.gecisUygula(
      gecisIstegi(DURUMLAR.HAZIRLIK_KONTROLU),
    );

    assert.deepEqual(sonuc, {
      isAnahtari: "TBP-29",
      oncekiDurum: DURUMLAR.PLAN_IS_LISTESI,
      durum: DURUMLAR.HAZIRLIK_KONTROLU,
      tekrar: false,
    });
    assert.equal(makine.durumGetir("TBP-29"), DURUMLAR.HAZIRLIK_KONTROLU);
    assert.deepEqual(makine.denetimKayitlariniListele("TBP-29"), [
      {
        isAnahtari: "TBP-29",
        oncekiDurum: DURUMLAR.PLAN_IS_LISTESI,
        hedefDurum: DURUMLAR.HAZIRLIK_KONTROLU,
        sonuc: "KABUL",
        nedenKodu: null,
        aktor: "codex",
        calistirici: "factory-test",
        deneme: 1,
        korelasyonKimligi: "corr-HAZIRLIK_KONTROLU",
        zamanDamgasi: "2026-10-06T13:00:00.000Z",
      },
    ]);
    makine.kapat();
  });

  test("geçersiz geçişi durum etkisi bırakmadan reddeder ve denetler", () => {
    const { makine } = makineOlustur();
    makine.isiBaslat("TBP-29");

    assert.throws(
      () => makine.gecisUygula(gecisIstegi(DURUMLAR.CLAUDE_UYGULAMA)),
      (hata) => {
        assert.ok(hata instanceof DurumMakinesiHatasi);
        assert.equal(hata.kod, "FACTORY_STATE_INVALID_TRANSITION");
        assert.equal(hata.mevcutDurum, DURUMLAR.PLAN_IS_LISTESI);
        assert.equal(hata.korelasyonKimligi, "corr-CLAUDE_UYGULAMA");
        return true;
      },
    );

    assert.equal(makine.durumGetir("TBP-29"), DURUMLAR.PLAN_IS_LISTESI);
    assert.deepEqual(makine.denetimKayitlariniListele("TBP-29"), [
      {
        isAnahtari: "TBP-29",
        oncekiDurum: DURUMLAR.PLAN_IS_LISTESI,
        hedefDurum: DURUMLAR.CLAUDE_UYGULAMA,
        sonuc: "RED",
        nedenKodu: "FACTORY_STATE_INVALID_TRANSITION",
        aktor: "codex",
        calistirici: "factory-test",
        deneme: 1,
        korelasyonKimligi: "corr-CLAUDE_UYGULAMA",
        zamanDamgasi: "2026-10-06T13:00:00.000Z",
      },
    ]);
    makine.kapat();
  });

  test("yeniden başlatıldığında son kalıcı durumdan devam eder", () => {
    const { makine, veritabaniYolu } = makineOlustur();
    makine.isiBaslat("TBP-29");
    makine.gecisUygula(gecisIstegi(DURUMLAR.HAZIRLIK_KONTROLU));
    makine.kapat();

    const yenidenBaslatilan = new YazilimFabrikasiDurumMakinesi(veritabaniYolu);
    assert.equal(
      yenidenBaslatilan.durumGetir("TBP-29"),
      DURUMLAR.HAZIRLIK_KONTROLU,
    );
    yenidenBaslatilan.gecisUygula(
      gecisIstegi(DURUMLAR.CLAUDE_UYGULAMA, {
        korelasyonKimligi: "corr-resume",
        idempotencyAnahtari: "idem-resume",
      }),
    );
    assert.equal(
      yenidenBaslatilan.durumGetir("TBP-29"),
      DURUMLAR.CLAUDE_UYGULAMA,
    );
    yenidenBaslatilan.kapat();
  });

  test("restart sonrası aynı idempotency anahtarlı tekrarda ikinci etki veya audit üretmez", () => {
    const { makine, veritabaniYolu } = makineOlustur();
    makine.isiBaslat("TBP-29");
    const istek = gecisIstegi(DURUMLAR.HAZIRLIK_KONTROLU);

    const ilk = makine.gecisUygula(istek);
    makine.kapat();

    const yenidenBaslatilan = new YazilimFabrikasiDurumMakinesi(veritabaniYolu);
    const tekrar = yenidenBaslatilan.gecisUygula(istek);

    assert.equal(ilk.tekrar, false);
    assert.deepEqual(tekrar, { ...ilk, tekrar: true });
    assert.equal(
      yenidenBaslatilan.denetimKayitlariniListele("TBP-29").length,
      1,
    );
    yenidenBaslatilan.kapat();
  });

  test("aynı idempotency anahtarının farklı hedefle kullanımını reddeder", () => {
    const { makine } = makineOlustur();
    makine.isiBaslat("TBP-29");
    makine.gecisUygula(gecisIstegi(DURUMLAR.HAZIRLIK_KONTROLU));

    assert.throws(
      () =>
        makine.gecisUygula(
          gecisIstegi(DURUMLAR.CLAUDE_UYGULAMA, {
            korelasyonKimligi: "corr-conflict",
            idempotencyAnahtari: "idem-HAZIRLIK_KONTROLU",
          }),
        ),
      (hata) => {
        assert.equal(hata.kod, "FACTORY_STATE_IDEMPOTENCY_CONFLICT");
        return true;
      },
    );
    assert.equal(makine.durumGetir("TBP-29"), DURUMLAR.HAZIRLIK_KONTROLU);
    makine.kapat();
  });

  test("UTC olmayan denetim zaman damgasını sınırda reddeder", () => {
    const { makine } = makineOlustur();
    makine.isiBaslat("TBP-29");

    assert.throws(
      () =>
        makine.gecisUygula(
          gecisIstegi(DURUMLAR.HAZIRLIK_KONTROLU, {
            zamanDamgasi: "2026-10-06T16:00:00+03:00",
          }),
        ),
      /kanonik UTC ISO-8601/,
    );
    assert.equal(makine.durumGetir("TBP-29"), DURUMLAR.PLAN_IS_LISTESI);
    assert.deepEqual(makine.denetimKayitlariniListele("TBP-29"), []);
    makine.kapat();
  });
});
