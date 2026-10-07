# TupBayiProje ADR Standardi

**Jira:** `TBP-7`  
**Durum:** Normatif  
**Tarih:** 2026-10-01

Bu dizin, geri döndürülmesi maliyetli mimari kararların bağlamını, kararını ve sonuçlarını kaydeder. ADR; Jira gereksiniminin yerine geçmez, onu teknik karara bağlar.

## Kaynak önceliği

1. Sistem, kullanıcı ve depo talimatları
2. Canlı Jira açıklaması, kabul kriterleri, bağlantıları ve yorumları
3. Normatif invariant ve ownership belgeleri
4. Kabul edilmiş ADR'ler
5. Kod ve diğer yerel belgeler

Yerel Jira listeleri yalnız indeks olarak kullanılır. Kaynaklar çelişirse değişiklik yapılmadan çelişki görünür kılınır.

## Dosya ve numaralandırma

- Konum: `docs/adr`
- Ad: `ADR-NNN-Turkce-Anlamli-ASCII-Ad.md`
- Numara bir kez verilir ve yeniden kullanılmaz.
- Kabul edilmiş kayıt silinmez veya geçmişi değiştirecek biçimde yeniden yazılmaz.
- Karar değişirse yeni ADR yazılır; eski kayıt `Yerine Geçildi` yapılarak yeni ADR'ye bağlanır.

## Durumlar

- `Önerildi`: Karar Human Gate veya ilgili Jira kabulünü bekler.
- `Kabul Edildi`: Normatif kaynak ve gerekli onaylarla yürürlüktedir.
- `Reddedildi`: Değerlendirilmiş fakat seçilmemiştir.
- `Kullanımdan Kaldırıldı`: Artık yeni kullanım için geçerli değildir.
- `Yerine Geçildi`: Daha yeni bir ADR tarafından değiştirilmiştir.

## Zorunlu içerik

Her ADR; durum, tarih, Jira kaynağı, bağlam, karar, değiştirilemez sınırlar, değerlendirilen alternatifler, sonuçlar ve doğrulama kanıtlarını içerir. Yeni business rule, sahiplik değişikliği veya kritik güvenlik kararı yalnız ADR ile üretilemez; canlı Jira Change Request ve gerekiyorsa Human Gate gerekir.

## Review ve uygulama

- Architecture Guardian ve Codex, implementasyonu ilgili ADR ve canlı Jira kaydına karşı bağımsız denetler.
- İhlal `REQUEST_CHANGES`; invariant veya güvenlik sınırı ihlali `BLOCKED`; eksik insan kararı `HUMAN_REQUIRED` üretir.
- Parametre, teknoloji veya politika henüz Jira ile belirlenmemişse ADR bunu açık soru olarak bırakır; varsayım üretmez.

## İlk kayıtlar

| ADR | Karar | Durum |
|---|---|---|
| ADR-001 | Tenant başına fiziksel veritabanı | Kabul Edildi |
| ADR-002 | Master DB sorumluluğu | Kabul Edildi |
| ADR-003 | Tenant çözümleme | Kabul Edildi |
| ADR-004 | Tüp hareket defteri | Kabul Edildi |
| ADR-005 | Stok projection | Kabul Edildi |
| ADR-006 | Finansal reversal | Kabul Edildi |
| ADR-007 | Ödeme webhook otoritesi | Kabul Edildi |
| ADR-008 | Offline outbox | Kabul Edildi |
| ADR-009 | Conflict çözümleme | Kabul Edildi |
| ADR-010 | Cihaz offline lisansı | Önerildi |
| ADR-011 | Figma tasarım kaynağı | Önerildi |
| ADR-012 | Jira gereksinim kaynağı | Kabul Edildi |
| ADR-013 | OpenAPI contract kaynağı | Önerildi |
| ADR-014 | Event contract sürümleme | Kabul Edildi |
| ADR-015 | Tenant bağlantı yaşam döngüsü | Kabul Edildi |
| ADR-016 | Tenant migration orkestrasyonu | Kabul Edildi |
