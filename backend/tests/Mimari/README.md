# Mimari Testler

`TupBayiProje.MimariTests`, `backend/src` altindaki uretim projelerini dosya
sistemi ve `ProjectReference` grafigi uzerinden otomatik tarar. Tarama hedef
bulamazsa basarili sayilmaz.

## Zorunlu sinirlar

- Modul tek bir `.csproj` icinde veya katman basina ayri `.csproj` ile
  kurulabilir. Her iki yapida da kod `Domain`, `Uygulama`, `Altyapi`, `Sunum`
  ve `Sozlesmeler` dizinlerinden biriyle acikca sinirlanir.
- Katman tipi `TupBayiProje.Moduller.<Modul>.<Katman>` namespace kokunu
  kullanir. Bu kok, ayni assembly icindeki yasak katman referanslarinin da
  otomatik bulunmasini saglar.
- Bir modul baska modulun yalniz `Sozlesmeler` projesine referans verebilir;
  ic `Domain`, `Uygulama`, `Altyapi` ve `Sunum` projeleri yasaktir.
- Katman yonu `Domain -> Ortak`, `Uygulama -> Domain`,
  `Altyapi -> Uygulama/Domain` ve `Sunum -> Uygulama` seklindedir.
  `Sozlesmeler` ve domainsiz `Ortak` teknik yapilar izin verilen hedeflere
  eklenebilir.
- `DbContext` veya `*VeritabaniBaglami` tanimlayan proje, asagidaki veritabani
  siniri metadata'sini beyan eder.

Tenant veritabani projesi:

```xml
<PropertyGroup>
  <TupBayiVeritabaniSiniri>Tenant</TupBayiVeritabaniSiniri>
  <TupBayiTenantBasinaFizikselVeritabani>true</TupBayiTenantBasinaFizikselVeritabani>
</PropertyGroup>
```

Master DB projesi:

```xml
<PropertyGroup>
  <TupBayiVeritabaniSiniri>Master</TupBayiVeritabaniSiniri>
</PropertyGroup>
```

Master ve Tenant baglamlari ayni projede bulunamaz. Baglam adlari sirasiyla
`*MasterVeritabaniBaglami` ve `*TenantVeritabaniBaglami` son ekini kullanir.
Master baglamindaki `DbSet<T>` ve `Entity<T>` kayitlari da SOT'taki sinira
gore taranir; `Musteri`, `Urun`, `Fiyat`, `Satis`, `Siparis`, `Stok`, `Cari`,
`Teslimat` ve `Depo` koklu tenant operasyon varliklari reddedilir.

## Calistirma

```powershell
dotnet test .\TupBayiProje.slnx
```

Kural motorunun negatif fixture testleri, her kural ailesinin ihlalli bir
ornegi gercekten reddettigini kanitlar. Gercek depo testi de ayni motoru
`backend/src` uzerinde calistirir.
