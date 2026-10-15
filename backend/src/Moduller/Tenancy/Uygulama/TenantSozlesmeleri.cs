namespace TupBayiProje.Moduller.Tenancy.Uygulama;

public enum TenantDurumu
{
    Aktif,
    Askida,
    Kapali,
}

public sealed record DogrulanmisKimlik
{
    private DogrulanmisKimlik(string kullaniciKimligi, string oturumKimligi)
    {
        KullaniciKimligi = kullaniciKimligi;
        OturumKimligi = oturumKimligi;
    }

    public string KullaniciKimligi { get; }

    public string OturumKimligi { get; }

    internal static DogrulanmisKimlik Olustur(string kullaniciKimligi, string oturumKimligi) =>
        new(
            ZorunluKimlik(kullaniciKimligi, nameof(kullaniciKimligi)),
            ZorunluKimlik(oturumKimligi, nameof(oturumKimligi)));

    private static string ZorunluKimlik(string deger, string parametreAdi)
    {
        if (string.IsNullOrWhiteSpace(deger))
        {
            throw new ArgumentException("Dogrulanmis kimlik alani bos olamaz.", parametreAdi);
        }

        return deger;
    }
}

public sealed record TenantKaydi(
    string TenantKimligi,
    string BaglantiReferansi,
    TenantDurumu Durum);

public sealed class TenantBaglami
{
    internal TenantBaglami(
        string tenantKimligi,
        string baglantiReferansi,
        string eyleyenKimligi)
    {
        TenantKimligi = tenantKimligi;
        BaglantiReferansi = baglantiReferansi;
        EyleyenKimligi = eyleyenKimligi;
    }

    public string TenantKimligi { get; }

    public string BaglantiReferansi { get; }

    public string EyleyenKimligi { get; }
}

public sealed record TenantBaglamCozumlemeSonucu(
    bool Basarili,
    TenantBaglami? Baglam,
    string? HataKodu)
{
    public static TenantBaglamCozumlemeSonucu Kabul(TenantBaglami baglam) =>
        new(true, baglam, null);

    public static TenantBaglamCozumlemeSonucu Ret(string hataKodu) =>
        new(false, null, hataKodu);
}

public interface ITenantKaydiOkuyucu
{
    ValueTask<TenantKaydi?> KimlikIcinBulAsync(
        DogrulanmisKimlik kimlik,
        CancellationToken cancellationToken = default);
}
