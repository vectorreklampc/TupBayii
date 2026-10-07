namespace TupBayiProje.MimariTests;

internal enum Katman
{
    Domain,
    Uygulama,
    Altyapi,
    Sunum,
    Sozlesmeler,
    Ortak,
    Host,
    Modul,
}

internal enum VeritabaniSiniri
{
    Yok,
    Master,
    Tenant,
}

internal sealed record ProjeTanim(
    string Ad,
    string? Modul,
    Katman Katman,
    IReadOnlyCollection<string> ProjeReferanslari);

internal sealed record VeritabaniProjesiTanim(
    string Ad,
    VeritabaniSiniri Sinir,
    bool TenantBasinaFizikselVeritabani,
    IReadOnlyCollection<string> BaglamAdlari,
    IReadOnlyCollection<string>? KaliciVarlikAdlari = null);

internal static class MimariKuralMotoru
{
    private static readonly string[] TenantOperasyonVarlikKokleri =
    [
        "Musteri",
        "Urun",
        "Fiyat",
        "Satis",
        "Siparis",
        "Stok",
        "Cari",
        "Teslimat",
        "Depo",
    ];

    public static IReadOnlyList<string> ProjeBagimliliklariniDogrula(
        IEnumerable<ProjeTanim> projeler)
    {
        var projeListesi = projeler.ToArray();
        var adaGoreProjeler = projeListesi.ToDictionary(
            proje => proje.Ad,
            StringComparer.OrdinalIgnoreCase);
        var ihlaller = new List<string>();

        foreach (var proje in projeListesi)
        {
            foreach (var referansAdi in proje.ProjeReferanslari)
            {
                if (!adaGoreProjeler.TryGetValue(referansAdi, out var hedef))
                {
                    ihlaller.Add($"{proje.Ad}, cozumde bulunmayan {referansAdi} projesine referans veriyor.");
                    continue;
                }

                if (ModulSiniriIhlalEdiliyor(proje, hedef))
                {
                    ihlaller.Add($"{proje.Ad} -> {hedef.Ad} referansi modul sinirini ihlal ediyor.");
                    continue;
                }

                if (!KatmanReferansiUygun(proje, hedef))
                {
                    ihlaller.Add($"{proje.Ad} -> {hedef.Ad} referansi katman yonunu ihlal ediyor.");
                }
            }
        }

        return ihlaller;
    }

    public static IReadOnlyList<string> VeritabaniSinirlariniDogrula(
        IEnumerable<VeritabaniProjesiTanim> projeler)
    {
        var ihlaller = new List<string>();

        foreach (var proje in projeler)
        {
            if (proje.BaglamAdlari.Count == 0)
            {
                continue;
            }

            if (proje.Sinir is VeritabaniSiniri.Yok)
            {
                ihlaller.Add($"{proje.Ad}, veritabani baglami icerdigi halde acik bir veritabani siniri beyan etmiyor.");
                continue;
            }

            var masterBaglamiVar = proje.BaglamAdlari.Any(BirMasterBaglamiMi);
            var tenantBaglamiVar = proje.BaglamAdlari.Any(BirTenantBaglamiMi);

            if (masterBaglamiVar && tenantBaglamiVar)
            {
                ihlaller.Add($"{proje.Ad}, Master ve Tenant veritabani baglamlarini ayni proje sinirinda tutuyor.");
                continue;
            }

            if (proje.Sinir is VeritabaniSiniri.Master && !masterBaglamiVar)
            {
                ihlaller.Add($"{proje.Ad}, Master siniri icin *MasterVeritabaniBaglami adlandirmasini kullanmalidir.");
            }

            if (proje.Sinir is VeritabaniSiniri.Master)
            {
                foreach (var varlikAdi in proje.KaliciVarlikAdlari ?? [])
                {
                    if (TenantOperasyonVarlikKokleri.Any(kok =>
                        varlikAdi.StartsWith(kok, StringComparison.Ordinal)))
                    {
                        ihlaller.Add($"{proje.Ad}, {varlikAdi} tenant operasyon varligini Master DB sinirinda tutamaz.");
                    }
                }
            }

            if (proje.Sinir is VeritabaniSiniri.Tenant)
            {
                if (!tenantBaglamiVar)
                {
                    ihlaller.Add($"{proje.Ad}, Tenant siniri icin *TenantVeritabaniBaglami adlandirmasini kullanmalidir.");
                }

                if (!proje.TenantBasinaFizikselVeritabani)
                {
                    ihlaller.Add($"{proje.Ad}, tenant basina fiziksel veritabani kullandigini beyan etmelidir.");
                }
            }
        }

        return ihlaller;
    }

    private static bool ModulSiniriIhlalEdiliyor(ProjeTanim kaynak, ProjeTanim hedef)
    {
        if (kaynak.Modul is null || hedef.Modul is null)
        {
            return false;
        }

        return !StringComparer.OrdinalIgnoreCase.Equals(kaynak.Modul, hedef.Modul)
            && hedef.Katman is not Katman.Sozlesmeler;
    }

    private static bool KatmanReferansiUygun(ProjeTanim kaynak, ProjeTanim hedef) =>
        kaynak.Katman switch
        {
            Katman.Domain => hedef.Katman is Katman.Ortak,
            Katman.Uygulama => hedef.Katman is Katman.Domain or Katman.Sozlesmeler or Katman.Ortak,
            Katman.Altyapi => hedef.Katman is Katman.Domain or Katman.Uygulama or Katman.Sozlesmeler or Katman.Ortak,
            Katman.Sunum => hedef.Katman is Katman.Uygulama or Katman.Sozlesmeler or Katman.Ortak,
            Katman.Sozlesmeler => hedef.Katman is Katman.Ortak,
            Katman.Ortak => hedef.Katman is Katman.Ortak,
            Katman.Host => hedef.Katman is Katman.Sunum or Katman.Altyapi or Katman.Sozlesmeler or Katman.Ortak,
            Katman.Modul => hedef.Katman is not Katman.Host,
            _ => false,
        };

    private static bool BirMasterBaglamiMi(string ad) =>
        ad.EndsWith("MasterVeritabaniBaglami", StringComparison.Ordinal);

    private static bool BirTenantBaglamiMi(string ad) =>
        ad.EndsWith("TenantVeritabaniBaglami", StringComparison.Ordinal);
}
