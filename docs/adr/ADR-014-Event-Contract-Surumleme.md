# ADR-014: Event Contract Sürümleme

## Durum

Kabul Edildi

## Tarih

2026-10-01

## Jira Kaynağı

- `TBP-7`
- Ayrıntı işi: `TBP-26`

## Bağlam

Üretici ve tüketicilerin farklı hızlarda değişmesi, event schema değişikliklerini uyumluluk riski haline getirir.

## Karar

Yayımlanan event contract'ları açık kimlik ve sürüm taşır; schema değişiklikleri kayıtlı compatibility kuralına tabidir. Tüketici, bilinmeyen veya uyumsuz sürümü sessizce işleyemez.

- Olay adı revision eki taşımaz; örneğin `SaleCompleted.v1` yasaktır.
- Revision pozitif ve ardışık `SchemaRevision` metadata'sıyla tutulur.
- Yayımlanmış `<olay adı, SchemaRevision>` çifti değiştirilemez veya silinemez.
- Payload değişikliği eski revision korunarak yeni `SchemaRevision` girdisiyle yayımlanır.
- Aynı revision altındaki schema değişikliği CI compatibility kontrolünde reddedilir.
- Başlangıç payload sözleşmesi yalnız ortak message/correlation/causation, kaynak kimliği/version'ı ve UTC oluşma zamanı metadata'sını tanımlar. Olaylara özel business alanları ilgili Jira sözleşmesi olmadan eklenmez.

## Değiştirilemez Sınırlar

- Duplicate ve out-of-order event ikinci veya geri alıcı etki oluşturamaz.
- Event başka domainin authoritative state'ini sahiplenemez.
- Correlation, causation ve message kimliği korunur.

## Değerlendirilen Alternatifler

- Sürümsüz event: değişiklik etkisini görünmez yapar.
- Her değişiklikte yeni topic: yaşam döngüsü ve operasyon maliyetini kontrolsüz büyütür.

## Sonuçlar

Kanonik registry `event-contracts/registry.json` altında tutulur. JSON Schema doğrulaması ve base branch karşılaştırması CI kalite kapısının parçasıdır. Yeni revision tüketici migration'ını otomatik çözmez; tüketici bilinmeyen revision'ı sessizce işleyemez.

## Doğrulama

`event-contracts` doğrulama testleri her başlangıç olayı için geçerli/geçersiz payload'ı ve aynı revision altındaki değişiklik reddini kanıtlar.
