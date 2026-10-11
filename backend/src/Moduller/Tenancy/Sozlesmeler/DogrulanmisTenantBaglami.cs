namespace TupBayiProje.Moduller.Tenancy.Sozlesmeler;

// Raw Guid constructor yoktur; yalniz Tenancy uygulama resolver'i guvenilir baglam uretebilir.
public sealed class DogrulanmisTenantBaglami
{
    internal DogrulanmisTenantBaglami(Guid tenantId) => TenantId = tenantId;

    public Guid TenantId { get; }
}
