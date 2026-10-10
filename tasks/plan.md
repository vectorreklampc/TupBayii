# Implementation Plan: TBP-246 Control-Plane Audit

## Scope

Canli Jira [TBP-246](https://ucarmakadil.atlassian.net/browse/TBP-246) ve normatif yorumlar
11107, 11109, 11111, 11113 (onaylar: 11108, 11110, 11112, 11114) uygulanir.
Bu plan is listesi icin Jira'nin yerine gecmez.

## Invariants

- Tenancy `MasterVeritabaniBaglami` tam iki entity olarak kalir.
- Audit ayri DbContext, migration history ve least-privilege SCRAM runtime rolu kullanir.
- Audit kaydi tam dokuz kolonludur; allow/deny gerekce truth table'i DB constraint ile korunur.
- Ortam transaction'i bastirilir; `KALICI` yalniz yerel commit kesin basariliysa doner.
- Retry ayni opaque karar ve correlation kimliklerini korur.
- Tek monotonic 12 saniyelik butce tum async fazlari kapsar; belirsiz commit fail-closed'dur.
- Hassas veri store, telemetry, exception veya test ciktisina girmez.

## Thin Slices

- [ ] Domain kontrati, opaque UUIDv7 kimlikleri ve model exact-set testleri (RED -> GREEN).
- [ ] Audit DbContext, migration, dokuz kolon ve truth-table testleri (RED -> GREEN).
- [ ] SCRAM bootstrap ve runtime/Tenancy/PUBLIC yetki negatifleri (RED -> GREEN).
- [ ] Yerel transaction, ambient suppression, replay/conflict/concurrency (RED -> GREEN).
- [ ] Unknown-commit reconciliation ve monotonic deadline/hanging-commit (RED -> GREEN).
- [ ] Telemetry exact allowlist ve hassas sentinel kaniti.
- [ ] Tam restore/build/test, diff ve guvenlik incelemesi; Jira kanit yorumu.

## Out of Scope

- Gercek OpenBao secret salimi ve dis caller tenant authorization.
- P05 kullanici kimligi.
- Production role/grant, retention/query/legal deletion.
- Merge, release veya production onayi.
