using TupBayiProje.Moduller.Audit.Altyapi;
using TupBayiProje.Moduller.Tenancy.Altyapi;

namespace TupBayiProje.Api;

// Dis endpoint degildir. Host, sabit Audit runtime credential'i ile Tenancy kaynakli baglami birlestirir.
internal static class AuditCompositionRoot
{
    internal static async Task<DenetimYazmaSonucu> SentetikIzinKarariYazAsync(
        string masterBaglantiDizesi,
        string auditRuntimeBaglantiDizesi,
        CancellationToken cancellationToken = default)
    {
        var tenantBaglami = await SentetikTenantBaglamiSaglayici.CozAsync(
            masterBaglantiDizesi,
            cancellationToken);
        var karar = DenetimKarariFabrikasi.IzinKarariOlustur(tenantBaglami);
        var yazici = new DenetimYazici(auditRuntimeBaglantiDizesi);
        return await yazici.YazAsync(karar, cancellationToken);
    }
}
