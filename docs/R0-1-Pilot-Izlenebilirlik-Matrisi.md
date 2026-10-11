# R0.1 Pilot İzlenebilirlik Matrisi (`TBP-248`)

**Source of Truth canlı Jira'dır.** Bu belge ve [`r0-1-pilot-izlenebilirlik.json`](r0-1-pilot-izlenebilirlik.json) yalnız izleme aracıdır; gereksinim, kabul kriteri veya iş davranışı kaynağı değildir. Çelişkide canlı Jira esas alınır.

## JSON'un anlamı

12 satır: {Windows, Android} × {Login, Müşteri, Ürün/Fiyat, Satış, Stok, Kasa Özeti}. Her satır:

- `pilotJira` / `platformJira` / `mainPlanJira`: eşleşen Jira anahtarları. Login `TBP-249` (ana plan `TBP-60,61,62,65,74-83`); Müşteri ve Ürün/Fiyat `TBP-250` (`TBP-85-104`); Stok `TBP-251` (`TBP-106-116`); Satış `TBP-252` (`TBP-100,118-128`); Kasa `TBP-253` (`TBP-142,143,146,147,149-151`); Windows `TBP-255`; Android `TBP-256`.
- `requirements`: Jira anahtarları; gereksinim metni yerelde kopyalanmaz.
- `apiBehaviors`: satırın davranış id'leri. Kök `apiBehaviors` kataloğu her davranışı `sourceJira`, `operationId` ve `schemas` ile `contracts/openapi.json`'a bağlar.
- `openapi.operationIds` / `schemas`: satırın `apiBehaviors` kayıtlarının operationId ve schema birleşimi; hepsi `contracts/openapi.json`'da gerçekten bulunur. Contract `/api/v1` altında operasyonlar ve `bearerAuth` security scheme'i tanımlar: yalnız `login` kimliksizdir, diğerleri bearer ister; stok/satış/kasa yazmaları `Idempotency-Key` header'ı ve 409 `IDEMPOTENCY_CONFLICT`/`IDEMPOTENCY_IN_PROGRESS` taşır. Önerilmiş/uydurma operationId yazılmaz.
- `figma`: dosya `unveOhyF2AlrBYA34ez6x6` ve node kanıtı (`VERIFIED` / `CANDIDATE`).
- `states`: `loading`, `empty`, `validation`, `permission`, `networkError`, `success`; her biri `UNVERIFIED`/`CANDIDATE`/`VERIFIED` ve kanıt `figmaNode`'u.
- `testOracle`: `{status, ids}`; `VERIFIED` ise `ids` kök `testOracles` kataloğunda bu satırı kapsayan tek kaydı gösterir.
- `readiness` (`BLOCKED`/`READY`), `humanApproval`, `blockers`.

Kök `testOracles` kataloğu her test oracle Jira'sını `pilotJira` (sorumlu kaynak), `executionJira` (`TBP-258`) ve kapsadığı satır id'leriyle (`<platform>-<flow>`) tanımlar.

## Test oracle eşlemesi

| Oracle | Satırlar | `pilotJira` | Koşu kanıtı |
|---|---|---|---|
| `TBP-260` | windows/android-login | `TBP-249` | `TBP-258` |
| `TBP-261` | windows/android-musteri, windows/android-urunFiyat | `TBP-250` | `TBP-258` |
| `TBP-262` | windows/android-stok | `TBP-251` | `TBP-258` |
| `TBP-263` | windows/android-satis | `TBP-252` | `TBP-258` |
| `TBP-264` | windows/android-kasaOzeti | `TBP-253` | `TBP-258` |

`testOracle: VERIFIED` yalnız gözden geçirilmiş oracle **tanımının** Jira'da var olduğunu söyler; testlerin koşup geçtiği anlamına gelmez. Koşu kanıtı `TBP-258`'e aittir.

## Kanıt durumu

Kayıtlı tüm Figma node'ları ve state'ler `VERIFIED`; kanıtlar tarayıcıda Figma dosyası üzerinden doğrulandı. Figma MCP kotası tarayıcıyla doğrulamayı engellemedi, AI kredisi harcanmadı ve yeni tasarım üretilmedi; mevcut tasarımlar yeniden kullanıldı.

| Satır | Windows node'ları | Android node'ları |
|---|---|---|
| Login | login `47:74` | mobil login `47:150` |
| Müşteri | müşteri ana `7:2`, yeni `8:2`, detay `70:2`, cari `7:187` | mobil müşteri `34:2` |
| Ürün/Fiyat | fiyat/depozito `41:246` | müşteri/sipariş girişi ve son satış fiyatı `34:2`, ürün/adet görev kartları `32:37` |
| Satış | POS ana `4:2`, ödeme/tamamlama `7:609`, yetersiz stok `8:169`, kredi limiti `8:211` | `32:37`, `32:92`, ödeme `32:141`, kasa hareketi özeti `61:35` |
| Stok | stok ana `7:390`, sayım farkı `8:87` | mobil stok `34:64` |
| Kasa Özeti | kasa özeti `31:166` | — (tasarım/handoff yok) |

6 zorunlu state (`loading`, `empty`, `validation`, `permission`, `networkError`, `success`) her satırda ortak POS durum/tamlık panosu `42:84` ile `VERIFIED`. OpenAPI ve test oracle kanıtları tamam.

**11 satır `READY`** (`humanApproval: true`, `blockers` boş). **`android-kasaOzeti` `BLOCKED`**: `figma.nodes` boş, `humanApproval: false`. Ödeme `32:141` ve satış sonrası kasa hareketi özeti `61:35` Satış akışının kanıtıdır; günlük kasa özeti, kasa açılışı ve gün sonu sayımı ekranlarını göstermez, bu yüzden Kasa Özeti kanıtı sayılmaz. Blocker'lar: Android günlük kasa özeti, kasa açılışı ve gün sonu sayımı için Figma tasarım/handoff node'u yok; insan onayı yok.

## Kapsam dışı ve release yolu

- R0.1: Windows + Android (Android yalnız online).
- R0.2: iOS.
- R0.3: offline sync/conflict, filo/kurye.
- R1.0: e-Fatura, abonelik otomasyonu, 100+ tenant, fabrika genelleştirme.

## UI kapısı

Bir satır UI implementasyonuna ancak `READY` olunca geçer: OpenAPI'de gerçek operationId ve schema, katalogda kayıtlı `testOracle`, tüm Figma node'ları ve 6 state `VERIFIED`, `humanApproval: true`, blocker yok. Validator bunu zorlar; kanıtı eksik bir satırın `READY` işaretlenmesini (sahte `READY`) reddeder.

## Doğrulama

```powershell
cd contracts
npm run validate   # OpenAPI kuralları + pilot matris
npm test           # validator testleri dahil
```

Doğrulayıcı: `contracts/scripts/pilot-matris.mjs` (testi `pilot-matris.test.mjs`). Kontroller: tam 12 tekil kombinasyon ve `<platform>-<flow>` satır id'si, 6 state, `testOracles` kataloğu (tekil TBP id, satır başına tek oracle, bilinen satırlar, satır ↔ oracle iki yönlü üyelik, oracle `pilotJira` = satır `pilotJira`, `executionJira` = `TBP-258`), Jira anahtarları ve eşlemeleri, release yolu, kapsam dışı, BLOCKED ⇒ blocker, her apiBehavior için OpenAPI'de bulunan operationId ve operasyonda kullanılan schema'lar, satır `openapi` alanının davranış birleşimine eşitliği, bağlı operasyonlarda `/api/v1` + çoğul kaynak, login dışı bearer security, client'tan tenant/connection string/secret alınmaması, tipli ve ayrık girdi/çıktı schema'ları, liste uçlarının sayfalı koleksiyon olması, `x-error-codes` biçimi, stok/finans yazmalarında Idempotency-Key, READY koşulları.
