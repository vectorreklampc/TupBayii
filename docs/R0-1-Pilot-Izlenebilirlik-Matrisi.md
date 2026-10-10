# R0.1 Pilot İzlenebilirlik Matrisi (`TBP-248`)

**Source of Truth canlı Jira'dır.** Bu belge ve [`r0-1-pilot-izlenebilirlik.json`](r0-1-pilot-izlenebilirlik.json) yalnız izleme aracıdır; gereksinim, kabul kriteri veya iş davranışı kaynağı değildir. Çelişkide canlı Jira esas alınır.

## JSON'un anlamı

12 satır: {Windows, Android} × {Login, Müşteri, Ürün/Fiyat, Satış, Stok, Kasa Özeti}. Her satır:

- `pilotJira` / `platformJira` / `mainPlanJira`: eşleşen Jira anahtarları. Login `TBP-249` (ana plan `TBP-60,61,62,65,74-83`); Müşteri ve Ürün/Fiyat `TBP-250` (`TBP-85-104`); Stok `TBP-251` (`TBP-106-116`); Satış `TBP-252` (`TBP-100,118-128`); Kasa `TBP-253` (`TBP-142,143,146,147,149-151`); Windows `TBP-255`; Android `TBP-256`.
- `requirements`, `apiBehaviors`: gereksinim metni yerelde kopyalanmaz; API davranışları canlı Jira okunana kadar boştur.
- `openapi.operationIds` / `schemas`: yalnız `contracts/openapi.json`'da gerçekten bulunan değerler. Contract'ta `paths` boş ve `securitySchemes` yok; bu yüzden hepsi boştur. Önerilmiş/uydurma operationId yazılmaz.
- `figma`: dosya `unveOhyF2AlrBYA34ez6x6` ve node kanıtı (`VERIFIED` / `CANDIDATE`).
- `states`: `loading`, `empty`, `validation`, `permission`, `networkError`, `success`; her biri `UNVERIFIED`/`VERIFIED`.
- `testOracle`, `readiness` (`BLOCKED`/`READY`), `humanApproval`, `blockers`.

## Kanıt durumu

| Durum | Node'lar |
|---|---|
| VERIFIED (Windows) | POS ana `4:2`, ödeme/tamamlama `7:609`, yetersiz stok `8:169`, kredi limiti `8:211`, stok ana `7:390`, sayım farkı `8:87` |
| CANDIDATE (bu turda doğrulanamadı) | müşteri ana `7:2`, yeni `8:2`, detay `70:2`, mobil müşteri `34:2`, fiyat/depozito `41:246`, cari `7:187` |
| Kanıtsız | Login, Kasa, mobil akışlar ve tüm required state node'ları (Figma View kotası doldu) |

VERIFIED ekran node'u state kanıtı değildir: 6 state'in hepsi `UNVERIFIED`. İnsan onayı yoktur (`humanApproval: false`), bu nedenle **12 satırın tamamı `BLOCKED`**.

## Kapsam dışı ve release yolu

- R0.1: Windows + Android (Android yalnız online).
- R0.2: iOS.
- R0.3: offline sync/conflict, filo/kurye.
- R1.0: e-Fatura, abonelik otomasyonu, 100+ tenant, fabrika genelleştirme.

## UI kapısı

Bir satır UI implementasyonuna ancak `READY` olunca geçer: OpenAPI'de gerçek operationId ve schema, tüm Figma node'ları ve 6 state `VERIFIED`, `humanApproval: true`, blocker yok. Validator bunu zorlar; eksikleri gizlemez, yalnız sahte `READY`'yi reddeder.

## Doğrulama

```powershell
cd contracts
npm run validate   # OpenAPI kuralları + pilot matris
npm test           # validator testleri dahil
```

Doğrulayıcı: `contracts/scripts/pilot-matris.mjs` (testi `pilot-matris.test.mjs`). Kontroller: tam 12 tekil kombinasyon, 6 state, Jira anahtarları ve eşlemeleri, release yolu, kapsam dışı, BLOCKED ⇒ blocker, kayıtlı operationId/schema'nın OpenAPI'de varlığı, READY koşulları.
