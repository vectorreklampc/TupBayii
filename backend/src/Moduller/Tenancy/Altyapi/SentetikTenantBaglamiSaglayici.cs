using Microsoft.EntityFrameworkCore;
using TupBayiProje.Moduller.Tenancy.Domain;
using TupBayiProje.Moduller.Tenancy.Sozlesmeler;
using TupBayiProje.Moduller.Tenancy.Uygulama;

namespace TupBayiProje.Moduller.Tenancy.Altyapi;

// Dogrulanmis tenant baglaminin tek public kaynagi Master veritabanidir; secim icin raw tenant kimligi alinmaz.
public static class SentetikTenantBaglamiSaglayici
{
    public static async Task<DogrulanmisTenantBaglami> CozAsync(
        string masterBaglantiDizesi,
        CancellationToken cancellationToken = default)
    {
        await using var baglam = BaglamOlustur(masterBaglantiDizesi);
        var tenant = await baglam.Set<Tenant>()
            .AsNoTracking()
            .SingleAsync(cancellationToken);
        return SentetikTenantBaglamiCozucu.Coz(tenant);
    }

    // Yerel P04 host'u icin Master'daki tum sentetik tenant'lari Master'in uuid sirasiyla cozer.
    // Tenant yoksa bos liste yerine hata verir: host baglamsiz devam edemez.
    public static async Task<IReadOnlyList<DogrulanmisTenantBaglami>> TumunuCozAsync(
        string masterBaglantiDizesi,
        CancellationToken cancellationToken = default)
    {
        await using var baglam = BaglamOlustur(masterBaglantiDizesi);
        var tenantlar = await baglam.Set<Tenant>()
            .AsNoTracking()
            .OrderBy(tenant => tenant.Id)
            .ToListAsync(cancellationToken);
        if (tenantlar.Count == 0)
        {
            throw new InvalidOperationException("Sentetik tenant bulunamadi.");
        }

        return [.. tenantlar.Select(SentetikTenantBaglamiCozucu.Coz)];
    }

    private static MasterVeritabaniBaglami BaglamOlustur(string masterBaglantiDizesi) =>
        new(new DbContextOptionsBuilder<MasterVeritabaniBaglami>()
            .UseNpgsql(masterBaglantiDizesi)
            .Options);
}
