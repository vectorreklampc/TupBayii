using System.Data.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql;
using TupBayiProje.Moduller.Tenancy.Altyapi;
using TupBayiProje.Moduller.Tenancy.Domain;
using Xunit;

namespace TupBayiProje.EntegrasyonTests;

// TBP-59 AC1-6 / GS-TBP-59-01: Master semasi ve kisitlari gercek PostgreSQL uzerinde dogrulanir.
// Beklenen sema EF modelinden degil pg_catalog'dan okunur; migration gecmis tablosu karsilastirma disidir.
[Collection(PostgreSqlKoleksiyonu.Ad)]
public sealed class MasterVeritabaniEntegrasyonTests(PostgreSqlKonteyneri postgreSql)
{
    private static readonly string[] BeklenenNesneler =
    [
        "i:ix_tenant_veritabani_tenant_id",
        "i:pk_tenant",
        "i:pk_tenant_veritabani",
        "r:tenant",
        "r:tenant_veritabani",
    ];

    // Kimlikler uygulamada UUIDv7 uretilir: hicbir kolonda DB default'u, identity veya generated ifade yoktur.
    private static readonly string[] BeklenenKolonlar =
    [
        "tenant.id:uuid:notnull:varsayilan-yok:uretim-yok",
        "tenant_veritabani.id:uuid:notnull:varsayilan-yok:uretim-yok",
        "tenant_veritabani.tenant_id:uuid:notnull:varsayilan-yok:uretim-yok",
    ];

    private static readonly string[] BeklenenKisitlar =
    [
        "tenant.pk_tenant:PRIMARY KEY (id)",
        "tenant_veritabani.fk_tenant_veritabani_tenant:FOREIGN KEY (tenant_id) REFERENCES master.tenant(id) ON DELETE RESTRICT",
        "tenant_veritabani.pk_tenant_veritabani:PRIMARY KEY (id)",
    ];

    private static readonly string[] BeklenenIndeksler =
    [
        "CREATE UNIQUE INDEX ix_tenant_veritabani_tenant_id ON master.tenant_veritabani USING btree (tenant_id)",
        "CREATE UNIQUE INDEX pk_tenant ON master.tenant USING btree (id)",
        "CREATE UNIQUE INDEX pk_tenant_veritabani ON master.tenant_veritabani USING btree (id)",
    ];

    private const string GecmisHaricNesneFiltresi = """
        n.nspname = 'master'
        AND c.relname <> '__EFMigrationsHistory'
        AND NOT EXISTS (
            SELECT 1 FROM pg_catalog.pg_index i
            JOIN pg_catalog.pg_class t ON t.oid = i.indrelid
            WHERE i.indexrelid = c.oid AND t.relname = '__EFMigrationsHistory')
        """;

    [Fact]
    public async Task Migration_UpDownUp_SemayiKurarKaldirirVeAyniSekildeYenidenKurar()
    {
        var baglantiDizesi = await postgreSql.BosVeritabaniOlusturAsync();
        await using var baglam = PostgreSqlKonteyneri.BaglamOlustur(baglantiDizesi);
        var migrator = baglam.GetService<IMigrator>();

        await migrator.MigrateAsync();
        await BeklenenSemayiDogrulaAsync(baglantiDizesi);

        await migrator.MigrateAsync(Migration.InitialDatabase);
        Assert.Empty(await SatirlariOkuAsync(baglantiDizesi, NesneSorgusu));
        Assert.Empty(await baglam.Database.GetAppliedMigrationsAsync());

        await migrator.MigrateAsync();
        await BeklenenSemayiDogrulaAsync(baglantiDizesi);
        Assert.Equal(["20261008000000_MasterTenantIlkSema"], await baglam.Database.GetAppliedMigrationsAsync());
    }

    [Fact]
    public async Task Migration_IkinciKezVeIdempotentScriptleTekrarUygulaninca_SemaVeGecmisDegismez()
    {
        var scriptliDizesi = await postgreSql.BosVeritabaniOlusturAsync();
        await using (var baglam = PostgreSqlKonteyneri.BaglamOlustur(scriptliDizesi))
        {
            var script = baglam.GetService<IMigrator>()
                .GenerateScript(options: MigrationsSqlGenerationOptions.Idempotent);
            await KomutCalistirAsync(scriptliDizesi, script);
            await KomutCalistirAsync(scriptliDizesi, script);

            await baglam.Database.MigrateAsync();
            Assert.Empty(await baglam.Database.GetPendingMigrationsAsync());
            Assert.Equal(["20261008000000_MasterTenantIlkSema"], await baglam.Database.GetAppliedMigrationsAsync());
        }

        await BeklenenSemayiDogrulaAsync(scriptliDizesi);

        var migrateliDizesi = await postgreSql.BosVeritabaniOlusturAsync();
        await using (var baglam = PostgreSqlKonteyneri.BaglamOlustur(migrateliDizesi))
        {
            await baglam.Database.MigrateAsync();
            await baglam.Database.MigrateAsync();
            Assert.Equal(["20261008000000_MasterTenantIlkSema"], await baglam.Database.GetAppliedMigrationsAsync());
        }

        await BeklenenSemayiDogrulaAsync(migrateliDizesi);
    }

    [Fact]
    public async Task Migration_UpOrtasindaHataEnjekteEdilince_TumDegisikliklerGeriAlinir()
    {
        var baglantiDizesi = await postgreSql.BosVeritabaniOlusturAsync();
        var hataEnjektoru = new UniqueIndeksHataEnjektoru();

        await using (var baglam = PostgreSqlKonteyneri.BaglamOlustur(baglantiDizesi, hataEnjektoru))
        {
            await Assert.ThrowsAsync<InvalidOperationException>(() => baglam.Database.MigrateAsync());
            Assert.True(hataEnjektoru.Tetiklendi);
            Assert.Empty(await baglam.Database.GetAppliedMigrationsAsync());
        }

        Assert.Empty(await SatirlariOkuAsync(baglantiDizesi, NesneSorgusu));

        await using (var baglam = PostgreSqlKonteyneri.BaglamOlustur(baglantiDizesi))
        {
            await baglam.Database.MigrateAsync();
        }

        await BeklenenSemayiDogrulaAsync(baglantiDizesi);
    }

    // FK nedeniyle tenant_veritabani satiri tek basina olamaz; yalniz tenant satiri ayri vaka olarak denenir.
    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task MigrationDown_MasterTablolarindaSatirVarken_HicbirSeyDusurmedenReddedilir(bool veritabaniKaydiVar)
    {
        var baglantiDizesi = await GocUygulanmisVeritabaniAsync();
        var tenant = Tenant.Olustur();
        var veritabani = TenantVeritabani.Olustur(tenant.Id);
        await KaydetAsync(baglantiDizesi, veritabaniKaydiVar ? [tenant, veritabani] : [tenant]);

        await using (var baglam = PostgreSqlKonteyneri.BaglamOlustur(baglantiDizesi))
        {
            // Npgsql execution strategy migration hatasini InvalidOperationException ile sarar.
            var sarmalayici = await Assert.ThrowsAsync<InvalidOperationException>(
                () => baglam.GetService<IMigrator>().MigrateAsync(Migration.InitialDatabase));
            var hata = Assert.IsType<PostgresException>(sarmalayici.InnerException);

            Assert.Equal(PostgresErrorCodes.ObjectNotInPrerequisiteState, hata.SqlState);
            Assert.Equal("TBP-59: master tenant tablolari bos degil; MasterTenantIlkSema geri alinamaz.", hata.MessageText);
            Assert.Equal(["20261008000000_MasterTenantIlkSema"], await baglam.Database.GetAppliedMigrationsAsync());
        }

        await BeklenenSemayiDogrulaAsync(baglantiDizesi);
        Assert.Equal([tenant.Id.ToString()], await SatirlariOkuAsync(baglantiDizesi, "SELECT id::text FROM master.tenant"));
        Assert.Equal(
            veritabaniKaydiVar ? [$"{veritabani.Id}:{tenant.Id}"] : [],
            await SatirlariOkuAsync(baglantiDizesi, "SELECT id::text || ':' || tenant_id::text FROM master.tenant_veritabani"));
    }

    [Fact]
    public async Task Kimlikler_DomainFabrikalarindanDbContextIleKaydedilince_PostgreSqlde_UuidV7Olur()
    {
        var baglantiDizesi = await GocUygulanmisVeritabaniAsync();
        var tenant = Tenant.Olustur();
        await KaydetAsync(baglantiDizesi, tenant, TenantVeritabani.Olustur(tenant.Id));

        // Surum PostgreSQL 18 uuid_extract_version ile DB'deki degerden okunur; .NET tarafi kanit sayilmaz.
        Assert.Equal(["7"], await SatirlariOkuAsync(baglantiDizesi, "SELECT uuid_extract_version(id)::text FROM master.tenant"));
        Assert.Equal(
            ["7"],
            await SatirlariOkuAsync(baglantiDizesi, "SELECT uuid_extract_version(id)::text FROM master.tenant_veritabani"));
    }

    [Fact]
    public async Task TenantSilme_BagliTenantVeritabaniVarken_RestrictIleReddedilir()
    {
        var baglantiDizesi = await GocUygulanmisVeritabaniAsync();
        var tenant = Tenant.Olustur();
        await KaydetAsync(baglantiDizesi, tenant, TenantVeritabani.Olustur(tenant.Id));

        await using var baglam = PostgreSqlKonteyneri.BaglamOlustur(baglantiDizesi);
        baglam.Remove(tenant);

        var hata = await PostgreSqlHatasiBekleAsync(baglam);

        Assert.Equal(PostgresErrorCodes.RestrictViolation, hata.SqlState);
        Assert.Equal("fk_tenant_veritabani_tenant", hata.ConstraintName);
        Assert.Equal(1, await KayitSayisiAsync(baglantiDizesi, tenant.Id));
    }

    [Fact]
    public async Task TenantVeritabani_AyniTenantIcinIkinciKayit_UniqueIleReddedilir()
    {
        var baglantiDizesi = await GocUygulanmisVeritabaniAsync();
        var tenant = Tenant.Olustur();
        await KaydetAsync(baglantiDizesi, tenant, TenantVeritabani.Olustur(tenant.Id));

        await using var baglam = PostgreSqlKonteyneri.BaglamOlustur(baglantiDizesi);
        baglam.Add(TenantVeritabani.Olustur(tenant.Id));

        var hata = await PostgreSqlHatasiBekleAsync(baglam);

        Assert.Equal(PostgresErrorCodes.UniqueViolation, hata.SqlState);
        Assert.Equal("ix_tenant_veritabani_tenant_id", hata.ConstraintName);
        Assert.Equal(1, await KayitSayisiAsync(baglantiDizesi, tenant.Id));
    }

    [Fact]
    public async Task TenantVeritabani_BilinmeyenTenantIcin_ForeignKeyIleReddedilir()
    {
        var baglantiDizesi = await GocUygulanmisVeritabaniAsync();
        var bilinmeyenTenantId = Guid.CreateVersion7();

        await using var baglam = PostgreSqlKonteyneri.BaglamOlustur(baglantiDizesi);
        baglam.Add(TenantVeritabani.Olustur(bilinmeyenTenantId));

        var hata = await PostgreSqlHatasiBekleAsync(baglam);

        Assert.Equal(PostgresErrorCodes.ForeignKeyViolation, hata.SqlState);
        Assert.Equal("fk_tenant_veritabani_tenant", hata.ConstraintName);
        Assert.Equal(0, await KayitSayisiAsync(baglantiDizesi, bilinmeyenTenantId));
    }

    [Fact]
    public async Task TenantVeritabani_AyniTenantIcinParalelIkiKayit_BiriCommitBiriUniqueRet()
    {
        var baglantiDizesi = await GocUygulanmisVeritabaniAsync();
        var tenant = Tenant.Olustur();
        await KaydetAsync(baglantiDizesi, tenant);

        // Iki worker baglantiyi acip kaydi ekleyince bariyer acilir; ardindan ikisi ayni anda SaveChanges'e salinir.
        // Bekleme sureleri sinirlidir: bir worker hazirlikta duserse test asili kalmadan hata verir.
        const int workerSayisi = 2;
        var zamanAsimi = TimeSpan.FromSeconds(30);
        var hazirSayisi = 0;
        var hazir = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var baslangic = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var gorevler = Enumerable.Range(0, workerSayisi)
            .Select(_ => Task.Run(async () =>
            {
                await using var baglam = PostgreSqlKonteyneri.BaglamOlustur(baglantiDizesi);
                try
                {
                    await baglam.Database.OpenConnectionAsync();
                    baglam.Add(TenantVeritabani.Olustur(tenant.Id));
                }
                catch (Exception hata)
                {
                    hazir.TrySetException(hata);
                    throw;
                }

                if (Interlocked.Increment(ref hazirSayisi) == workerSayisi)
                {
                    hazir.TrySetResult();
                }

                await baslangic.Task.WaitAsync(zamanAsimi);
                try
                {
                    await baglam.SaveChangesAsync();
                    return (PostgresException?)null;
                }
                catch (DbUpdateException hata)
                {
                    return Assert.IsType<PostgresException>(hata.InnerException);
                }
            }))
            .ToArray();
        try
        {
            await hazir.Task.WaitAsync(zamanAsimi);
            Assert.Equal(workerSayisi, Volatile.Read(ref hazirSayisi));
            baslangic.SetResult();
        }
        finally
        {
            // Bariyer basarisizsa bekleyen worker'lar serbest kalir; SetResult sonrasi etkisizdir.
            baslangic.TrySetCanceled();
        }

        var sonuclar = await Task.WhenAll(gorevler).WaitAsync(zamanAsimi);

        Assert.Single(sonuclar, sonuc => sonuc is null);
        var ret = Assert.Single(sonuclar, sonuc => sonuc is not null)!;
        Assert.Equal(PostgresErrorCodes.UniqueViolation, ret.SqlState);
        Assert.Equal("ix_tenant_veritabani_tenant_id", ret.ConstraintName);
        Assert.Equal(1, await KayitSayisiAsync(baglantiDizesi, tenant.Id));
    }

    private const string NesneSorgusu = $"""
        SELECT c.relkind::text || ':' || c.relname
        FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE {GecmisHaricNesneFiltresi}
        """;

    private const string KolonSorgusu = """
        SELECT c.relname || '.' || a.attname || ':' || pg_catalog.format_type(a.atttypid, a.atttypmod)
            || ':' || CASE WHEN a.attnotnull THEN 'notnull' ELSE 'null' END
            || ':' || CASE WHEN a.atthasdef THEN 'varsayilan-var' ELSE 'varsayilan-yok' END
            || ':' || CASE WHEN a.attidentity = '' AND a.attgenerated = '' THEN 'uretim-yok' ELSE 'uretim-var' END
        FROM pg_catalog.pg_attribute a
        JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'master' AND c.relkind = 'r' AND c.relname <> '__EFMigrationsHistory'
            AND a.attnum > 0 AND NOT a.attisdropped
        """;

    private const string KisitSorgusu = """
        SELECT c.relname || '.' || con.conname || ':' || pg_catalog.pg_get_constraintdef(con.oid)
        FROM pg_catalog.pg_constraint con
        JOIN pg_catalog.pg_class c ON c.oid = con.conrelid
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'master' AND c.relname <> '__EFMigrationsHistory' AND con.contype <> 'n'
        """;

    private const string IndeksSorgusu = """
        SELECT pg_catalog.pg_get_indexdef(i.indexrelid)
        FROM pg_catalog.pg_index i
        JOIN pg_catalog.pg_class c ON c.oid = i.indrelid
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'master' AND c.relname <> '__EFMigrationsHistory'
        """;

    private static async Task BeklenenSemayiDogrulaAsync(string baglantiDizesi)
    {
        Assert.Equal(BeklenenNesneler, await SatirlariOkuAsync(baglantiDizesi, NesneSorgusu));
        Assert.Equal(BeklenenKolonlar, await SatirlariOkuAsync(baglantiDizesi, KolonSorgusu));
        Assert.Equal(BeklenenKisitlar, await SatirlariOkuAsync(baglantiDizesi, KisitSorgusu));
        Assert.Equal(BeklenenIndeksler, await SatirlariOkuAsync(baglantiDizesi, IndeksSorgusu));
    }

    private static async Task<string[]> SatirlariOkuAsync(string baglantiDizesi, string sorgu)
    {
        await using var baglanti = new NpgsqlConnection(baglantiDizesi);
        await baglanti.OpenAsync();
        await using var komut = new NpgsqlCommand(sorgu, baglanti);
        await using var okuyucu = await komut.ExecuteReaderAsync();
        var satirlar = new List<string>();
        while (await okuyucu.ReadAsync())
        {
            satirlar.Add(okuyucu.GetString(0));
        }

        return [.. satirlar.Order(StringComparer.Ordinal)];
    }

    private static async Task KomutCalistirAsync(string baglantiDizesi, string sql)
    {
        await using var baglanti = new NpgsqlConnection(baglantiDizesi);
        await baglanti.OpenAsync();
        await using var komut = new NpgsqlCommand(sql, baglanti);
        await komut.ExecuteNonQueryAsync();
    }

    private async Task<string> GocUygulanmisVeritabaniAsync()
    {
        var baglantiDizesi = await postgreSql.BosVeritabaniOlusturAsync();
        await using var baglam = PostgreSqlKonteyneri.BaglamOlustur(baglantiDizesi);
        await baglam.Database.MigrateAsync();
        return baglantiDizesi;
    }

    private static async Task KaydetAsync(string baglantiDizesi, params object[] varliklar)
    {
        await using var baglam = PostgreSqlKonteyneri.BaglamOlustur(baglantiDizesi);
        baglam.AddRange(varliklar);
        await baglam.SaveChangesAsync();
    }

    private static async Task<PostgresException> PostgreSqlHatasiBekleAsync(MasterVeritabaniBaglami baglam)
    {
        var hata = await Assert.ThrowsAsync<DbUpdateException>(() => baglam.SaveChangesAsync());
        return Assert.IsType<PostgresException>(hata.InnerException);
    }

    private static async Task<int> KayitSayisiAsync(string baglantiDizesi, Guid tenantId)
    {
        await using var baglam = PostgreSqlKonteyneri.BaglamOlustur(baglantiDizesi);
        return await baglam.Set<TenantVeritabani>().CountAsync(veritabani => veritabani.TenantId == tenantId);
    }

    // Up'in son adimi olan unique index olusturma komutunda hata firlatir; onceki adimlar geri alinmalidir.
    private sealed class UniqueIndeksHataEnjektoru : DbCommandInterceptor
    {
        public bool Tetiklendi { get; private set; }

        public override ValueTask<InterceptionResult<int>> NonQueryExecutingAsync(
            DbCommand command,
            CommandEventData eventData,
            InterceptionResult<int> result,
            CancellationToken cancellationToken = default)
        {
            if (command.CommandText.Contains("CREATE UNIQUE INDEX ix_tenant_veritabani_tenant_id", StringComparison.Ordinal))
            {
                Tetiklendi = true;
                throw new InvalidOperationException("Enjekte edilmis migration hatasi.");
            }

            return base.NonQueryExecutingAsync(command, eventData, result, cancellationToken);
        }
    }
}
