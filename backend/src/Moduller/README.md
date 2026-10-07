# Moduller

Her backend domain modulu kendi dikey diliminde ve proje sinirlarinda yer
alir:

```text
<ModulAdi>/
|-- Domain/
|   `-- TupBayiProje.Moduller.<ModulAdi>.Domain.csproj
|-- Uygulama/
|   `-- TupBayiProje.Moduller.<ModulAdi>.Uygulama.csproj
|-- Altyapi/
|   `-- TupBayiProje.Moduller.<ModulAdi>.Altyapi.csproj
`-- Sunum/
    `-- TupBayiProje.Moduller.<ModulAdi>.Sunum.csproj
```

Modul adlari kanonik domain ownership kaydiyla ayni anlami tasir ve Turkce
anlamli ASCII identifier kurallarina uyar. Bir modul baska bir modulun ic
tiplerine, tablolarina veya `DbContext` nesnesine dogrudan baglanamaz.

Modul ici bagimlilik yonu:

```text
Sunum -> Uygulama
Altyapi -> Uygulama -> Domain
```

`Domain` baska katmana baglanmaz. `Uygulama`, altyapi implementasyonuna
baglanmaz. Moduller arasi kullanim yalniz acik contract uzerinden yapilir.

Business modulleri ilgili Jira isi gelmeden bu dizinde onceden olusturulmaz.
