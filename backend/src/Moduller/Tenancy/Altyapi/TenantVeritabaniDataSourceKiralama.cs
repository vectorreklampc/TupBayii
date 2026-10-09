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

    public NpgsqlDataSource DataSource { get; }

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
