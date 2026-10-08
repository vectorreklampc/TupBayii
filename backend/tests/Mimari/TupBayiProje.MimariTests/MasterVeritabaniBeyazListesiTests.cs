using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using TupBayiProje.MimariTests.MasterFixture;
using Xunit;

namespace TupBayiProje.MimariTests;

// Test-only fixture: yalnizca whitelist ve negatif oracle mantigini kanitlar.
// Gercek MasterDbContext.Model uzerindeki whitelist testi TBP-59'a aittir; bu testler onun yerine gecmez.
public sealed partial class MasterVeritabaniBeyazListesiTests
{
    // TBP-59 gercek MasterDbContext testinde bu deger gercek Master entity tipleri olmalidir.
    private static readonly IReadOnlyList<Type> FixtureTipleri = WhitelistBaglami.BeklenenTipler;

    [Fact]
    public void Kayitlar_KapaliListeOndortEntityVeTekilAdTabloIcerir()
    {
        var kayitlar = MasterVeritabaniBeyazListesi.Kayitlar;
        string[] sotKimlikleri = ["SOT-IDN-001", "SOT-TEN-001", "SOT-PRV-001", "SOT-LIC-001", "SOT-DEV-001", "SOT-BIL-001", "SOT-AUD-001"];

        Assert.Equal(14, kayitlar.Count);
        Assert.Equal(kayitlar.Count, kayitlar.Select(kayit => kayit.VarlikAdi).Distinct(StringComparer.Ordinal).Count());
        Assert.Equal(kayitlar.Count, kayitlar.Select(kayit => kayit.TabloAdi).Distinct(StringComparer.Ordinal).Count());
        Assert.All(kayitlar, kayit =>
        {
            Assert.Contains(kayit.SotKimligi, sotKimlikleri);
            Assert.Matches(TabloAdiDeseni(), kayit.TabloAdi);
        });
    }

    [Fact]
    public void ModeliDogrula_YalnizWhitelistEntityleri_IhlalUretmez()
    {
        using var baglam = new WhitelistBaglami();

        Assert.Equal(14, baglam.Model.GetEntityTypes().Count());
        Assert.Empty(MasterVeritabaniBeyazListesi.ModeliDogrula(baglam.Model, FixtureTipleri));
    }

    [Fact]
    public void ModeliDogrula_BilinmeyenEntity_IhlalUretir() =>
        TekIhlalBekle(new BilinmeyenEntityBaglami(), nameof(Bilinmeyen));

    [Fact]
    public void ModeliDogrula_YasakMusteriEntity_IhlalUretir() =>
        TekIhlalBekle(new MusteriBaglami(), nameof(Musteri));

    [Fact]
    public void ModeliDogrula_YasakTedarikciEntity_IhlalUretir() =>
        TekIhlalBekle(new TedarikciBaglami(), nameof(Tedarikci));

    [Fact]
    public void ModeliDogrula_ErkenBackupEntity_IhlalUretir() =>
        TekIhlalBekle(new BackupBaglami(), nameof(TenantYedekIsi));

    [Fact]
    public void ModeliDogrula_OwnedTip_IhlalUretir() =>
        TekIhlalBekle(new OwnedTipBaglami(), nameof(KullaniciProfili));

    [Fact]
    public void ModeliDogrula_ManyToManyJoinTipi_IhlalUretir() =>
        TekIhlalBekle(new JoinTipiBaglami(), "KullaniciTenant");

    [Fact]
    public void ModeliDogrula_WhitelistEntitySinirDisiTabloya_IhlalUretir() =>
        TekIhlalBekle(new YanlisTabloBaglami(), "tenants");

    [Fact]
    public void ModeliDogrula_AyniKisaAdliYabanciNamespaceTipi_IhlalUretir()
    {
        using var baglam = new YabanciNamespaceBaglami();

        Assert.Equal(14, baglam.Model.GetEntityTypes().Count());
        var ihlal = Assert.Single(MasterVeritabaniBeyazListesi.ModeliDogrula(baglam.Model, FixtureTipleri));
        Assert.Contains(typeof(TupBayiProje.MimariTests.MasterFixture.Yabanci.Kullanici).FullName!, ihlal, StringComparison.Ordinal);
    }

    [Fact]
    public void ModeliDogrula_AyniAdVeNamespaceliYabanciAssemblyTipiIzinliTipinYerineGecerse_IhlalUretir()
    {
        using var baglam = new YabanciAssemblyBaglami();
        var yabanciTip = YabanciAssembly.Kullanici;

        Assert.Equal(typeof(Kullanici).FullName, yabanciTip.FullName);
        Assert.NotEqual(typeof(Kullanici).Assembly, yabanciTip.Assembly);
        Assert.Equal(14, baglam.Model.GetEntityTypes().Count());
        // EF tam ada gore arar: izinli Kullanici adi altinda modelde yabanci assembly tipi durur.
        var varlik = baglam.Model.FindEntityType(typeof(Kullanici))!;
        Assert.Same(yabanciTip, varlik.ClrType);
        Assert.Equal("kullanici", varlik.GetTableName());

        var ihlal = Assert.Single(MasterVeritabaniBeyazListesi.ModeliDogrula(baglam.Model, FixtureTipleri));
        Assert.Contains(YabanciAssembly.AssemblyAdi, ihlal, StringComparison.Ordinal);
    }

    [Fact]
    public void ModeliDogrula_WhitelistDisiBeklenenTip_ReddEdilir()
    {
        using var baglam = new MusteriBaglami();

        Assert.Throws<ArgumentException>(() =>
            MasterVeritabaniBeyazListesi.ModeliDogrula(baglam.Model, [.. FixtureTipleri, typeof(Musteri)]));
    }

    [Fact]
    public void ModeliDogrula_AyniWhitelistKaydinaIkinciBeklenenTip_ReddEdilir()
    {
        using var baglam = new YabanciAssemblyBaglami();

        Assert.Throws<ArgumentException>(() =>
            MasterVeritabaniBeyazListesi.ModeliDogrula(baglam.Model, [.. FixtureTipleri, YabanciAssembly.Kullanici]));
    }

    private static void TekIhlalBekle(DbContext baglam, string beklenenIfade)
    {
        using (baglam)
        {
            var ihlal = Assert.Single(MasterVeritabaniBeyazListesi.ModeliDogrula(baglam.Model, FixtureTipleri));
            Assert.Contains(beklenenIfade, ihlal, StringComparison.Ordinal);
        }
    }

    [GeneratedRegex("^[a-z]+(_[a-z]+)*$")]
    private static partial Regex TabloAdiDeseni();
}
