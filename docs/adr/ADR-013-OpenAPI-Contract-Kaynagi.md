# ADR-013: OpenAPI Contract Kaynağı

## Durum

Önerildi

## Tarih

2026-10-01

## Jira Kaynağı

- `TBP-7`
- Ayrıntı işleri: `TBP-21`, `TBP-22`

## Bağlam

API implementasyonu, client ve mock birbirinden bağımsız tanımlanırsa contract drift oluşur.

## Karar

HTTP API yüzeyi için tek, version-controlled OpenAPI belgesi contract kaynağı olacaktır. Server, client ve mock aynı contract'a karşı doğrulanacaktır. OpenAPI business gereksiniminin değil, Jira ile onaylanmış API temsilinin kaynağıdır.

`TBP-21` teknik seçimi: contract-first OpenAPI 3.1 JSON kaynağı `contracts/openapi.json` içinde tutulur. Yapısal ve referans doğrulaması sabitlenmiş Swagger Parser ile, proje wire kuralları `contracts/scripts/dogrula.mjs` ile yürütülür. JSON seçimi Node.js'in yerleşik ayrıştırıcısıyla tek kaynak üzerinde deterministik fixture testlerine izin verir; çalışan server'dan üretilen belge authoritative değildir. Henüz onaylı endpoint ve Identity credential taşıma kararı olmadığından `paths` ile `securitySchemes` boş başlar; bu kararlar ilgili Jira kaydına göre eklenir. Mock/client ve CI kullanımı ayrı işlerde doğrulanacaktır.

## Değiştirilemez Sınırlar

- Tenant, authorization ve domain invariantları yalnız schema doğrulamasına bırakılamaz.
- Breaking change, compatibility ve migration kararı olmadan yayımlanamaz.
- Contract üretim yönü ve araç seçimi `TBP-21` ile belirlenir.

## Değerlendirilen Alternatifler

- Ayrı el yazımı client/server modelleri: drift üretir.
- Çalışan server'ı tek başına contract saymak: mock ve review kanıtını zayıflatır.

## Sonuçlar

Contract lint `TBP-21` ile uygulanır. Compatibility diff ve mock doğrulama kapıları sırasıyla `TBP-25` ve `TBP-22` kapsamında tamamlanacaktır. ADR'nin kabul durumu bu işlerin kanıtı gelene dek `Önerildi` kalır.

## Doğrulama

`TBP-21` ve `TBP-22` kabul kriterleri tamamlanmadan kabul edilmez.
