# Factory

Bu dizin otonom yazilim fabrikasi bilesenleri icin kanonik koktur.

## SM-FACTORY-001 durum makinesi

`TBP-29` kapsamindaki yazilim fabrikasi is yasam dongusunun tek sahibi
`src/durum-makinesi.mjs` moduludur. Authoritative kaynak, kurucuya verilen dosya
yolundaki SQLite veritabanidir. Durum bellekte tutulmaz; her kabul edilen gecis,
durum ve denetim kaydini tek transaction icinde kalicilastirir.

Baslangic durumu `PLAN_IS_LISTESI`, basarili terminal durum `TAMAMLANDI`'dir.
`DEGISIKLIK_ISTENDI`, `ENGELLENDI`, `INSAN_ONAYI_GEREKLI` ve `HATA` bu ticket
kapsaminda terminal hata dallaridir. Hata durumlarindan recovery gecisi ancak
canli Jira'da acik bir kural tanimlandiginda eklenebilir.

Ana akis:

```text
PLAN_IS_LISTESI -> HAZIRLIK_KONTROLU
HAZIRLIK_KONTROLU -> CODEX_ON_INCELEME -> CLAUDE_UYGULAMA
HAZIRLIK_KONTROLU ----------------------> CLAUDE_UYGULAMA
CLAUDE_UYGULAMA -> BAGIMSIZ_TEST -> CODEX_SON_INCELEME
CODEX_SON_INCELEME -> SENARYO_DOGRULAMA -> TAMAMLANDI
```

Her aktif durumdan dort terminal hata dalina gecis acikca tanimlidir. Diger tum
gecisler `FACTORY_STATE_INVALID_TRANSITION` ile reddedilir ve denetlenir.

## Kullanim sozlesmesi

```js
import {
  DURUMLAR,
  YazilimFabrikasiDurumMakinesi,
} from "./src/durum-makinesi.mjs";

const makine = new YazilimFabrikasiDurumMakinesi("./data/factory.sqlite");
makine.isiBaslat("TBP-29");
makine.gecisUygula({
  isAnahtari: "TBP-29",
  hedefDurum: DURUMLAR.HAZIRLIK_KONTROLU,
  aktor: "codex",
  calistirici: "factory-worker-1",
  deneme: 1,
  korelasyonKimligi: "corr-...",
  idempotencyAnahtari: "TBP-29:hazirlik",
  zamanDamgasi: new Date().toISOString(),
});
makine.kapat();
```

Ayni is ve idempotency anahtariyla ayni hedefe retry, onceki sonucu dondurur ve
ikinci durum/audit etkisi olusturmaz. Ayni anahtarin farkli hedefle kullanimi
`FACTORY_STATE_IDEMPOTENCY_CONFLICT` sonucudur.

## Dogrulama

Node.js 24 veya ustu gerekir.

```powershell
npm.cmd install
npm.cmd run check
npm.cmd test
```

Testler gecis tablosunu, gecersiz gecis reddini, denetim alanlarini, process
restart sonrasi devam etmeyi ve kalici idempotent retry davranisini kanitlar.

## Rollback ve recovery

Kod rollback'i mevcut SQLite semasini silmez. Bu ticket yalniz additive ilk
semayi olusturur; migration yoktur. Process yeniden baslatildiginda ayni
veritabani yolu verilerek son kalici durum okunur. Veritabani dosyasi silinmez
ve hata durumundan sessizce baska bir duruma gecilmez.

## TBP-32 belirtim koruyucusu

`src/belirtim-koruyucusu.mjs`, normalize edilmis Jira snapshot'ini saf ve
deterministik olarak degerlendirir. Ag cagrisi yapmaz ve caller'in `hazir`
beyanina guvenmez.

Girdi uc bolumden olusur:

- `alanlar`: Story standardindaki 23 zorunlu alan.
- `etiketler`: Gereksinim, mimari, sozlesme, tasarim, izlenebilirlik,
  Test Oracle, risk ve Human Gate kapilari.
- `kanitlar`: Mimari, sozlesme, Figma, izlenebilirlik, test referansi ve
  gerekiyorsa insan onayi referanslari.

Koruyucu eksikleri su kararli sirayla toplar:
`GEREKSINIM_EKSIK`, `MIMARI_EKSIK`, `SOZLESME_EKSIK`,
`TASARIM_EKSIK`, `IZLENEBILIRLIK_EKSIK`,
`TEST_REFERANSI_EKSIK`. Eksik yoksa sonuc `HAZIR` olur. `sonuc` ilk
neden kodudur; `nedenKodlari` butun eksik kategorilerini, `eksikler` ise
alan veya kanit yolunu tasir.

`N/A` yalniz `N/A - <somut gerekce>` biciminde kabul edilir. Tasarim gerekli
ise Figma URL kaniti, Human Gate gerekli ise onay kaniti zorunludur. Hazir ve
gerekmez etiketlerinin birlikte bulunmasi fail-closed reddedilir.

## TBP-33 Architecture Guardian

`src/mimari-koruyucu.mjs`, normalize edilmis mimari inceleme snapshot'ini ag
cagrisi yapmadan degerlendirir. Asagidaki global invariantlari kanonik sirada
korur:

- `INV-TEN-001`: Database-per-Tenant.
- `INV-TEN-002`: Master DB yalniz control-plane verisi tutar.
- `INV-TEN-003`: Tenant context server-side cozulur; client `TenantId`
  authoritative degildir.
- `INV-STK-001`: Fiziksel stok yalniz movement ledger ile degisir.
- `INV-PAY-001`: Odeme authority dogrulanmis webhook ve Master DB state'idir.
- `INV-CODE-001`: Domain kodu Turkce anlamli ASCII adlandirma kullanir.

Her invariant kaydi `durum: UYGUN | IHLAL` ve en az bir metin `kanitlar`
degeri tasir. Bilinmeyen durum, eksik/bozuk kanit veya eksik girdi fail-closed
`BLOCKED` olur. Butun kayitlar kanitli `UYGUN` ise sonuc `ACCEPTED` olur.
`invariantKodlari` ve `bulgular`, ihlalleri yukaridaki kararlı sirada raporlar.
