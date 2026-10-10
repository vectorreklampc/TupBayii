namespace TupBayiProje.Moduller.Tenancy.Altyapi;

public sealed class TenantVeritabaniDataSourceOnbellegiSecenekleri
{
    public TenantVeritabaniDataSourceOnbellegiSecenekleri(
        int kapasite,
        TimeSpan yasamSuresi,
        TimeSpan bosKalmaSuresi,
        TimeSpan temizlemeAraligi,
        TimeSpan baglantiDogrulamaZamanAsimi)
    {
        if (kapasite <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(kapasite), "Kapasite sifirdan buyuk olmalidir.");
        }

        PozitifSureDogrula(yasamSuresi, nameof(yasamSuresi));
        PozitifSureDogrula(bosKalmaSuresi, nameof(bosKalmaSuresi));
        PozitifSureDogrula(temizlemeAraligi, nameof(temizlemeAraligi));
        PozitifSureDogrula(baglantiDogrulamaZamanAsimi, nameof(baglantiDogrulamaZamanAsimi));

        Kapasite = kapasite;
        YasamSuresi = yasamSuresi;
        BosKalmaSuresi = bosKalmaSuresi;
        TemizlemeAraligi = temizlemeAraligi;
        BaglantiDogrulamaZamanAsimi = baglantiDogrulamaZamanAsimi;
    }

    public int Kapasite { get; }

    public TimeSpan YasamSuresi { get; }

    public TimeSpan BosKalmaSuresi { get; }

    public TimeSpan TemizlemeAraligi { get; }

    public TimeSpan BaglantiDogrulamaZamanAsimi { get; }

    private static void PozitifSureDogrula(TimeSpan sure, string parametreAdi)
    {
        if (sure <= TimeSpan.Zero)
        {
            throw new ArgumentOutOfRangeException(parametreAdi, "Sure sifirdan buyuk olmalidir.");
        }
    }
}
