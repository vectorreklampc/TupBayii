# Dokumantasyon

Bu dizin teknik mimari belgeler ve karar kayitlari icin kanonik koktur.

- `adr/`: Kabul edilen mimari karar kayitlari ve ADR sablonu.
- Proje kokundeki `TupBayiProje_*.md` belgeleri: P00 kapsaminda olusturulan normatif standartlar.

Normatif belgeler canli Jira gereksinimlerinin yerine gecmez. Celiski halinde sistem, kullanici ve repository talimatlari sakli kalmak uzere canli Jira esas alinir.

- [`R0-1-Pilot-Izlenebilirlik-Matrisi.md`](R0-1-Pilot-Izlenebilirlik-Matrisi.md): R0.1 pilot akışları için Jira/Figma/OpenAPI izlenebilirliği ve hazırlık kapısı (`r0-1-pilot-izlenebilirlik.json`; doğrulama `cd contracts && npm run validate`). Jira Source of Truth'tur.
