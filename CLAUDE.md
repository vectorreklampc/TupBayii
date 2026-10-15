@AGENTS.md

# TupBayiProje Claude Calisma Sozlesmesi

Bu dosya repository kokunden calisan Claude ve uygulayici ajanlar icin kalici
calisma sozlesmesidir. Ayrintili mimari kurallari yeniden tanimlamaz; kanonik
kaynaklara yonlendirir. Alt dizindeki daha ozel `CLAUDE.md` ve `AGENTS.md`
dosyalari yalniz kendi kapsamlarini daraltabilir; kok kurallari gevsetemez.

## 1. Yetki sirasi ve zorunlu preflight

1. Sistem ve kullanici talimatlari.
2. Kapsama uygulanan `AGENTS.md` dosyalari.
3. Canli Jira `TBP` kaydi: gereksinim, kabul kriteri, baglanti, yorum, durum ve
   is sirasi icin Source of Truth.
4. Kabul edilmis ADR'ler ve kokteki normatif `TupBayiProje_*.md` standartlari.
5. Bu dosya ve workspace README'leri.
6. Mevcut kod; kod davranisi ustteki kaynaklarla celisirse emsal sayilmaz.

Her proje isinden ve her dosya degisikliginden once `AGENTS.md` icindeki canli
Jira dongusunu uygula. Ticket okunamiyorsa, uygunluk belirlenemiyorsa veya
gerekli alan eksikse tahminle ilerleme. Yerel Jira listesi ve sohbet gecmisi
yalniz arama yardimcisidir.

Bir ise baslarken:

- calisma agacini ve ilgili `AGENTS.md`/`CLAUDE.md` dosyalarini oku;
- kullanici ticket vermediyse canli Jira rank, durum, `Blocks`, tamamlanmis on
  kosullar ve faz GATE'leriyle ilk blokajsiz isi sec;
- Jira workflow'u destekliyorsa aktif isi `DEVAM EDIYOR` durumunda gorunur tut;
- tek ticket, tek kisa omurlu branch/worktree kullan;
- kullaniciya ait mevcut degisiklikleri silme, ezme veya commite katma.

## 2. Urun amaci ve kapsam disi alanlar

TupBayiProje, tup bayilerinin merkez ve saha operasyonlarini ayni urunde
yoneten cok kiracili bir sistemdir. Backend, Flutter mobil/masaustu istemciler,
merkezi SaaS Admin Web, contract'lar, altyapi ve otonom Software Factory ayni
monorepo'da tutulur.

Ticket acikca istemedikce kapsam disidir:

- yeni business rule, endpoint, event veya UI akisi icat etmek;
- onceden business modul, tablo, migration veya generic altyapi kurmak;
- mevcut teknoloji yiginini degistirmek ya da yeni dependency eklemek;
- production deploy, destructive migration, restore veya gercek veri islemi;
- mimari standardi, invariant'i veya Human Gate'i gevsetmek;
- komsu kodu "hazirken" refactor etmek.

En basit tam sistemi kur. Once mevcut davranisi ve invariantlari izle; uygun
sahip, tip, helper veya platform ozelligi varsa onu genislet. Spekulatif
abstraction, tek implementasyonlu interface ve gelecege donuk scaffolding ekleme.

## 3. Teknoloji yigini ve repository haritasi

| Kok | Sorumluluk | Temel teknoloji |
|---|---|---|
| `backend/` | Modular monolith backend | .NET 10, ASP.NET Core 10, EF Core 10 |
| `flutter/` | Mobil ve masaustu istemciler | Flutter 3.41.6, Dart 3.11 |
| `admin-web/` | Merkezi SaaS yonetimi | Next.js, React, TypeScript |
| `contracts/` | Kanonik HTTP contract ve uretilen client girdisi | OpenAPI 3.1 JSON, Node.js 24 |
| `factory/` | Otonom Software Factory | Node.js 24, SQLite |
| `infrastructure/` | Yerel/uzak altyapi | Docker Compose ve ilgili deployment araclari |
| `docs/adr/` | Mimari karar gecmisi | Markdown ADR |

Backend katman yonu:

```text
Sunum -> Uygulama -> Domain
Altyapi -------> Uygulama
```

`Domain` baska katmana, `Uygulama` altyapi implementasyonuna baglanmaz.
`backend/src/Ortak` yalniz business ownership tasimayan ve gercekten paylasilan
kucuk teknik yapilar icindir.

## 4. Bounded context ve veri sahipligi

Kanonik kayit: `TupBayiProje_Source_of_Truth_ve_Domain_Ownership.md`.

- Identity kimlik/session/revoke state'in; Tenancy tenant lifecycle ve DB
  metadata'nin sahibidir.
- Billing odeme gerceginin; Licensing abonelik, lisans ve cihaz state'inin
  sahibidir.
- Tenant Operations isletme, sube, depo tanimi ve urun katalog temelinin;
  Customers musteri/adresin; Pricing fiyat gecmisinin sahibidir.
- Inventory fiziksel movement ledger ve stok projection'inin; Cylinders tup ve
  exchange politikasinin sahibidir.
- Sales satis state'inin; Orders siparis/dispatch'in; Delivery teslimat state'inin
  sahibidir.
- Accounting cari, kasa, tahsilat, gider ve finansal ledger'in; Fleet arac ve
  filo uygunlugunun sahibidir.

Bir modul baska modulun tablosuna, `DbContext` nesnesine veya aggregate'ina
dogrudan yazamaz. Degisiklik sahip domainin application/command contract'i ile
yapilir. Projection, cache, rapor, UI, log ve audit business state icin
authoritative kaynak degildir.

## 5. Database-per-Tenant ve guven siniri

- Her tenant ayri fiziksel PostgreSQL veritabanina sahiptir.
- Master DB yalniz control-plane verisi tasir; tenant business verisi tasiyamaz.
- Client `TenantId`, header, query, body, role veya record ownership beyanina
  guvenilmez.
- Tenant context dogrulanmis identity ve server-side Tenancy cozumuyle uretilir.
- Tenant context cozulmezse islem fail-closed reddedilir.
- Cross-tenant veri erisimi, ortak tenant tablosu/semasi ve tenant bilgisini
  client'tan routing authority yapmak `BLOCKED` sonucudur.

Ilgili kararlar: `ADR-001`, `ADR-002`, `ADR-003`, `ADR-015`, `ADR-016`.

## 6. Invariant kayit defteri ve dogrulama

Kanonik kayit `TupBayiProje_Global_Invariantlar.md` dosyasidir. Her kural kalici
`INV-<ALAN>-NNN` kimligiyle izlenir. Ilgili degisiklikte once etkilenen INV ve
SOT kimliklerini yaz; sonra bunlari test/architecture check/contract test/runtime
assertion ile kanitla.

Asgari kritik gruplar:

- `INV-TEN-*`: tenant izolasyonu, Master DB siniri, server-side tenant context;
- `INV-STK-*`: FULL/EMPTY ayrimi, movement ledger otoritesi, atomiklik;
- `INV-FIN-*`: finansal ledger, reversal/correction, idempotency;
- `INV-PAY-*`: imzali webhook, replay/sira korumasi, payment authority;
- `INV-OFF-*`: offline command kimligi ve sessiz last-write-wins yasagi;
- `INV-AUD-*`: kritik audit, hassas veri korumasi ve kanitlanabilirlik;
- `INV-GOV-*`: Human Gate ve AI yetki siniri.

Bilinmeyen veya kanitsiz durumda PASS/ACCEPTED verme. Invariant ihlali
`BLOCKED`; bilinen standarda aykirilik `REQUEST_CHANGES`; eksik business karari
`SPEC_REQUIRED`; insan yetkisi gereken karar `HUMAN_REQUIRED` sonucudur. AI bir
invariant'i kaldiramaz, gevsetemez veya yeniden yorumlayarak etkisizlestiremez.

## 7. Kodlama dili ve adlandirma

Kanonik kaynak: `TupBayiProje_Kodlama_Dili_ve_Adlandirma_Standardi.md`.

- Domain identifier'lari Turkce anlamli ve yalniz ASCII olur.
- Framework, protokol ve urun adlarini resmi yazimiyla koru.
- C#: public type/member `PascalCase`, local/parameter `camelCase`.
- TypeScript/Dart: type/component `PascalCase`, fonksiyon/deger `camelCase`.
- PostgreSQL: `snake_case`; JSON property: `camelCase`; route: `kebab-case`.
- Enum/state ve kararlı hata kodu: `UPPER_SNAKE_CASE`.
- Kod yorumlari Turkce ve ASCII olur; yalniz kararin nedenini aciklar.
- Generated dosyayi elle degistirme; schema/template/generator config'ini duzelt.
- `Manager`, `Helper`, `Data`, `Common`, `Temp`, `Test1`, `Works` gibi
  sorumlulugu veya kaniti gizleyen adlar kullanma.

## 8. Error ve result modeli

- Domain hatasi HTTP status'tan bagimsiz kararlı `code` tasir.
- Guvenli hata sonucu en az `code`, `message`, `correlationId`; ilgiliyse
  `currentState` veya allowlist `details` tasir.
- Validation/authentication/authorization/business rejection/concurrency/
  idempotency/infrastructure hata siniflarini birbirine karistirma.
- Stack trace, secret, token, connection string, tam odeme verisi, gereksiz PII
  veya baska tenant bilgisi response/log/audit'e yazilmaz.
- Beklenmeyen hatayi basarili, bos sonuc veya sessiz no-op'a cevirme.
- State serbest string veya public setter degildir; gecersiz gecis state ve yan
  etki birakmadan kararlı hata uretir.

## 9. Transaction, concurrency ve idempotency

Kanonik kaynaklar:
`TupBayiProje_Transaction_Concurrency_Idempotency_ve_Guvenlik_Standardi.md` ve
`TupBayiProje_State_Machine_ve_Yasam_Dongusu_Standardi.md`.

- Business state, ledger, outbox, audit ve idempotency sonucu gereken yerde tek
  transaction sinirinda commit veya rollback olur.
- Cross-database/dis sistem etkisinde local state + durable outbox atomik olur;
  uzak etki retry edilebilir ve gorunur state tasir.
- Finans/stok akiminda silent last-write-wins yasaktir. Optimistic version,
  atomic DB operation, unique constraint veya uygun lock ile invariant korunur.
- Idempotency anahtari intent'ten gelir; retry katmani yeni key uretmez.
- Ayni key + ayni payload tek mantiksal sonuc; ayni key + farkli payload kararlı
  conflict; check-then-act yerine atomik unique claim kullanilir.
- Unknown commit sonucunda kor tekrar yapma; authoritative idempotency sonucunu
  sorgula. Retry yalniz transient hata icin bounded backoff/jitter ile yapilir.
- Duplicate ve out-of-order event ikinci etki veya state geri alma uretemez.

## 10. OpenAPI ve event contract kurallari

- HTTP API'nin tek kaynagi `contracts/openapi.json` OpenAPI 3.1 belgesidir.
- Server, mock ve generated client ayni contract'a karsi dogrulanir; elle ikinci
  request/response contract'i tutulmaz.
- Her operasyon security beyanini, gercek basari response'unu, ortak hata
  envelope'unu ve `TraceId` header'ini aciklar.
- Kritik tekrar edilebilir yazma `Idempotency-Key` ve
  `x-idempotency-required: true` tasir.
- Breaking property/route/event/enum/error-code degisikligi compatibility,
  deprecation/migration plani ve gerekli Human Gate olmadan yayimlanmaz.
- Event acik kimlik/surum, message id, correlation/causation ve compatibility
  kurali tasir. Bilinmeyen surum sessizce islenmez.
- ADR-013 ve ADR-014 hala ilgili Jira kanitlarina baglidir; "Onerildi" karari
  kabul edilmis gibi genisletilmez.

## 11. Logging, audit ve trace

- Her dis istek ve factory calismasi `traceId`; gereken akista `spanId`,
  `correlationId` ve `causationId` tasir.
- Structured log alanlari tutarli olur: severity, component, tenant-safe scope,
  operation, result, duration ve issue/release referansi.
- Secret/PII redaction boundary'de uygulanir. Idempotency key gerekiyorsa tam
  deger yerine guvenli referans/hash audit edilir.
- Audit authoritative business state degildir ve sessizce degistirilemez.
- Log/metric/trace basari kaniti olarak business state'in yerine gecmez.
- Yeni runtime davranisi en az failure, retry/conflict ve kritik latency'nin
  nasil gorulecegini aciklar; vendor secimi ilgili Jira olmadan icat edilmez.

## 12. Test turleri ve minimum kalite kapilari

Kanonik kaynaklar:
`TupBayiProje_Test_Oracle_ve_Golden_Scenario_Standardi.md` ve
`TupBayiProje_Definition_of_Done_ve_Risk_Bazli_Kalite_Kapilari_Standardi.md`.

Degisen davranis icin once fail eden test yaz, sonra en kucuk implementasyonla
gecir. Test beklenen sonucu test edilen implementasyondan uretmez. REQ/BR/INV/
AC/GS kimligini test veya kalici kanitla esle.

Asgari risk kapilari:

- LOW: ilgili format/lint, acceptance kaniti ve Codex review.
- MEDIUM: build, lint/static analysis, unit test, deterministic scenario;
  runtime etkisinde observability; ilgiliyse integration/contract/security/
  idempotency ve Codex review.
- HIGH: unit + integration + ilgili contract/security/concurrency/idempotency,
  rollback/recovery, audit/observability, somut Test Oracle veya Golden Scenario
  ve bagimsiz Codex review.
- CRITICAL: HIGH kapilarinin tamami, negatif/failure Golden Scenario,
  staging/dry-run recovery kaniti ve Human Gate.

Failing, skipped veya flaky kritik test varken issue `TAMAMLANDI` olamaz.
Coverage yuzdesi tek basina kanit degildir; risk ve davranis kapsami esastir.

Temel komutlar ilgili workspace'te calistirilir:

```powershell
# backend/
dotnet restore TupBayiProje.slnx -p:NuGetAuditMode=all -p:NuGetAuditLevel=low -p:TreatWarningsAsErrors=true
dotnet format TupBayiProje.slnx --verify-no-changes --no-restore
dotnet build TupBayiProje.slnx --no-restore --configuration Release
dotnet test TupBayiProje.slnx --no-build --configuration Release

# contracts/, factory/ veya admin-web/
npm ci
npm run check       # yalniz factory
npm run validate    # yalniz contracts
npm run format:check # yalniz admin-web
npm run lint        # yalniz admin-web
npm run typecheck   # yalniz admin-web
npm test
npm run build       # yalniz admin-web
npm audit --audit-level=high

# flutter/
flutter pub get --enforce-lockfile
dart format --output=none --set-exit-if-changed apps packages
flutter analyze
flutter test apps/tup_mobile
flutter test apps/tup_desktop
```

## 13. Yasak implementasyonlar

- Process-local authoritative state veya yalniz bellek ici lock.
- Serbest string state, public state setter, joker/ortuk transition.
- Baska domain tablosuna dogrudan yazma veya genel amacli state update.
- Master DB'de tenant business data; client TenantId ile DB routing.
- Ledger disinda stok/bakiye set etme; finans/stok kaydini hard-delete/overwrite.
- Check-then-act idempotency; unbounded retry; sessiz conflict cozumleme.
- Controller/UI icinde business kural, authorization authority veya domain state.
- Contract'siz endpoint/event; generated client'i elle patch etme.
- Secret/PII loglama, credential commit etme, `.env` veya build output commitleme.
- Testi silerek, skip ederek veya assertion'i zayiflatarak kirmizi kapiyi gecme.
- Canli Jira olmadan yerel backlogdan siradaki isi tahmin etme.

## 14. Figma, requirement ve Jira izlenebilirligi

- Jira business gereksiniminin Source of Truth'udur (`ADR-012`).
- `ADR-011` henuz `Onerildi` durumundadir. Canli Jira tasarim kapisi istiyorsa
  yalniz onayli/kilitli Figma UI gorunumu ve component davranisinin tasarim
  kaynagidir; Figma business rule uretmez.
- Figma ile Jira celisirse implementasyonu durdur ve celiskiyi gorunur yap.
- Empty/loading/error/offline/stale/conflict durumlari hem Jira acceptance'a hem
  ilgili Figma node'una izlenebilir olmalidir.
- PR/commit/test/contract/migration/telemetry kaniti Jira anahtari tasir.
- Canli kayitla yerel belge celisirse ust talimatlar sakli kalmak uzere Jira
  uygulanir ve celiski raporlanir.

## 15. Ajan durdurma kosullari

Asagidaki durumda kod veya dokuman degisikligini durdur:

- Jira erisimi, ticket alani, yorum, dependency veya faz GATE'i okunamiyor;
- gelen `Blocks` bagimliligi tamamlanmamis veya gerekli Human Gate yok;
- requirement, mimari, contract, tasarim, izlenebilirlik veya Test Oracle eksik;
- canli Jira, ADR, invariant, Figma veya mevcut contract birbiriyle celisiyor;
- ownership, tenant siniri, auth, payment, finans/stok dogrulugu belirsiz;
- destructive/veri kaybi yaratabilecek karar icin rollback ve insan onayi yok;
- working tree'deki kullanici degisikligiyle guvenli izolasyon kurulamiyor;
- gerekli test/build/CI kirmizi ve dar kapsamta guvenle duzeltilemiyor.

Sonucu acikca `REQUEST_CHANGES`, `SPEC_REQUIRED`, `BLOCKED` veya
`HUMAN_REQUIRED` olarak bildir; sessiz varsayimla devam etme.

## 16. Referans mimari ve seed kullanimi

Yeni vertical slice su akisi izler:

```text
API/Sunum -> Uygulama/use-case -> Domain -> Persistence/Altyapi
          -> Contract -> Tests -> Telemetry
```

Once repository'de ayni bounded context ve risk sinifina ait calisan, testli ve
Jira ile izlenebilir referans implementasyonu bul. Code shape, error handling,
transaction, telemetry ve test duzenini ondan al. Referans veya insan kontrollu
seed modul henuz yoksa yeni bir pattern icat etme; ilgili Jira kapsami olmadan
"seed" adiyla ornek production kodu ekleme.

Seed adaylari tenant resolution/connection lifecycle, kimlik/yetki, urun + stok
hareketi, basit satis/POS command ve audit + trace'tir. Bir modul ancak canli
Jira kabul kriterleri, invariant/SOT eslemesi ve zorunlu testleriyle referans
ilan edilebilir. Referans drift'i architecture/contract test ve review ile
`REQUEST_CHANGES` veya `BLOCKED` uretmelidir.

## 17. Release ve production sinirlari

- Ajan production'a deploy, destructive migration, restore, tenant DB silme,
  secret rotation veya gercek odeme islemi yapamaz; acik yetki ve Human Gate
  gerekir.
- Test, acceptance, smoke, security, migration/rollback ve risk kapilari
  gecmeden release yapilmaz (`INV-GOV-001`).
- Release immutable commit/tag/artefakt ile izlenir; Jira, contract, migration,
  deployment ve telemetry ayni surume baglanir.
- Rollback/forward-fix siniri, veri kaybi ihtimali ve eski/yeni surum birlikte
  calisma davranisi release oncesi kanitlanir.
- Production secret veya ham hassas veri LLM baglamina verilmez; maskelenmis
  diagnostic bundle kullanilir.

## 18. Tamamlama ve handoff

Is bitiminde canli Jira'yi yeniden oku. Acceptance maddelerini test/kanitla
esle; risk kapilarini ve `N/A` gerekcelerini yaz; diff'i correctness,
architecture, security, compatibility ve sadelik acisindan incele. Yalniz tum
zorunlu kapilar PASS ve review sonucu APPROVE ise issue'yu `TAMAMLANDI` yap.

Handoff en az sunlari tasir: ticket/branch/commit, degisen dosyalar, calistirilan
komutlar ve sonuclari, rollback/recovery, acik riskler, gerekli onaylar ve bir
sonraki canli Jira seciminin henuz yapilmadigi bilgisi.
