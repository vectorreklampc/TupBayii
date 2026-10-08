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
./ship.sh recovery --plan recovery-plan.json --database /guvenli/state/ship.sqlite --actor operator
```

`--trace` ve `--correlation` verilmezse CLI yeni kimlik uretir. Plan dosyasi
trusted operasyon girdisidir ve review edilmeden dis kaynaktan alinmaz; listedeki
komutlar gercek surec olarak calistirilir. Her komuta `TBP_RELEASE_ID`,
`TBP_DEPLOYMENT_ENVIRONMENT`, `TBP_TRACE_ID`, `TBP_CORRELATION_ID`,
`TBP_ARTIFACT_PATH` ve `TBP_ARTIFACT_SHA256` aktarilir. Deploy komutu ayrica
gercekte uyguladigi artefaktin SHA-256 ozetini
`TBP_DEPLOYMENT_ATTESTATION_PATH` dosyasina yazmalidir; eksik veya farkli ozet
kapinin kapanmasina neden olur.

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
- production icin `insanOnayi`: kanit, onaylayan, release, artefakt ve staging
  kanit kimliklerini birlikte tasiyan nesne;
- crash recovery icin `recoveryOnayi`: kanit, onaylayan, release ve artefakt
  kimliklerini birlikte tasiyan nesne;
- `komutlar`: her sabit kapi adi icin executable ve argumanlardan olusan dizi.

Ornek komut bicimi `{"fullTest":["npm","test"]}` seklindedir. `&&`, pipe,
redirect veya command substitution yorumlanmaz. Platforma ozel gercek deploy,
smoke, telemetry ve rollback komutlari bu planda acikca verilmeden release
ilerlemez.

## Guvenlik ve recovery

- Candidate, kaynak artefakti SHA-256 ile adreslenen salt-okunur bir snapshota
  kopyalar. Staging ve production yalniz bu snapshot yolunu kullanir; deploy
  oncesi ve sonrasi ozet tekrar hesaplanir.
- Ayni release kimligi farkli manifest veya komut planiyla tekrar kullanilamaz.
  Komut plani ozeti candidate kaydinin immutable parcasidir.
- Human Gate kayitlari append-only tutulur. Production onayi release, artefakt,
  staging kaniti ve onaylayan kimligine baglidir; serbest metin onay sayilmaz.
- Staging ve production ortamlari lease, heartbeat ve monoton fencing token
  iceren kalici deployment lock ile korunur. Suresi dolmus veya devralinmis bir
  calistirici release durumunu ilerletemez.
- Normal hata ve sinyalde lock `finally` ile birakilir. Ani process/host kaybinda
  lease dolana kadar akis fail-closed kalir. Sonrasinda yalniz `recoveryOnayi`
  bulunan `recovery` komutu stale lock'i devralip idempotent rollback calistirir;
  DB elle degistirilmez. Rollback basarisizsa durum `INCIDENT_ACIK` olur.
- Release audit update/delete trigger'lariyla immutable'dir; trace, correlation,
  Jira, commit, release ve artifact referanslari birlikte tutulur.
- Migration dry-run, backup/restore hazirligi, forward ve rollback planlari bos
  birakilamaz. Bunlarin gercek kaniti ilgili komutun basarili sonucudur.

Bu mekanizma production yetkisi vermez. Production komutunun calistirilmasi,
gecerli Human Gate kaniti ve yetkili operator girdisi gerektirir.
