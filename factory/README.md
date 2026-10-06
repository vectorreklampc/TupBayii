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

## Invariant-Driven Design kapisi

`TBP-233` kapsaminda global invariant metadata'si
`invariants/kayit-defteri.json` dosyasinda surumlenir. Insan-okunur normatif
tanimlar repository kokundeki `TupBayiProje_Global_Invariantlar.md` dosyasinda
kalir; test iki kaynagin kimliklerini birebir esler.

`src/invariant-kapisi.mjs`, her invariant icin dis kalite kapisinin urettigi
kaniti alir. Yalniz butun kayitlar `KANITLANDI` ise `ACCEPTED` verir. `IHLAL`,
`BILINMIYOR`, eksik kanit, bilinmeyen invariant veya bozuk kayit defteri
fail-closed `BLOCKED` sonucudur. Kanit kayitli `testKimligi` ile eslesir;
`CRITICAL` kayit ayrica acik Human Gate onay kaniti tasir. Bos veya eksiltilmis
kanonik manifest kabul edilmez. Kapi mimari/security/domain testinin yerine
gecmez; bu testlerin sonuclarini kalici invariant kimlikleriyle toplar.

Her HIGH/CRITICAL kayit icin declarative kural
`invariants/yurutulebilir-kurallar.json`, pozitif ve ihlal girdisi
`test/fixtures/invariant-kanitlari.json` icinde bulunur. Fixture kapsami ve
metadata drift'i `test/invariant-kapisi.test.mjs` ile dogrulanir.

## Rollback ve recovery

Kod rollback'i mevcut SQLite semasini silmez. Bu ticket yalniz additive ilk
semayi olusturur; migration yoktur. Process yeniden baslatildiginda ayni
veritabani yolu verilerek son kalici durum okunur. Veritabani dosyasi silinmez
ve hata durumundan sessizce baska bir duruma gecilmez.
