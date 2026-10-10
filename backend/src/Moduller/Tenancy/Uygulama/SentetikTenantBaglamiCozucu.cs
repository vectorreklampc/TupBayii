using TupBayiProje.Moduller.Tenancy.Domain;
using TupBayiProje.Moduller.Tenancy.Sozlesmeler;

namespace TupBayiProje.Moduller.Tenancy.Uygulama;

public static class SentetikTenantBaglamiCozucu
{
    public static DogrulanmisTenantBaglami YeniTenantIcinCoz() => Coz(Tenant.Olustur());

    public static DogrulanmisTenantBaglami Coz(Tenant tenant)
    {
        ArgumentNullException.ThrowIfNull(tenant);
        return new DogrulanmisTenantBaglami(tenant.Id);
    }
}
