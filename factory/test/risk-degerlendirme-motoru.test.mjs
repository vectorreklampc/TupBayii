import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { riskiDegerlendir } from "../src/risk-degerlendirme-motoru.mjs";

const ORNEKLER = [
  [
    "davranis degistirmeyen yazim duzeltmesini LOW siniflandirir",
    { baslik: "README yazim duzeltmesi", aciklama: "Yalniz metin duzeltilecek.", etiketler: ["docs-only"] },
    "LOW",
    ["DOKUMANTASYON_VEYA_STIL"],
  ],
  [
    "izole stil duzeltmesini LOW siniflandirir",
    { baslik: "Buton boslugunu duzelt", aciklama: "Runtime davranisi degismez.", etiketler: ["style-only"] },
    "LOW",
    ["DOKUMANTASYON_VEYA_STIL"],
  ],
  [
    "tek bilesen runtime davranisini MEDIUM siniflandirir",
    { baslik: "Yonetim filtresini gelistir", aciklama: "Tek ekrandaki filtre davranisini degistir.", etiketler: ["runtime-change"] },
    "MEDIUM",
    ["SINIRLI_RUNTIME_DAVRANISI"],
  ],
  [
    "kritik olmayan dogrulamayi MEDIUM siniflandirir",
    { baslik: "Form dogrulamasini ekle", aciklama: "Bos aciklamayi reddet.", etiketler: ["validation"] },
    "MEDIUM",
    ["SINIRLI_RUNTIME_DAVRANISI"],
  ],
  [
    "connection lifecycle degisikligini HIGH siniflandirir",
    { baslik: "Tenant connection lifecycle gelistir", aciklama: "Baglanti yasam dongusunu degistir.", etiketler: ["connection-lifecycle"] },
    "HIGH",
    ["YUKSEK_CONNECTION_LIFECYCLE"],
  ],
  [
    "concurrency davranisini HIGH siniflandirir",
    { baslik: "Eszamanli stok yarisi", aciklama: "Concurrency kontrolunu uygula.", etiketler: ["concurrency"] },
    "HIGH",
    ["YUKSEK_CONCURRENCY"],
  ],
  [
    "idempotency davranisini HIGH siniflandirir",
    { baslik: "Idempotency korumasi", aciklama: "Duplicate komut etkisini engelle.", etiketler: ["idempotency"] },
    "HIGH",
    ["YUKSEK_IDEMPOTENCY"],
  ],
  [
    "stok reversal degisikligini HIGH siniflandirir",
    { baslik: "Stok reversal uygula", aciklama: "Tamamlanan hareketi ters kayitla duzelt.", etiketler: ["stock-reversal"] },
    "HIGH",
    ["YUKSEK_STOK_FINANS_REVERSAL"],
  ],
  [
    "finansal reversal degisikligini HIGH siniflandirir",
    { baslik: "Finansal correction akisi", aciklama: "Ledger reversal davranisini gelistir.", etiketler: ["financial-reversal"] },
    "HIGH",
    ["YUKSEK_STOK_FINANS_REVERSAL"],
  ],
  [
    "breaking contract degisikligini HIGH siniflandirir",
    { baslik: "Event contract alanini kaldir", aciklama: "Tuketiciler icin breaking change.", etiketler: ["breaking-change"] },
    "HIGH",
    ["YUKSEK_CONTRACT_BREAKING"],
  ],
  [
    "authorization davranisini HIGH siniflandirir",
    { baslik: "Kaynak yetkilendirmesini degistir", aciklama: "Authorization kontrolunu guncelle.", etiketler: ["authorization"] },
    "HIGH",
    ["YUKSEK_AUTHORIZATION"],
  ],
  [
    "tenant isolation mimarisini CRITICAL siniflandirir",
    { baslik: "Tenant isolation mimarisini degistir", aciklama: "Veritabani sinirini yeniden tasarla.", etiketler: ["tenant-isolation", "architecture-change"] },
    "CRITICAL",
    ["KRITIK_TENANT_IZOLASYONU"],
  ],
  [
    "authentication cekirdegini CRITICAL siniflandirir",
    { baslik: "Authentication architecture degisikligi", aciklama: "Kimlik cekirdegini yeniden tasarla.", etiketler: ["auth-core", "architecture-change"] },
    "CRITICAL",
    ["KRITIK_AUTH_CEKIRDEGI"],
  ],
  [
    "payment core degisikligini CRITICAL siniflandirir",
    { baslik: "Payment core akisini degistir", aciklama: "Odeme otoritesini yeniden uygula.", etiketler: ["payment-core", "runtime-change"] },
    "CRITICAL",
    ["KRITIK_ODEME_CEKIRDEGI"],
  ],
  [
    "destructive migration isini CRITICAL siniflandirir",
    { baslik: "Kolonlari destructive migration ile sil", aciklama: "Geri donusu zor schema degisikligi.", etiketler: ["destructive-migration"] },
    "CRITICAL",
    ["KRITIK_YIKICI_MIGRATION"],
  ],
  [
    "restore akisini CRITICAL siniflandirir",
    { baslik: "Tenant restore akisini gelistir", aciklama: "Yedekten geri yukleme davranisini uygula.", etiketler: ["restore", "runtime-change"] },
    "CRITICAL",
    ["KRITIK_RESTORE"],
  ],
  [
    "tenant veritabani silmeyi CRITICAL siniflandirir",
    { baslik: "Tenant DB deletion komutu", aciklama: "Tenant veritabanini kalici sil.", etiketler: ["tenant-db-deletion"] },
    "CRITICAL",
    ["KRITIK_TENANT_DB_SILME"],
  ],
  [
    "offline finans conflict kararini CRITICAL siniflandirir",
    { baslik: "Offline finans conflict cozumu", aciklama: "Conflict politikasini degistir.", etiketler: ["offline-finance-conflict"] },
    "CRITICAL",
    ["KRITIK_OFFLINE_FINANS_CONFLICT"],
  ],
  [
    "production deploy davranisini CRITICAL siniflandirir",
    { baslik: "Production deploy otomasyonu", aciklama: "Canli ortama release uygula.", etiketler: ["production-deploy"] },
    "CRITICAL",
    ["KRITIK_PRODUCTION_DEPLOY"],
  ],
];

describe("Risk degerlendirme motoru", () => {
  for (const [ad, girdi, riskSeviyesi, nedenKodlari] of ORNEKLER) {
    test(ad, () => {
      const sonuc = riskiDegerlendir(girdi);

      assert.deepEqual(sonuc, {
        riskSeviyesi,
        nedenKodlari,
        codexOnIncelemeGerekliMi: ["HIGH", "CRITICAL"].includes(riskSeviyesi),
        insanKapisiGerekliMi: riskSeviyesi === "CRITICAL",
      });
    });
  }

  test("ayni girdi her cagri ve etiket sirasinda ayni sonucu uretir", () => {
    const girdi = {
      baslik: "Idempotency ve concurrency korumasini gelistir",
      aciklama: "Duplicate komut ve paralel yaris davranisini degistir.",
      etiketler: ["concurrency", "idempotency"],
    };

    const ilk = riskiDegerlendir(girdi);
    const ikinci = riskiDegerlendir({ ...girdi, etiketler: [...girdi.etiketler].reverse() });

    assert.deepEqual(ilk, ikinci);
    assert.deepEqual(ilk.nedenKodlari, ["YUKSEK_CONCURRENCY", "YUKSEK_IDEMPOTENCY"]);
  });

  test("kritik anahtar kelime tek basina riski yukseltmez", () => {
    assert.deepEqual(
      riskiDegerlendir({
        baslik: "Tenant isolation rehberindeki yazim hatasi",
        aciklama: "Yalniz dokumantasyon metnini guncelle.",
        etiketler: ["docs-only"],
      }),
      {
        riskSeviyesi: "LOW",
        nedenKodlari: ["DOKUMANTASYON_VEYA_STIL"],
        codexOnIncelemeGerekliMi: false,
        insanKapisiGerekliMi: false,
      },
    );
  });

  test("birden cok eslesmede en yuksek riski ve yalniz o seviyenin nedenlerini dondurur", () => {
    assert.deepEqual(
      riskiDegerlendir({
        baslik: "Payment core idempotency akisini degistir",
        aciklama: "Odeme cekirdegi ve duplicate korumasi birlikte guncellenecek.",
        etiketler: ["idempotency", "payment-core", "runtime-change"],
      }),
      {
        riskSeviyesi: "CRITICAL",
        nedenKodlari: ["KRITIK_ODEME_CEKIRDEGI"],
        codexOnIncelemeGerekliMi: true,
        insanKapisiGerekliMi: true,
      },
    );
  });

  test("bos veya bozuk girdiyi LOW kabul etmez", () => {
    assert.deepEqual(riskiDegerlendir(null), {
      riskSeviyesi: "MEDIUM",
      nedenKodlari: ["RISK_BELIRSIZ"],
      codexOnIncelemeGerekliMi: false,
      insanKapisiGerekliMi: false,
    });
    assert.deepEqual(riskiDegerlendir({ baslik: "", aciklama: "", etiketler: [] }), {
      riskSeviyesi: "MEDIUM",
      nedenKodlari: ["RISK_BELIRSIZ"],
      codexOnIncelemeGerekliMi: false,
      insanKapisiGerekliMi: false,
    });
  });

  test("Jira sinirindaki bozuk alanlari sessizce siniflandirmaz", () => {
    assert.deepEqual(
      riskiDegerlendir({
        baslik: "Concurrency davranisini degistir",
        aciklama: "Paralel yarisi engelle.",
        etiketler: ["concurrency", 42],
      }),
      {
        riskSeviyesi: "MEDIUM",
        nedenKodlari: ["RISK_GIRDISI_GECERSIZ"],
        codexOnIncelemeGerekliMi: false,
        insanKapisiGerekliMi: false,
      },
    );
  });
});
