using TupBayiProje.Gozlemlenebilirlik;

namespace TupBayiProje.Moduller.Tenancy.Uygulama;

public sealed class TenantBaglamCozumleyici(
    ITenantKaydiOkuyucu tenantKaydiOkuyucu,
    IAuditKaydiYazici auditKaydiYazici,
    TimeProvider zamanSaglayici)
{
    public async ValueTask<TenantBaglamCozumlemeSonucu> CozAsync(
        DogrulanmisKimlik? kimlik,
        IzBaglami izBaglami,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(izBaglami);

        if (kimlik is null)
        {
            const string hataKodu = "TENANT_KIMLIGI_DOGRULANMADI";
            await AuditEtAsync(null, null, izBaglami, hataKodu, cancellationToken);
            return TenantBaglamCozumlemeSonucu.Ret(hataKodu);
        }

        var tenantKaydi = await tenantKaydiOkuyucu.KimlikIcinBulAsync(kimlik, cancellationToken);
        if (tenantKaydi is null)
        {
            const string hataKodu = "TENANT_BAGLAMI_COZULEMEDI";
            await AuditEtAsync(kimlik, null, izBaglami, hataKodu, cancellationToken);
            return TenantBaglamCozumlemeSonucu.Ret(hataKodu);
        }

        if (string.IsNullOrWhiteSpace(tenantKaydi.TenantKimligi) ||
            string.IsNullOrWhiteSpace(tenantKaydi.BaglantiReferansi))
        {
            const string hataKodu = "TENANT_KAYDI_GECERSIZ";
            await AuditEtAsync(kimlik, null, izBaglami, hataKodu, cancellationToken);
            return TenantBaglamCozumlemeSonucu.Ret(hataKodu);
        }

        if (tenantKaydi.Durum is not TenantDurumu.Aktif)
        {
            const string hataKodu = "TENANT_YASAM_DONGUSU_UYGUN_DEGIL";
            await AuditEtAsync(kimlik, tenantKaydi.TenantKimligi, izBaglami, hataKodu, cancellationToken);
            return TenantBaglamCozumlemeSonucu.Ret(hataKodu);
        }

        var baglam = new TenantBaglami(
            tenantKaydi.TenantKimligi,
            tenantKaydi.BaglantiReferansi,
            kimlik.KullaniciKimligi);
        await AuditEtAsync(
            kimlik,
            baglam.TenantKimligi,
            izBaglami,
            "TENANT_BAGLAMI_COZULDU",
            cancellationToken);
        return TenantBaglamCozumlemeSonucu.Kabul(baglam);
    }

    private ValueTask AuditEtAsync(
        DogrulanmisKimlik? kimlik,
        string? tenantKimligi,
        IzBaglami izBaglami,
        string sonucKodu,
        CancellationToken cancellationToken) =>
        auditKaydiYazici.EkleAsync(
            new AuditKaydi(
                "tenant_baglami_cozumleme",
                kimlik?.KullaniciKimligi,
                tenantKimligi,
                zamanSaglayici.GetUtcNow(),
                izBaglami.TraceKimligi,
                izBaglami.KorelasyonKimligi,
                sonucKodu),
            cancellationToken);
}
