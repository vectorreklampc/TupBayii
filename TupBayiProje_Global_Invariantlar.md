# TupBayiProje Global Invariantları

**Jira:** `TBP-2`  
**Durum:** Normatif  
**Kapsam:** Tüm uygulamalar, servisler, arka plan işleri, entegrasyonlar ve operasyon araçları

Bu belge, TupBayiProje için uygulama ayrıntılarından bağımsız ve değiştirilemez sistem ilkelerini tanımlar. Kod, yapılandırma, veri modeli ve operasyon süreçleri bu kurallara uymak zorundadır. Çelişki halinde Jira gereksinimleri ve bu belgede kayıtlı invariantlar uygulanır.

## Yürütülebilir kayıt defteri

Bu belge invariant tanımının insan-okunur normatif kaynağıdır.
[`factory/invariants/kayit-defteri.json`](factory/invariants/kayit-defteri.json)
aynı kimlikler için yürütülebilir metadata companion'ıdır. Her kayıt; kimlik,
sınıf, tanım, gerekçe, kaynak requirement/ADR, ihlal örneği, doğrulama yöntemi,
test kimliği, önem, remediation ve Human Gate kararını taşır.

`factory/src/invariant-kapisi.mjs` kanıtları fail-closed değerlendirir:

- bütün kayıtlar açık `KANITLANDI` kanıtı taşıyorsa `ACCEPTED`,
- bir ihlal varsa invariant kimliğiyle `BLOCKED`,
- kanıt eksik veya bilinmiyorsa `BLOCKED`,
- kanıt kayıtlı `testKimligi` ile eşleşmiyorsa `BLOCKED`,
- `CRITICAL` kaydın yetkili Human Gate kanıtı yoksa `BLOCKED`,
- kayıt defteri şeması ya da kimlik eşleşmesi bozuksa `BLOCKED`.

Kanonik 26 kimlik manifesti, yürütülebilir kurallar ve yapılandırılmış fixture
girdileri testte birebir karşılaştırılır. Tanım değişikliği
yalnız iki kaynağı birlikte güncelleyen, ilgili fixture/test kanıtını yenileyen ve
`INV-GOV-002` değişiklik yetkisini sağlayan Jira Change Request ile yapılabilir.

## 1. Tenant izolasyonu ve veri sahipliği

### `INV-TEN-001` — Database-per-Tenant

Her tenant ayrı bir fiziksel PostgreSQL veritabanı kullanır. Tenant operasyon verileri ortak bir tenant tablosunda veya ortak bir tenant şemasında birleştirilemez.

### `INV-TEN-002` — Master DB sınırı

Master DB yalnızca control-plane verilerini tutar. Tenant iş verileri, stok hareketleri, satışlar, cari hareketler ve operasyon kayıtları Master DB'ye yazılamaz.

### `INV-TEN-003` — Tenant kimliğinin kaynağı

İstek içindeki `TenantId`, header, query string veya request body authoritative değildir. Tenant context yalnızca doğrulanmış kimlik ve server-side çözümleme üzerinden türetilir.

### `INV-TEN-004` — Sınır zorunluluğu

Her tenant veri erişimi, işlem başlamadan önce çözümlenmiş tenant context ile sınırlandırılır. Tenant context bulunamadığında veya doğrulanamadığında işlem güvenli biçimde reddedilir.

## 2. Stok ve tüp hareketleri

### `INV-STK-001` — Hareket defteri otoritesi

Fiziksel stok değişikliklerinin kaynağı movement ledger'dır. Mevcut stok doğrudan artırılamaz veya azaltılamaz; yalnızca geçerli bir hareket kaydı sonucunda değişir.

### `INV-STK-002` — FULL ve EMPTY ayrımı

Dolu (`FULL`) ve boş (`EMPTY`) tüp stokları ayrı durumlar olarak tutulur. Biri diğerinin negatif veya türetilmiş karşılığı kabul edilemez.

### `INV-STK-003` — Fiziksel lokasyon

Depo, araç ve müşteri gibi fiziksel lokasyonlar açıkça modellenir. Vehicle Stock bağımsız bir fiziksel lokasyondur; kurye teslimatı ana depo stokunu doğrudan değiştiremez.

### `INV-STK-004` — Kayıtların korunması

Tamamlanmış stok hareketleri hard-delete veya yerinde geçmiş değiştirme ile düzeltilemez. Hatalar reversal veya correction hareketiyle giderilir.

### `INV-STK-005` — Atomiklik ve eşzamanlılık

Bir iş işleminin stok üzerindeki bütün etkileri atomik olmalıdır. Duplicate movement, oversell ve eşzamanlı güncelleme yarışları veri katmanında engellenir.

## 3. Finansal kayıtlar

### `INV-FIN-001` — Finansal ledger

Satış, tahsilat, ödeme, gider ve cari etkiler izlenebilir ledger kayıtları üretir. Son bakiye tek başına finansal gerçekliğin kaynağı değildir.

### `INV-FIN-002` — Reversal ve correction

Tamamlanmış finansal kayıtlar hard-delete edilemez ve geçmişi gizleyecek biçimde değiştirilemez. Düzeltme, önceki kayda bağlı reversal veya correction ile yapılır.

### `INV-FIN-003` — İşlem bütünlüğü

Bir satış veya tahsilatın finans, stok ve cari etkileri tanımlanan transaction sınırı içinde ya birlikte başarıya ulaşır ya da birlikte geri alınır.

### `INV-FIN-004` — İdempotency

Aynı iş komutunun tekrar gönderilmesi ikinci bir finansal veya stok etkisi oluşturamaz. İdempotency anahtarı server-side doğrulanır ve tenant sınırı içinde benzersizdir.

## 4. Ödeme otoritesi

### `INV-PAY-001` — Doğrulanmış webhook

Ödeme sonucu için authoritative kaynak, imzası doğrulanmış provider webhook'u ile Master DB'deki payment state'in birlikte değerlendirilmesidir. Client bildirimi tek başına ödeme kanıtı değildir.

### `INV-PAY-002` — Tekrar ve sıra koruması

Webhook işleme duplicate, replay ve out-of-order olaylara dayanıklı olmalıdır. Daha eski veya yinelenen olay doğrulanmış güncel ödeme durumunu geri alamaz.

### `INV-PAY-003` — Lisans aktivasyonu

Abonelik veya lisans aktivasyonu yalnızca doğrulanmış ödeme state machine geçişi sonucunda yapılabilir.

## 5. Offline çalışma ve conflict yönetimi

### `INV-OFF-001` — Sessiz last-write-wins yasağı

Finansal kayıtlar ve fiziksel stok etkileri için silent last-write-wins uygulanamaz. Çözülemeyen conflict açıkça kaydedilir ve Conflict Review veya tanımlı domain politikasıyla sonuçlandırılır.

### `INV-OFF-002` — Offline komut kimliği

Her offline komut benzersiz kimlik, tenant, cihaz, sıra ve idempotency bilgisi taşır. Server bu bilgileri doğrulamadan domain etkisi oluşturmaz.

### `INV-OFF-003` — Yetki yeniden doğrulaması

Offline oluşturulan komutlar senkronizasyon sırasında güncel server-side kimlik, tenant ve yetki kurallarıyla yeniden doğrulanır.

### `INV-OFF-004` — Kullanıcıya görünür durum

Pending, stale, rejected ve conflicted durumları kullanıcıdan gizlenemez. Başarısız senkronizasyon başarılı işlem gibi gösterilemez.

## 6. Audit ve izlenebilirlik

### `INV-AUD-001` — Kritik işlem izi

Kimlik, yetki, tenant çözümleme, stok, finans, ödeme, lisans, migration, restore ve yönetici işlemleri kim, ne zaman, hangi tenant ve hangi correlation kimliğiyle yaptı bilgisiyle audit edilir.

### `INV-AUD-002` — Audit bütünlüğü

Audit kayıtları iş akışı tarafından sessizce değiştirilemez veya silinemez. Düzeltme gerekiyorsa önceki kaydı koruyan yeni bir kayıt üretilir.

### `INV-AUD-003` — Hassas veri koruması

Secret, parola, token, tam ödeme verisi ve gereksiz kişisel veri log veya audit içeriğine yazılamaz. Gerekli tanımlayıcılar maskeleme kurallarına uyar.

### `INV-AUD-004` — Kanıtlanabilirlik

HIGH ve CRITICAL riskli işler somut Test Oracle veya Golden Scenario kanıtı olmadan tamamlanmış sayılamaz.

## 7. Human Gate ve değişiklik yetkisi

### `INV-GOV-001` — Kritik değişiklik onayı

Production deploy, destructive migration, restore, tenant izolasyonu, authentication, payment core ve benzeri kritik değişiklikler Human Gate onayı gerektirir.

### `INV-GOV-002` — AI yetki sınırı

AI bu invariantları kaldıramaz, gevşetemez, yeniden yorumlayarak etkisizleştiremez veya yeni business rule icat edemez.

Bir invariant değişikliği yalnızca aşağıdaki kanıtların tamamıyla yapılabilir:

1. İnsan tarafından onaylanmış Jira Change Request,
2. Etki ve geri dönüş planı,
3. İlgili ADR,
4. Güncellenmiş test kanıtı,
5. Gerekli Human Gate kararı.

Bu koşullar yoksa değişiklik `HUMAN_REQUIRED` veya mimari ihlal durumunda `BLOCKED` olarak işaretlenir.

## 8. Yasak uygulama yolları

Aşağıdaki uygulamalar açıkça yasaktır:

- Birden fazla tenantın operasyon verisini aynı fiziksel veritabanında toplamak.
- Tenant seçimini client tarafından gönderilen `TenantId` değerine güvenerek yapmak.
- Tenant iş verisini Master DB'de tutmak.
- Stok bakiyesini movement ledger dışında doğrudan değiştirmek.
- `FULL` ve `EMPTY` stoklarını tek sayı veya birbirinin negatifi olarak modellemek.
- Kurye teslimatında Vehicle Stock hareketi oluşturmadan ana depo stokunu doğrudan değiştirmek.
- Tamamlanmış stok veya finans kaydını hard-delete etmek ya da geçmiş etkisini yerinde değiştirmek.
- Client callback'ini veya redirect sonucunu ödeme kanıtı kabul etmek.
- Duplicate komut veya webhook'un ikinci bir domain etkisi oluşturmasına izin vermek.
- Finansal veya stok conflict'ini sessiz last-write-wins ile çözmek.
- Yetki, tenant sınırı veya imza doğrulaması başarısız olduğunda fail-open davranmak.
- Secret, parola veya token değerlerini loglamak.
- Gerekli Human Gate'i atlamak.
- Test Oracle veya Golden Scenario olmadan HIGH/CRITICAL işi tamamlamak.
- Jira gereksinimi olmadan AI tarafından business rule eklemek veya bu invariantları değiştirmek.

## 9. Uygulama ve review sonucu

Bu invariantlardan birini ihlal eden tasarım veya implementasyon kabul edilemez. Review sonucu ihlalin niteliğine göre `REQUEST_CHANGES`, `BLOCKED` veya `HUMAN_REQUIRED` olmalıdır. P00 GATE, bu belgenin sonraki yönetişim belgeleri ve test standartlarıyla izlenebilirliğini doğrulamadan geçilemez.
