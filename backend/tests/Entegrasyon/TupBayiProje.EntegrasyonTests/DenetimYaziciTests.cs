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
    public async Task AyniKararYalnizCorrelationFarkli_CatismaDoner()
    {
        var (adminDizesi, yazici) = await YaziciHazirlaAsync();
        var karar = IzinKarariOlustur();
        var farkliCorrelation = DenetimKarariFabrikasi.IzinKarariOlustur(karar.TenantBaglami).CorrelationKimligi;
        var catismali = new DenetimKarari(
            karar.KararKimligi,
            farkliCorrelation,
            karar.TenantBaglami,
            karar.Islem,
            karar.Sonuc,
            karar.GerekceKodu);

        Assert.Equal(DenetimYazmaSonucu.Kalici, await yazici.YazAsync(karar));
        Assert.Equal(DenetimYazmaSonucu.Catisma, await yazici.YazAsync(catismali));
        Assert.Equal(1, await KayitSayisiAsync(adminDizesi, karar.KararKimligi.TestDegeri));
    }

    [Fact]
    public void BaglantiAyarlari_PoolingKapaliVeCancellationBeklemesiYok()
    {
        var gelen = new NpgsqlConnectionStringBuilder
        {
            Host = "localhost",
            Username = "audit_runtime",
            Pooling = true,
            CancellationTimeout = 2000,
        };

        var ayarlar = new DenetimYazici(gelen.ConnectionString).TestBaglantiAyarlari;

        Assert.False(ayarlar.Pooling);
        Assert.Equal(-1, ayarlar.CancellationTimeout);
    }

    [Fact]
    public async Task PoolingAcikGirdiyleBile_YazmaSonrasiAuditRuntimeOturumuKalmaz()
    {
        var (adminDizesi, _) = await YaziciHazirlaAsync();
        var yazici = new DenetimYazici(PoolingAcikRuntimeDizesi(adminDizesi));

        Assert.Equal(DenetimYazmaSonucu.Kalici, await yazici.YazAsync(IzinKarariOlustur()));
        Assert.Equal(0, await AuditRuntimeOturumSayisiniBekleAsync(adminDizesi));
    }

    [Fact]
    public async Task KilitliCatismaliSatir_GercekIoButceIcindeBelirsizDonerKaliciDegil()
    {
        var butce = TimeSpan.FromSeconds(1);
        var tolerans = TimeSpan.FromMilliseconds(750);
        var (adminDizesi, _) = await YaziciHazirlaAsync();
        var yazici = new DenetimYazici(
            PoolingAcikRuntimeDizesi(adminDizesi),
            new DenetimYaziciTestKancalari { TestButcesi = butce });
        var karar = IzinKarariOlustur();
        await using var kilitBaglantisi = new NpgsqlConnection(adminDizesi);
        await kilitBaglantisi.OpenAsync();
        await using var kilitTransaction = await kilitBaglantisi.BeginTransactionAsync();
        await using (var kilitKomutu = new NpgsqlCommand(
            "INSERT INTO master.denetim_kaydi (id, karar_id, servis_kimligi, tenant_id, correlation_id, islem, sonuc) " +
            "VALUES ($1, $2, 'audit_runtime', $3, $4, $5, $6)",
            kilitBaglantisi,
            kilitTransaction))
        {
            kilitKomutu.Parameters.AddWithValue(Guid.CreateVersion7());
            kilitKomutu.Parameters.AddWithValue(karar.KararKimligi.TestDegeri);
            kilitKomutu.Parameters.AddWithValue(karar.TenantBaglami.TenantId);
            kilitKomutu.Parameters.AddWithValue(karar.CorrelationKimligi.TestDegeri);
            kilitKomutu.Parameters.AddWithValue(karar.Islem);
            kilitKomutu.Parameters.AddWithValue(karar.Sonuc);
            await kilitKomutu.ExecuteNonQueryAsync();
        }

        var kronometre = Stopwatch.StartNew();
        var sonuc = await yazici.YazAsync(karar);
        var gecen = kronometre.Elapsed;

        Assert.Equal(DenetimYazmaSonucu.BelirsizGuvenliHata, sonuc);
        Assert.True(gecen < butce + tolerans, $"Gecen sure butceyi asti: {gecen.TotalMilliseconds} ms");
        Assert.Equal(0, await AuditRuntimeOturumSayisiniBekleAsync(adminDizesi));
        await kilitTransaction.RollbackAsync();
        Assert.Equal(0, await KayitSayisiAsync(adminDizesi, karar.KararKimligi.TestDegeri));
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
    public async Task CleanupZinciriButceyiAsarsa_CallerBelirsizDonerZincirArkaPlandaSiraylaBiter()
    {
        var butce = TimeSpan.FromMilliseconds(300);
        var tolerans = TimeSpan.FromMilliseconds(500);
        var ilkAdimiSerbestBirak = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var zincirBitti = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var kilit = new object();
        var adimlar = new List<DenetimTemizlikAdimi>();
        var aktifAdim = 0;
        var enFazlaEszamanliAdim = 0;
        var (adminDizesi, yazici) = await YaziciHazirlaAsync(new DenetimYaziciTestKancalari
        {
            TestButcesi = butce,
            CommitBasladi = _ => throw new IOException("sentetik-commit-oncesi-kayip"),
            TemizlikAdimiBasliyor = async adim =>
            {
                lock (kilit)
                {
                    adimlar.Add(adim);
                    aktifAdim++;
                    enFazlaEszamanliAdim = Math.Max(enFazlaEszamanliAdim, aktifAdim);
                }

                if (adim == DenetimTemizlikAdimi.Rollback)
                {
                    await ilkAdimiSerbestBirak.Task;
                }
            },
            TemizlikAdimiBitti = adim =>
            {
                lock (kilit)
                {
                    aktifAdim--;
                }

                if (adim == DenetimTemizlikAdimi.BaglantiDispose)
                {
                    zincirBitti.TrySetResult();
                }
            },
        });
        var karar = IzinKarariOlustur();
        var kronometre = Stopwatch.StartNew();

        DenetimYazmaSonucu sonuc;
        TimeSpan gecen;
        try
        {
            sonuc = await yazici.YazAsync(karar).WaitAsync(butce + tolerans);
            gecen = kronometre.Elapsed;
            lock (kilit)
            {
                // Ilk adim beklerken ayni baglantida ikinci cleanup operasyonu baslamamali.
                Assert.Equal([DenetimTemizlikAdimi.Rollback], adimlar);
            }
        }
        finally
        {
            ilkAdimiSerbestBirak.TrySetResult();
        }

        Assert.Equal(DenetimYazmaSonucu.BelirsizGuvenliHata, sonuc);
        Assert.True(gecen < butce + tolerans, $"Gecen sure butceyi asti: {gecen.TotalMilliseconds} ms");

        await zincirBitti.Task.WaitAsync(TimeSpan.FromSeconds(5));
        lock (kilit)
        {
            // Iptal edilen rollback sonrasi transaction dispose atlanir; tek connection dispose ile biter.
            Assert.Equal([DenetimTemizlikAdimi.Rollback, DenetimTemizlikAdimi.BaglantiDispose], adimlar);
            Assert.Equal(1, enFazlaEszamanliAdim);
            Assert.Equal(0, aktifAdim);
        }

        Assert.Equal(0, await AuditRuntimeOturumSayisiniBekleAsync(adminDizesi));
        Assert.Equal(0, await KayitSayisiAsync(adminDizesi, karar.KararKimligi.TestDegeri));
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

    private string PoolingAcikRuntimeDizesi(string adminDizesi) =>
        new NpgsqlConnectionStringBuilder(postgreSql.AuditRuntimeBaglantiDizesi(adminDizesi))
        {
            Pooling = true,
        }.ConnectionString;

    // Socket kapandiktan sonra backend cikisi sunucuda asenkron izlenir; kisa bir sure beklenir.
    private static async Task<long> AuditRuntimeOturumSayisiniBekleAsync(string adminDizesi)
    {
        await using var baglanti = new NpgsqlConnection(adminDizesi);
        await baglanti.OpenAsync();
        await using var komut = new NpgsqlCommand(
            "SELECT count(*) FROM pg_stat_activity WHERE usename = 'audit_runtime' AND datname = current_database()",
            baglanti);
        var kronometre = Stopwatch.StartNew();
        while (true)
        {
            var sayi = (long)(await komut.ExecuteScalarAsync())!;
            if (sayi == 0 || kronometre.Elapsed > TimeSpan.FromSeconds(2))
            {
                return sayi;
            }

            await Task.Delay(50);
        }
    }

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
