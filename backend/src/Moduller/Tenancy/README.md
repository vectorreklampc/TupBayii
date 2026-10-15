# Tenant baglanti seed referansi (`TBP-234`)

Bu seed, `INV-TEN-003`, `INV-TEN-004`, `INV-AUD-001` ve `INV-AUD-003`
icin insan kontrollu code-shape referansidir.

Akis:

```text
Dogrulanmis identity
  -> TenantBaglamCozumleyici
  -> server-side ITenantKaydiOkuyucu
  -> TenantBaglami (tenant + opaque baglanti referansi)
  -> TenantBaglantiAcici
  -> server-side ITenantBaglantiBilgisiOkuyucu
  -> bounded TenantBaglantiKapsami
```

Client `TenantId`, header, query veya body bu contract'a girdi degildir.
Baglanti metni yalniz altyapi sinirinda kullanilir; result, exception veya audit
kaydina tasinmaz. Kapsam acik baglantiyi `CloseAsync` ve `DisposeAsync` ile
kapatir. Cache/pool boyutu veya eviction politikasi bu seed'de icat edilmez;
bunlar `TBP-63` olcumu ve karariyla belirlenir.

Audit kayitlari sabit alanli `AuditKaydi` contract'ini kullanir. Secret, token,
connection string ve serbest request body audit contract'inda yer almaz.

Kanit:

```powershell
dotnet test .\tests\Birim\TupBayiProje.Tenancy.BirimTests\TupBayiProje.Tenancy.BirimTests.csproj
dotnet test .\TupBayiProje.slnx
```
