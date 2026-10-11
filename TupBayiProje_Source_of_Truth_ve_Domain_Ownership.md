# TupBayiProje Source of Truth ve Domain Ownership Kayıt Defteri

**Jira:** `TBP-3`  
**Durum:** Normatif  
**Bağlı belge:** `TupBayiProje_Global_Invariantlar.md`

Bu kayıt defteri kritik verilerin authoritative kaynağını, sahibi olan domain'i ve diğer domainlerin bu veriyi nasıl kullanabileceğini tanımlar. Her veri için yalnızca bir authoritative kaynak vardır. Projection, cache, rapor veya istemci kopyası hiçbir zaman ikinci bir gerçek kaynak oluşturmaz.

## 1. Sahiplik kuralları

1. Bir veri kümesini yalnızca sahibi olan domain oluşturabilir, değiştirebilir ve yaşam döngüsünde ilerletebilir.
2. Başka bir domain, sahibin tablosuna veya aggregate'ına doğrudan yazamaz.
3. Domainler arası değişiklik; sahibin application service'i, tanımlı command contract'ı veya event contract'ı üzerinden yapılır.
4. Atomiklik gereken aynı Tenant DB işlemlerinde orchestration, sahip domainlerin kurallarını çağırır; tablo sahipliği atlanamaz.
5. Domainler arası eventual işlem gerekiyorsa durable outbox/inbox ve idempotency kullanılır.
6. Yabancı domain verisi yalnızca kimlik ile referanslanır. Kopyalanan gösterim alanları snapshot veya projection olarak işaretlenir.
7. Projection ve cache sahibin event veya query contract'ından yeniden oluşturulabilir olmalıdır.
8. Client, rapor, cache, log ve audit kaydı business state için authoritative kaynak değildir.
9. Bir ownership değişikliği Jira Change Request, ADR, migration/rollback planı ve Human Gate gerektirir.

## 2. Control-plane kayıtları

| Kayıt | Sahip domain | Authoritative veri | Fiziksel kaynak | Tek yazma yetkisi | Diğer domainlerin erişimi |
|---|---|---|---|---|---|
| `SOT-IDN-001` | Identity | Kullanıcı kimliği, credential referansı, session ve revoke state | Master DB | Identity | Doğrulanmış identity/authorization contract'ları |
| `SOT-TEN-001` | Tenancy | Tenant kimliği, tenant yaşam döngüsü, tenant DB metadata ve migration version | Master DB | Tenancy | Server-side `TenantConnectionResolver` ve tenant lifecycle event'leri |
| `SOT-LIC-001` | Licensing | Subscription, trial, grace, suspension ve license state | Master DB | Licensing | License query/enforcement contract'ı |
| `SOT-DEV-001` | Licensing | Cihaz aktivasyonu, cihaz limiti ve revoke state | Master DB | Licensing | Device activation ve enforcement contract'ları |
| `SOT-BIL-001` | Billing | Payment intent/attempt, doğrulanmış provider event'i ve payment state | Master DB | Billing | İmzalı webhook işleme ve payment state event'leri |
| `SOT-PRV-001` | Tenancy | Provisioning ve tenant migration job state | Master DB | Tenancy | Provisioning/migration query ve lifecycle event'leri |

### Control-plane sınırı

Master DB yalnızca yukarıdaki control-plane verilerini ve `SOT-AUD-001` kapsamındaki control-plane audit kaydını tutar (karar: TBP-58 yorum 10867). Müşteri, ürün, fiyat, satış, sipariş, stok, cari ve teslimat gibi tenant operasyon verileri Master DB'ye yazılamaz.

## 3. Tenant operasyon kayıtları

| Kayıt | Sahip domain | Authoritative veri | Fiziksel kaynak | Tek yazma yetkisi | Diğer domainlerin erişimi |
|---|---|---|---|---|---|
| `SOT-OPS-001` | Tenant Operations | İşletme profili, şube ve operasyon ayarları | Tenant DB | Tenant Operations | Kimlik ve scope içeren query contract'ları |
| `SOT-OPS-002` | Tenant Operations | Depo tanımı ve depo türü | Tenant DB | Tenant Operations | Inventory lokasyon referansı üzerinden |
| `SOT-OPS-003` | Tenant Operations | Tenant kullanıcı referansı ve şube ataması | Tenant DB | Tenant Operations | Identity kimliği referansı ve authorization query'si |
| `SOT-OPS-004` | Tenant Operations | Ürün kataloğu ve ürün temel bilgileri | Tenant DB | Tenant Operations | Pricing, Sales, Orders ve Inventory ürün kimliğiyle referanslar |
| `SOT-CUS-001` | Customers | Bireysel/ticari müşteri, iletişim bilgisi ve müşteri durumu | Tenant DB | Customers | Customer query contract'ı ve müşteri kimliği |
| `SOT-CUS-002` | Customers | Müşteri adresleri ve teslimat notları | Tenant DB | Customers | Orders ve Delivery salt-okunur snapshot/query kullanır |
| `SOT-PRI-001` | Pricing | Fiyat geçmişi, aktif fiyat ve müşteri özel fiyatı | Tenant DB | Pricing | Fiyat çözümleme contract'ı; satışta çözümlenen fiyat snapshot'ı |
| `SOT-ACC-001` | Accounting | Cari ledger, kredi limiti, vade ve aging sonucu | Tenant DB | Accounting | Cari query ve posting/reversal command'ları |
| `SOT-ACC-002` | Accounting | Kasa, vardiya, tahsilat, gider ve gün sonu ledger'ı | Tenant DB | Accounting | Posting/reversal command'ları ve rapor projection event'leri |
| `SOT-CYL-001` | Cylinders | Tüp türü ve canonical movement sözlüğü | Tenant DB | Cylinders | Inventory ve Sales tanımlı tüp/movement kimliklerini kullanır |
| `SOT-CYL-002` | Cylinders | Cross-brand `CylinderExchangePolicy` | Tenant DB | Cylinders | Sales policy evaluation contract'ı üzerinden kullanır |
| `SOT-CYL-003` | Cylinders | Müşterideki tüp ve depozito ilişkisinin domain kaydı | Tenant DB | Cylinders | Sales ve Delivery command/event contract'ları |
| `SOT-INV-001` | Inventory | Stok lokasyonu ve Vehicle Stock lokasyon kimliği | Tenant DB | Inventory | Fleet araç kimliğini referanslar; Fleet stok yazamaz |
| `SOT-INV-002` | Inventory | Fiziksel tüp movement ledger | Tenant DB | Inventory | Movement command'ları ve movement event'leri |
| `SOT-INV-003` | Inventory | Ledger'dan üretilen stok projection'ı | Tenant DB | Inventory | Inventory query contract'ı; projection yeniden üretilebilir |
| `SOT-INV-004` | Inventory | Stok sayımı, adjustment ve fark iş akışı | Tenant DB | Inventory | Approval contract'ı ve audit event'leri |
| `SOT-SAL-001` | Sales | Sale aggregate, satış satırları, uygulanan fiyat snapshot'ı ve satış state | Tenant DB | Sales | Sale command/query/event contract'ları |
| `SOT-SAL-002` | Sales | Sale cancellation, reversal ve correction ilişkisi | Tenant DB | Sales | Accounting ve Inventory sahiplerine tanımlı reversal command'ları |
| `SOT-ORD-001` | Orders | Sipariş aggregate'ı, sipariş satırları ve sipariş state | Tenant DB | Orders | Dispatch/Delivery için order event ve query contract'ları |
| `SOT-ORD-002` | Orders | Dispatch kuyruğu ve atama isteği | Tenant DB | Orders | Delivery ve Fleet uygunluk contract'ları |
| `SOT-DEL-001` | Delivery | Teslimat state, teslimat kanıtı ve başarısızlık nedeni | Tenant DB | Delivery | Order state transition ve audit event'leri |
| `SOT-DEL-002` | Delivery | Kurye teslimat akışı ve teslimat reconciliation state | Tenant DB | Delivery | Inventory movement ve Accounting collection command'ları |
| `SOT-FLT-001` | Fleet | Araç kimliği, araç durumu ve kapasite bilgisi | Tenant DB | Fleet | Orders/Delivery araç query contract'ı |
| `SOT-FLT-002` | Fleet | Kurye ve araç atamasının filo uygunluk sonucu | Tenant DB | Fleet | Orders atama orchestration contract'ı |

## 4. Platform ve türetilmiş kayıtlar

| Kayıt | Sahip domain | Authoritative veri | Fiziksel kaynak | Tek yazma yetkisi | Diğer domainlerin erişimi |
|---|---|---|---|---|---|
| `SOT-SYN-001` | Sync | Offline command envelope, cihaz sırası, pending ve conflict state | Tenant DB ve istemci local store | Sync | Server doğrulama ve domain command dispatch contract'ı |
| `SOT-AUD-001` | Audit | Değiştirilemez audit kaydı ve correlation bilgisi | Control-plane audit: Master DB (yalnız eklenebilir, maskelenmiş, tenant iş payload'ı yok); diğer audit: ilgili güvenli audit store (TBP-202) | Audit pipeline | Salt-okunur audit query; business state olarak kullanılamaz |
| `SOT-OBS-001` | Observability | Trace, metric, health ve maskelenmiş structured log | Telemetry store | Observability pipeline | Operasyonel sorgu; business state olarak kullanılamaz |
| `SOT-REP-001` | Reporting | Yeniden üretilebilir dashboard ve rapor projection'ları | Tenant DB/report store | Reporting | Sahip domainlerin event/query contract'larından beslenir |
| `SOT-NOT-001` | Notifications | Notification delivery state ve kullanıcı aksiyon durumu | Tenant DB | Notifications | Sahip domain event'lerini tüketir; kaynak domain state'ini değiştiremez |

## 5. Kritik sahiplik ayrımları

### Identity ve Tenancy

- Identity, kullanıcının kim olduğunu ve hangi session'ın geçerli olduğunu belirler.
- Tenancy, tenantın varlığını, yaşam döngüsünü ve hangi fiziksel veritabanına bağlanılacağını belirler.
- Client tarafından gönderilen tenant bilgisi iki domain için de authoritative değildir.

### Billing ve Licensing

- Billing, ödeme gerçeğinin sahibidir.
- Licensing, doğrulanmış payment state sonucunda abonelik ve lisans state'ini değiştirir.
- Licensing provider webhook'unu doğrudan yorumlayamaz; Billing event/contract'ını kullanır.
- Billing lisans state'ini doğrudan değiştiremez.

### Fleet ve Inventory

- Fleet araç kimliği, kapasitesi ve operasyonel uygunluğunun sahibidir.
- Inventory, araçtaki fiziksel stok dahil bütün stok lokasyonları ve movement ledger'ın sahibidir.
- Fleet veya Delivery, Vehicle Stock miktarını doğrudan değiştiremez.

### Sales, Accounting ve Inventory

- Sales satış yaşam döngüsünün sahibidir.
- Accounting finansal ve cari ledger etkilerinin sahibidir.
- Inventory fiziksel stok hareketlerinin sahibidir.
- Atomik satış orchestration'ı bu sahiplerin kurallarını aynı transaction sınırında çağırabilir; hiçbir modül diğerinin tablosuna doğrudan yazamaz.

### Orders ve Delivery

- Orders sipariş ve dispatch talebinin sahibidir.
- Delivery fiziksel teslimat yaşam döngüsünün sahibidir.
- Teslimat sonucu Orders'a tanımlı event/command ile bildirilir; Delivery sipariş tablosunu doğrudan değiştiremez.

## 6. Domainler arası değişiklik protokolü

Bir domain başka bir domainin sahip olduğu veride değişiklik istediğinde aşağıdaki yol izlenir:

1. Çağıran domain, sahip domainin tanımlı command/application contract'ını kullanır.
2. Sahip domain tenant, identity, authorization, state ve idempotency doğrulamalarını yapar.
3. Değişiklik yalnızca sahip domain tarafından kendi store'una yazılır.
4. Sonuç, tanımlı response veya event contract'ıyla yayınlanır.
5. Tüketici domain kendi projection'ını güncelleyebilir; authoritative kaynağı kopyalayamaz.
6. Başarısızlık, retry veya conflict açık state olarak saklanır; silent last-write-wins uygulanmaz.

## 7. Doğrudan yazma yasağı

Aşağıdakiler mimari ihlaldir:

- Bir domainin başka domain tablosuna repository veya `DbContext` üzerinden yazması.
- Rapor, cache veya projection değerini authoritative business state olarak geri yazmak.
- Identity dışından session/revoke state değiştirmek.
- Tenancy dışından tenant DB metadata veya lifecycle state değiştirmek.
- Billing dışında payment state üretmek.
- Licensing dışında license/device state değiştirmek.
- Inventory dışında stok bakiyesi, movement veya Vehicle Stock değiştirmek.
- Accounting dışında cari, kasa, tahsilat veya gün sonu ledger kaydı üretmek.
- Pricing dışında aktif fiyat geçmişini değiştirmek.
- Customers dışında müşteri ve adres kaydını değiştirmek.
- Sales dışında sale state; Orders dışında order state; Delivery dışında delivery state değiştirmek.
- Fleet dışında araç uygunluk state'i değiştirmek.

İhlal review sırasında `REQUEST_CHANGES`; kritik sınır ihlalinde `BLOCKED`; sahiplik değişikliği talebinde `HUMAN_REQUIRED` üretir.

## 8. Review kontrol listesi

- Değiştirilen her veri için kayıt defterinde tek sahip var mı?
- Yazma işlemi sahip domain içinde mi gerçekleşiyor?
- Cross-domain erişim tanımlı command, query veya event contract'ı üzerinden mi?
- Kopya veri açıkça snapshot, cache veya projection olarak mı işaretli?
- Projection authoritative kaynaktan yeniden oluşturulabiliyor mu?
- Tenant sınırı ve server-side tenant çözümlemesi korunuyor mu?
- Transaction, idempotency, reversal/correction ve audit invariantları korunuyor mu?
- Ownership değişiyorsa Jira Change Request, ADR, migration/rollback ve Human Gate mevcut mu?
