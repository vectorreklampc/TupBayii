# TupBayiProje

TupBayiProje, tüp bayilerinin merkez ve saha operasyonlarını aynı ürün altında yönetecek çok kiracılı bir sistemdir. Bu repository backend, çoklu platform Flutter istemcileri, merkezi SaaS admin web, altyapı ve otonom yazılım fabrikası bileşenlerinin kanonik monorepo'sudur.

## Repository Yapısı

| Dizin | Sorumluluk | İskelet işi |
| --- | --- | --- |
| `backend/` | .NET backend ve modular monolith | `TBP-15` |
| `flutter/` | Desktop ve mobile Flutter workspace | `TBP-16` |
| `admin-web/` | Merkezi SaaS yönetim web uygulaması | `TBP-17` |
| `infrastructure/` | Yerel ve uzak ortam altyapısı | `TBP-18` ve sonraki altyapı işleri |
| `factory/` | Otonom yazılım fabrikası | P02 Jira işleri |
| `contracts/` | Kanonik OpenAPI belgesi ve contract doğrulaması | `TBP-21` |
| `docs/` | Teknik belgeler ve ADR kayıtları | P00 ve ilgili Jira işleri |

Kökteki `TupBayiProje_*.md` belgeleri P00 kapsamında oluşturulan normatif standartlardır. İş gereksinimleri, sıralama ve uygunluk için canlı Jira `TBP` projesi Source of Truth'tur.

## Çalışmaya Başlama

1. [`AGENTS.md`](AGENTS.md) içindeki canlı Jira döngüsünü uygula.
2. [`CONTRIBUTING.md`](CONTRIBUTING.md) içindeki branch, PR, secret ve repository hijyeni kurallarını izle.
3. İlgili workspace'in README dosyasındaki kapsam sınırını koru.

Uygulama çalıştırma komutları ilgili workspace iskeletleri kurulduğunda kendi README dosyalarına eklenecektir. Bu temel ticket, henüz var olmayan build veya test komutları tanımlamaz.

## Mimari Kararlar

Kabul edilen kararlar ve ADR şablonu [`docs/adr/`](docs/adr/) altında tutulur. Yeni bir ADR, yalnız pahalı veya zor geri alınabilir bir mimari karar gerektiğinde ve mevcut numaralandırma sürdürülerek eklenir.
