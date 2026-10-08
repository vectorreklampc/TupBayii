using TupBayiProje.Gozlemlenebilirlik;
using TupBayiProje.Moduller.Inventory.Domain;
using TupBayiProje.Moduller.Inventory.Uygulama;
using Xunit;

namespace TupBayiProje.Inventory.BirimTests;

public sealed class StokHareketiKaydediciTests
{
    [Fact]
    public async Task KaydetAtomikDepoBasariliysaHareketiVeAuditiOlusturur()
    {
        var depo = new SahteStokHareketiDeposu(StokHareketiDepoSonucu.Kaydedildi);
        var audit = new BellekAuditYazici();
        var kaydedici = new StokHareketiKaydedici(depo, audit, TimeProvider.System);
        var baglam = StokIslemBaglami.Olustur("tenant-1", "kullanici-1");

        var sonuc = await kaydedici.KaydetAsync(
            GecerliKomut(),
            baglam,
            IzBaglami.Olustur("trace-1", "corr-1"));

        Assert.True(sonuc.Basarili);
        Assert.False(sonuc.Tekrar);
        Assert.Null(sonuc.HataKodu);
        Assert.Equal("hareket-1", depo.SonHareket?.HareketKimligi);
        Assert.Equal("tenant-1", depo.SonBaglam?.TenantKimligi);
        Assert.Contains(audit.Kayitlar, kayit =>
            kayit.OlayAdi == "stok_hareketi_kaydetme" &&
            kayit.SonucKodu == "STOK_HAREKETI_KAYDEDILDI" &&
            kayit.TenantKimligi == "tenant-1" &&
            kayit.KorelasyonKimligi == "corr-1");
    }

    [Fact]
    public async Task KaydetAyniIdempotentSonucuIkinciEtkiOlmadanDondurur()
    {
        var depo = new SahteStokHareketiDeposu(StokHareketiDepoSonucu.Tekrar);
        var kaydedici = new StokHareketiKaydedici(
            depo,
            new BellekAuditYazici(),
            TimeProvider.System);

        var sonuc = await kaydedici.KaydetAsync(
            GecerliKomut(),
            StokIslemBaglami.Olustur("tenant-1", "kullanici-1"),
            IzBaglami.Olustur("trace-2", "corr-2"));

        Assert.True(sonuc.Basarili);
        Assert.True(sonuc.Tekrar);
        Assert.Equal(1, depo.KaydetmeSayisi);
    }

    [Fact]
    public async Task KaydetAyniAnahtarFarkliIstekteConflictUretir()
    {
        var depo = new SahteStokHareketiDeposu(StokHareketiDepoSonucu.IdempotencyConflict);
        var kaydedici = new StokHareketiKaydedici(
            depo,
            new BellekAuditYazici(),
            TimeProvider.System);

        var sonuc = await kaydedici.KaydetAsync(
            GecerliKomut(),
            StokIslemBaglami.Olustur("tenant-1", "kullanici-1"),
            IzBaglami.Olustur("trace-3", "corr-3"));

        Assert.False(sonuc.Basarili);
        Assert.Equal("STOK_HAREKETI_IDEMPOTENCY_CONFLICT", sonuc.HataKodu);
    }

    private static StokHareketiKaydetKomutu GecerliKomut() =>
        new(
            "hareket-1",
            "idem-1",
            "urun-1",
            TupDurumu.Dolu,
            StokLokasyonTuru.Depo,
            "depo-1",
            StokLokasyonTuru.Arac,
            "arac-1",
            1);

    private sealed class SahteStokHareketiDeposu(StokHareketiDepoSonucu sonuc)
        : IStokHareketiDeposu
    {
        public int KaydetmeSayisi { get; private set; }

        public StokIslemBaglami? SonBaglam { get; private set; }

        public StokHareketi? SonHareket { get; private set; }

        public ValueTask<StokHareketiDepoSonucu> AtomikKaydetAsync(
            StokIslemBaglami baglam,
            string idempotencyAnahtari,
            StokHareketi hareket,
            CancellationToken cancellationToken = default)
        {
            KaydetmeSayisi++;
            SonBaglam = baglam;
            SonHareket = hareket;
            return ValueTask.FromResult(sonuc);
        }
    }
}
