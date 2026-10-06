using System.Data;
using System.Data.Common;
using System.Diagnostics.CodeAnalysis;
using TupBayiProje.Gozlemlenebilirlik;
using TupBayiProje.Moduller.Tenancy.Altyapi;
using TupBayiProje.Moduller.Tenancy.Uygulama;
using Xunit;

namespace TupBayiProje.Tenancy.BirimTests;

public sealed class TenantBaglantiAciciTests
{
    [Fact]
    public async Task MetadataReferansiBaglamlaUyusmazsaBaglantiAcmaz()
    {
        var baglam = await CozulmusBaglamOlusturAsync("tenant-1", "beklenen-ref");
        var audit = new BellekAuditYazici();
        var baglantiUretildi = false;
        var acici = new TenantBaglantiAcici(
            new SahteBaglantiBilgisiOkuyucu(
                new TenantBaglantiBilgisi("baska-ref", "Host=gizli")),
            baglantiMetni =>
            {
                baglantiUretildi = true;
                return new SahteDbConnection(baglantiMetni);
            },
            audit,
            TimeProvider.System);

        var hata = await Assert.ThrowsAsync<TenantBaglantiHatasi>(async () =>
            await acici.AcAsync(
                baglam,
                IzBaglami.Olustur("trace-1", "corr-1")));

        Assert.Equal("TENANT_BAGLANTI_REFERANSI_UYUSMUYOR", hata.Kod);
        Assert.False(baglantiUretildi);
        Assert.Contains(audit.Kayitlar, kayit =>
            kayit.SonucKodu == "TENANT_BAGLANTI_REFERANSI_UYUSMUYOR");
    }

    [Fact]
    public async Task ServerMetadataBaglantisiniAcarVeKapsamBitinceKapatir()
    {
        var baglam = await CozulmusBaglamOlusturAsync("tenant-1", "baglanti-ref-1");
        const string gizliBaglantiMetni = "Host=sahte;Database=tenant";
        var audit = new BellekAuditYazici();
        SahteDbConnection? uretilenBaglanti = null;
        var acici = new TenantBaglantiAcici(
            new SahteBaglantiBilgisiOkuyucu(
                new TenantBaglantiBilgisi("baglanti-ref-1", gizliBaglantiMetni)),
            baglantiMetni => uretilenBaglanti = new SahteDbConnection(baglantiMetni),
            audit,
            TimeProvider.System);

        await using (var kapsam = await acici.AcAsync(
            baglam,
            IzBaglami.Olustur("trace-2", "corr-2")))
        {
            Assert.Same(uretilenBaglanti, kapsam.Baglanti);
            Assert.Equal(ConnectionState.Open, kapsam.Baglanti.State);
        }

        Assert.Equal(ConnectionState.Closed, uretilenBaglanti?.State);
        Assert.DoesNotContain(
            audit.Kayitlar,
            kayit => kayit.ToString().Contains(gizliBaglantiMetni, StringComparison.Ordinal));
        Assert.Contains(audit.Kayitlar, kayit =>
            kayit.SonucKodu == "TENANT_BAGLANTISI_ACILDI" &&
            kayit.TenantKimligi == "tenant-1");
    }

    [Fact]
    public async Task BaglantiMetniBosIseBaglantiUretmez()
    {
        var baglam = await CozulmusBaglamOlusturAsync("tenant-1", "baglanti-ref-1");
        var baglantiUretildi = false;
        var acici = new TenantBaglantiAcici(
            new SahteBaglantiBilgisiOkuyucu(
                new TenantBaglantiBilgisi("baglanti-ref-1", " ")),
            baglantiMetni =>
            {
                baglantiUretildi = true;
                return new SahteDbConnection(baglantiMetni);
            },
            new BellekAuditYazici(),
            TimeProvider.System);

        var hata = await Assert.ThrowsAsync<TenantBaglantiHatasi>(async () =>
            await acici.AcAsync(
                baglam,
                IzBaglami.Olustur("trace-3", "corr-3")));

        Assert.Equal("TENANT_BAGLANTI_BILGISI_GECERSIZ", hata.Kod);
        Assert.False(baglantiUretildi);
    }

    [Fact]
    public async Task ProviderAcmaHatasiGuvenliKodlaAuditEdilirVeBaglantiTemizlenir()
    {
        var baglam = await CozulmusBaglamOlusturAsync("tenant-1", "baglanti-ref-1");
        var audit = new BellekAuditYazici();
        var providerHatasi = new InvalidOperationException("Host=sahte;Password=sizdi");
        SahteDbConnection? uretilenBaglanti = null;
        var acici = new TenantBaglantiAcici(
            new SahteBaglantiBilgisiOkuyucu(
                new TenantBaglantiBilgisi("baglanti-ref-1", "Host=sahte")),
            baglantiMetni => uretilenBaglanti = new SahteDbConnection(baglantiMetni, providerHatasi),
            audit,
            TimeProvider.System);

        var hata = await Assert.ThrowsAsync<TenantBaglantiHatasi>(async () =>
            await acici.AcAsync(
                baglam,
                IzBaglami.Olustur("trace-4", "corr-4")));

        Assert.Equal("TENANT_BAGLANTISI_ACILAMADI", hata.Kod);
        Assert.DoesNotContain("Password", hata.ToString(), StringComparison.OrdinalIgnoreCase);
        Assert.True(uretilenBaglanti?.DisposeEdildi);
        Assert.Contains(audit.Kayitlar, kayit =>
            kayit.SonucKodu == "TENANT_BAGLANTISI_ACILAMADI" &&
            kayit.KorelasyonKimligi == "corr-4");
    }

    [Fact]
    public void BaglantiBilgisiGozlemlenebilirMetindeSirriGizler()
    {
        var bilgi = new TenantBaglantiBilgisi(
            "baglanti-ref-1",
            "Host=sahte;Password=sizmasin");

        Assert.DoesNotContain("Password", bilgi.ToString(), StringComparison.OrdinalIgnoreCase);
        Assert.Contains("[GIZLENDI]", bilgi.ToString(), StringComparison.Ordinal);
    }

    private static async Task<TenantBaglami> CozulmusBaglamOlusturAsync(
        string tenantKimligi,
        string baglantiReferansi)
    {
        var cozumleyici = new TenantBaglamCozumleyici(
            new SahteTenantKaydiOkuyucu(
                new TenantKaydi(tenantKimligi, baglantiReferansi, TenantDurumu.Aktif)),
            new BellekAuditYazici(),
            TimeProvider.System);
        var sonuc = await cozumleyici.CozAsync(
            DogrulanmisKimlik.Olustur("kullanici-1", "oturum-1"),
            IzBaglami.Olustur("trace-baglam", "corr-baglam"));

        Assert.True(sonuc.Basarili);
        return Assert.IsType<TenantBaglami>(sonuc.Baglam);
    }

    private sealed class SahteBaglantiBilgisiOkuyucu(TenantBaglantiBilgisi bilgi)
        : ITenantBaglantiBilgisiOkuyucu
    {
        public ValueTask<TenantBaglantiBilgisi?> BaglantiIcinBulAsync(
            TenantBaglami baglam,
            CancellationToken cancellationToken = default) =>
            ValueTask.FromResult<TenantBaglantiBilgisi?>(bilgi);
    }

    private sealed class SahteTenantKaydiOkuyucu(TenantKaydi kayit) : ITenantKaydiOkuyucu
    {
        public ValueTask<TenantKaydi?> KimlikIcinBulAsync(
            DogrulanmisKimlik kimlik,
            CancellationToken cancellationToken = default) =>
            ValueTask.FromResult<TenantKaydi?>(kayit);
    }

    private sealed class SahteDbConnection(
        string connectionString,
        Exception? acmaHatasi = null) : DbConnection
    {
        private ConnectionState durum = ConnectionState.Closed;

        [AllowNull]
        public override string ConnectionString { get; set; } = connectionString;

        public override string Database => "tenant";

        public override string DataSource => "sahte";

        public override string ServerVersion => "1";

        public override ConnectionState State => durum;

        public bool DisposeEdildi { get; private set; }

        public override void ChangeDatabase(string databaseName) =>
            throw new NotSupportedException();

        public override void Close() => durum = ConnectionState.Closed;

        public override void Open()
        {
            if (acmaHatasi is not null)
            {
                throw acmaHatasi;
            }

            durum = ConnectionState.Open;
        }

        protected override void Dispose(bool disposing)
        {
            DisposeEdildi = true;
            durum = ConnectionState.Closed;
            base.Dispose(disposing);
        }

        protected override DbTransaction BeginDbTransaction(IsolationLevel isolationLevel) =>
            throw new NotSupportedException();

        protected override DbCommand CreateDbCommand() =>
            throw new NotSupportedException();
    }
}
