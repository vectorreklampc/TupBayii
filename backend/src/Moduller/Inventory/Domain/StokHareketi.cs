namespace TupBayiProje.Moduller.Inventory.Domain;

public enum TupDurumu
{
    Dolu,
    Bos,
}

public enum StokLokasyonTuru
{
    Depo,
    Arac,
    Musteri,
}

public sealed class StokHareketiKuraliHatasi(string kod)
    : InvalidOperationException("Stok hareketi kurali ihlal edildi.")
{
    public string Kod { get; } = kod;
}

public sealed record StokLokasyonu
{
    private StokLokasyonu(StokLokasyonTuru tur, string kimlik)
    {
        Tur = tur;
        Kimlik = kimlik;
    }

    public StokLokasyonTuru Tur { get; }

    public string Kimlik { get; }

    public static StokLokasyonu Olustur(StokLokasyonTuru tur, string kimlik)
    {
        if (!Enum.IsDefined(tur))
        {
            throw new StokHareketiKuraliHatasi("STOK_LOKASYONU_TURU_GECERSIZ");
        }

        if (string.IsNullOrWhiteSpace(kimlik))
        {
            throw new StokHareketiKuraliHatasi("STOK_LOKASYONU_KIMLIGI_GECERSIZ");
        }

        return new StokLokasyonu(tur, kimlik);
    }
}

public sealed class StokHareketi
{
    private StokHareketi(
        string hareketKimligi,
        string urunKimligi,
        TupDurumu durum,
        StokLokasyonu kaynak,
        StokLokasyonu hedef,
        int miktar,
        DateTimeOffset olusturulmaZamani)
    {
        HareketKimligi = hareketKimligi;
        UrunKimligi = urunKimligi;
        Durum = durum;
        Kaynak = kaynak;
        Hedef = hedef;
        Miktar = miktar;
        OlusturulmaZamani = olusturulmaZamani;
    }

    public string HareketKimligi { get; }

    public string UrunKimligi { get; }

    public TupDurumu Durum { get; }

    public StokLokasyonu Kaynak { get; }

    public StokLokasyonu Hedef { get; }

    public int Miktar { get; }

    public DateTimeOffset OlusturulmaZamani { get; }

    public static StokHareketi Olustur(
        string hareketKimligi,
        string urunKimligi,
        TupDurumu durum,
        StokLokasyonu kaynak,
        StokLokasyonu hedef,
        int miktar,
        DateTimeOffset olusturulmaZamani)
    {
        if (string.IsNullOrWhiteSpace(hareketKimligi))
        {
            throw new StokHareketiKuraliHatasi("STOK_HAREKETI_KIMLIGI_GECERSIZ");
        }

        if (string.IsNullOrWhiteSpace(urunKimligi))
        {
            throw new StokHareketiKuraliHatasi("STOK_URUNU_KIMLIGI_GECERSIZ");
        }

        if (!Enum.IsDefined(durum))
        {
            throw new StokHareketiKuraliHatasi("TUP_DURUMU_GECERSIZ");
        }

        ArgumentNullException.ThrowIfNull(kaynak);
        ArgumentNullException.ThrowIfNull(hedef);

        if (kaynak == hedef)
        {
            throw new StokHareketiKuraliHatasi("STOK_HAREKETI_LOKASYONLARI_AYNI");
        }

        if (miktar <= 0)
        {
            throw new StokHareketiKuraliHatasi("STOK_HAREKETI_MIKTARI_GECERSIZ");
        }

        return new StokHareketi(
            hareketKimligi,
            urunKimligi,
            durum,
            kaynak,
            hedef,
            miktar,
            olusturulmaZamani);
    }
}
