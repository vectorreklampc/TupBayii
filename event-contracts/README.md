# Olay Sözleşmesi Kayıt Defteri (`TBP-26`)

Bu workspace domain/integration olaylarının kanonik adını, `SchemaRevision`
değerini, JSON Schema payload sözleşmesini ve geçerli örneğini birlikte tutar.
Kayıt defterinin giriş noktası [`registry.json`](registry.json) dosyasıdır.

## Başlangıç olayları

- `SaleCompleted`
- `DeliveryCompleted`
- `PaymentReceived`
- `CylinderTransferred`
- `CollectionPosted`

Olay adı revision eki taşımaz. `SaleCompleted.v1` yasaktır; revision yalnız
registry ve schema içindeki `SchemaRevision` metadata'sıyla temsil edilir.
Başlangıç payload'ları yalnız normatif ortak metadata'yı içerir: message,
correlation ve causation kimlikleri; kaynak kimliği ve version'ı; UTC oluşma
zamanı. Jira ile tanımlanmamış iş alanı alanları bu temel sözleşmede üretilmez.

## Doğrulama

```powershell
cd event-contracts
npm ci
npm run validate
npm test
```

`npm run validate` registry yapısını, revision sırasını, schema metadata'sını
ve her örnek payload'ı doğrular. `npm test` beş olay için geçerli ve geçersiz
payload'ları; ayrıca revision uyumluluk kuralını çalıştırır.

## Şema evrimi

Yayımlanmış bir `<olay adı, SchemaRevision>` çifti değiştirilemez ve
silinemez. Payload şeması evrilecekse eski kayıt korunur, aynı olay adıyla bir
sonraki ardışık `SchemaRevision` eklenir. PR kalite kapısı base branch'teki
registry ile güncel registry'yi karşılaştırır ve aynı revision altındaki her
değişikliği reddeder. Açık migration/approval yolu tanımlanacaksa bu korumayı
sessizce kapatamaz; ayrı Jira kararı ve doğrulanabilir CI kanıtı gerektirir.
