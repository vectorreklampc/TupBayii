# TBP-36: Factory kalite runner ilk dilim belirtimi (taslak)

Kaynak gerçek: [canlı TBP-36](https://ucarmakadil.atlassian.net/browse/TBP-36),
özellikle 11044, 11051 ve 11052 numaralı yorumlar. Bu belge yalnız Factory
ilk diliminin inceleme taslağıdır; `READY`, gerçek yürütme veya TBP-36 kapanışı
değildir. PR #23'teki sentetik yardımcı ayrı kalır.

## Hedef ve sınır

Claude'un test beyanından bağımsız, değişmez aday commit'teki Factory kodunu
önceden onaylı Test Oracle ile sınamak. İlk dilim yalnız Node sözdizimi ve
Factory birim/karar testlerini kapsar. Backend, contracts, event-contracts,
Admin Web, Flutter, DB, performans ve production kontrolleri bu dilimin
başarısından PASS alamaz. TBP-237 plan ve kalite kararının sahibidir; bu runner
yalnız güvenilir süreç gözlemini ona taşır.

## Teknoloji, yapı ve adlandırma

- Node.js 24, mevcut `factory/src` ve `factory/test`; bağımlılıksız
  `factory/package-lock.json`. `npm ci`, `npm run`, shell ve yeni paket yok.
- Domain adları Türkçe anlamlı ASCII; yorumlar Türkçe ASCII; Node/Git/Docker
  teknoloji adları özgün yazılır. Mevcut kaynakta aynı kural korunur.
- Komut manifesti ve oracle, aday commit'in serbest metninden değil ayrı
  onaylı, sürümlü snapshot'tan gelir. Aday `src` ile onaylı `test` ve fixture
  ağaçları ayrı hash'lerle bağlanır. Adayın kendi test değişikliği otomatik
  oracle güncellemesi olamaz.
- İlk oracle **adayı** `main` commit
  `d2ec0594a59a77e6f3b9014ff433e4d4620537e8` içindeki dokuz Factory
  testidir; Git SHA tek başına insan onayı veya güvenilir manifest değildir.
  Bu revizyondaki fixture, iki invariant JSON ve kök normatif Markdown da
  aynı snapshot'ın girdileridir. Onaylı oracle kimliği/hash'i ayrıca
  sabitlenmeden gerçek yürütme ve PASS yoktur.

## Önerilen v1 komut manifesti

Her süreç için cwd `/workspace/factory`, shell kapalı, executable digest ile
pinlenmiş Node image içindeki `/usr/local/bin/node`. Girdi yalnız onaylı
`issue + candidate SHA + oracle hash + katalog hash + attempt` tuple'ıdır.
Liste üzerinde dosya adı ekleme/çıkarma/yeniden adlandırma yeni katalog onayı
gerektirir. Kaynak dosyaları aday SHA'dan, testler ve fixture onaylı oracle
snapshot'ından alınır.

`TEST-TBP-36-FACTORY-CHECK`: Her aşağıdaki aday kaynak ve baseline oracle test
dosyası için ayrı argv `["--check", "<dosya>"]`, dosya başına 10 saniye.
`src` ve `test` dizinleri ayrı snapshot'lardan geldiği için check her ikisini
de kapsar. Adayda yeni dosya ancak ayrıca sabitlenmiş katalog girdisiyle
syntax kontrolüne girer; bu kontrol ona unit kapsamı kazandırmaz.

| Aday kaynak | Baseline oracle testi adayı |
| --- | --- |
| `src/api-guvenlik-kapisi.mjs` | `test/api-guvenlik-kapisi.test.mjs` |
| `src/belirtim-koruyucusu.mjs` | `test/belirtim-koruyucusu.test.mjs` |
| `src/durum-makinesi.mjs` | `test/durum-makinesi.test.mjs` |
| `src/invariant-kapisi.mjs` | `test/invariant-kapisi.test.mjs` |
| `src/is-sahiplenme.mjs` | `test/is-sahiplenme.test.mjs` |
| `src/is-uygunluk-motoru.mjs` | `test/is-uygunluk-motoru.test.mjs` |
| `src/kabul-testi-catisi.mjs` | `test/kabul-testi-catisi.test.mjs` |
| `src/mimari-koruyucu.mjs` | `test/mimari-koruyucu.test.mjs` |
| `src/risk-degerlendirme-motoru.mjs` | `test/risk-degerlendirme-motoru.test.mjs` |

`src/sentetik-kalite-runner.mjs` ve `test/sentetik-kalite-runner.test.mjs`
yalnız PR #23 aday dalındadır. Kaynak dosyasının `--check` kontrolü katalogda
ayrıca sabitlenebilir; test dosyası bu baseline oracle'nın parçası değildir.
Runner davranışı için onaylı ayrı test revizyonu oluşmadan bu yeni özelliğin
test kapsamı veya TBP-36 tamamlanması iddia edilemez.

`TEST-TBP-36-FACTORY-UNIT`: argv `--test` ve tablodaki dokuz baseline test
dosyasının açık, sıralı listesi; 180 saniye. `test/fixtures` de yalnız onaylı
snapshot'tan gelir. Wildcard/autodiscovery ve aday test dosyası kullanılmaz.
Girdi kapanışı yalnız bu iki dizinden ibaret değildir:
`test/invariant-kapisi.test.mjs` ayrıca `factory/invariants/kayit-defteri.json`,
`factory/invariants/yurutulebilir-kurallar.json` ve depo kökündeki
`TupBayiProje_Global_Invariantlar.md` dosyasını okur. Bu üç dosyanın sürümü,
hash'i ve hangi güven kökünden geleceği onaylı manifestte açıkça yer almalıdır;
eksik ya da adaydan kendiliğinden alınmış girdiyle PASS üretilmez. Testlerin
geçici SQLite dosyaları için `os.tmpdir()` ayrı, sınırlı tmpfs'e işaret etmelidir.
Toplam attempt sınırı 5 dakika. Test kimlikleri, zorunlu sayılar ve
skip/cancel/flaky kuralı TBP-237 planıyla eşlenmeden exit 0 PASS sayılmaz.
Test kodu ve TAP/stdout yalnız başına güvenilir kaynak değildir; adapter'ın
gerçek yürütmeyi nasıl kanıtladığı ayrıca olumsuz fixture ile doğrulanmalıdır.
Özellikle aday kodu `process.exit(0)` çağırabilir veya stdout'a sahte TAP
yazabilir; exit 0 + metin ayrıştırma, her assertion'ın çalıştığının kanıtı
değildir. Güvenilir sonuç sınırının ve bu davranışlara karşı negatif testin
tasarımı onaylanmadan `TEST-*-UNIT` PASS'i TBP-237'ye aktarılmaz.
Sentetik Node 24 karşı örneğinde güvenilir test dosyası aday modülü içe
aktardı; aday modül `process.exit(0)` çağırdı, dosyadaki zorunlu assertion
hiç çalışmadı, fakat `node --test` exit 0 ve `tests 1 / pass 1` üretti:
bu sayı assertion'ı değil test dosyasını temsil ediyordu. Aynı dosyada normal
adayla zorunlu assertion çalışıp exit 1 verdi. Dolayısıyla mevcut dokuz
in-process test, yalnız önceden incelemeye alınacak içerik adayıdır; kodun
kasıtlı olarak test sürecini yönlendirebildiği tehdit modelinde yetkili PASS
oracle'sı değildir. Daha güçlü iddia için öneri, güvenilir assertion ve
sonuç gözlemini aday süreç sınırının dışına taşıyan black-box/contract test
revizyonudur. Bu kapsam değişikliği ve TEST eşlemesi onaylanmadan yalnız
syntax kontrolü bu açığı kapatmaz; `UNIT` kararı `BLOCKED` kalır.

## İlk black-box contract dilimi (tasarım yönü onaylı; yürütme manifesti değil)

Canlı TBP-36 yorum 11062, aşağıdaki dört vakayı ve vaka başına 10 saniye ile
ayrı stdin/stdout 4 KiB sınırını ilk contract oracle tasarım kararı olarak
kaydeder. Bu karar, vakaların canonical byte dizisini ve hash'ini, adapter
kaynak revizyonunu, tam Node argv'sini veya yürütme yetkisini onaylamaz.

`TEST-TBP-36-FACTORY-RISK-CONTRACT` yalnız
`src/risk-degerlendirme-motoru.mjs` dosyasının mevcut `riskiDegerlendir`
export'unun seçilmiş gözlenebilir davranışını sınar. Mevcut dokuz testin
yerine geçmez ve bunlardan PASS türetmez. Aday kaynak değişmez aday SHA'dan
salt okunur gelir; bu testin girdileri, beklenen JSON sonuçları ve karar kodu
aday container'ına mount edilmez. Güvenilir orkestratör her vaka için tek
JSON girdiyi stdin'e verir, container'daki sabit Node çağrısı export'u çağırıp
JSON sonucu stdout'a yazar. Adayın çalıştığı Node sürecinin içindeki çağrı
kodu güven kökü değildir: `process.exit(0)` dâhil tüm davranışlar dışarıdan
yalnız gözlenebilir süreç sonucu sayılır. Yeni public runtime API eklenmez.

Güvenilir dış sınır, her vakada tam bir JSON nesnesi dışında stdout, eksik
çıktı, ek çıktı, stderr, nonzero/sinyal, timeout veya bu contract'a özgü
4 KiB sınır aşımını `BLOCKED` sayar; çıkış 0 tek başına PASS değildir.
Bu sınır genel komutlar için önerilen 1 MiB sınırından daha dardır.
Beklenen yapıyla alan, değer, dizi sırası ve fazla alan dâhil birebir
eşleşme aranır. Her vaka ayrı
atılabilir süreç/container'da çalışır; bir vakanın sonucu diğerine taşınmaz.
Önerilen katalog v1'in tam girdileri ve beklenen sonuçları, mevcut Factory
risk testlerinden seçilmiştir (JSON anahtarları aşağıdaki sıradadır):

```json
[
  {"kimlik":"RISK-01","girdi":{"baslik":"README yazim duzeltmesi","aciklama":"Yalniz metin duzeltilecek.","etiketler":["docs-only"]},"beklenen":{"riskSeviyesi":"LOW","nedenKodlari":["DOKUMANTASYON_VEYA_STIL"],"codexOnIncelemeGerekliMi":false,"insanKapisiGerekliMi":false}},
  {"kimlik":"RISK-02","girdi":{"baslik":"Eszamanli stok yarisi","aciklama":"Concurrency kontrolunu uygula.","etiketler":["concurrency"]},"beklenen":{"riskSeviyesi":"HIGH","nedenKodlari":["YUKSEK_CONCURRENCY"],"codexOnIncelemeGerekliMi":true,"insanKapisiGerekliMi":false}},
  {"kimlik":"RISK-03","girdi":{"baslik":"Tenant isolation mimarisini degistir","aciklama":"Veritabani sinirini yeniden tasarla.","etiketler":["tenant-isolation","architecture-change"]},"beklenen":{"riskSeviyesi":"CRITICAL","nedenKodlari":["KRITIK_TENANT_IZOLASYONU"],"codexOnIncelemeGerekliMi":true,"insanKapisiGerekliMi":true}},
  {"kimlik":"RISK-04","girdi":{"baslik":"Concurrency davranisini degistir","aciklama":"Paralel yarisi engelle.","etiketler":["concurrency",42]},"beklenen":{"riskSeviyesi":"MEDIUM","nedenKodlari":["RISK_GIRDISI_GECERSIZ"],"codexOnIncelemeGerekliMi":false,"insanKapisiGerekliMi":false}}
]
```

Her vaka için yalnız `girdi` nesnesi tek UTF-8 JSON satırı ve LF olarak
stdin'e verilir. Bu dilim için sınır vaka başına 10 saniye, stdin ve stdout için
ayrı ayrı 4 KiB; stderr boş olmalıdır. Çıktı tek JSON nesnesi ve tek LF
olmalıdır; güvenilir katman tam şema ve beklenen değerleri doğrular, tekrar
eden JSON nesne anahtarını (iç içe nesneler dâhil) ayrıştırma öncesinde tespit
edip reddeder; yalnız `JSON.parse` bunu kanıtlamaz. Protokol dışı byte da
reddedilir. Bu denetimin trusted adapter'ı ve negatif fixture'ı ayrıca
onaylanmadan PASS yoktur. Katalog JSON'unun SHA-256 değeri ve Node
çağrısının tam argv'si onaylı manifestte sabitlenir;
bu belge tek başına o manifest değildir.

### Canonical oracle byte önerisi (henüz onaylı manifest değil)

Yukarıdaki JSON bloğundaki dört kayıt sırası ve nesne anahtar sırası korunarak
`JSON.stringify(kayitlar) + "\n"` üretilir; kodlama UTF-8, BOM ve CR yoktur.
`kayitlar` yalnız bu dört `{kimlik,girdi,beklenen}` nesnesini içerir. Bu exact
1153 byte'ın SHA-256 değeri
`5d7163157bd2f4cb4f3d4f1a3135c37466200c06f85019480ea6e24b54f73209`.
Bu hash insan tarafından onaylanmış oracle kimliği veya imza değildir; yalnız
bu taslak byte dizisini yeniden üretmek ve değişikliği fark etmek içindir.
Her vaka stdin'i ayrı `JSON.stringify(kayit.girdi) + "\n"` byte dizisidir;
beklenen karşılaştırma nesnesi de trusted tarafta
`JSON.stringify(kayit.beklenen) + "\n"` ile türetilebilir, fakat stdout'un
anahtar sırası byte düzeyinde eşit olmak zorunda değildir: strict ayrıştırmadan
sonra tam alan/tür/değer/dizi sırası karşılaştırılır. Katalog revizyonunda
anahtar veya vaka sırası değişirse hash yeniden hesaplanır ve yeniden onaylanır.

Önerilen process argv tam olarak
`["/usr/local/bin/node", "/trusted/risk-contract-bridge.mjs"]`, cwd
`/workspace/factory` ve stdin yukarıdaki tek vaka byte dizisidir; shell ve
ek Node bayrağı yoktur. Bridge'in yalnız onaylı
`/workspace/factory/src/risk-degerlendirme-motoru.mjs` export'unu çağırıp tek
JSON nesnesi + LF yazması önerilir. Bridge kaynak byte'ları, import kapanışı,
Node image digest'i ve dış trusted adapter'ın kaynak byte/hash'i henüz
sabitlenmemiştir. Bridge aday sürecinde çalıştığından PASS kararı veremez;
`process.exit(0)` ile boş çıktı dâhil bütün gözlem dış adapter'da doğrulanır.
Bu öneriyle container başlatılmaz ve `UNIT` PASS üretilmez.

Adapter sınırı aday sürecinin dışındadır: trusted orkestratör onaylı oracle
snapshot'ından her vakayı seçer, stdin byte'larını kendisi oluşturup sayar,
stdout/stderr byte'larını ayrı sayaçlarla akış sırasında sınırlar ve ham
çıktıyı kalıcı loga geçirmez. Çıkış kodu, sinyal, timeout ve container kapanışı
gözlemi de dışarıdan alınır. Çıktı ancak tek UTF-8 JSON nesnesi + tek LF
olarak ayrıştırılır; nesne anahtarları her iç içe nesnede tekil olmalıdır.
`JSON.parse` yinelenen anahtarı son değerle örttüğü için tek başına
doğrulayıcı olamaz. Nesnenin tam dört alanı, türleri, değerleri,
`nedenKodlari` sırası ve fazla/eksik alan yokluğu onaylı beklenen nesneyle
karşılaştırılır. Adapter, aday modülden import edilen kod veya adayın stdout
metninden alınan bir PASS/kimlik bilgisine dayanmaz. Bir vakadaki bilinmeyen
sonuç bütün contract'ı `BLOCKED` yapar; kısmi vaka başarısı aktarılmaz.

Trusted adapter'ın kendi kaynak hash'i ve oracle fixture byte'larının hash'i
aday SHA'dan ayrı, yetkili manifestte pinlenir. Negatif fixture'lar en az
`process.exit(0)`/boş çıktı, sahte PASS/TAP, yinelenen üst ve iç nesne anahtarı,
ek satır veya byte, bozuk UTF-8/JSON, yanlış veya fazla alan, stderr, nonzero,
timeout, her akış için sınır aşımı ve kapanışı doğrulanamayan alt süreci
`BLOCKED` olarak göstermelidir. Gerçek adapter ve bu fixture'ların kanıtı
olmadan dört vaka onayından PASS sonucu çıkarılmaz.

Beklenen dört alanın tamamı (`riskSeviyesi`, `nedenKodlari`,
`codexOnIncelemeGerekliMi`, `insanKapisiGerekliMi`) güvenilir tarafta
karşılaştırılır. Negatif oracle: erken `process.exit(0)` boş çıktı,
`PASS`/sahte TAP, ek satır, kısmi/bozuk JSON, yanlış nesne, tekrar eden çıktı,
timeout ve test vakaları arası state sızıntısı ACCEPTED olamaz. Aday girdiyi
görüp beklenen çıktıyı taklit ederse black-box test bunun iç uygulamasını
ayırt edemez; iddia yalnız onaylı vakalardaki **gözlenebilir davranıştır**.
Vaka listesi/hash'i, tam çağrı argv'si, giriş/çıkış boyutu ve süre sınırı,
güvenilir orkestratör sahipliği ile TBP-237 eşlemesi insan DoR'unda
sabitlenmeden bu öneri yürütme yetkisi veya `UNIT` PASS'i vermez.

## Yalıtım ve sınırlar

Her attempt atılabilir Linux container/VM'de, ağ kapalı, sır/token ve host
profiline erişimsiz, Docker socket'siz, non-root ve no-new-privileges ile;
capability yok, kaynak ve test mount'ları salt okunur, yalnız geçici tmpfs
yazılabilir, CPU/bellek/pid sınırları tanımlı çalışır. İmaj ve runtime
konfigürasyonu onaylı digest/hash ile bağlanır. Trusted orkestratör container
dışındadır; içerden yazılmış sonuç dosyasına veya PASS metnine güvenmez.
İptal/zaman aşımında tüm container/process-tree kapanışı gözlenir. Kapanış
kanıtlanamazsa sonuç BLOCKED; canlı süreç kalabilecek ortamda yeni iş
başlatılmaz. Host'ta değiştirilebilir repo kodu çalıştırılmaz.

## Kanıt ve test stratejisi

Trusted katman issue, SHA, oracle/katalog/runtime hash'i, attempt, TEST
kimliği, süre, exit/sinyal, timeout, çıktı byte sayısı/hash'i ve kapanış
gözlemini bağlar. Ham stdout/stderr Jira, PR veya kalıcı artefakta girmez.
Öneri: komut başına 1 MiB çıktı sınırı; aşım BLOCKED. Metadata için 7 gün,
yalnız proje maintainer erişimi önerilir; retention/silme mekanizması ayrıca
onaylanacaktır. Belirsiz crash/replay yeni PASS üretemez; aynı tuple ikinci
çalıştırma başlatmaz. `SKIP`/`FLAKY` ilk dilimde PASS değildir.

Pozitif test: onaylı test snapshot'ı ve aday Factory kaynağında her zorunlu
komut gerçek exit 0, eksiksiz test kimliği ve trusted kanıt üretir. Negatif
testler: eksik/değişmiş test veya fixture, sahte stdout PASS + exit 1,
yanlış SHA/oracle, timeout, kill reddi/kaçan alt süreç, ağ/host-secret
sentineli, çıktı taşması, eşzamanlı/replay, bozuk kanıt ve testte skip.
Bu koşulların herhangi biri TBP-237 `ACCEPTED` üretmemelidir.

## Açık kararlar ve uygulama kapısı

1. Dokuz baseline test ile yeni runner testinin ayrı yetkili oracle revizyonu,
   exact dosyalar ve TEST kimlikleri; ayrıca
   fixture ile üç ek normatif girdi dosyasının hash/güven kökü ve aday yeni
   dosyaların kabul yolu.
2. Node image digest'i, Docker Desktop/CI hedefindeki yalıtımın gerçek ağ,
   secret, mount ve process-tree negatif test kanıtı.
3. In-process dokuz testin adversarial güven sınırını aşan test revizyonu,
   sahte TAP/PASS, erken exit ve skip'i ayırt eden trusted adapter;
   ilk risk contract vakalarının exact hash/katalog onayı ve TBP-237'ye
   doğrulanmış sonuç biçimi.
4. 1 MiB sınırı, 7 günlük metadata retention/erişim/silme onayı ve crash
   sonrası tek sahiplik kalıcılığı.

Bu dört karar ve 23 alanlı Jira DoR onaylanmadan gerçek Factory kodu runner'a
verilmez, PR #23 merge edilmez veya TBP-36 `Tamamlandı` yapılmaz.
