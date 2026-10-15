# Inventory referans dilimi

Bu modül `TBP-234` kapsamında sonraki ajan uygulamalarına örnek olacak en küçük
stok hareketi dikey dilimidir. Public HTTP endpoint yayımlamaz; Jira'da rota ve
HTTP şeması kararı verilmediği için `Sunum/StokHareketiApi` modül içi API
sınırıdır.

Akış:

```text
Sozlesmeler -> Sunum -> Uygulama -> Domain
                         |
                         v
                      Altyapi
```

Kalıcılık adapteri tenant'a ait `DbConnection` alır. Idempotency claim, kaynak
projection azaltma, immutable movement kaydı ve hedef projection artırma tek
`Serializable` transaction içinde yürür. PostgreSQL referans şeması
`Altyapi/Sql/StokHareketiSemasi.sql` dosyasındadır; production migration
orkestrasyonu bu ticket'ın kapsamında değildir.

Kanıtlanan sınırlar:

- `INV-STK-001`: projection yalnız movement ile aynı transaction'da değişir.
- `INV-STK-002`: `FULL` ve `EMPTY` ayrı değerlerdir.
- `INV-STK-003`: depo, araç ve müşteri ayrı fiziksel lokasyonlardır.
- `INV-STK-004`: tamamlanmış movement update/delete tetikleyicisiyle reddedilir.
- `INV-STK-005`: idempotency, yetersiz stok ve projection etkileri store
  transaction'ında korunur.
- `INV-AUD-001`: başarı, tekrar ve ret sonuçları trace/correlation ile audit
  edilir.

Bu seed ürün kataloğu, tüp sözlüğü, satış/POS orkestrasyonu, HTTP route,
migration runner veya yeni business rule tanımlamaz.
