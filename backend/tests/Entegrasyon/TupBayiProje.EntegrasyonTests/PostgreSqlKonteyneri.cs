using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Npgsql;
using Testcontainers.PostgreSql;
using TupBayiProje.Moduller.Audit.Altyapi;
using TupBayiProje.Moduller.Tenancy.Altyapi;
using Xunit;

namespace TupBayiProje.EntegrasyonTests;

[CollectionDefinition(Ad)]
public sealed class PostgreSqlKoleksiyonu : ICollectionFixture<PostgreSqlKonteyneri>
{
    public const string Ad = "PostgreSql";
}

// Test kosusu boyunca yasayan efemer PostgreSQL konteyneri. Docker yoksa testler atlanmaz, hata verir.
// Sifre her kosuda rastgele uretilir; kaynakta, ciktida veya logda yer almaz.
public sealed class PostgreSqlKonteyneri : IAsyncLifetime
{
    private readonly PostgreSqlContainer _konteyner = new PostgreSqlBuilder("postgres:18.0-alpine")
        .WithPassword(Convert.ToHexString(RandomNumberGenerator.GetBytes(32)))
        .Build();

    public Task InitializeAsync() => _konteyner.StartAsync();

    public Task DisposeAsync() => _konteyner.DisposeAsync().AsTask();

    // Her test kendi bos veritabanini alir; testler birbirinin semasini ve verisini gormez.
    public async Task<string> BosVeritabaniOlusturAsync()
    {
        var veritabaniAdi = $"tbp_{Guid.CreateVersion7():N}";
        await using var baglanti = new NpgsqlConnection(_konteyner.GetConnectionString());
        await baglanti.OpenAsync();
        await using var komut = new NpgsqlCommand($"CREATE DATABASE {veritabaniAdi}", baglanti);
        await komut.ExecuteNonQueryAsync();

        return new NpgsqlConnectionStringBuilder(_konteyner.GetConnectionString()) { Database = veritabaniAdi }
            .ConnectionString;
    }

    public static MasterVeritabaniBaglami BaglamOlustur(string baglantiDizesi, params IInterceptor[] yakalayicilar) =>
        new(new DbContextOptionsBuilder<MasterVeritabaniBaglami>()
            .UseNpgsql(baglantiDizesi)
            .AddInterceptors(yakalayicilar)
            .Options);

    public static DenetimVeritabaniBaglami DenetimBaglamiOlustur(
        string baglantiDizesi,
        params IInterceptor[] yakalayicilar) =>
        new(new DbContextOptionsBuilder<DenetimVeritabaniBaglami>()
            .UseNpgsql(baglantiDizesi)
            .AddInterceptors(yakalayicilar)
            .Options);
}
