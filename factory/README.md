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
