using System.Security.Cryptography;
using DotNet.Testcontainers.Builders;
using DotNet.Testcontainers.Containers;
using DotNet.Testcontainers.Networks;
using Npgsql;
using Testcontainers.PostgreSql;
using Xunit;

namespace TupBayiProje.EntegrasyonTests;

[CollectionDefinition(Ad)]
public sealed class PgBouncerKoleksiyonu : ICollectionFixture<PgBouncerKonteyneri>
{
    public const string Ad = "PgBouncer";
}

// Uygulama trafigi transaction pooling uzerinden, migration ve yonetim islemleri dogrudan PostgreSQL uzerinden akar.
// Docker yoksa testler atlanmaz; PoC altyapisinin kurulamamasi gorunur bir test hatasidir.
public sealed class PgBouncerKonteyneri : IAsyncLifetime
{
    private const string VeritabaniAdi = "tbp_pgbouncer_poc";
    private const ushort PostgreSqlPortu = 5432;
    private readonly string _sifre = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
    private readonly INetwork _ag;
    private readonly PostgreSqlContainer _postgresql;
    private readonly IContainer _pgbouncer;

    public PgBouncerKonteyneri()
    {
        _ag = new NetworkBuilder().Build();
        _postgresql = new PostgreSqlBuilder("postgres:18.0-alpine")
            .WithDatabase(VeritabaniAdi)
            .WithPassword(_sifre)
            .WithNetwork(_ag)
            .WithNetworkAliases("postgresql")
            .Build();
        _pgbouncer = new ContainerBuilder("edoburu/pgbouncer:v1.26.0-p0")
            .WithNetwork(_ag)
            .WithEnvironment("DB_HOST", "postgresql")
            .WithEnvironment("DB_PORT", "5432")
            .WithEnvironment("DB_NAME", VeritabaniAdi)
            .WithEnvironment("DB_USER", "postgres")
            .WithEnvironment("DB_PASSWORD", _sifre)
            .WithEnvironment("AUTH_TYPE", "scram-sha-256")
            .WithEnvironment("POOL_MODE", "transaction")
            .WithEnvironment("MAX_CLIENT_CONN", "50")
            .WithEnvironment("DEFAULT_POOL_SIZE", "2")
            .WithEnvironment("MAX_PREPARED_STATEMENTS", "100")
            .WithPortBinding(PostgreSqlPortu, true)
            .WithWaitStrategy(Wait.ForUnixContainer().UntilInternalTcpPortIsAvailable(PostgreSqlPortu))
            .Build();
    }

    public string DogrudanBaglantiDizesi => _postgresql.GetConnectionString();

    public string UygulamaBaglantiDizesi => new NpgsqlConnectionStringBuilder(DogrudanBaglantiDizesi)
    {
        Host = _pgbouncer.Hostname,
        Port = _pgbouncer.GetMappedPublicPort(PostgreSqlPortu),
        ApplicationName = "tbp-pgbouncer-poc",
        Pooling = true,
        NoResetOnClose = true,
        Multiplexing = false,
    }.ConnectionString;

    public async Task InitializeAsync()
    {
        await _ag.CreateAsync();
        await _postgresql.StartAsync();
        await _pgbouncer.StartAsync();
    }

    public async Task DisposeAsync()
    {
        await _pgbouncer.DisposeAsync();
        await _postgresql.DisposeAsync();
        await _ag.DisposeAsync();
    }

    public async Task<string> BosTabloOlusturAsync()
    {
        var tablo = $"poc_{Guid.CreateVersion7():N}";
        await KomutCalistirAsync(DogrudanBaglantiDizesi, $"CREATE TABLE {tablo} (deger integer NOT NULL)");
        return tablo;
    }

    public async Task<int> SatirSayisiAsync(string tablo) =>
        await DogrudanSkalerAsync<int>($"SELECT count(*)::integer FROM {tablo}");

    public async Task<int> AktifUykuSorgusuSayisiAsync(int backendPid)
    {
        await using var baglanti = new NpgsqlConnection(DogrudanBaglantiDizesi);
        await baglanti.OpenAsync();
        await using var komut = new NpgsqlCommand("""
            SELECT count(*)::integer
            FROM pg_catalog.pg_stat_activity
            WHERE pid = $1
                AND state = 'active'
                AND query LIKE '%TBP64_UYKU%'
            """, baglanti);
        komut.Parameters.AddWithValue(backendPid);
        return (int)(await komut.ExecuteScalarAsync())!;
    }

    public async Task<T> SkalerAsync<T>(string sql)
    {
        await using var baglanti = new NpgsqlConnection(UygulamaBaglantiDizesi);
        await baglanti.OpenAsync();
        await using var komut = new NpgsqlCommand(sql, baglanti);
        return (T)(await komut.ExecuteScalarAsync())!;
    }

    private async Task<T> DogrudanSkalerAsync<T>(string sql)
    {
        await using var baglanti = new NpgsqlConnection(DogrudanBaglantiDizesi);
        await baglanti.OpenAsync();
        await using var komut = new NpgsqlCommand(sql, baglanti);
        return (T)(await komut.ExecuteScalarAsync())!;
    }

    public async Task BackendSonlandirAsync(int backendPid)
    {
        await using var baglanti = new NpgsqlConnection(DogrudanBaglantiDizesi);
        await baglanti.OpenAsync();
        await using var komut = new NpgsqlCommand("SELECT pg_terminate_backend($1)", baglanti);
        komut.Parameters.AddWithValue(backendPid);
        Assert.True((bool)(await komut.ExecuteScalarAsync())!);
    }

    private static async Task KomutCalistirAsync(string baglantiDizesi, string sql)
    {
        await using var baglanti = new NpgsqlConnection(baglantiDizesi);
        await baglanti.OpenAsync();
        await using var komut = new NpgsqlCommand(sql, baglanti);
        await komut.ExecuteNonQueryAsync();
    }
}
