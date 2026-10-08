using TupBayiProje.Gozlemlenebilirlik;
using TupBayiProje.Moduller.Inventory.Domain;
using TupBayiProje.Moduller.Inventory.Sozlesmeler;
using TupBayiProje.Moduller.Inventory.Sunum;
using TupBayiProje.Moduller.Inventory.Uygulama;
using Xunit;

namespace TupBayiProje.Inventory.BirimTests;

public sealed class StokHareketiApiTests
{
    [Fact]
    public async Task KaydetFullVeVehicleDegerleriniDomainSozlesmesineDonusturur()
    {
        var depo = new KaydiYakalayanDepo();
        var kaydedici = new StokHareketiKaydedici(
            depo,
            new BellekAuditYazici(),
            TimeProvider.System);
        var api = new StokHareketiApi(kaydedici);
        var istek = new StokHareketiKaydetIstegi(
            "hareket-1",
            "idem-1",
            "urun-1",
            "FULL",
            "WAREHOUSE",
            "depo-1",
            "VEHICLE",
            "arac-1",
            1);

        var yanit = await api.KaydetAsync(
            istek,
            StokIslemBaglami.Olustur("tenant-1", "kullanici-1"),
            IzBaglami.Olustur("trace-1", "corr-1"));

        Assert.True(yanit.Basarili);
        Assert.Equal(TupDurumu.Dolu, depo.Hareket?.Durum);
        Assert.Equal(StokLokasyonTuru.Depo, depo.Hareket?.Kaynak.Tur);
        Assert.Equal(StokLokasyonTuru.Arac, depo.Hareket?.Hedef.Tur);
    }

    [Fact]
    public async Task KaydetBilinmeyenWireDegerindeDepoyaGitmedenReddeder()
    {
        var depo = new KaydiYakalayanDepo();
        var api = new StokHareketiApi(new StokHareketiKaydedici(
            depo,
            new BellekAuditYazici(),
            TimeProvider.System));
        var istek = new StokHareketiKaydetIstegi(
            "hareket-1",
            "idem-1",
            "urun-1",
            "UNKNOWN",
            "WAREHOUSE",
            "depo-1",
            "VEHICLE",
            "arac-1",
            1);

        var yanit = await api.KaydetAsync(
            istek,
            StokIslemBaglami.Olustur("tenant-1", "kullanici-1"),
            IzBaglami.Olustur("trace-2", "corr-2"));

        Assert.False(yanit.Basarili);
        Assert.Equal("TUP_DURUMU_GECERSIZ", yanit.HataKodu);
        Assert.Null(depo.Hareket);
    }

    [Fact]
    public void IstekSozlesmesiClientTenantKimligiTasiyamaz()
    {
        Assert.DoesNotContain(
            typeof(StokHareketiKaydetIstegi).GetProperties(),
            property => property.Name.Contains("Tenant", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void StokIslemBaglamiModulDisindanUretilemez()
    {
        Assert.Empty(typeof(StokIslemBaglami).GetConstructors());
        Assert.DoesNotContain(
            typeof(StokIslemBaglami).GetMethods(),
            method => method.IsPublic && method.IsStatic && method.ReturnType == typeof(StokIslemBaglami));
    }

    private sealed class KaydiYakalayanDepo : IStokHareketiDeposu
    {
        public StokHareketi? Hareket { get; private set; }

        public ValueTask<StokHareketiDepoSonucu> AtomikKaydetAsync(
            StokIslemBaglami baglam,
            string idempotencyAnahtari,
            StokHareketi hareket,
            CancellationToken cancellationToken = default)
        {
            Hareket = hareket;
            return ValueTask.FromResult(StokHareketiDepoSonucu.Kaydedildi);
        }
    }
}
