using TupBayiProje.Moduller.Tenancy.Domain;
using TupBayiProje.Moduller.Tenancy.Sozlesmeler;

namespace TupBayiProje.Moduller.Tenancy.Uygulama;

// Public dogrulanmis yol DB destekli SentetikTenantBaglamiSaglayici.CozAsync'tir; bu cozucu
// in-memory Tenant'i dogrulanmis baglama cevirebildigi icin yalniz InternalsVisibleTo allowlist'ine aciktir.
internal static class SentetikTenantBaglamiCozucu
{
    internal static DogrulanmisTenantBaglami Coz(Tenant tenant)
    {
        ArgumentNullException.ThrowIfNull(tenant);
        return new DogrulanmisTenantBaglami(tenant.Id);
    }
}
