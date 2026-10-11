# Infrastructure

Bu dizin yerel ve uzak ortam altyapisi tanimlari icin kanonik koktur.

## Yerel Docker gelistirme ortami

`local/compose.yaml`, yerel gelistirme icin su servisleri calistirir:

- PostgreSQL: dogrudan erisim icin `localhost:5432`
- PgBouncer: uygulama baglantilari icin `localhost:6432`
- Redis: `localhost:6379`

PgBouncer `transaction` pooling modunda calisir. Uygulama Npgsql pooling'i acik
tutuyorsa baglanti dizesinde `No Reset On Close=true` kullanilmalidir. Protocol
prepared statement destegi `PGBOUNCER_MAX_PREPARED_STATEMENTS` ile aciktir.
Migration, veritabani olusturma ve PgBouncer yonetim islemleri `localhost:5432`
uzerinden dogrudan PostgreSQL'e baglanir; uygulama trafigi bu hatti kullanmaz.

Portlar yalnizca loopback arayuzune acilir. PostgreSQL ve Redis verileri named
volume'larda korunur.

Ilk calistirmadan once ornek yapilandirmayi kopyalayin ve iki bos parola alanini
guclu, yalnizca yerelde kullanilan degerlerle doldurun:

```powershell
Copy-Item infrastructure/local/.env.example infrastructure/local/.env
docker compose --env-file infrastructure/local/.env -f infrastructure/local/compose.yaml up -d --wait
```

Servislerin durumunu goruntulemek icin:

```powershell
docker compose --env-file infrastructure/local/.env -f infrastructure/local/compose.yaml ps
```

Ortami durdurmak icin:

```powershell
docker compose --env-file infrastructure/local/.env -f infrastructure/local/compose.yaml down
```

Verileri de silmek ancak acikca temiz bir yerel ortam istendiginde `down --volumes`
ile yapilmalidir.

`.env` dosyasi Git tarafindan izlenmez. Secret degerleri bu dizinde, Compose
taniminda, komut ciktisinda veya Git gecmisinde tutulamaz. Uzak ortam altyapisi ve
tenant veritabani yasam dongusu bu yerel temelin kapsami disindadir.

PgBouncer uyumluluk PoC'sini calistirmak icin Docker ayaktayken:

```powershell
dotnet test backend/tests/Entegrasyon/TupBayiProje.EntegrasyonTests/TupBayiProje.EntegrasyonTests.csproj --filter FullyQualifiedName~PgBouncerUyumlulukTests
```

Testler Docker yoksa atlanmaz. Kurulum hatasi, uyumluluk kanitinin uretilemedigini
gosteren bir test hatasi olarak raporlanir.
