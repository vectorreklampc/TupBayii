using Microsoft.EntityFrameworkCore;
using Npgsql;
using Xunit;

namespace TupBayiProje.EntegrasyonTests;

[Collection(PostgreSqlKoleksiyonu.Ad)]
public sealed class AuditRolVeScramTests(PostgreSqlKonteyneri postgreSql)
{
    [Fact]
    public async Task AuditRuntime_GercekTcpScramYolundaDogruParolaylaAcilirYanlisVeEksikParolayiReddeder()
    {
        var adminDizesi = await HazirVeritabaniAsync();
        var auditDizesi = postgreSql.AuditRuntimeBaglantiDizesi(adminDizesi);

        await using (var baglanti = new NpgsqlConnection(auditDizesi))
        {
            await baglanti.OpenAsync();
            await using var komut = new NpgsqlCommand(
                "SELECT current_user, inet_client_addr() IS NOT NULL",
                baglanti);
            await using var okuyucu = await komut.ExecuteReaderAsync();
            Assert.True(await okuyucu.ReadAsync());
            Assert.Equal("audit_runtime", okuyucu.GetString(0));
            Assert.True(okuyucu.GetBoolean(1));
        }

        Assert.True(await SkalerAsync<bool>(adminDizesi, "SELECT rolpassword LIKE 'SCRAM-SHA-256$%' FROM pg_catalog.pg_authid WHERE rolname='audit_runtime'"));
        const string etkinHbaSorgusu = """
            SELECT auth_method = 'scram-sha-256'
            FROM pg_catalog.pg_hba_file_rules
            WHERE type = 'host' AND error IS NULL
                AND (database @> ARRAY['all'] OR database @> ARRAY[current_database()::text])
                AND (user_name @> ARRAY['all'] OR user_name @> ARRAY['audit_runtime'])
                AND CASE
                    WHEN address IS NULL OR address = 'all' THEN true
                    ELSE inet_client_addr() << address::cidr
                END
            ORDER BY line_number
            LIMIT 1
            """;
        Assert.True(await SkalerAsync<bool>(adminDizesi, etkinHbaSorgusu));

        await Assert.ThrowsAsync<PostgresException>(() => BaglantiAcAsync(postgreSql.AuditRuntimeBaglantiDizesi(adminDizesi, yanlisParola: true)));
        await Assert.ThrowsAsync<NpgsqlException>(() => BaglantiAcAsync(postgreSql.AuditRuntimeBaglantiDizesi(adminDizesi, parolaEkle: false)));
    }

    [Fact]
    public async Task AuditRuntime_YalnizDarInsertSelectYetkisineSahiptir()
    {
        var adminDizesi = await HazirVeritabaniAsync();
        var auditDizesi = postgreSql.AuditRuntimeBaglantiDizesi(adminDizesi);
        var tenancyDizesi = postgreSql.TenancyRuntimeBaglantiDizesi(adminDizesi);
        var tenantA = Guid.CreateVersion7();
        var tenantB = Guid.CreateVersion7();

        await GecerliKayitEkleAsync(auditDizesi, tenantA, "IZIN_VERILDI", null);
        await GecerliKayitEkleAsync(auditDizesi, tenantB, "REDDEDILDI", "ERISIM_REDDEDILDI");

        Assert.Equal(2, await SkalerAsync<long>(auditDizesi, "SELECT count(*) FROM master.denetim_kaydi"));
        Assert.Equal(1, await SkalerAsync<long>(auditDizesi, "SELECT count(*) FROM master.denetim_kaydi WHERE tenant_id=$1", tenantA));
        Assert.Equal(1, await SkalerAsync<long>(auditDizesi, "SELECT count(*) FROM master.denetim_kaydi WHERE tenant_id=$1", tenantB));

        await YetkiReddiniDogrulaAsync(auditDizesi, "UPDATE master.denetim_kaydi SET sonuc='REDDEDILDI'");
        await YetkiReddiniDogrulaAsync(auditDizesi, "DELETE FROM master.denetim_kaydi");
        await YetkiReddiniDogrulaAsync(auditDizesi, "TRUNCATE master.denetim_kaydi");
        await YetkiReddiniDogrulaAsync(auditDizesi, "ALTER TABLE master.denetim_kaydi ADD COLUMN yasak text");
        await YetkiReddiniDogrulaAsync(auditDizesi, "SET ROLE audit_migrator");
        await YetkiReddiniDogrulaAsync(
            auditDizesi,
            "INSERT INTO master.denetim_kaydi (id, karar_id, servis_kimligi, tenant_id, correlation_id, islem, sonuc) VALUES ($1,$2,'forged',$3,$4,'TENANT_SECRET_OKUMA_KARARI','IZIN_VERILDI')",
            Guid.CreateVersion7(), Guid.CreateVersion7(), tenantA, Guid.CreateVersion7());
        await YetkiReddiniDogrulaAsync(
            tenancyDizesi,
            "INSERT INTO master.denetim_kaydi (id, karar_id, tenant_id, correlation_id, islem, sonuc) VALUES ($1,$2,$3,$4,'TENANT_SECRET_OKUMA_KARARI','IZIN_VERILDI')",
            Guid.CreateVersion7(), Guid.CreateVersion7(), tenantA, Guid.CreateVersion7());
        Assert.False(await SkalerAsync<bool>(adminDizesi, "SELECT has_table_privilege('public', 'master.denetim_kaydi', 'INSERT')"));
        Assert.False(await SkalerAsync<bool>(adminDizesi, "SELECT pg_has_role('audit_runtime', 'audit_migrator', 'MEMBER')"));
        Assert.Equal(
            "audit_migrator",
            await SkalerAsync<string>(adminDizesi, "SELECT tableowner FROM pg_catalog.pg_tables WHERE schemaname='master' AND tablename='denetim_kaydi'"));
        Assert.Equal(
            "audit_migrator",
            await SkalerAsync<string>(adminDizesi, "SELECT tableowner FROM pg_catalog.pg_tables WHERE schemaname='master' AND tablename='__AuditEFMigrationsHistory'"));
    }

    private async Task<string> HazirVeritabaniAsync()
    {
        var dize = await postgreSql.BosVeritabaniOlusturAsync();
        await using var baglam = PostgreSqlKonteyneri.DenetimBaglamiOlustur(dize);
        await baglam.Database.MigrateAsync();
        await PostgreSqlKonteyneri.AuditYetkileriniUygulaAsync(dize);
        return dize;
    }

    private static async Task GecerliKayitEkleAsync(string dize, Guid tenantId, string sonuc, string? gerekce)
    {
        const string sql = "INSERT INTO master.denetim_kaydi (id, karar_id, tenant_id, correlation_id, islem, sonuc, gerekce_kodu) VALUES ($1,$2,$3,$4,'TENANT_SECRET_OKUMA_KARARI',$5,$6)";
        await KomutCalistirAsync(dize, sql, Guid.CreateVersion7(), Guid.CreateVersion7(), tenantId, Guid.CreateVersion7(), sonuc, gerekce);
    }

    private static async Task YetkiReddiniDogrulaAsync(string dize, string sql, params object?[] degerler)
    {
        var hata = await Assert.ThrowsAsync<PostgresException>(() => KomutCalistirAsync(dize, sql, degerler));
        Assert.Equal(PostgresErrorCodes.InsufficientPrivilege, hata.SqlState);
    }

    private static async Task BaglantiAcAsync(string dize)
    {
        await using var baglanti = new NpgsqlConnection(dize);
        await baglanti.OpenAsync();
    }

    private static async Task KomutCalistirAsync(string dize, string sql, params object?[] degerler)
    {
        await using var baglanti = new NpgsqlConnection(dize);
        await baglanti.OpenAsync();
        await using var komut = new NpgsqlCommand(sql, baglanti);
        foreach (var deger in degerler)
        {
            komut.Parameters.AddWithValue(deger ?? DBNull.Value);
        }

        await komut.ExecuteNonQueryAsync();
    }

    private static async Task<T> SkalerAsync<T>(string dize, string sql, params object[] degerler)
    {
        await using var baglanti = new NpgsqlConnection(dize);
        await baglanti.OpenAsync();
        await using var komut = new NpgsqlCommand(sql, baglanti);
        foreach (var deger in degerler)
        {
            komut.Parameters.AddWithValue(deger);
        }

        return (T)(await komut.ExecuteScalarAsync())!;
    }
}
