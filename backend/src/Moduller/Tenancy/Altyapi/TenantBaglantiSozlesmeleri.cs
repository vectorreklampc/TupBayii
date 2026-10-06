using System.Data.Common;
using TupBayiProje.Moduller.Tenancy.Uygulama;

namespace TupBayiProje.Moduller.Tenancy.Altyapi;

public sealed class TenantBaglantiBilgisi
{
    internal TenantBaglantiBilgisi(string baglantiReferansi, string baglantiMetni)
    {
        BaglantiReferansi = baglantiReferansi;
        BaglantiMetni = baglantiMetni;
    }

    public string BaglantiReferansi { get; }

    internal string BaglantiMetni { get; }

    public override string ToString() =>
        $"{nameof(TenantBaglantiBilgisi)} {{ BaglantiReferansi = {BaglantiReferansi}, BaglantiMetni = [GIZLENDI] }}";
}

public interface ITenantBaglantiBilgisiOkuyucu
{
    ValueTask<TenantBaglantiBilgisi?> BaglantiIcinBulAsync(
        TenantBaglami baglam,
        CancellationToken cancellationToken = default);
}

public sealed class TenantBaglantiHatasi(string kod)
    : InvalidOperationException("Tenant baglantisi guvenli bicimde acilamadi.")
{
    public string Kod { get; } = kod;
}

public sealed class TenantBaglantiKapsami(DbConnection baglanti) : IAsyncDisposable
{
    private DbConnection? baglanti = baglanti;

    public DbConnection Baglanti =>
        baglanti ?? throw new ObjectDisposedException(nameof(TenantBaglantiKapsami));

    public async ValueTask DisposeAsync()
    {
        var kapatilacakBaglanti = Interlocked.Exchange(ref baglanti, null);
        if (kapatilacakBaglanti is not null)
        {
            try
            {
                await kapatilacakBaglanti.CloseAsync();
            }
            finally
            {
                await kapatilacakBaglanti.DisposeAsync();
            }
        }
    }
}
