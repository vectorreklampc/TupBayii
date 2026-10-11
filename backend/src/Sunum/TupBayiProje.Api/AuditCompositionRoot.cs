using TupBayiProje.Moduller.Audit.Altyapi;
using TupBayiProje.Moduller.Tenancy.Altyapi;
using TupBayiProje.Moduller.Tenancy.Sozlesmeler;

namespace TupBayiProje.Api;

// Dis endpoint degildir. Host, sabit Audit runtime credential'i ile Tenancy kaynakli baglami birlestirir.
internal static class AuditCompositionRoot
{
    internal static async Task<DenetimYazmaSonucu> SentetikIzinKarariYazAsync(
        string masterBaglantiDizesi,
        string auditRuntimeBaglantiDizesi,
        CancellationToken cancellationToken = default)
    {
        DogrulanmisTenantBaglami tenantBaglami;
        try
        {
            tenantBaglami = await SentetikTenantBaglamiSaglayici.CozAsync(
                masterBaglantiDizesi,
                cancellationToken);
        }
        catch
        {
            // Baglam dogrulanamadi: ham provider/baglanti hatasi caller'a tasinmaz; yazim yapilmadan fail-closed.
            // Caller iptali de DenetimYazici ile ayni sekilde istisna degil guvenli sonuc olarak doner.
            return DenetimYazmaSonucu.BelirsizGuvenliHata;
        }

        return await IzinKarariYazAsync(tenantBaglami, auditRuntimeBaglantiDizesi, cancellationToken);
    }

    // Yazim yollari yalniz Tenancy saglayicisinin urettigi opak baglami kabul eder; raw tenant kimligi almaz.
    internal static Task<DenetimYazmaSonucu> IzinKarariYazAsync(
        DogrulanmisTenantBaglami tenantBaglami,
        string auditRuntimeBaglantiDizesi,
        CancellationToken cancellationToken = default) =>
        new DenetimYazici(auditRuntimeBaglantiDizesi).YazAsync(
            DenetimKarariFabrikasi.IzinKarariOlustur(tenantBaglami),
            cancellationToken);

    // Gerekce kodu allowlist'ini DenetimKarariFabrikasi dogrular.
    internal static Task<DenetimYazmaSonucu> ReddetKarariYazAsync(
        DogrulanmisTenantBaglami tenantBaglami,
        string auditRuntimeBaglantiDizesi,
        string gerekceKodu,
        CancellationToken cancellationToken = default) =>
        new DenetimYazici(auditRuntimeBaglantiDizesi).YazAsync(
            DenetimKarariFabrikasi.ReddetKarariOlustur(tenantBaglami, gerekceKodu),
            cancellationToken);
}
