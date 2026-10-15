using TupBayiProje.Moduller.Inventory.Domain;
using TupBayiProje.Moduller.Inventory.Sozlesmeler;

namespace TupBayiProje.Moduller.Inventory.Uygulama;

public sealed record StokIslemBaglami
{
    private StokIslemBaglami(string tenantKimligi, string eyleyenKimligi)
    {
        TenantKimligi = tenantKimligi;
        EyleyenKimligi = eyleyenKimligi;
    }

    public string TenantKimligi { get; }

    public string EyleyenKimligi { get; }

    internal static StokIslemBaglami Olustur(string tenantKimligi, string eyleyenKimligi) =>
        new(
            ZorunluKimlik(tenantKimligi, nameof(tenantKimligi)),
            ZorunluKimlik(eyleyenKimligi, nameof(eyleyenKimligi)));

    private static string ZorunluKimlik(string deger, string parametreAdi)
    {
        if (string.IsNullOrWhiteSpace(deger))
        {
            throw new ArgumentException("Stok islem baglami alani bos olamaz.", parametreAdi);
        }

        return deger;
    }
}

public sealed record StokHareketiKaydetKomutu(
    string HareketKimligi,
    string IdempotencyAnahtari,
    string UrunKimligi,
    TupDurumu Durum,
    StokLokasyonTuru KaynakTuru,
    string KaynakKimligi,
    StokLokasyonTuru HedefTuru,
    string HedefKimligi,
    int Miktar);

public enum StokHareketiDepoSonucu
{
    Kaydedildi,
    Tekrar,
    IdempotencyConflict,
    HareketKimligiConflict,
    KaynakStokYetersiz,
}

public sealed record StokHareketiKaydetSonucu(
    bool Basarili,
    bool Tekrar,
    string HareketKimligi,
    string? HataKodu);

public interface IStokHareketiDeposu
{
    ValueTask<StokHareketiDepoSonucu> AtomikKaydetAsync(
        StokIslemBaglami baglam,
        string idempotencyAnahtari,
        StokHareketi hareket,
        CancellationToken cancellationToken = default);
}

public static class StokHareketiKomutCozumleyici
{
    public static StokHareketiKaydetKomutu Coz(StokHareketiKaydetIstegi istek)
    {
        ArgumentNullException.ThrowIfNull(istek);

        return new StokHareketiKaydetKomutu(
            istek.HareketKimligi,
            istek.IdempotencyAnahtari,
            istek.UrunKimligi,
            TupDurumunuCoz(istek.TupDurumu),
            LokasyonTurunuCoz(istek.KaynakTuru),
            istek.KaynakKimligi,
            LokasyonTurunuCoz(istek.HedefTuru),
            istek.HedefKimligi,
            istek.Miktar);
    }

    private static TupDurumu TupDurumunuCoz(string deger) => deger switch
    {
        "FULL" => TupDurumu.Dolu,
        "EMPTY" => TupDurumu.Bos,
        _ => (TupDurumu)(-1),
    };

    private static StokLokasyonTuru LokasyonTurunuCoz(string deger) => deger switch
    {
        "WAREHOUSE" => StokLokasyonTuru.Depo,
        "VEHICLE" => StokLokasyonTuru.Arac,
        "CUSTOMER" => StokLokasyonTuru.Musteri,
        _ => (StokLokasyonTuru)(-1),
    };
}
