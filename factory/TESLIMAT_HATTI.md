# TBP-238 Kontrollu Teslimat Hatti

`ship.sh`, ayni immutable artefakti candidate, staging ve production boyunca
tasiyan vendor bagimsiz release orkestratorudur. Bir cloud veya Kubernetes
urununu varsaymaz. Operasyon ekibinin onayli komutlarini shell acmadan argv
olarak calistirir; komut ciktilarini, argumanlarini veya secret degerlerini
SQLite audit kaydina yazmaz.

## Komutlar

```bash
./ship.sh candidate --plan release-plan.json --database /guvenli/state/ship.sqlite --actor operator
./ship.sh staging --plan release-plan.json --database /guvenli/state/ship.sqlite --actor operator
./ship.sh production --plan release-plan.json --database /guvenli/state/ship.sqlite --actor operator
```

`--trace` ve `--correlation` verilmezse CLI yeni kimlik uretir. Plan dosyasi
trusted operasyon girdisidir ve review edilmeden dis kaynaktan alinmaz; listedeki
komutlar gercek surec olarak calistirilir. Her komuta `TBP_RELEASE_ID`,
`TBP_DEPLOYMENT_ENVIRONMENT`, `TBP_TRACE_ID` ve `TBP_CORRELATION_ID` aktarilir.

## Sabit kapi sirasi

Candidate:

```text
versionBuild -> sbomDependencySecurity -> migrationsDryRun -> fullTest
-> acceptance -> packageSign
```

Staging:

```text
stagingDeploy -> stagingSmoke -> stagingTelemetry
```

Production:

```text
Human Gate -> productionDeploy -> productionSmoke -> productionTelemetry
```

Bir kapinin sifirdan farkli cikis kodu sonraki kapiyi calistirmaz. Production
deploy, smoke veya kritik telemetry kapisi basarisizsa `rollback` komutu
otomatik calisir. Rollback basariliysa sonuc `ROLLBACK_UYGULANDI`; o da
basarisizsa `INCIDENT_ACIK` olur. Ikisi de basarili release sayilmaz ve CLI
`2` cikis kodu verir.

## Plan sozlesmesi

Plan su alanlari tasir:

- `releaseKimligi`: `release-*` biciminde kalici kimlik;
- `isAnahtarlari`, `commitKimligi`, `artefaktYolu`, `artefaktSha256`;
- `imzaKimligi`, `dagitimStratejisi` (`CANARY`, `ROLLING`, `RECREATE`);
- `migrationPlani`: dry-run, forward ve rollback kanit kimlikleri;
- `backupRestoreKanitKimligi`;
- production icin `insanOnayiKanitKimligi`;
- `komutlar`: her sabit kapi adi icin executable ve argumanlardan olusan dizi.

Ornek komut bicimi `{"fullTest":["npm","test"]}` seklindedir. `&&`, pipe,
redirect veya command substitution yorumlanmaz. Platforma ozel gercek deploy,
smoke, telemetry ve rollback komutlari bu planda acikca verilmeden release
ilerlemez.

## Guvenlik ve recovery

- Artifact SHA-256 candidate oncesi ve her deployment oncesi tekrar hesaplanir.
- Ayni release kimligi farkli manifest ile tekrar kullanilamaz.
- Staging ve production ortamlari kalici, tekil deployment lock ile korunur.
- Normal hata ve sinyalde lock `finally` ile birakilir. Ani process/host kaybinda
  DB'de kalan lock fail-closed davranir; DB elle degistirilmez. Once gercek ortam
  ve deployment durumu incelenir, incident/Human Gate karariyla yeni release
  olusturulur veya kontrollu operasyonel recovery uygulanir.
- Release audit update/delete trigger'lariyla immutable'dir; trace, correlation,
  Jira, commit, release ve artifact referanslari birlikte tutulur.
- Migration dry-run, backup/restore hazirligi, forward ve rollback planlari bos
  birakilamaz. Bunlarin gercek kaniti ilgili komutun basarili sonucudur.

Bu mekanizma production yetkisi vermez. Production komutunun calistirilmasi,
gecerli Human Gate kaniti ve yetkili operator girdisi gerektirir.
