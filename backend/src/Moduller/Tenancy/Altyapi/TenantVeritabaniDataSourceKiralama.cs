using Npgsql;

namespace TupBayiProje.Moduller.Tenancy.Altyapi;

public sealed class TenantVeritabaniDataSourceKiralama : IAsyncDisposable
{
    private TenantVeritabaniDataSourceOnbellegi? _sahip;
    private readonly TenantVeritabaniDataSourceOnbellegi.Kayit _kayit;

    internal TenantVeritabaniDataSourceKiralama(
        TenantVeritabaniDataSourceOnbellegi sahip,
        TenantVeritabaniDataSourceOnbellegi.Kayit kayit,
        NpgsqlDataSource dataSource)
    {
        _sahip = sahip;
        _kayit = kayit;
        DataSource = dataSource;
    }

    // Ham data source disariya verilmez; runtime baglanti acma hatalari bu sinirda olculur.
    internal NpgsqlDataSource DataSource { get; }

    // Baglanti, kiralama bitmeden kapatilmalidir. Sorgu hatalari bu sayacin kapsami disindadir.
    public async ValueTask<NpgsqlConnection> OpenConnectionAsync(CancellationToken cancellationToken = default)
    {
        var sahip = _sahip ?? throw new ObjectDisposedException(nameof(TenantVeritabaniDataSourceKiralama));
        try
        {
            return await DataSource.OpenConnectionAsync(cancellationToken).ConfigureAwait(false);
        }
        catch (NpgsqlException)
        {
            sahip.BaglantiHatasiniOlc();
            throw;
        }
    }

    public async ValueTask DisposeAsync()
    {
        var sahip = Interlocked.Exchange(ref _sahip, null);
        if (sahip is not null)
        {
            await sahip.GeriBirakAsync(_kayit).ConfigureAwait(false);
        }

        GC.SuppressFinalize(this);
    }
}
