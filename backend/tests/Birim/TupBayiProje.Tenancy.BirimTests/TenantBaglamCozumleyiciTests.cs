using TupBayiProje.Gozlemlenebilirlik;
using TupBayiProje.Moduller.Tenancy.Uygulama;
using Xunit;

namespace TupBayiProje.Tenancy.BirimTests;

public sealed class TenantBaglamCozumleyiciTests
{
    [Fact]
    public void GuvenSiniriTipleriDisaridanUretilemez()
    {
        Assert.DoesNotContain(
            typeof(DogrulanmisKimlik).GetMethods(),
            method => method.IsStatic && method.ReturnType == typeof(DogrulanmisKimlik));
        Assert.Empty(typeof(TenantBaglami).GetConstructors());
    }

    [Fact]
    public async Task DogrulanmisKimlikYoksaFailClosedReddeder()
    {
        var kayitlar = new SahteTenantKaydiOkuyucu();
        var audit = new BellekAuditYazici();
        var cozumleyici = new TenantBaglamCozumleyici(kayitlar, audit, TimeProvider.System);

        var sonuc = await cozumleyici.CozAsync(null, IzBaglami.Olustur("trace-1", "corr-1"));

        Assert.False(sonuc.Basarili);
        Assert.Equal("TENANT_KIMLIGI_DOGRULANMADI", sonuc.HataKodu);
        Assert.Null(sonuc.Baglam);
        Assert.Equal(0, kayitlar.OkumaSayisi);
        Assert.Contains(audit.Kayitlar, kayit =>
            kayit.OlayAdi == "tenant_baglami_cozumleme" &&
            kayit.SonucKodu == "TENANT_KIMLIGI_DOGRULANMADI" &&
            kayit.TenantKimligi is null);
    }

    [Fact]
    public async Task ServerKaydiAktifseTenantBaglaminiUretir()
    {
        var kimlik = DogrulanmisKimlik.Olustur("kullanici-1", "oturum-1");
        var kayitlar = new SahteTenantKaydiOkuyucu(
            new TenantKaydi("tenant-server", "baglanti-ref-1", TenantDurumu.Aktif));
        var audit = new BellekAuditYazici();
        var cozumleyici = new TenantBaglamCozumleyici(kayitlar, audit, TimeProvider.System);

        var sonuc = await cozumleyici.CozAsync(kimlik, IzBaglami.Olustur("trace-2", "corr-2"));

        Assert.True(sonuc.Basarili);
        Assert.Equal("tenant-server", sonuc.Baglam?.TenantKimligi);
        Assert.Equal("baglanti-ref-1", sonuc.Baglam?.BaglantiReferansi);
        Assert.Contains(audit.Kayitlar, kayit =>
            kayit.SonucKodu == "TENANT_BAGLAMI_COZULDU" &&
            kayit.TenantKimligi == "tenant-server" &&
            kayit.KorelasyonKimligi == "corr-2");
    }

    [Fact]
    public async Task TenantAktifDegilseBaglamUretmez()
    {
        var kimlik = DogrulanmisKimlik.Olustur("kullanici-1", "oturum-1");
        var kayitlar = new SahteTenantKaydiOkuyucu(
            new TenantKaydi("tenant-1", "baglanti-ref-1", TenantDurumu.Askida));
        var cozumleyici = new TenantBaglamCozumleyici(
            kayitlar,
            new BellekAuditYazici(),
            TimeProvider.System);

        var sonuc = await cozumleyici.CozAsync(kimlik, IzBaglami.Olustur("trace-3", "corr-3"));

        Assert.False(sonuc.Basarili);
        Assert.Equal("TENANT_YASAM_DONGUSU_UYGUN_DEGIL", sonuc.HataKodu);
        Assert.Null(sonuc.Baglam);
    }

    [Fact]
    public async Task ServerKaydiEksikseFailClosedReddeder()
    {
        var kimlik = DogrulanmisKimlik.Olustur("kullanici-1", "oturum-1");
        var kayitlar = new SahteTenantKaydiOkuyucu(
            new TenantKaydi("", "baglanti-ref-1", TenantDurumu.Aktif));
        var cozumleyici = new TenantBaglamCozumleyici(
            kayitlar,
            new BellekAuditYazici(),
            TimeProvider.System);

        var sonuc = await cozumleyici.CozAsync(kimlik, IzBaglami.Olustur("trace-4", "corr-4"));

        Assert.False(sonuc.Basarili);
        Assert.Equal("TENANT_KAYDI_GECERSIZ", sonuc.HataKodu);
        Assert.Null(sonuc.Baglam);
    }

    private sealed class SahteTenantKaydiOkuyucu(TenantKaydi? kayit = null) : ITenantKaydiOkuyucu
    {
        public int OkumaSayisi { get; private set; }

        public ValueTask<TenantKaydi?> KimlikIcinBulAsync(
            DogrulanmisKimlik kimlik,
            CancellationToken cancellationToken = default)
        {
            OkumaSayisi++;
            return ValueTask.FromResult(kayit);
        }
    }
}
