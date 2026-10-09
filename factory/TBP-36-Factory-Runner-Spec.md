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

## Önerilen ilk black-box contract dilimi (henüz onaylı katalog değil)

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
çıktı, ek çıktı, stderr, nonzero/sinyal, timeout veya 1 MiB sınır aşımını
`BLOCKED` sayar; çıkış 0 tek başına PASS değildir. Beklenen yapıyla alan,
değer, dizi sırası ve fazla alan dâhil birebir eşleşme aranır. Her vaka ayrı
atılabilir süreç/container'da çalışır; bir vakanın sonucu diğerine taşınmaz.
Önerilen pozitif vakalar onaylı revizyonda en az şu dört davranışı kapsar:

| Girdi sınıfı | Beklenen risk / neden |
| --- | --- |
| `docs-only` yazım düzeltmesi | `LOW` / `DOKUMANTASYON_VEYA_STIL` |
| `concurrency` değişikliği | `HIGH` / `YUKSEK_CONCURRENCY` |
| `tenant-isolation` mimari değişikliği | `CRITICAL` / `KRITIK_TENANT_IZOLASYONU` |
| Sayısal etiket içeren bozuk girdi | `MEDIUM` / `RISK_GIRDISI_GECERSIZ` |

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
