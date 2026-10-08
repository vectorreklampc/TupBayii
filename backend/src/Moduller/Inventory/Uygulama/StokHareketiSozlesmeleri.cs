using TupBayiProje.Moduller.Inventory.Domain;

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
