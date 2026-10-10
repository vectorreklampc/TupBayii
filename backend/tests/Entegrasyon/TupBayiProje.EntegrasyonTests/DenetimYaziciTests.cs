using System.Transactions;
using System.Diagnostics;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using TupBayiProje.Moduller.Audit.Altyapi;
using TupBayiProje.Moduller.Tenancy.Domain;
using TupBayiProje.Moduller.Tenancy.Uygulama;
using TupBayiProje.Api;
using Xunit;

namespace TupBayiProje.EntegrasyonTests;

[Collection(PostgreSqlKoleksiyonu.Ad)]
public sealed class DenetimYaziciTests(PostgreSqlKonteyneri postgreSql)
{
    [Fact]
    public async Task IlkCommitKalici_AyniKararTekrar_FarkliIcerikCatismaDoner()
    {
        var (adminDizesi, yazici) = await YaziciHazirlaAsync();
        var karar = IzinKarariOlustur();
        var farkliTenant = SentetikTenantBaglamiCozucu.Coz(Tenant.Olustur());
        var catismali = new DenetimKarari(
            karar.KararKimligi,
            karar.CorrelationKimligi,
            farkliTenant,
            karar.Islem,
            karar.Sonuc,
            karar.GerekceKodu);

        Assert.Equal(DenetimYazmaSonucu.Kalici, await yazici.YazAsync(karar));
        Assert.Equal(DenetimYazmaSonucu.Tekrar, await yazici.YazAsync(karar));
        Assert.Equal(DenetimYazmaSonucu.Catisma, await yazici.YazAsync(catismali));
        Assert.Equal(1, await KayitSayisiAsync(adminDizesi, karar.KararKimligi.TestDegeri));
    }

    [Fact]
    public async Task HostCompositionRoot_TenancyTenantindenAuditKarariKalicilastirir()
    {
        var adminDizesi = await postgreSql.BosVeritabaniOlusturAsync();
        await using var tenancyBaglami = PostgreSqlKonteyneri.BaglamOlustur(adminDizesi);
        await tenancyBaglami.Database.MigrateAsync();
        tenancyBaglami.Add(Tenant.Olustur());
        await tenancyBaglami.SaveChangesAsync();
        await using var auditBaglami = PostgreSqlKonteyneri.DenetimBaglamiOlustur(adminDizesi);
        await auditBaglami.Database.MigrateAsync();
        await PostgreSqlKonteyneri.AuditYetkileriniUygulaAsync(adminDizesi);
        await PostgreSqlKonteyneri.TenancyOkumaYetkisiniUygulaAsync(adminDizesi);

        var sonuc = await AuditCompositionRoot.SentetikIzinKarariYazAsync(
            postgreSql.TenancyRuntimeBaglantiDizesi(adminDizesi),
            postgreSql.AuditRuntimeBaglantiDizesi(adminDizesi));

        Assert.Equal(DenetimYazmaSonucu.Kalici, sonuc);
        await using var baglanti = new NpgsqlConnection(adminDizesi);
        await baglanti.OpenAsync();
        await using var komut = new NpgsqlCommand("SELECT count(*) FROM master.denetim_kaydi", baglanti);
        Assert.Equal(1, (long)(await komut.ExecuteScalarAsync())!);
    }

    [Fact]
    public async Task ParalelAyniKarar_TekCommitVeBirTekrarUretir()
    {
        var (adminDizesi, yazici) = await YaziciHazirlaAsync();
        var karar = ReddetKarariOlustur();

        var sonuclar = await Task.WhenAll(yazici.YazAsync(karar), yazici.YazAsync(karar));

        Assert.Single(sonuclar, sonuc => sonuc == DenetimYazmaSonucu.Kalici);
        Assert.Single(sonuclar, sonuc => sonuc == DenetimYazmaSonucu.Tekrar);
        Assert.Equal(1, await KayitSayisiAsync(adminDizesi, karar.KararKimligi.TestDegeri));
    }

    [Fact]
    public async Task DisTransactionScopeRollbackEdilseDe_AuditYerelCommitKalir()
    {
        var (adminDizesi, yazici) = await YaziciHazirlaAsync();
        var karar = IzinKarariOlustur();
        DenetimYazmaSonucu sonuc;

        using (var ortam = new TransactionScope(TransactionScopeAsyncFlowOption.Enabled))
        {
            sonuc = await yazici.YazAsync(karar);
            // Complete yok: ortam transaction'i rollback olur.
        }

        Assert.Equal(DenetimYazmaSonucu.Kalici, sonuc);
        Assert.Equal(1, await KayitSayisiAsync(adminDizesi, karar.KararKimligi.TestDegeri));
    }

    [Fact]
    public async Task GercekCommitSonrasiAckKaybi_ReconciliationIleTekrarDoner()
    {
        var (adminDizesi, yazici) = await YaziciHazirlaAsync(new DenetimYaziciTestKancalari
        {
            CommitSonrasi = _ => throw new IOException("sentetik-ack-kaybi"),
        });
        var karar = IzinKarariOlustur();

        var sonuc = await yazici.YazAsync(karar);

        Assert.Equal(DenetimYazmaSonucu.Tekrar, sonuc);
        Assert.Equal(1, await KayitSayisiAsync(adminDizesi, karar.KararKimligi.TestDegeri));
    }

    [Fact]
    public async Task CommitOncesiAckKaybiVeReconciliationHatasi_GuvenliBelirsizDoner()
    {
        var (adminDizesi, yazici) = await YaziciHazirlaAsync(new DenetimYaziciTestKancalari
        {
            CommitBasladi = _ => throw new IOException("sentetik-commit-oncesi-kayip"),
            ReconciliationBasladi = _ => throw new IOException("sentetik-reconciliation-hatasi"),
        });
        var karar = IzinKarariOlustur();

        var sonuc = await yazici.YazAsync(karar);

        Assert.Equal(DenetimYazmaSonucu.BelirsizGuvenliHata, sonuc);
        Assert.Equal(0, await KayitSayisiAsync(adminDizesi, karar.KararKimligi.TestDegeri));
    }

    [Fact]
    public async Task CommitOncesiAckKaybi_ReconciliationSatirBulamazsaGuvenliBelirsizDoner()
    {
        var (adminDizesi, yazici) = await YaziciHazirlaAsync(new DenetimYaziciTestKancalari
        {
            CommitBasladi = _ => throw new IOException("sentetik-commit-oncesi-kayip"),
        });
        var karar = IzinKarariOlustur();

        var sonuc = await yazici.YazAsync(karar);

        Assert.Equal(DenetimYazmaSonucu.BelirsizGuvenliHata, sonuc);
        Assert.Equal(0, await KayitSayisiAsync(adminDizesi, karar.KararKimligi.TestDegeri));
    }

    [Fact]
    public async Task HangingCommit_TekMonotonicDeadlineSonundaKaliciDonmez()
    {
        var (adminDizesi, yazici) = await YaziciHazirlaAsync(new DenetimYaziciTestKancalari
        {
            TestButcesi = TimeSpan.FromMilliseconds(150),
            CommitBasladi = cancellationToken => Task.Delay(Timeout.InfiniteTimeSpan, cancellationToken),
        });
        var karar = IzinKarariOlustur();
        var kronometre = Stopwatch.StartNew();

        var sonuc = await yazici.YazAsync(karar);

        Assert.Equal(DenetimYazmaSonucu.BelirsizGuvenliHata, sonuc);
        Assert.True(kronometre.Elapsed < TimeSpan.FromSeconds(2));
        Assert.Equal(0, await KayitSayisiAsync(adminDizesi, karar.KararKimligi.TestDegeri));
    }

    [Fact]
    public async Task DeadlineYakinindaCommitAckKaybi_SatirOlsaBileKaliciDonmez()
    {
        var (adminDizesi, yazici) = await YaziciHazirlaAsync(new DenetimYaziciTestKancalari
        {
            TestButcesi = TimeSpan.FromMilliseconds(150),
            CommitSonrasi = cancellationToken => Task.Delay(Timeout.InfiniteTimeSpan, cancellationToken),
        });
        var karar = IzinKarariOlustur();

        var sonuc = await yazici.YazAsync(karar);

        Assert.Equal(DenetimYazmaSonucu.BelirsizGuvenliHata, sonuc);
        Assert.Equal(1, await KayitSayisiAsync(adminDizesi, karar.KararKimligi.TestDegeri));
    }

    [Fact]
    public async Task HassasSentinel_StoreTelemetryVeCallerSonucunaSizmaz()
    {
        const string sentinel = "YASAK_SECRET_REF_TOKEN_7f3a";
        var (adminDizesi, _) = await YaziciHazirlaAsync();
        var hataliDize = new NpgsqlConnectionStringBuilder(
            postgreSql.AuditRuntimeBaglantiDizesi(adminDizesi))
        {
            Database = sentinel,
        }.ConnectionString;
        var yazici = new DenetimYazici(hataliDize, new DenetimYaziciTestKancalari
        {
            TestButcesi = TimeSpan.FromSeconds(1),
        });

        var sonuc = await yazici.YazAsync(IzinKarariOlustur());
        var telemetry = PreContextAuditTelemetry.BaglamDogrulanamadi(TimeSpan.FromMilliseconds(5));
        var storeMetni = await TumAuditMetniniOkuAsync(adminDizesi);

        Assert.Equal(DenetimYazmaSonucu.BelirsizGuvenliHata, sonuc);
        Assert.DoesNotContain(sentinel, sonuc.ToString(), StringComparison.Ordinal);
        Assert.DoesNotContain(sentinel, string.Join('|', telemetry.Select(cift => $"{cift.Key}={cift.Value}")), StringComparison.Ordinal);
        Assert.DoesNotContain(sentinel, storeMetni, StringComparison.Ordinal);
    }

    private async Task<(string AdminDizesi, DenetimYazici Yazici)> YaziciHazirlaAsync(
        DenetimYaziciTestKancalari? testKancalari = null)
    {
        var adminDizesi = await postgreSql.BosVeritabaniOlusturAsync();
        await using var baglam = PostgreSqlKonteyneri.DenetimBaglamiOlustur(adminDizesi);
        await baglam.Database.MigrateAsync();
        await PostgreSqlKonteyneri.AuditYetkileriniUygulaAsync(adminDizesi);
        var runtimeDizesi = postgreSql.AuditRuntimeBaglantiDizesi(adminDizesi);
        return (
            adminDizesi,
            testKancalari is null
                ? new DenetimYazici(runtimeDizesi)
                : new DenetimYazici(runtimeDizesi, testKancalari));
    }

    private static DenetimKarari IzinKarariOlustur() =>
        DenetimKarariFabrikasi.IzinKarariOlustur(
            SentetikTenantBaglamiCozucu.Coz(Tenant.Olustur()));

    private static DenetimKarari ReddetKarariOlustur() =>
        DenetimKarariFabrikasi.ReddetKarariOlustur(
            SentetikTenantBaglamiCozucu.Coz(Tenant.Olustur()),
            "ERISIM_REDDEDILDI");

    private static async Task<long> KayitSayisiAsync(string dize, Guid kararId)
    {
        await using var baglanti = new NpgsqlConnection(dize);
        await baglanti.OpenAsync();
        await using var komut = new NpgsqlCommand(
            "SELECT count(*) FROM master.denetim_kaydi WHERE karar_id=$1",
            baglanti);
        komut.Parameters.AddWithValue(kararId);
        return (long)(await komut.ExecuteScalarAsync())!;
    }

    private static async Task<string> TumAuditMetniniOkuAsync(string dize)
    {
        await using var baglanti = new NpgsqlConnection(dize);
        await baglanti.OpenAsync();
        await using var komut = new NpgsqlCommand(
            "SELECT coalesce(string_agg(row_to_json(kayit)::text, ''), '') FROM master.denetim_kaydi kayit",
            baglanti);
        return (string)(await komut.ExecuteScalarAsync())!;
    }
}
