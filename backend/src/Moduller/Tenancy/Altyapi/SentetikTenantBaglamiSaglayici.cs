using Microsoft.EntityFrameworkCore;
using TupBayiProje.Moduller.Tenancy.Domain;
using TupBayiProje.Moduller.Tenancy.Sozlesmeler;
using TupBayiProje.Moduller.Tenancy.Uygulama;

namespace TupBayiProje.Moduller.Tenancy.Altyapi;

public static class SentetikTenantBaglamiSaglayici
{
    public static async Task<DogrulanmisTenantBaglami> CozAsync(
        string masterBaglantiDizesi,
        CancellationToken cancellationToken = default)
    {
        var secenekler = new DbContextOptionsBuilder<MasterVeritabaniBaglami>()
            .UseNpgsql(masterBaglantiDizesi)
            .Options;
        await using var baglam = new MasterVeritabaniBaglami(secenekler);
        var tenant = await baglam.Set<Tenant>()
            .AsNoTracking()
            .SingleAsync(cancellationToken);
        return SentetikTenantBaglamiCozucu.Coz(tenant);
    }
}
