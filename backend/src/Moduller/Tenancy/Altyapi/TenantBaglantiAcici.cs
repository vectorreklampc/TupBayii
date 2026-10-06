using System.Data.Common;
using TupBayiProje.Gozlemlenebilirlik;
using TupBayiProje.Moduller.Tenancy.Uygulama;

namespace TupBayiProje.Moduller.Tenancy.Altyapi;

public sealed class TenantBaglantiAcici(
    ITenantBaglantiBilgisiOkuyucu baglantiBilgisiOkuyucu,
    Func<string, DbConnection> baglantiUretici,
    IAuditKaydiYazici auditKaydiYazici,
    TimeProvider zamanSaglayici)
{
    public async ValueTask<TenantBaglantiKapsami> AcAsync(
        TenantBaglami baglam,
        IzBaglami izBaglami,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(baglam);
        ArgumentNullException.ThrowIfNull(izBaglami);

        var baglantiBilgisi = await baglantiBilgisiOkuyucu.BaglantiIcinBulAsync(
            baglam,
            cancellationToken);
        if (baglantiBilgisi is null)
        {
            await AuditEtAsync(
                baglam,
                izBaglami,
                "TENANT_BAGLANTI_BILGISI_BULUNAMADI",
                cancellationToken);
            throw new TenantBaglantiHatasi("TENANT_BAGLANTI_BILGISI_BULUNAMADI");
        }

        if (!StringComparer.Ordinal.Equals(
                baglantiBilgisi.BaglantiReferansi,
                baglam.BaglantiReferansi))
        {
            await AuditEtAsync(
                baglam,
                izBaglami,
                "TENANT_BAGLANTI_REFERANSI_UYUSMUYOR",
                cancellationToken);
            throw new TenantBaglantiHatasi("TENANT_BAGLANTI_REFERANSI_UYUSMUYOR");
        }

        if (string.IsNullOrWhiteSpace(baglantiBilgisi.BaglantiMetni))
        {
            await AuditEtAsync(
                baglam,
                izBaglami,
                "TENANT_BAGLANTI_BILGISI_GECERSIZ",
                cancellationToken);
            throw new TenantBaglantiHatasi("TENANT_BAGLANTI_BILGISI_GECERSIZ");
        }

        DbConnection? baglanti = null;
        try
        {
            baglanti = baglantiUretici(baglantiBilgisi.BaglantiMetni);
            await baglanti.OpenAsync(cancellationToken);
            await AuditEtAsync(
                baglam,
                izBaglami,
                "TENANT_BAGLANTISI_ACILDI",
                cancellationToken);
            return new TenantBaglantiKapsami(baglanti);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            await GuvenleKapatAsync(baglanti);
            await AuditEtAsync(
                baglam,
                izBaglami,
                "TENANT_BAGLANTISI_IPTAL_EDILDI",
                CancellationToken.None);

            throw;
        }
        catch
        {
            await GuvenleKapatAsync(baglanti);
            await AuditEtAsync(
                baglam,
                izBaglami,
                "TENANT_BAGLANTISI_ACILAMADI",
                CancellationToken.None);
            throw new TenantBaglantiHatasi("TENANT_BAGLANTISI_ACILAMADI");
        }
    }

    private ValueTask AuditEtAsync(
        TenantBaglami baglam,
        IzBaglami izBaglami,
        string sonucKodu,
        CancellationToken cancellationToken) =>
        auditKaydiYazici.EkleAsync(
            new AuditKaydi(
                "tenant_baglantisi_acma",
                baglam.EyleyenKimligi,
                baglam.TenantKimligi,
                zamanSaglayici.GetUtcNow(),
                izBaglami.TraceKimligi,
                izBaglami.KorelasyonKimligi,
                sonucKodu),
            cancellationToken);

    private static async ValueTask GuvenleKapatAsync(DbConnection? baglanti)
    {
        if (baglanti is null)
        {
            return;
        }

        try
        {
            await baglanti.CloseAsync();
        }
        catch
        {
            // Ilk provider hatasini ve guvenli dis hata sinirini koru.
        }

        try
        {
            await baglanti.DisposeAsync();
        }
        catch
        {
            // Cleanup hatasi provider ayrintisini disariya tasimamali.
        }
    }
}
