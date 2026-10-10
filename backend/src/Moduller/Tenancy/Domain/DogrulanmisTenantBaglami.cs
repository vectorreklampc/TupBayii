namespace TupBayiProje.Moduller.Tenancy.Domain;

// Yalniz gercek Tenant nesnesinden uretilir; raw Guid, istemci beyanini guvenilir baglama ceviremez.
public sealed class DogrulanmisTenantBaglami
{
    private DogrulanmisTenantBaglami(Guid tenantId) => TenantId = tenantId;

    public Guid TenantId { get; }

    public static DogrulanmisTenantBaglami TenanttenOlustur(Tenant tenant)
    {
        ArgumentNullException.ThrowIfNull(tenant);
        return new(tenant.Id);
    }
}
