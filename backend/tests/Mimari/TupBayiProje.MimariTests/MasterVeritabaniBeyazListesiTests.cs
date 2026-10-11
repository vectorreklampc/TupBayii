using Microsoft.EntityFrameworkCore;
using TupBayiProje.MimariTests.MasterFixture;
using Xunit;

namespace TupBayiProje.MimariTests;

// Test-only fixture: yalnizca whitelist ve negatif oracle mantigini kanitlar.
// Gercek MasterDbContext.Model uzerindeki whitelist testi TBP-59'a aittir; bu testler onun yerine gecmez.
public sealed class MasterVeritabaniBeyazListesiTests
{
    // TBP-59 gercek MasterDbContext testinde bu deger gercek Master entity tipleri olmalidir.
    private static readonly IReadOnlyList<Type> FixtureTipleri = WhitelistBaglami.BeklenenTipler;

    // Bagimsiz sozlesme: docs/mimari/Master-DB-Sema-Sozlesmesi.md section 1 tablosunun elle yazilmis kopyasi.
    // Kayitlar'dan uretilmez; entity, tablo, sahip domain veya SOT degisikligi bu testi kirar.
    private static readonly MasterVarlikKaydi[] SozlesmeKayitlari =
    [
        new("Kullanici", "kullanici", "Identity", "SOT-IDN-001"),
        new("KullaniciOturumu", "kullanici_oturumu", "Identity", "SOT-IDN-001"),
        new("Tenant", "tenant", "Tenancy", "SOT-TEN-001"),
        new("TenantVeritabani", "tenant_veritabani", "Tenancy", "SOT-TEN-001"),
        new("TenantMigrationSurumu", "tenant_migration_surumu", "Tenancy", "SOT-TEN-001"),
        new("TenantProvisioningIsi", "tenant_provisioning_isi", "Tenancy", "SOT-PRV-001"),
        new("TenantMigrationIsi", "tenant_migration_isi", "Tenancy", "SOT-PRV-001"),
        new("Abonelik", "abonelik", "Licensing", "SOT-LIC-001"),
        new("Lisans", "lisans", "Licensing", "SOT-LIC-001"),
        new("Cihaz", "cihaz", "Licensing", "SOT-DEV-001"),
        new("OdemeNiyeti", "odeme_niyeti", "Billing", "SOT-BIL-001"),
        new("OdemeDenemesi", "odeme_denemesi", "Billing", "SOT-BIL-001"),
        new("OdemeSaglayiciOlayi", "odeme_saglayici_olayi", "Billing", "SOT-BIL-001"),
        new("DenetimKaydi", "denetim_kaydi", "Audit", "SOT-AUD-001"),
    ];

    [Fact]
    public void Kayitlar_SozlesmedekiOndortKaydaBirebirEsittir() =>
        Assert.Equal(SozlesmeKayitlari, MasterVeritabaniBeyazListesi.Kayitlar);

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
    public void ModeliDogrula_WhitelistEntityMasterDisiSemaya_IhlalUretir() =>
        TekIhlalBekle(new YanlisSemaBaglami(), "public");

    [Fact]
    public void ModeliDogrula_WhitelistEntityIkinciTabloyaBolunurse_IhlalUretir()
    {
        using var baglam = new TabloBolmeBaglami();

        // Entity splitting birincil tablo adini degistirmez; ek tablo yalniz tablo eslemelerinde gorunur.
        Assert.Equal("tenant", baglam.Model.FindEntityType(typeof(Tenant))!.GetTableName());
        var ihlal = Assert.Single(MasterVeritabaniBeyazListesi.ModeliDogrula(baglam.Model, FixtureTipleri));
        Assert.Contains("tenant_ek", ihlal, StringComparison.Ordinal);
    }

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
}
