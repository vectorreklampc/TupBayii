using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql;
using Xunit;

namespace TupBayiProje.EntegrasyonTests;

[Collection(PostgreSqlKoleksiyonu.Ad)]
public sealed class DenetimVeritabaniEntegrasyonTests(PostgreSqlKonteyneri postgreSql)
{
    private static readonly string[] BeklenenKolonlar =
    [
        "correlation_id:uuid:notnull:varsayilan-yok",
        "gerekce_kodu:character varying(64):null:varsayilan-yok",
        "id:uuid:notnull:varsayilan-yok",
        "islem:character varying(64):notnull:varsayilan-yok",
        "karar_id:uuid:notnull:varsayilan-yok",
        "olusturulma_zamani:timestamp with time zone:notnull:statement_timestamp()",
        "servis_kimligi:character varying(64):notnull:CURRENT_USER",
        "sonuc:character varying(32):notnull:varsayilan-yok",
        "tenant_id:uuid:notnull:varsayilan-yok",
    ];

    [Fact]
    public async Task Migration_UpDownUp_DokuzKolonuVeAyriGecmisiAyniSekildeKurar()
    {
        var baglantiDizesi = await postgreSql.BosVeritabaniOlusturAsync();
        await using var tenancy = PostgreSqlKonteyneri.BaglamOlustur(baglantiDizesi);
        await using var audit = PostgreSqlKonteyneri.DenetimBaglamiOlustur(baglantiDizesi);
        await tenancy.Database.MigrateAsync();
        var migrator = audit.GetService<IMigrator>();

        await migrator.MigrateAsync();
        await SemayiDogrulaAsync(baglantiDizesi);

        await migrator.MigrateAsync(Migration.InitialDatabase);
        Assert.Equal(0, await SkalerAsync<long>(baglantiDizesi, "SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='master' AND c.relname='denetim_kaydi'"));

        await migrator.MigrateAsync();
        await SemayiDogrulaAsync(baglantiDizesi);
    }

    [Theory]
    [InlineData("REDDEDILDI", null)]
    [InlineData("IZIN_VERILDI", "ERISIM_REDDEDILDI")]
    [InlineData("REDDEDILDI", "BILINMEYEN")]
    [InlineData("BILINMEYEN", null)]
    public async Task TruthTable_GecersizSonucGerekceBirlesiminiReddeder(string sonuc, string? gerekce)
    {
        var baglantiDizesi = await GocUygulanmisVeritabaniAsync();
        var sql = "INSERT INTO master.denetim_kaydi " +
            "(id, karar_id, servis_kimligi, tenant_id, correlation_id, islem, sonuc, gerekce_kodu) " +
            "VALUES ($1, $2, 'audit_runtime', $3, $4, 'TENANT_SECRET_OKUMA_KARARI', $5, $6)";

        var hata = await Assert.ThrowsAsync<PostgresException>(() =>
            KomutCalistirAsync(
                baglantiDizesi,
                sql,
                Guid.CreateVersion7(),
                Guid.CreateVersion7(),
                Guid.CreateVersion7(),
                Guid.CreateVersion7(),
                sonuc,
                gerekce));

        Assert.Equal(PostgresErrorCodes.CheckViolation, hata.SqlState);
        Assert.Equal("ck_denetim_kaydi_sonuc_gerekce", hata.ConstraintName);
    }

    private async Task<string> GocUygulanmisVeritabaniAsync()
    {
        var baglantiDizesi = await postgreSql.BosVeritabaniOlusturAsync();
        await using var audit = PostgreSqlKonteyneri.DenetimBaglamiOlustur(baglantiDizesi);
        await audit.Database.MigrateAsync();
        return baglantiDizesi;
    }

    private static async Task SemayiDogrulaAsync(string baglantiDizesi)
    {
        const string kolonSorgusu = """
            SELECT a.attname || ':' || pg_catalog.format_type(a.atttypid, a.atttypmod)
                || ':' || CASE WHEN a.attnotnull THEN 'notnull' ELSE 'null' END
                || ':' || CASE WHEN a.atthasdef THEN pg_catalog.pg_get_expr(d.adbin, d.adrelid) ELSE 'varsayilan-yok' END
            FROM pg_catalog.pg_attribute a
            JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
            WHERE n.nspname = 'master' AND c.relname = 'denetim_kaydi'
                AND a.attnum > 0 AND NOT a.attisdropped
            ORDER BY a.attname
            """;
        Assert.Equal(BeklenenKolonlar, await SatirlariOkuAsync(baglantiDizesi, kolonSorgusu));
        Assert.Equal(1, await SkalerAsync<long>(baglantiDizesi, "SELECT count(*) FROM master.\"__EFMigrationsHistory\""));
        Assert.Equal(1, await SkalerAsync<long>(baglantiDizesi, "SELECT count(*) FROM master.\"__AuditEFMigrationsHistory\""));
    }

    private static async Task<string[]> SatirlariOkuAsync(string baglantiDizesi, string sql)
    {
        await using var baglanti = new NpgsqlConnection(baglantiDizesi);
        await baglanti.OpenAsync();
        await using var komut = new NpgsqlCommand(sql, baglanti);
        await using var okuyucu = await komut.ExecuteReaderAsync();
        var satirlar = new List<string>();
        while (await okuyucu.ReadAsync())
        {
            satirlar.Add(okuyucu.GetString(0));
        }

        return [.. satirlar];
    }

    private static async Task<T> SkalerAsync<T>(string baglantiDizesi, string sql)
    {
        await using var baglanti = new NpgsqlConnection(baglantiDizesi);
        await baglanti.OpenAsync();
        await using var komut = new NpgsqlCommand(sql, baglanti);
        return (T)(await komut.ExecuteScalarAsync())!;
    }

    private static async Task KomutCalistirAsync(string baglantiDizesi, string sql, params object?[] parametreler)
    {
        await using var baglanti = new NpgsqlConnection(baglantiDizesi);
        await baglanti.OpenAsync();
        await using var komut = new NpgsqlCommand(sql, baglanti);
        foreach (var parametre in parametreler)
        {
            komut.Parameters.AddWithValue(parametre ?? DBNull.Value);
        }

        await komut.ExecuteNonQueryAsync();
    }
}
