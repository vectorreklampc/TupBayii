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
`TBP_ARTIFACT_PATH` ve `TBP_ARTIFACT_SHA256` aktarilir. Deployment ve rollback
komutlarina ayrica `TBP_FENCE_TOKEN`, `TBP_FENCE_GENERATION` ve intent tabanli
`TBP_IDEMPOTENCY_KEY` verilir. Hedef sistem adaptoru fence neslini hedefte
atomik olarak uygulamali, daha eski nesilleri reddetmeli ve ayni idempotency
anahtarini ikinci kez etkilememelidir.

Deploy'dan ayri `*ArtifactVerify` komutu hedef sistemden gercek SHA-256/version
bilgisini okumali ve `TBP_TARGET_ATTESTATION_PATH` dosyasina
`artefaktSha256`, `kilitKimligi`, `fencingNesli` ve `idempotencyAnahtari`
alanlarini iceren JSON yazmalidir. Deploy komutunun kendi beyanı kanit sayilmaz.

## Sabit kapi sirasi

Candidate:

```text
versionBuild -> sbomDependencySecurity -> migrationsDryRun -> fullTest
-> acceptance -> packageSign
```

Staging:

```text
stagingDeploy -> stagingArtifactVerify -> stagingSmoke -> stagingTelemetry
```

Production:

```text
Human Gate -> productionDeploy -> productionArtifactVerify
-> productionSmoke -> productionTelemetry
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
- production icin `insanOnayi`: kanit, onaylayan, release, artefakt, staging,
  ortam, guvenilir anahtar kimligi ve Ed25519 imzasini birlikte tasiyan nesne;
- crash recovery icin `recoveryOnayi`: kanit, onaylayan, release ve artefakt
  kimliklerine ek olarak ortam, devralinacak lock nesli, anahtar kimligi ve
  Ed25519 imzasini tasiyan nesne;
- `komutlar`: her sabit kapi adi icin executable ve argumanlardan olusan dizi.

Ornek komut bicimi `{"fullTest":["npm","test"]}` seklindedir. `&&`, pipe,
redirect veya command substitution yorumlanmaz. Platforma ozel gercek deploy,
smoke, telemetry ve rollback komutlari bu planda acikca verilmeden release
ilerlemez.

Human Gate trust store planin ve CLI argumanlarinin disindadir. Yolu Windows'ta
`C:\ProgramData\TupBayiProje\human-gate-keys.json`, Linux/macOS'ta
`/etc/tupbayiproje/human-gate-keys.json` olarak sabittir. Dosya deployment
yoneticisi tarafindan provision edilir; uygulama/operator hesabi yazamaz.
POSIX'te ust dizin ve dosya icin root sahipligi ile grup/dunya yazma izinleri
dogrulanir. Windows'ta hem dizin hem dosya DACL inheritance'i kapali olmali;
owner SYSTEM, Administrators veya TrustedInstaller olmali ve yalniz bu SID'ler
yazma/ACL/ownership hakki tasimalidir. ACL okunamaz veya belirsizse production
fail-closed kalir. JSON nesnesinde her anahtar kimligi icin
`onaylayanKimligi` ve `publicKeyPem` bulunur. Onay imzasi,
`humanGateImzaMetniOlustur` tarafindan uretilen kanonik UTF-8 metin uzerinden
Ed25519 ile uretilir. Plan icine public key koymak veya cagri sirasinda baska
trust store secmek yetki vermez.

## Guvenlik ve recovery

- Candidate, kaynak artefakti SHA-256 ile adreslenen salt-okunur bir snapshota
  kopyalar. Staging ve production yalniz bu snapshot yolunu kullanir; deploy
  oncesi ve sonrasi ozet tekrar hesaplanir.
- Ayni release kimligi farkli manifest veya komut planiyla tekrar kullanilamaz.
  Komut plani ozeti candidate kaydinin immutable parcasidir.
- Human Gate kayitlari append-only tutulur. Production onayi release, artefakt,
  staging kaniti, ortam ve onaylayan kimligine; recovery onayi ayrica stale lock
  nesline baglidir. Guvenilir trust anchor ile dogrulanmayan serbest metin veya
  self-asserted kimlik onay sayilmaz.
- Staging ve production ortamlari lease, heartbeat ve monoton fencing token
  iceren kalici deployment lock ile korunur. Fence ve idempotency degerleri dis
  hedef adaptoru sozlesmesinin parcasidir; suresi dolmus veya devralinmis bir
  calistirici ne release durumunu ne de hedef sistem etkisini ilerletebilir.
- Normal hata ve sinyalde lock `finally` ile birakilir. Ani process/host kaybinda
  lease dolana kadar akis fail-closed kalir. Sonrasinda yalniz `recoveryOnayi`
  bulunan `recovery` komutu stale lock'i devralip heartbeat altinda idempotent
  rollback calistirir. Her recovery denemesi ortam ve stale fence nesli bazinda
  ayri append-only onay olarak saklanir; ikinci bir crash yeni nesil onayiyla
  tekrar kurtarilabilir. DB elle degistirilmez. Rollback basarisizsa durum
  `INCIDENT_ACIK` olur.
- SQLite semasi transaction icinde `user_version=3` seviyesine yukseltilir.
  Eski release, audit ve lock kayitlari korunur; eski self-asserted Human Gate
  satirlari yetki vermeyen `human_gate_onaylari_legacy_v2` arsivine tasinir.
- Release audit update/delete trigger'lariyla immutable'dir; trace, correlation,
  Jira, commit, release ve artifact referanslari birlikte tutulur.
- Migration dry-run, backup/restore hazirligi, forward ve rollback planlari bos
  birakilamaz. Bunlarin gercek kaniti ilgili komutun basarili sonucudur.

Bu mekanizma production yetkisi vermez. Production komutunun calistirilmasi,
gecerli Human Gate kaniti ve yetkili operator girdisi gerektirir.
