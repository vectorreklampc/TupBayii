# HTTP API contract standardı (`TBP-21`)

Kanonik kaynak [`openapi.json`](openapi.json) dosyasıdır. Bu aşamada ürün endpoint'i yoktur; boş `paths`, onaylanmamış bir iş davranışı üretmemek içindir. Ancak doğrulama boş işlem kümesine güvenmez: gerçek pozitif/negatif operasyon fixture'ları çalışır ve şema ile kurallar bozulursa komut başarısız olur.

```powershell
cd contracts
npm ci
npm run validate
npm test
npm run mock
```

`npm run mock`, aynı `openapi.json` kaynağından `http://localhost:4010` adresinde deterministik örnek yanıtlar üretir. Böylece Flutter ve Admin Web, backend implementasyonunu beklemeden onaylı contract operasyonlarını kullanabilir. Tarayıcı istemcileri için CORS açıktır; `MOCK_HOST`, `MOCK_PORT` ve test amaçlı `MOCK_CONTRACT` ortam değişkenleriyle dinleme adresi veya kaynak değiştirilebilir. Contract boşken sunucu yine başlar ve eşleşmeyen istekleri `404 MOCK_OPERATION_NOT_FOUND` ile reddeder; Jira ile onaylanmamış endpoint üretmez.

OpenAPI 3.1 belgesi önce Swagger Parser ile yapısal ve `$ref` yönünden doğrulanır, ardından proje kuralları uygulanır. `npm test` hem contract kabul/ret senaryolarını hem mock HTTP davranışını sınar. Yeni operasyon aynı kaynağa eklenir; server, client veya mock modelleri elle ikinci bir contract olarak tutulmaz. Generated client (`TBP-23/24`) ve breaking-change CI (`TBP-25`) bu işin dışında; CI bağlama `TBP-19` kapsamındadır.

## Wire kuralları

- Domain adları Türkçe anlamlı ASCII, JSON property'leri `camelCase`, route segmentleri `kebab-case`, enum ve kararlı hata kodları `UPPER_SNAKE_CASE` olur. URI kaynak adı çoğuldur; teknik/protokol terimleri özgün yazılır. `operationId` kararlı ve benzersiz `camelCase` olur. Yayınlanmış isim yalnız kozmetik nedenle değiştirilmez.
- Her operasyon gerçek başarı response'u, `400`, `401`, `403` ve `500` hata response'larını belgeler; bütün hata response'ları ortak `Hata` şemasına ve `TraceId` header'ına başvurur. Business ret, `404`, `409`, `422` gibi ek durumlar ilgili Jira davranışıyla tanımlanır. `401` kimlik yok/geçersiz, `403` doğrulanmış fakat yetkisiz; kaynak varlığını sızdırma riski varsa tutarlı `404` politikası uygulanır. `500` iç ayrıntı veya stack trace sızdırmaz. Hata `code` kararlı, `message` güvenli insan metni, `traceId` korelasyon kimliği, `details` ise yalnız güvenli alan/kod çiftleridir.
- Her response `TraceId` header'ı taşır; hata gövdesindeki `traceId` bununla eşleşir. TraceId idempotency anahtarı veya identity yerine geçmez. Gizli veya kişisel veri TraceId, hata, audit ya da log içinde taşınmaz.
- Her operasyon `security` alanıyla kimlik gereksinimini açıkça gösterir. Anonim erişim ancak `security: []` ve gerekçeli `x-anonymous-reason` ile ilan edilir. Gerçek credential taşıma şeması Identity kararına göre `components.securitySchemes` altında tanımlanır; TBP-21 yeni bir token/cookie politikası icat etmez. OpenAPI security beyanı backend'deki tenant, lifecycle, role, branch/warehouse/record scope ve domain guard kontrolünün yerine geçmez. Client `TenantId`/role beyanı authoritative olamaz.
- Her GET, koleksiyon olup olmadığını `x-collection` boolean alanıyla belirtir. Listeleme işlemleri `page` (1 tabanlı) ve `pageSize` query parametrelerini kullanır; response `{ data: [...], pagination: { page, pageSize, totalItems, totalPages } }` biçimindedir. `pageSize` üst sınırı ve sıralama Jira'daki kaynak davranışına göre belirlenir; keyfi global sayı dayatılmaz. Hatalı sınırlar `400` ve ortak hata gövdesi üretir. Veri ve toplam sayılar aynı yetki/tenant kapsamından hesaplanır.
- Finans, stok, ödeme, provisioning, migration, offline sync ve tekrar edilebilir kritik yazma işlemleri `Idempotency-Key` zorunlu header'ı ile `x-idempotency-required: true` beyan eder. Aynı key + payload aynı mantıksal sonucu döndürür; farklı payload `409` + `IDEMPOTENCY_CONFLICT`, işlem sürüyorsa ikinci etki olmadan `409` ve güvenli yeniden deneme davranışı verir. Anahtar server-side tenant/operation kapsamında atomik unique kayıtla tutulur, saklama süresi en uzun replay penceresinden kısa olamaz. Commit sonucu belirsizse kayıtlı sonuç araştırılır. Diğer mutating operasyonlar da `x-idempotency-required: false` ve retry güvenliği açıklaması taşır; sessiz güvenli-retry vaadi verilmez.
- Body/query/path girişleri biçim, boyut, aralık, enum ve semantik olarak API sınırında doğrulanır. Bozuk HTTP/şema girdisi `400`, semantik iş reddi ilgili kararlı kod/statü ile belgelenir. `details` yalnız izinli alan adları ve kodları içerir; gelen ham değer veya sırlar yansıtılmaz. Schema validation authorization/domain invariantlarının yerine geçmez.

Her yeni operasyonun Jira kabul kriteri, başarı/ret örnekleri, security scope'u, concurrency ve idempotency semantiği contract review'unda eşlenir. Değişen public contract compatibility ve migration kararı olmadan yayımlanmaz.
