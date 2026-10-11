using TupBayiProje.Moduller.Tenancy.Sozlesmeler;

namespace TupBayiProje.Moduller.Audit.Altyapi;

public sealed class DenetimKarari
{
    internal DenetimKarari(
        KararKimligi kararKimligi,
        CorrelationKimligi correlationKimligi,
        DogrulanmisTenantBaglami tenantBaglami,
        string islem,
        string sonuc,
        string? gerekceKodu)
    {
        KararKimligi = kararKimligi;
        CorrelationKimligi = correlationKimligi;
        TenantBaglami = tenantBaglami;
        Islem = islem;
        Sonuc = sonuc;
        GerekceKodu = gerekceKodu;
    }

    public KararKimligi KararKimligi { get; }

    public CorrelationKimligi CorrelationKimligi { get; }

    public DogrulanmisTenantBaglami TenantBaglami { get; }

    public string Islem { get; }

    public string Sonuc { get; }

    public string? GerekceKodu { get; }
}

// InternalsVisibleTo allowlist'i bu fabrikayi yalniz host composition root ve test oracle'ina acar.
internal static class DenetimKarariFabrikasi
{
    internal static DenetimKarari IzinKarariOlustur(DogrulanmisTenantBaglami tenantBaglami)
    {
        ArgumentNullException.ThrowIfNull(tenantBaglami);
        return new(
            new KararKimligi(Guid.CreateVersion7()),
            new CorrelationKimligi(Guid.CreateVersion7()),
            tenantBaglami,
            "TENANT_SECRET_OKUMA_KARARI",
            "IZIN_VERILDI",
            null);
    }

    internal static DenetimKarari ReddetKarariOlustur(
        DogrulanmisTenantBaglami tenantBaglami,
        string gerekceKodu)
    {
        ArgumentNullException.ThrowIfNull(tenantBaglami);
        if (gerekceKodu is not (
            "ERISIM_REDDEDILDI" or
            "METADATA_GECERSIZ" or
            "SECRET_BULUNAMADI" or
            "SECRET_SAGLAYICI_ERISILEMIYOR"))
        {
            throw new ArgumentOutOfRangeException(nameof(gerekceKodu));
        }

        return new(
            new KararKimligi(Guid.CreateVersion7()),
            new CorrelationKimligi(Guid.CreateVersion7()),
            tenantBaglami,
            "TENANT_SECRET_OKUMA_KARARI",
            "REDDEDILDI",
            gerekceKodu);
    }
}
