using TupBayiProje.Moduller.Tenancy.Domain;

namespace TupBayiProje.Moduller.Audit.Altyapi;

public sealed class DenetimKarari
{
    internal DenetimKarari(
        KararKimligi kararKimligi,
        CorrelationKimligi correlationKimligi,
        DogrulanmisTenantBaglami tenantBaglami)
    {
        KararKimligi = kararKimligi;
        CorrelationKimligi = correlationKimligi;
        TenantBaglami = tenantBaglami;
    }

    public KararKimligi KararKimligi { get; }

    public CorrelationKimligi CorrelationKimligi { get; }

    public DogrulanmisTenantBaglami TenantBaglami { get; }
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
            tenantBaglami);
    }
}
