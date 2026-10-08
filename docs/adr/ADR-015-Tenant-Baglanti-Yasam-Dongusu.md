# ADR-015: Tenant Bağlantı Yaşam Döngüsü

## Durum

Kabul Edildi

## Tarih

2026-10-01

## Jira Kaynağı

- `TBP-7`
- Normatif kaynaklar: `INV-TEN-003`, `INV-TEN-004`, `SOT-TEN-001`
- Ayrıntı işleri: `TBP-62`, `TBP-63`, `TBP-64`

## Bağlam

Database-per-Tenant modelinde sınırsız veya client seçimine bağlı connection yönetimi bellek, secret ve izolasyon riski doğurur.

## Karar

Tenant database metadata Tenancy'nin sahip olduğu Master DB kaydından server-side çözülür. Connection/data source yalnız doğrulanmış tenant context sonrasında alınır ve bounded bir yaşam döngüsüyle yönetilir. Request kodu connection string seçemez.

Uygulama trafiğinde PgBouncer `transaction` pooling modu kullanılır. Bir server
connection yalnız transaction süresince client'a atanır ve transaction sonunda
havuza döner. Migration, veritabanı oluşturma ve PgBouncer yönetimi session veya
yönetim ayrıcalığı gerektirebildiği için PgBouncer'ı atlayarak doğrudan PostgreSQL
bağlantısından çalışır.

Npgsql'in kendi havuzu PgBouncer önünde açık tutulabilir; bu durumda transaction
pooling ile anlamsız ve uyumsuz olan connection reset komutlarını önlemek için
`No Reset On Close=true` zorunludur. PoC, `Pooling=true`,
`No Reset On Close=true` ve `Multiplexing=false` ile çalıştırılmıştır.

Protocol-level prepared statement kullanımı yalnız PgBouncer'da
`max_prepared_statements` sıfırdan büyükken desteklenir. Başlangıç üretim değeri
`100` seçilmiştir. Npgsql `Max Auto Prepare` değeri iş yükü ölçülmeden üretim için
sabitlenmez veya etkinleştirilmez. PoC explicit protocol prepare davranışını
farklı PostgreSQL backend connection'ları arasında doğrular.

## Değiştirilemez Sınırlar

- Secret kaynak koda, loga veya client'a çıkamaz.
- Yanlış tenant connection'ı fail-closed reddedilir.
- Cache boyutu, eviction ve disposal davranışı ölçülebilir olmalıdır.
- Uygulama transaction sınırı dışında session durumuna güvenemez.
- Migration ve yönetim bağlantı dizesi uygulama bağlantı dizesinden ayrı tutulur.

## Yasaklı ve Uyumsuz Özellikler

Transaction pooling hattında aşağıdakiler kullanılmaz:

- Transaction dışına taşan `SET`/`RESET` durumu ve session GUC'ları.
- `LISTEN`, session-level advisory lock, `WITH HOLD` cursor ve `LOAD`.
- `PRESERVE ROWS` veya `DELETE ROWS` geçici tablolar.
- SQL-level `PREPARE`/`DEALLOCATE`. Protocol-level prepared statement yalnız
  `max_prepared_statements > 0` ile kullanılabilir.
- `server_reset_query` ile session temizliği varsayımı. PgBouncer bu sorguyu
  transaction pooling modunda varsayılan olarak çalıştırmaz.
- PgBouncer'ın takip etmediği startup parametreleri. `search_path` gibi durumlar
  role/database düzeyinde veya transaction içinde `SET LOCAL` ile yönetilir.
- Migration, `CREATE DATABASE` ve PgBouncer admin komutları.

`Multiplexing` bu PoC matrisinin dışında bırakılmış ve kapalı tutulmuştur; ayrı
kanıt olmadan etkinleştirilemez.

## Değerlendirilen Alternatifler

- Her istekte sınırsız yeni pool: kaynak tüketimini kontrolsüz büyütür.
- Sınırsız kalıcı tenant cache'i: tenant sayısıyla birlikte bellek ve connection riskini büyütür.

## Sonuçlar

Kesin cache parametreleri `TBP-63` ve 100+ tenant PoC ölçümüyle belirlenir.

PgBouncer `default_pool_size` ve Npgsql havuz boyutları ortam başına concurrency,
bekleme süresi ve PostgreSQL connection bütçesi ölçülerek belirlenir. PoC'nin iki
server connection'lık havuzu yalnız contention davranışını görünür kılmak içindir
ve üretim kapasite önerisi değildir.

## Doğrulama

`PgBouncerUyumlulukTests` Docker üzerinde aşağıdakileri tekrar üretir:

- transaction rollback sonucunun veritabanında kalmadığını,
- `transaction` modunu ve prepared statement'ın farklı backend'lerde çalıştığını,
- session durumunun aynı backend'i alan sonraki isteğe sızdığını ve bu nedenle
  session özelliklerinin yasaklanması gerektiğini,
- koparılan backend connection sonrasında yeni isteğin toparlandığını,
- iki server connection üzerinde sekiz eşzamanlı transaction'ın tamamlandığını,
- migration'ın doğrudan hatta uygulanıp modelin PgBouncer üzerinden okunduğunu,
- command timeout ve cancellation sonrasında server sorgusunun bittiğini ve
  havuzun kullanılabilir kaldığını.

Kaynaklar:

- [PgBouncer pooling modu ve özellik matrisi](https://www.pgbouncer.org/features.html)
- [PgBouncer `max_prepared_statements` ve reset davranışı](https://www.pgbouncer.org/config)
- [Npgsql PgBouncer uyumluluk notları](https://www.npgsql.org/doc/compatibility.html#pgbouncer)
- [Npgsql prepared statement davranışı](https://www.npgsql.org/doc/prepare.html)
- [EF Core migration transaction davranışı](https://learn.microsoft.com/ef/core/managing-schemas/migrations/managing)
