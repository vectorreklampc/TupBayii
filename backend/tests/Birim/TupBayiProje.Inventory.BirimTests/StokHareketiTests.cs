using System.Globalization;
using TupBayiProje.Moduller.Inventory.Domain;
using Xunit;

namespace TupBayiProje.Inventory.BirimTests;

public sealed class StokHareketiTests
{
    [Fact]
    public void OlusturGecerliTransferdeDegistirilemezHareketUretir()
    {
        var kaynak = StokLokasyonu.Olustur(StokLokasyonTuru.Depo, "depo-1");
        var hedef = StokLokasyonu.Olustur(StokLokasyonTuru.Arac, "arac-1");

        var hareket = StokHareketi.Olustur(
            "hareket-1",
            "urun-1",
            TupDurumu.Dolu,
            kaynak,
            hedef,
            2,
            DateTimeOffset.Parse("2026-10-08T10:00:00+03:00", CultureInfo.InvariantCulture));

        Assert.Equal("hareket-1", hareket.HareketKimligi);
        Assert.Equal("urun-1", hareket.UrunKimligi);
        Assert.Equal(TupDurumu.Dolu, hareket.Durum);
        Assert.Equal(kaynak, hareket.Kaynak);
        Assert.Equal(hedef, hareket.Hedef);
        Assert.Equal(2, hareket.Miktar);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void OlusturPozitifOlmayanMiktariReddeder(int miktar)
    {
        var kaynak = StokLokasyonu.Olustur(StokLokasyonTuru.Depo, "depo-1");
        var hedef = StokLokasyonu.Olustur(StokLokasyonTuru.Musteri, "musteri-1");

        var hata = Assert.Throws<StokHareketiKuraliHatasi>(() => StokHareketi.Olustur(
            "hareket-1",
            "urun-1",
            TupDurumu.Bos,
            kaynak,
            hedef,
            miktar,
            DateTimeOffset.UtcNow));

        Assert.Equal("STOK_HAREKETI_MIKTARI_GECERSIZ", hata.Kod);
    }

    [Fact]
    public void OlusturAyniKaynakVeHedefiReddeder()
    {
        var depo = StokLokasyonu.Olustur(StokLokasyonTuru.Depo, "depo-1");

        var hata = Assert.Throws<StokHareketiKuraliHatasi>(() => StokHareketi.Olustur(
            "hareket-1",
            "urun-1",
            TupDurumu.Dolu,
            depo,
            depo,
            1,
            DateTimeOffset.UtcNow));

        Assert.Equal("STOK_HAREKETI_LOKASYONLARI_AYNI", hata.Kod);
    }

    [Fact]
    public void LokasyonOlusturBosKimligiReddeder()
    {
        var hata = Assert.Throws<StokHareketiKuraliHatasi>(() =>
            StokLokasyonu.Olustur(StokLokasyonTuru.Depo, " "));

        Assert.Equal("STOK_LOKASYONU_KIMLIGI_GECERSIZ", hata.Kod);
    }
}
