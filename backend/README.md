# Backend

Bu dizin TupBayiProje backend solution'i icin kanonik koktur.

## Teknoloji Temeli

- .NET SDK 10
- ASP.NET Core 10
- EF Core 10
- Modular monolith

SDK secimi [`global.json`](global.json), ortak derleme kurallari
[`Directory.Build.props`](Directory.Build.props), NuGet paket surumleri ise
[`Directory.Packages.props`](Directory.Packages.props) ile merkezi olarak
yonetilir.

## Dizin Yapisi

```text
backend/
|-- TupBayiProje.slnx
|-- src/
|   |-- Sunum/
|   |   `-- TupBayiProje.Api/
|   |-- Moduller/
|   `-- Ortak/
`-- tests/
    |-- Birim/
    |-- Entegrasyon/
    `-- Mimari/
```

`Sunum/TupBayiProje.Api` yalnizca composition root ve HTTP host
sorumlulugunu tasir. Business kurali, domain state'i veya veri sahipligi bu
projeye eklenmez.

Her domain modulu `src/Moduller/<ModulAdi>/` altinda, en az bir ayri
proje siniriyla olusturulur:

```text
<ModulAdi>/
|-- Domain/
|-- Uygulama/
|-- Altyapi/
`-- Sunum/
```

Bu katmanlar yalniz modulun ic organizasyonudur; baska modullere public
contract disinda acilmaz. Moduller:

- baska bir modulun ic implementasyonuna veya veri katmanina proje referansi
  vermez,
- domainler arasi iletisimi tanimli command, query veya event contract'i
  uzerinden yapar,
- kendi business state ve veri erisim sorumlulugunu kendi siniri icinde tutar,
- yalniz gercekten ortak ve domainsiz teknik yapilari `src/Ortak` uzerinden
  paylasir.

Bu sinirlarin otomatik architecture testleri `TBP-20` kapsamindadir.

## Komutlar

```powershell
dotnet restore .\TupBayiProje.slnx
dotnet build .\TupBayiProje.slnx --no-restore
dotnet run --project .\src\Sunum\TupBayiProje.Api
```

Linux ve macOS ortamlarinda ayni yollar `/` ayiraciyla kullanilir.

Bu iskelet business feature, domain modulu, veritabani modeli, migration,
OpenAPI contract'i veya gecici ornek endpoint icermez.
