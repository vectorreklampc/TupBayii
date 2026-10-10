# Master DB Şema Sözleşmesi

**Jira:** `TBP-58` (karar kaydı: yorum 10867)
**Durum:** Kabul edildi — Codex ACCEPTED (2026-10-08); gerçek `MasterDbContext` kanıtı TBP-59'a aittir
**Normatif dayanaklar:** ADR-001, ADR-002, ADR-003, ADR-007, ADR-010, ADR-015, ADR-016,
`INV-TEN-001`–`004`, `INV-AUD-001`–`003`, `INV-PAY-001`–`002`,
`TupBayiProje_Source_of_Truth_ve_Domain_Ownership.md`

Bu belge Master DB'ye girebilecek kalıcı entity'lerin kapalı listesini, her birinin sahibini ve
SOT kaydını, cross-DB sınırını ve doğrulama yöntemini tanımlar. Yeni bir business rule veya
ownership kararı getirmez; yalnızca mevcut normatif kayıtları ve TBP-58 insan kararlarını uygular.

## 1. Kapalı whitelist

Bu listede olmayan hiçbir mapped entity Master DB'ye giremez. Liste değişikliği, ilgili SOT
kaydı ve Jira kararı olmadan yapılamaz. Entity bölme/birleştirme de liste değişikliğidir.
Tüm tablolar PostgreSQL `master` schema'sındadır; her entity tam olarak bir tabloya eşlenir.

| Entity | Tablo | Sahip domain | SOT | Tutulan veri | Dayanak |
|---|---|---|---|---|---|
| `Kullanici` | `kullanici` | Identity | `SOT-IDN-001` | Kullanıcı kimliği, credential referansı | ADR-002, K1 |
| `KullaniciOturumu` | `kullanici_oturumu` | Identity | `SOT-IDN-001` | Session ve revoke state | ADR-002, K1 |
| `Tenant` | `tenant` | Tenancy | `SOT-TEN-001` | Tenant kimliği ve yaşam döngüsü | ADR-003 |
| `TenantVeritabani` | `tenant_veritabani` | Tenancy | `SOT-TEN-001` | DB bağlantı metadata'sı ve secret referansı (secret değil) | ADR-015, TBP-60 |
| `TenantMigrationSurumu` | `tenant_migration_surumu` | Tenancy | `SOT-TEN-001` | Tenant DB migration version | ADR-016, TBP-66 |
| `TenantProvisioningIsi` | `tenant_provisioning_isi` | Tenancy | `SOT-PRV-001` | Provisioning job state | ADR-016, TBP-61 |
| `TenantMigrationIsi` | `tenant_migration_isi` | Tenancy | `SOT-PRV-001` | Migration job state | ADR-016, TBP-67/68 |
| `Abonelik` | `abonelik` | Licensing | `SOT-LIC-001` | Subscription, trial, grace, suspension | SOT §2 |
| `Lisans` | `lisans` | Licensing | `SOT-LIC-001` | License state | SOT §2, ADR-010 |
| `Cihaz` | `cihaz` | Licensing | `SOT-DEV-001` | Cihaz aktivasyonu, limit, revoke | SOT §2, ADR-010 |
| `OdemeNiyeti` | `odeme_niyeti` | Billing | `SOT-BIL-001` | Payment intent ve payment state | ADR-007 |
| `OdemeDenemesi` | `odeme_denemesi` | Billing | `SOT-BIL-001` | Payment attempt | SOT §2 |
| `OdemeSaglayiciOlayi` | `odeme_saglayici_olayi` | Billing | `SOT-BIL-001` | İmzası doğrulanmış provider event'i; provider event kimliğiyle dedup | INV-PAY-002 |
| `DenetimKaydi` | `denetim_kaydi` | Audit | `SOT-AUD-001` | Yalnız control-plane audit | K3, INV-AUD-001–003 |

`DenetimKaydi` kısıtları: tek yazma yetkisi Audit pipeline'dadır (`SOT-AUD-001`); kapsam Identity, Tenancy, provisioning, migration, Licensing, Billing
ve yönetici işlemleridir; kayıt yalnız eklenebilir (`INV-AUD-002`), maskelenir (`INV-AUD-003`)
ve tenant iş payload'ı içermez. Tenant iş işlemlerinin audit'i Master'a yazılmaz.

## 2. Whitelist dışında kalanlar

| Konu | Durum | Gerekçe |
|---|---|---|
| Backup/restore state | Kapalı; TBP-202 SOT kaydı gerekir | SOT'ta kayıt yok (K2) |
| Tenant iş audit'i, ayrı güvenli audit store | TBP-202 | K3 |
| Genel outbox/inbox tabloları | TBP-59; SOT kaydı gerekir | Sahip tanımsız |
| Kullanıcı–tenant üyelik eşlemesi | TBP-62; SOT kaydı gerekir | Sahip tanımsız |
| SOT §3 tenant operasyon kayıtları, `SOT-SYN/REP/NOT` | Kalıcı yasak | INV-TEN-002, ADR-002 |
| Müşteri, cari, satış, sipariş, tüp/stok hareketi, kasa, teslimat, tedarikçi | Kalıcı yasak | TBP-58 açıklaması |

EF Core'un `master` schema'sında tuttuğu migration geçmişi tabloları (`__EFMigrationsHistory`,
Audit için `__AuditEFMigrationsHistory`) mapped entity değildir ve `TenantMigrationSurumu` ile
karıştırılmaz.

## 3. ID, FK ve cross-DB sınırı

1. Master DB ile tenant DB arasında FK, join veya distributed transaction yoktur
   (ADR-002, Transaction standardı).
2. Tenant DB kayıtları Master'daki kimliklere yalnız ID değeriyle referans verir (SOT §1.6).
3. Master, tenant iş kayıtlarının ID'sini veya kopyasını tutmaz (ADR-002).
4. Tenant context client değerinden değil, doğrulanmış kimlik ve `Tenant` /
   `TenantVeritabani` kaydından server-side çözülür (INV-TEN-003, ADR-003, ADR-015).
5. Master içindeki domainler birbirinin tablosuna yazmaz; geçişler contract/event ile olur
   (SOT §1.2, §5).
6. Cross-DB yan etkiler outbox/inbox ve idempotency ile yürür.

TBP-59'a bırakılanlar: ID biçimi, Master içi domainler arası FK constraint kararı, kolon
ayrıntıları, gerçek Master entity tipleri ve bunların namespace/assembly
yerleşimi ve owned değer nesnelerine ilişkin nihai karar.

## 4. Doğrulama

1. Whitelist makine tarafından okunabilir veri olarak tutulur; her satır SOT kimliği taşır.
2. Test, EF Core runtime modelini (`Model.GetEntityTypes()`, owned ve join tipleri dahil)
   whitelist ile karşılaştırır. Kaynak kod regex taraması kanıt sayılmaz.
3. Oracle: bilinmeyen entity FAIL; yasak örnek (`Musteri`, `Tedarikci`) FAIL; erken eklenmiş
   backup entity FAIL; owned tip FAIL; many-to-many join tipi FAIL; whitelist entity'sinin
   farklı tabloya veya `master` dışı schema'ya eşlenmesi FAIL; entity splitting (`SplitToTable`)
   ile ikinci tabloya bölünmesi FAIL; whitelist kısa adını taşıyan ama beklenen tip olmayan tip
   (farklı namespace veya aynı ad ve namespace ile farklı assembly) FAIL; yalnız beklenen
   whitelist tipleri PASS.
   - Tip kimliği: çağıran, beklenen Master entity CLR tiplerini (`Type`) oracle'a açıkça verir.
     Her beklenen tip kısa adıyla tek bir whitelist kaydına bağlanır; whitelist dışı ada veya
     aynı kayda ikinci tip verilmesi çağıran hatasıdır ve whitelist'i genişletemez. Modeldeki
     her entity'nin `ClrType` değeri beklenen tiple referans eşitliğiyle karşılaştırılır; tablo
     adı whitelist kaydından doğrulanır. Böylece namespace ve assembly ayrıca varsayılmaz;
     tek bir ortak namespace gerekmez.
   - Fixture'da beklenen tipler test-only `WhitelistBaglami.BeklenenTipler` listesidir. Gerçek
     Master entity tipleri ve bunların namespace/assembly yerleşimi TBP-59'da `MasterDbContext`
     ile belirlenir; gerçek testte bu tipler açıkça verilir. Bu sözleşme üretim assembly
     yerleşimi veya ownership kararı getirmez.
   - Tablo eşlemesi: oracle yalnız `GetTableName()` değil, entity'nin tüm tablo eşlemelerini
     (`GetTableMappings()`) okur. Eşlemeler tam olarak tek bir `master.<whitelist tablosu>` olmalıdır;
     farklı schema, eksik tablo veya entity splitting ile eklenen ek tablo FAIL olur.
   - Owned tipler: owned değer nesnelerine genel izin verilmez. Oracle her owned tipi FAIL eder
     ve kapalı-liste davranışı korunur. Owned değer nesneleri için nihai karar TBP-59'da verilir.
4. Master EF modelinde tenant iş entity'si bulunamaz; bu şart 2. ve 3. maddedeki runtime model
   testiyle doğrulanır. Proje veya assembly bağımlılık kuralı TBP-58 kapsamında tanımlanmaz.
5. Oracle ve whitelist verisi `backend/tests/Mimari/TupBayiProje.MimariTests/MasterVeritabaniBeyazListesi.cs`
   içindedir; fixture testleri `MasterVeritabaniBeyazListesiTests.cs`, fixture tipleri
   `MasterFixture/` altındadır.

### Kanıt sınırı

TBP-58'de kullanılan test-only EF `DbContext` fixture'ı yalnızca whitelist ve negatif oracle
mantığının doğruluğunu kanıtlar. Bu fixture gerçek `MasterDbContext` mapped modelinin testi
yerine geçmez. TBP-59, aynı whitelist testini gerçek `MasterDbContext.Model` üzerinde PASS
etmeden Master sınırının uygulandığı kabul edilemez. Mevcut ad-kökü denylist'i ve `1acbbb1`
commit'i whitelist kanıtı değildir.
