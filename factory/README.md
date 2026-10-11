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

`src/invariant-kapisi.mjs` iki acik modda fail-closed calisir:

- Kayit defteri/uygunluk modu (`uygunluguDogrula`): strict kayit defteri semasi,
  koddaki immutable `KANONIK_MANIFEST` (kimlik, sira, onem, Human Gate), her
  invariant icin `invariants/yurutulebilir-kurallar.json` predikati, her
  predikatin `invariants/kural-ornekleri.json` icindeki domain bicimli pozitif
  ornekte `KANITLANDI` ve ihlal orneginde `IHLAL` uretmesi, normatif Markdown
  baslik/token paritesi ve `invariants/kabul-edilmis-riskler.json` istisnalarinin
  suresi birlikte gecmelidir.
- Is kalemi modu (`invariantKanitlariniDegerlendir`): yalniz ilgili
  invariantlar icin, ayni `isKimligi` ve `calistirmaKimligi`ye bagli, kayitli
  `testKimligi` ile eslesen yurutulmus test `gozlem`i kabul edilir. Kapi beyan
  edilen sonuca guvenmez; gozlemi semantik predikata uygular. Eksik, bilinmeyen,
  ilgisiz, bozuk, eski, eslesmeyen, kanitlanamayan veya ihlal eden kanit ve
  `CRITICAL` kayitta ise/invariant'a bagli insan Human Gate onayi olmamasi
  `BLOCKED` sonucudur.

Tamamlama kapisinin sahibi `src/kabul-testi-catisi.mjs` icindeki
`kaliteKapisiniDegerlendir`'dir. Kabul kriterlerinde kaynak gosterilen her
`INV-*` ilgili invarianttir: plan kayitli `TEST-INV-*` testini icermeli, bu
test karantinaya alinamaz ve is kalemi modu `ACCEPTED` olmadan
`tamamlanabilirMi` `true` olmaz. Kapi yalniz saglanan yurutulmus kaniti
degerlendirir; henuz uygulanmamis tenant/stok/finans/urun alanlarinin uyumlu
oldugunu beyan etmez.

Kabul edilmis risk istisnasi duzeltme veya `PASS` degildir. Admin Web
`braces` / `GHSA-vfj7-8cjw-p6xm` gelistirme bagimliligi istisnasi
`KABUL_EDILMIS_RISK`, `duzeltildi: false` olarak tutulur ve 2026-11-07 (UTC)
gununden itibaren kayit defteri modu `BLOCKED` olur.

Komut satiri kanonik dosyalari `import.meta.url` uzerinden cozer; her calisma
dizininden ayni sonucu verir. Cikis kodu `0` ACCEPTED, `1` BLOCKED, `2`
kullanim hatasidir:

```powershell
node src/invariant-kapisi-cli.mjs kayit-defteri
node src/invariant-kapisi-cli.mjs is-kalemi test/fixtures/is-kalemi-gecerli.json
```

`is-kalemi` girdisi `isKimligi`, `calistirmaKimligi`, `testOracle`,
`kabulKriterleri`, `testSonuclari` ve `invariantKanitlari` tasir; test plani
istemciden alinmaz, kabul kriterlerinden yeniden derlenir. CI factory isi
kayit defteri modunu ve is kalemi modunun pozitif/negatif sozlesmesini gercek
komutla calistirir.

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
- `STD-KOD-001`: Domain kodu Turkce anlamli ASCII adlandirma kullanir. Bu bir
  global invariant degil, ic kodlama standardi kimligidir.

Her invariant kaydi `durum: UYGUN | IHLAL` ve en az bir metin `kanitlar`
degeri tasir. Bilinmeyen durum, eksik/bozuk kanit veya eksik girdi fail-closed
`BLOCKED` olur. Butun kayitlar kanitli `UYGUN` ise sonuc `ACCEPTED` olur.
`invariantKodlari` ve `bulgular`, ihlalleri yukaridaki kararlı sirada raporlar.

## TBP-34 risk degerlendirme motoru

`src/risk-degerlendirme-motoru.mjs`, normalize edilmis Jira basligi,
aciklamasi ve etiketlerini saf ve deterministik olarak degerlendirir:

```js
import { riskiDegerlendir } from "./src/risk-degerlendirme-motoru.mjs";

const sonuc = riskiDegerlendir({
  baslik: "Idempotency korumasi",
  aciklama: "Duplicate komut etkisini engelle.",
  etiketler: ["idempotency"],
});
```

Sonuc her zaman `riskSeviyesi`, kararli siradaki `nedenKodlari`,
`codexOnIncelemeGerekliMi` ve `insanKapisiGerekliMi` alanlarini tasir.
HIGH ve CRITICAL sonucunda Codex on incelemesi; CRITICAL sonucunda Human Gate
zorunludur.

Kritik bir terimin metinde gecmesi tek basina riski yukseltmez. Metin tabanli
eslesme degisiklik niyeti ve issue semantigini birlikte arar; `docs-only` veya
`style-only` baglami yalniz metin eslesmesini LOW seviyesinde tutar. Kritik
alan etiketi varsa bu acik sinyal goz ardi edilmez. Birden cok kural eslesirse
yalniz en yuksek seviyenin nedenleri kanonik kural sirasinda dondurulur.

Bos girdi LOW kabul edilmez ve `RISK_BELIRSIZ` ile MEDIUM olur. Jira
sinirindaki bozuk alan tipleri `RISK_GIRDISI_GECERSIZ` ile MEDIUM olur; motor
gecerli parcalari kullanarak sessizce risk karari vermez.

## TBP-236 API guvenlik kapisi

`src/api-guvenlik-kapisi.mjs`, normalize edilmis endpoint hardening
sozlesmesini ag cagrisi yapmadan ve fail-closed olarak degerlendirir. Her
endpoint su 17 kontrolu `PASS` ya da kanitli ve gerekceli `NOT_APPLICABLE`
olarak bildirmelidir:

- authentication ve authorization
- tenant izolasyonu
- girdi dogrulama ve payload siniri
- rate limit, kota ve burst politikasi
- idempotency
- timeout/cancellation ve retry siniri
- CORS/CSRF politikasi
- secret yonetimi
- hata yaniti standardi
- PII/secret log redaksiyonu
- webhook imza dogrulama ve replay korumasi
- API surumleme/kullanimdan kaldirma
- OpenAPI contract dogrulama
- abuse/anomali telemetry

Her kontrol en az bir kanit tasir. `securityTestleri` veya `contractTestleri`
`PASS` degilse sonuc `BLOCKED` olur ve bulgu merge ile release'i engeller.
Kritik endpoint `failOpen: false` degerini acikca bildirmelidir; eksik ya da
true deger kabul edilmez. OpenAPI'nin kendi contract kurallari bu modulde
tekrarlanmaz; bu kapi onlarin test sonucunu ve endpoint kanitini tuketir.

```js
import {
  apiGuvenliginiDegerlendir,
  rateLimitKarariVer,
} from "./src/api-guvenlik-kapisi.mjs";

const karar = apiGuvenliginiDegerlendir({
  endpointler,
  kaliteKapilari: {
    securityTestleri: "PASS",
    contractTestleri: "PASS",
  },
});
```

Referans rate limit karari sabit pencere kullanir. `kota + burst`, bir pencere
icindeki toplam izinli istek sayisidir; sinira ulasan sonraki istek pencere
doluncaya kadar reddedilir. Fonksiyon saat ya da kalici state okumaz. Politika
ile `pencereYasiMs` ve `oncekiIstekSayisi` girdileri ayniysa karar da aynidir.
Dagitik sayacin atomikligi ve depolamasi adapter sorumlulugudur; API katmani
bu saf karari authoritative sayac state'i ile uygular.

## TBP-237 kabul testi catisi ve kalite piramidi

`src/kabul-testi-catisi.mjs`, Gherkin veya structured kabul kriterlerini
deterministik bir test planina derler. Her kriter bir `AC-*` kimligi, risk
seviyesi, en az bir `REQ-*`, `BR-*`, `INV-*`, `AC-*` veya `GS-*` kaynak
kimligi ve en az bir benzersiz `TEST-*` kimligi tasir. Derleyici bu kaynaklari
testlere baglayan izlenebilirlik matrisini uretir; kriter icinden gelen Test
Oracle degisikligini fail-closed reddeder.

Kalite piramidi hizli geri bildirim, sinir/altyapi ve sistem/release
katmanlarinda Jira'nin tanimladigi 15 test turunu kapsar. Piramit yuzde
coverage hedefi koymaz; hangi risk ve davranis kaynaginin hangi calistirilabilir
testle kapsandigini esas alir.

```js
import {
  kabulTestPlaniOlustur,
  kaliteKapisiniDegerlendir,
} from "./src/kabul-testi-catisi.mjs";

const plan = kabulTestPlaniOlustur({
  testOracle: {
    kimlik: "ORACLE-SATIS-001",
    surum: "1",
    ozet: "Satis tamamlama authoritative beklenen sonuclari",
  },
  kabulKriterleri,
});

const kapi = kaliteKapisiniDegerlendir({ plan, testSonuclari });
```

Eksik, bilinmeyen, tekrarli veya basarisiz test sonucu issue tamamlamayi
engeller. Flaky test yalniz kritik degilse, somut gerekce ve bir `TBP-*` takip
isiyle karantinaya alinabilir. Kritik test karantinasi her durumda engellenir;
kritik gate bypass edilemez.
