namespace TupBayiProje.Moduller.Tenancy.Domain;

// SOT-TEN-001: bir tenant'in fiziksel veritabani kaydi. Her tenant'in en fazla bir kaydi olur.
public sealed class TenantVeritabani
{
    private TenantVeritabani(Guid id, Guid tenantId)
    {
        Id = id;
        TenantId = tenantId;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public static TenantVeritabani Olustur(Guid tenantId)
    {
        if (tenantId == Guid.Empty)
        {
            throw new ArgumentException("Tenant kimligi bos olamaz.", nameof(tenantId));
        }

        return new(Guid.CreateVersion7(), tenantId);
    }
}
