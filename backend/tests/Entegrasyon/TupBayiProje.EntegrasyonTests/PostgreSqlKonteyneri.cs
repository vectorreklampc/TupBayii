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
    private readonly string _auditParolasi = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
    private readonly string _tenancyParolasi = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
    private readonly string _yanlisParola = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
    private readonly PostgreSqlContainer _konteyner = new PostgreSqlBuilder("postgres:18.0-alpine")
        .WithPassword(Convert.ToHexString(RandomNumberGenerator.GetBytes(32)))
        .Build();

    public async Task InitializeAsync()
    {
        await _konteyner.StartAsync();
        await RuntimeRolleriniOlusturAsync();
    }

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

    public string AuditRuntimeBaglantiDizesi(
        string adminBaglantiDizesi,
        bool yanlisParola = false,
        bool parolaEkle = true) =>
        RuntimeBaglantiDizesi(
            adminBaglantiDizesi,
            "audit_runtime",
            parolaEkle ? (yanlisParola ? _yanlisParola : _auditParolasi) : string.Empty);

    public string TenancyRuntimeBaglantiDizesi(string adminBaglantiDizesi) =>
        RuntimeBaglantiDizesi(adminBaglantiDizesi, "tenancy_runtime", _tenancyParolasi);

    public static async Task AuditYetkileriniUygulaAsync(string adminBaglantiDizesi)
    {
        const string sql = """
            REVOKE ALL ON SCHEMA master FROM PUBLIC;
            REVOKE ALL ON TABLE master.denetim_kaydi FROM PUBLIC;
            ALTER TABLE master.denetim_kaydi OWNER TO audit_migrator;
            ALTER TABLE master."__AuditEFMigrationsHistory" OWNER TO audit_migrator;
            GRANT USAGE ON SCHEMA master TO audit_runtime;
            GRANT INSERT (id, karar_id, tenant_id, correlation_id, islem, sonuc, gerekce_kodu)
                ON master.denetim_kaydi TO audit_runtime;
            GRANT SELECT (karar_id, servis_kimligi, tenant_id, correlation_id, islem, sonuc, gerekce_kodu)
                ON master.denetim_kaydi TO audit_runtime;
            GRANT USAGE ON SCHEMA master TO tenancy_runtime;
            """;
        await KomutCalistirAsync(adminBaglantiDizesi, sql);
    }

    public static Task TenancyOkumaYetkisiniUygulaAsync(string adminBaglantiDizesi) =>
        KomutCalistirAsync(
            adminBaglantiDizesi,
            "GRANT USAGE ON SCHEMA master TO tenancy_runtime; " +
            "GRANT SELECT (id) ON master.tenant TO tenancy_runtime");

    private async Task RuntimeRolleriniOlusturAsync()
    {
        var auditParolasi = SqlMetni(_auditParolasi);
        var tenancyParolasi = SqlMetni(_tenancyParolasi);
        var sql = $"""
            SET password_encryption = 'scram-sha-256';
            CREATE ROLE audit_migrator NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
            CREATE ROLE audit_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS PASSWORD '{auditParolasi}';
            CREATE ROLE tenancy_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS PASSWORD '{tenancyParolasi}';
            """;
        await KomutCalistirAsync(_konteyner.GetConnectionString(), sql);
    }

    private static string RuntimeBaglantiDizesi(string adminBaglantiDizesi, string kullanici, string parola)
    {
        var olusturucu = new NpgsqlConnectionStringBuilder(adminBaglantiDizesi)
        {
            Username = kullanici,
            Password = parola,
            Enlist = false,
            Pooling = false,
            Timeout = 5,
            CommandTimeout = 5,
            IncludeErrorDetail = false,
        };
        return olusturucu.ConnectionString;
    }

    private static string SqlMetni(string deger) => deger.Replace("'", "''", StringComparison.Ordinal);

    private static async Task KomutCalistirAsync(string baglantiDizesi, string sql)
    {
        await using var baglanti = new NpgsqlConnection(baglantiDizesi);
        await baglanti.OpenAsync();
        await using var komut = new NpgsqlCommand(sql, baglanti);
        await komut.ExecuteNonQueryAsync();
    }
}
