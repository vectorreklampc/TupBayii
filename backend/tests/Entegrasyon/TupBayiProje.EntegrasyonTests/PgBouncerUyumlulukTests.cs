using Microsoft.EntityFrameworkCore;
using Npgsql;
using TupBayiProje.Moduller.Tenancy.Domain;
using Xunit;

namespace TupBayiProje.EntegrasyonTests;

[Collection(PgBouncerKoleksiyonu.Ad)]
public sealed class PgBouncerUyumlulukTests(PgBouncerKonteyneri pgbouncer)
{
    [Fact]
    public async Task Transaction_RollbackEdilince_VeritabaniDegismezVeBaglantiYenidenKullanilir()
    {
        var tablo = await pgbouncer.BosTabloOlusturAsync();

        await using (var baglanti = new NpgsqlConnection(pgbouncer.UygulamaBaglantiDizesi))
        {
            await baglanti.OpenAsync();
            await using var transaction = await baglanti.BeginTransactionAsync();
            await new NpgsqlCommand($"INSERT INTO {tablo} (deger) VALUES (1)", baglanti, transaction)
                .ExecuteNonQueryAsync();
            await transaction.RollbackAsync();
        }

        Assert.Equal(0, await pgbouncer.SatirSayisiAsync(tablo));
        Assert.Equal(1, await pgbouncer.SkalerAsync<int>("SELECT 1"));
    }

    [Fact]
    public async Task Baglanti_Acilinca_TransactionPoolingVePreparedStatementTakibiDogrulanir()
    {
        await using var baglanti = new NpgsqlConnection(pgbouncer.UygulamaBaglantiDizesi);
        await baglanti.OpenAsync();

        Assert.Equal("transaction", baglanti.PostgresParameters["pgbouncer.pool_mode"]);
        Assert.Equal("100", baglanti.PostgresParameters["pgbouncer.max_prepared_statements"]);

        await using var ilkTransaction = await baglanti.BeginTransactionAsync();
        await using var komut = new NpgsqlCommand("SELECT pg_backend_pid(), $1::integer + 1", baglanti, ilkTransaction);
        komut.Parameters.AddWithValue(41);
        await komut.PrepareAsync();
        var (ilkBackend, ilkSonuc) = await BackendVeSonucOkuAsync(komut);
        Assert.Equal(42, ilkSonuc);
        await ilkTransaction.CommitAsync();

        await using var tutucuBir = new NpgsqlConnection(pgbouncer.UygulamaBaglantiDizesi);
        await using var tutucuIki = new NpgsqlConnection(pgbouncer.UygulamaBaglantiDizesi);
        await tutucuBir.OpenAsync();
        await tutucuIki.OpenAsync();
        await using var tutucuTransactionBir = await tutucuBir.BeginTransactionAsync();
        await using var tutucuTransactionIki = await tutucuIki.BeginTransactionAsync();
        var tutucuBackendBir = await BackendPidOkuAsync(tutucuBir, tutucuTransactionBir);
        var tutucuBackendIki = await BackendPidOkuAsync(tutucuIki, tutucuTransactionIki);
        Assert.Equal(2, new[] { tutucuBackendBir, tutucuBackendIki }.Distinct().Count());

        var serbestBirakilanTransaction = tutucuBackendBir == ilkBackend
            ? tutucuTransactionIki
            : tutucuTransactionBir;
        var tutulanTransaction = tutucuBackendBir == ilkBackend
            ? tutucuTransactionBir
            : tutucuTransactionIki;
        Assert.Contains(ilkBackend, new[] { tutucuBackendBir, tutucuBackendIki });
        await serbestBirakilanTransaction.CommitAsync();

        await using var ikinciTransaction = await baglanti.BeginTransactionAsync();
        komut.Transaction = ikinciTransaction;
        var (ikinciBackend, ikinciSonuc) = await BackendVeSonucOkuAsync(komut);
        await ikinciTransaction.CommitAsync();
        await tutulanTransaction.CommitAsync();

        Assert.NotEqual(ilkBackend, ikinciBackend);
        Assert.Equal(42, ikinciSonuc);
        Assert.True(komut.IsPrepared);
    }

    [Fact]
    public async Task SessionDurumu_AyniBackendiAlanSonrakiIstekeSizarVeKullanilmamalidir()
    {
        var sizanDeger = Guid.CreateVersion7().ToString("N");
        int kaynakBackend;
        await using (var baglanti = new NpgsqlConnection(pgbouncer.UygulamaBaglantiDizesi))
        {
            await baglanti.OpenAsync();
            await using var transaction = await baglanti.BeginTransactionAsync();
            await using var komut = new NpgsqlCommand(
                "SELECT pg_backend_pid(), set_config('tbp.poc_durum', $1, false)", baglanti, transaction);
            komut.Parameters.AddWithValue(sizanDeger);
            await using (var okuyucu = await komut.ExecuteReaderAsync())
            {
                Assert.True(await okuyucu.ReadAsync());
                kaynakBackend = okuyucu.GetInt32(0);
                Assert.Equal(sizanDeger, okuyucu.GetString(1));
            }

            await transaction.CommitAsync();
        }

        await using var okuyucuBir = new NpgsqlConnection(pgbouncer.UygulamaBaglantiDizesi);
        await using var okuyucuIki = new NpgsqlConnection(pgbouncer.UygulamaBaglantiDizesi);
        await okuyucuBir.OpenAsync();
        await okuyucuIki.OpenAsync();
        await using var transactionBir = await okuyucuBir.BeginTransactionAsync();
        await using var transactionIki = await okuyucuIki.BeginTransactionAsync();
        var durumBir = await BackendVeDurumOkuAsync(okuyucuBir, transactionBir);
        var durumIki = await BackendVeDurumOkuAsync(okuyucuIki, transactionIki);
        var sizinti = new[] { durumBir, durumIki }.Single(durum => durum.BackendPid == kaynakBackend);

        Assert.Equal(sizanDeger, sizinti.Durum);

        var temizlenecekBaglanti = durumBir.BackendPid == kaynakBackend ? okuyucuBir : okuyucuIki;
        var temizlenecekTransaction = durumBir.BackendPid == kaynakBackend ? transactionBir : transactionIki;
        await new NpgsqlCommand("RESET tbp.poc_durum", temizlenecekBaglanti, temizlenecekTransaction)
            .ExecuteNonQueryAsync();
        await transactionBir.CommitAsync();
        await transactionIki.CommitAsync();
    }

    [Fact]
    public async Task BackendBaglantisiKesilince_SonrakiBaglantiToparlanir()
    {
        int backendPid;
        await using (var baglanti = new NpgsqlConnection(pgbouncer.UygulamaBaglantiDizesi))
        {
            await baglanti.OpenAsync();
            await using var transaction = await baglanti.BeginTransactionAsync();
            backendPid = (int)(await new NpgsqlCommand("SELECT pg_backend_pid()", baglanti, transaction)
                .ExecuteScalarAsync())!;
            await pgbouncer.BackendSonlandirAsync(backendPid);

            await Assert.ThrowsAnyAsync<NpgsqlException>(async () =>
                await new NpgsqlCommand("SELECT 1", baglanti, transaction).ExecuteScalarAsync());
        }

        Assert.NotEqual(backendPid, await pgbouncer.SkalerAsync<int>("SELECT pg_backend_pid()"));
    }

    [Fact]
    public async Task EszamanliIstekler_HavuzSiniriAltinda_TumTransactionlariTamamlar()
    {
        var tablo = await pgbouncer.BosTabloOlusturAsync();
        var gorevler = Enumerable.Range(1, 8).Select(async deger =>
        {
            await using var baglanti = new NpgsqlConnection(pgbouncer.UygulamaBaglantiDizesi);
            await baglanti.OpenAsync();
            await using var transaction = await baglanti.BeginTransactionAsync();
            var backendPid = await BackendPidOkuAsync(baglanti, transaction);
            await new NpgsqlCommand("SELECT pg_sleep(0.05)", baglanti, transaction).ExecuteNonQueryAsync();
            await new NpgsqlCommand($"INSERT INTO {tablo} (deger) VALUES ({deger})", baglanti, transaction)
                .ExecuteNonQueryAsync();
            await transaction.CommitAsync();
            return backendPid;
        });

        var backendler = await Task.WhenAll(gorevler);

        Assert.Equal(8, await pgbouncer.SatirSayisiAsync(tablo));
        Assert.Equal(2, backendler.Distinct().Count());
    }

    [Fact]
    public async Task Migration_DogrudanBaglantidaUygulaninca_PgBouncerUzerindenModelOkunur()
    {
        await using (var migrationBaglami = PostgreSqlKonteyneri.BaglamOlustur(pgbouncer.DogrudanBaglantiDizesi))
        {
            await migrationBaglami.Database.MigrateAsync();
        }

        await using var uygulamaBaglami = PostgreSqlKonteyneri.BaglamOlustur(pgbouncer.UygulamaBaglantiDizesi);
        Assert.Equal(0, await uygulamaBaglami.Set<Tenant>().CountAsync());
        Assert.Equal(0, await uygulamaBaglami.Set<TenantVeritabani>().CountAsync());
    }

    [Fact]
    public async Task UzunSorgu_IptalEdilince_HavuzSonrakiIstegiCalistirir()
    {
        int backendPid;
        await using (var baglanti = new NpgsqlConnection(pgbouncer.UygulamaBaglantiDizesi))
        {
            await baglanti.OpenAsync();
            await using var transaction = await baglanti.BeginTransactionAsync();
            backendPid = await BackendPidOkuAsync(baglanti, transaction);
            await using var komut = new NpgsqlCommand(
                "/* TBP64_UYKU */ SELECT pg_sleep(30)", baglanti, transaction);
            using var iptal = new CancellationTokenSource();
            var sorguGorevi = komut.ExecuteNonQueryAsync(iptal.Token);
            await UykuSorgusununBaslamasiniBekleAsync(backendPid);
            iptal.Cancel();

            await Assert.ThrowsAnyAsync<OperationCanceledException>(async () => await sorguGorevi);
        }

        await UykuSorgusununBitmesiniBekleAsync(backendPid);
        Assert.Equal(1, await pgbouncer.SkalerAsync<int>("SELECT 1"));
    }

    [Fact]
    public async Task UzunSorgu_CommandTimeoutOlunca_ServerSorguyuDurdurur()
    {
        int backendPid;
        await using (var baglanti = new NpgsqlConnection(pgbouncer.UygulamaBaglantiDizesi))
        {
            await baglanti.OpenAsync();
            await using var transaction = await baglanti.BeginTransactionAsync();
            backendPid = await BackendPidOkuAsync(baglanti, transaction);
            await using var komut = new NpgsqlCommand(
                "/* TBP64_UYKU */ SELECT pg_sleep(30)", baglanti, transaction)
            {
                CommandTimeout = 2,
            };
            var sorguGorevi = komut.ExecuteNonQueryAsync();
            await UykuSorgusununBaslamasiniBekleAsync(backendPid);

            await Assert.ThrowsAnyAsync<NpgsqlException>(async () => await sorguGorevi);
        }

        await UykuSorgusununBitmesiniBekleAsync(backendPid);
        Assert.Equal(1, await pgbouncer.SkalerAsync<int>("SELECT 1"));
    }

    private static async Task<int> BackendPidOkuAsync(NpgsqlConnection baglanti, NpgsqlTransaction transaction) =>
        (int)(await new NpgsqlCommand("SELECT pg_backend_pid()", baglanti, transaction).ExecuteScalarAsync())!;

    private static async Task<(int BackendPid, int Sonuc)> BackendVeSonucOkuAsync(NpgsqlCommand komut)
    {
        await using var okuyucu = await komut.ExecuteReaderAsync();
        Assert.True(await okuyucu.ReadAsync());
        return (okuyucu.GetInt32(0), okuyucu.GetInt32(1));
    }

    private static async Task<(int BackendPid, string? Durum)> BackendVeDurumOkuAsync(
        NpgsqlConnection baglanti,
        NpgsqlTransaction transaction)
    {
        await using var komut = new NpgsqlCommand(
            "SELECT pg_backend_pid(), current_setting('tbp.poc_durum', true)", baglanti, transaction);
        await using var okuyucu = await komut.ExecuteReaderAsync();
        Assert.True(await okuyucu.ReadAsync());
        return (okuyucu.GetInt32(0), okuyucu.IsDBNull(1) ? null : okuyucu.GetString(1));
    }

    private async Task UykuSorgusununBaslamasiniBekleAsync(int backendPid)
    {
        for (var deneme = 0; deneme < 50; deneme++)
        {
            if (await pgbouncer.AktifUykuSorgusuSayisiAsync(backendPid) == 1)
            {
                return;
            }

            await Task.Delay(TimeSpan.FromMilliseconds(100));
        }

        Assert.Fail("Uyku sorgusu bes saniye icinde PostgreSQL'de aktif gorulmedi.");
    }

    private async Task UykuSorgusununBitmesiniBekleAsync(int backendPid)
    {
        for (var deneme = 0; deneme < 50; deneme++)
        {
            if (await pgbouncer.AktifUykuSorgusuSayisiAsync(backendPid) == 0)
            {
                return;
            }

            await Task.Delay(TimeSpan.FromMilliseconds(100));
        }

        Assert.Fail("Iptal edilen uyku sorgusu bes saniye icinde PostgreSQL'de sonlanmadi.");
    }
}
