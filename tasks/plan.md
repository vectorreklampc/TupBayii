# Implementation Plan: TBP-31 DAG, Claim, Lock ve Heartbeat

## Overview

TBP-31, Jira `Blocks` grafigini claim oncesinde fail-closed dogrulayan ve ayni isin iki agent tarafindan eszamanli sahiplenilmesini SQLite uzerinde atomik olarak engelleyen factory cekirdegini ekler. Ayrintili kabul ve ilerleme kaydi canli Jira TBP-31 uzerinden izlenir.

## Architecture Decisions

- DAG dogrulamasi saf ve deterministik tutulur; issue key sirasi hicbir kararda kullanilmaz.
- Claim, aktif lock kontrolu ve stale recovery tek `BEGIN IMMEDIATE` transaction'i icinde yapilir.
- Lock process-local degildir; SQLite authoritative store kullanilir.
- Zaman davranisi test edilebilir olmak icin kanonik UTC girdisiyle yurutulur; heartbeat yalniz mevcut sahibi tarafindan yenilenir.
- Eksik dugum, cycle, tamamlanmamis on kosul ve tamamlanmamis gate ayri neden kodlariyla fail-closed reddedilir.

## Task List

Tasks tracked in Jira: [TBP-31](https://ucarmakadil.atlassian.net/browse/TBP-31).

### Phase 1: DAG dogrulama

- [x] Cycle, unresolved dependency, blocked prerequisite ve gate bypass testlerini RED olarak ekle.
- [x] En kucuk saf DAG dogrulayiciyi uygula ve odakli testleri GREEN yap.

### Phase 2: Atomik claim ve lock

- [x] Iki eszamanli claimant icin tek kazanan testini RED olarak ekle.
- [x] SQLite-backed atomik claim ve aktif lock korumasini uygula.

### Phase 3: Heartbeat ve stale recovery

- [x] Heartbeat kaybi, stale recovery ve aktif lock'in alinmamasi testlerini RED olarak ekle.
- [x] Sahip kontrollu heartbeat ile guvenli stale recovery davranisini uygula.

### Checkpoint: Complete

- [x] `npm run check`, `npm test` ve `npm audit --audit-level=high` basarili.
- [x] Concurrency testi gercek iki ayri SQLite baglantisiyla tek kazanan kaniti verir.
- [x] Codex son incelemesi ve GitHub Actions kalite kapilari basarili.

## Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Cift claim yarisi | Ayni isin iki kez uygulanmasi | SQLite `BEGIN IMMEDIATE` ve unique issue lock kaydi |
| Aktif lock'in stale sanilmasi | Calisan agent'in sahipligi kaybolur | Kanonik UTC, acik timeout siniri ve aktif-lock negatif testi |
| Eksik Jira graph verisi | Dependency bypass | Eksik dugum ve belirsiz durumlarda fail-closed sonuc |
| Testin yalniz tek connection kullanmasi | Gercek yarisi kacirir | Iki ayri connection ile concurrency entegrasyon testi |

## Open Questions

- Yok; canli Jira kabul kriterleri uygulama icin yeterlidir.
