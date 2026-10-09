using System.Collections.Concurrent;
using System.Diagnostics.Metrics;
using Npgsql;
using TupBayiProje.Moduller.Tenancy.Altyapi;
using Xunit;

namespace TupBayiProje.EntegrasyonTests;

// TBP-63: bounded NpgsqlDataSource yasam dongusu gercek PostgreSQL ile dogrulanir.
[Collection(PostgreSqlKoleksiyonu.Ad)]
public sealed class TenantVeritabaniDataSourceOnbellegiTests(PostgreSqlKonteyneri postgreSql)
{
    [Fact]
    public async Task ParalelAyniTenantKiralamalari_TekDataSourceKullanir()
    {
        var baglantiDizesi = await postgreSql.BosVeritabaniOlusturAsync();
        await using var onbellek = OnbellekOlustur(kapasite: 8);
        var tenantId = Guid.CreateVersion7();

        var kiralamalar = await Task.WhenAll(Enumerable.Range(0, 32)
            .Select(_ => onbellek.KiralaAsync(tenantId, baglantiDizesi).AsTask()));

        Assert.Single(kiralamalar.Select(kiralama => kiralama.DataSource).Distinct(ReferenceEqualityComparer.Instance));
        Assert.Equal(1, onbellek.AktifDataSourceSayisi);

        await Task.WhenAll(kiralamalar.Select(kiralama => kiralama.DisposeAsync().AsTask()));
    }

    [Fact]
    public async Task YuzYirmiSekizTenantSoak_KapasiteSiniriniAsmaz()
    {
        var baglantiDizesi = await postgreSql.BosVeritabaniOlusturAsync();
        const int kapasite = 8;
        await using var onbellek = OnbellekOlustur(kapasite);

        for (var sira = 0; sira < 128; sira++)
        {
            await using var kiralama = await onbellek.KiralaAsync(Guid.CreateVersion7(), baglantiDizesi);
            Assert.InRange(onbellek.AktifDataSourceSayisi, 1, kapasite);
        }

        Assert.Equal(kapasite, onbellek.AktifDataSourceSayisi);
        Assert.Equal(kapasite, onbellek.OnbellektekiDataSourceSayisi);
    }

    [Fact]
    public async Task EszamanliTemizlemeVeYeniKiralamalar_FizikselDataSourceSiniriniAsmaz()
    {
        const int kapasite = 8;
        var anlikAktif = 0;
        var enYuksekAktif = 0;
        using var dinleyici = new MeterListener();
        dinleyici.InstrumentPublished = (arac, meterListener) =>
        {
            if (arac.Meter.Name == TenantVeritabaniDataSourceOnbellegi.MeterAdi &&
                arac.Name == "tbp.tenancy.datasource.active")
            {
                meterListener.EnableMeasurementEvents(arac);
            }
        };
        dinleyici.SetMeasurementEventCallback<long>((_, olcum, _, _) =>
        {
            var yeniDeger = Interlocked.Add(ref anlikAktif, checked((int)olcum));
            int oncekiEnYuksek;
            do
            {
                oncekiEnYuksek = Volatile.Read(ref enYuksekAktif);
                if (yeniDeger <= oncekiEnYuksek)
                {
                    break;
                }
            }
            while (Interlocked.CompareExchange(ref enYuksekAktif, yeniDeger, oncekiEnYuksek) != oncekiEnYuksek);
        });
        dinleyici.Start();

        var baglantiDizesi = await postgreSql.BosVeritabaniOlusturAsync();
        await using var onbellek = OnbellekOlustur(
            kapasite,
            bosKalmaSuresi: TimeSpan.FromMilliseconds(30));
        for (var sira = 0; sira < kapasite; sira++)
        {
            await using var kiralama = await onbellek.KiralaAsync(Guid.CreateVersion7(), baglantiDizesi);
        }

        await Task.Delay(TimeSpan.FromMilliseconds(80));
        var temizleme = onbellek.BosKayitlariTemizleAsync();
        var yeniKiralamalar = Enumerable.Range(0, kapasite)
            .Select(_ => onbellek.KiralaAsync(Guid.CreateVersion7(), baglantiDizesi).AsTask())
            .ToArray();
        await temizleme;
        var kiralamalar = await Task.WhenAll(yeniKiralamalar);

        Assert.InRange(enYuksekAktif, 1, kapasite);
        await Task.WhenAll(kiralamalar.Select(kiralama => kiralama.DisposeAsync().AsTask()));
    }

    [Fact]
    public async Task KapasiteDoluVeTumKayitlarKullanimdayken_YeniTenantReddedilir()
    {
        var baglantiDizesi = await postgreSql.BosVeritabaniOlusturAsync();
        await using var onbellek = OnbellekOlustur(kapasite: 2);
        await using var ilk = await onbellek.KiralaAsync(Guid.CreateVersion7(), baglantiDizesi);
        await using var ikinci = await onbellek.KiralaAsync(Guid.CreateVersion7(), baglantiDizesi);

        var hata = await Assert.ThrowsAsync<InvalidOperationException>(async () =>
            await onbellek.KiralaAsync(Guid.CreateVersion7(), baglantiDizesi));

        Assert.Equal("Data source onbellegi dolu ve tum kayitlar kullanimda.", hata.Message);
        Assert.Equal(2, onbellek.AktifDataSourceSayisi);
    }

    [Fact]
    public async Task BosKalmaSuresiDolanKayit_TemizlenirVeDisposeEdilir()
    {
        var baglantiDizesi = await postgreSql.BosVeritabaniOlusturAsync();
        await using var onbellek = OnbellekOlustur(kapasite: 2, bosKalmaSuresi: TimeSpan.FromMilliseconds(30));
        var kiralama = await onbellek.KiralaAsync(Guid.CreateVersion7(), baglantiDizesi);
        var dataSource = kiralama.DataSource;
        await kiralama.DisposeAsync();

        await Task.Delay(TimeSpan.FromMilliseconds(80));
        await onbellek.BosKayitlariTemizleAsync();

        Assert.Equal(0, onbellek.AktifDataSourceSayisi);
        await Assert.ThrowsAsync<ObjectDisposedException>(async () => await dataSource.OpenConnectionAsync());
    }

    [Fact]
    public async Task BosKayit_PeriyodikTemizlemeIleKendiligindenTahliyeEdilir()
    {
        var baglantiDizesi = await postgreSql.BosVeritabaniOlusturAsync();
        await using var onbellek = OnbellekOlustur(
            kapasite: 2,
            bosKalmaSuresi: TimeSpan.FromMilliseconds(30),
            temizlemeAraligi: TimeSpan.FromMilliseconds(20));
        await using (var kiralama = await onbellek.KiralaAsync(Guid.CreateVersion7(), baglantiDizesi))
        {
        }

        await DurumBekleAsync(() => onbellek.AktifDataSourceSayisi == 0, TimeSpan.FromSeconds(2));

        Assert.Equal(0, onbellek.OnbellektekiDataSourceSayisi);
    }

    [Fact]
    public async Task YasamSuresiDolsaBile_AktifKiralamaDisposeEdilmez()
    {
        var baglantiDizesi = await postgreSql.BosVeritabaniOlusturAsync();
        await using var onbellek = OnbellekOlustur(
            kapasite: 2,
            yasamSuresi: TimeSpan.FromMilliseconds(30),
            bosKalmaSuresi: TimeSpan.FromMinutes(5));
        var tenantId = Guid.CreateVersion7();
        var kiralama = await onbellek.KiralaAsync(tenantId, baglantiDizesi);

        await Task.Delay(TimeSpan.FromMilliseconds(80));
        await onbellek.BosKayitlariTemizleAsync();

        Assert.Equal(1, onbellek.AktifDataSourceSayisi);
        var yenilemeHatasi = await Assert.ThrowsAsync<InvalidOperationException>(async () =>
            await onbellek.KiralaAsync(tenantId, baglantiDizesi));
        Assert.Equal(
            "Tenant data source kaydinin yenilenmesi icin aktif kiralamalarin tamamlanmasi bekleniyor.",
            yenilemeHatasi.Message);
        await using (var baglanti = await kiralama.DataSource.OpenConnectionAsync())
        {
            Assert.Equal(System.Data.ConnectionState.Open, baglanti.State);
        }

        await kiralama.DisposeAsync();
        Assert.Equal(0, onbellek.AktifDataSourceSayisi);
    }

    [Fact]
    public async Task Kapanis_AktifKiralamaDisposeEdileneKadarBeklerVeTekrarCagrilabilir()
    {
        var baglantiDizesi = await postgreSql.BosVeritabaniOlusturAsync();
        var onbellek = OnbellekOlustur(kapasite: 2);
        var kiralama = await onbellek.KiralaAsync(Guid.CreateVersion7(), baglantiDizesi);

        var kapanis = onbellek.DisposeAsync().AsTask();
        await Task.Delay(TimeSpan.FromMilliseconds(50));
        Assert.False(kapanis.IsCompleted);

        await kiralama.DisposeAsync();
        await kapanis.WaitAsync(TimeSpan.FromSeconds(5));
        Assert.Equal(0, onbellek.AktifDataSourceSayisi);

        await onbellek.DisposeAsync();
    }

    [Fact]
    public async Task ParalelBasarisizOlusturmaSonrasi_YeniBasariliKayitKorunur()
    {
        var gecerliBaglantiDizesi = await postgreSql.BosVeritabaniOlusturAsync();
        var gecersizBaglantiDizesi = new NpgsqlConnectionStringBuilder(gecerliBaglantiDizesi)
        {
            Host = "127.0.0.1",
            Port = 1,
            Timeout = 1,
        }.ConnectionString;
        await using var onbellek = OnbellekOlustur(kapasite: 2);
        var tenantId = Guid.CreateVersion7();
        var basarisizKiralamalar = Enumerable.Range(0, 32)
            .Select(_ => onbellek.KiralaAsync(tenantId, gecersizBaglantiDizesi).AsTask())
            .ToArray();

        var ilkTamamlanan = await Task.WhenAny(basarisizKiralamalar);
        await Assert.ThrowsAnyAsync<NpgsqlException>(() => ilkTamamlanan);
        await using var basariliKiralama = await onbellek.KiralaAsync(tenantId, gecerliBaglantiDizesi);
        foreach (var basarisizKiralama in basarisizKiralamalar)
        {
            await Assert.ThrowsAnyAsync<NpgsqlException>(() => basarisizKiralama);
        }

        Assert.Equal(1, onbellek.AktifDataSourceSayisi);
        Assert.Equal(1, onbellek.OnbellektekiDataSourceSayisi);
        await using var baglanti = await basariliKiralama.DataSource.OpenConnectionAsync();
        Assert.Equal(System.Data.ConnectionState.Open, baglanti.State);
    }

    [Fact]
    public async Task UlasilamayanVeritabani_OnbellegiZehirlemez()
    {
        var gecerliBaglantiDizesi = await postgreSql.BosVeritabaniOlusturAsync();
        var gecersizBaglantiDizesi = new NpgsqlConnectionStringBuilder(gecerliBaglantiDizesi)
        {
            Host = "127.0.0.1",
            Port = 1,
            Timeout = 1,
        }.ConnectionString;
        await using var onbellek = OnbellekOlustur(kapasite: 2);
        var tenantId = Guid.CreateVersion7();

        await Assert.ThrowsAnyAsync<NpgsqlException>(async () =>
            await onbellek.KiralaAsync(tenantId, gecersizBaglantiDizesi));
        Assert.Equal(0, onbellek.AktifDataSourceSayisi);
        Assert.Equal(0, onbellek.OnbellektekiDataSourceSayisi);

        await using var kiralama = await onbellek.KiralaAsync(tenantId, gecerliBaglantiDizesi);
        Assert.Equal(1, onbellek.AktifDataSourceSayisi);
    }

    [Fact]
    public async Task YasamDongusu_IsabetTahliyeOlusturmaDisposeVeBaglantiHatasiMetrikleriniYayar()
    {
        var olcumler = new ConcurrentDictionary<string, ConcurrentBag<long>>(StringComparer.Ordinal);
        using var dinleyici = new MeterListener();
        dinleyici.InstrumentPublished = (arac, meterListener) =>
        {
            if (arac.Meter.Name == TenantVeritabaniDataSourceOnbellegi.MeterAdi)
            {
                meterListener.EnableMeasurementEvents(arac);
            }
        };
        dinleyici.SetMeasurementEventCallback<long>((arac, olcum, _, _) =>
            olcumler.GetOrAdd(arac.Name, _ => []).Add(olcum));
        dinleyici.Start();

        var baglantiDizesi = await postgreSql.BosVeritabaniOlusturAsync();
        await using var onbellek = OnbellekOlustur(kapasite: 2, bosKalmaSuresi: TimeSpan.FromMilliseconds(30));
        var tenantId = Guid.CreateVersion7();
        await using (var ilk = await onbellek.KiralaAsync(tenantId, baglantiDizesi))
        await using (var ikinci = await onbellek.KiralaAsync(tenantId, baglantiDizesi))
        {
            Assert.Same(ilk.DataSource, ikinci.DataSource);
        }

        await Task.Delay(TimeSpan.FromMilliseconds(80));
        await onbellek.BosKayitlariTemizleAsync();

        var gecersizBaglantiDizesi = new NpgsqlConnectionStringBuilder(baglantiDizesi)
        {
            Host = "127.0.0.1",
            Port = 1,
            Timeout = 1,
        }.ConnectionString;
        await Assert.ThrowsAnyAsync<NpgsqlException>(async () =>
            await onbellek.KiralaAsync(Guid.CreateVersion7(), gecersizBaglantiDizesi));

        AssertOlculdu(olcumler, "tbp.tenancy.datasource.cache.hit", 1);
        AssertOlculdu(olcumler, "tbp.tenancy.datasource.cache.miss", 1);
        AssertOlculdu(olcumler, "tbp.tenancy.datasource.eviction", 1);
        AssertOlculdu(olcumler, "tbp.tenancy.datasource.create", 1);
        AssertOlculdu(olcumler, "tbp.tenancy.datasource.dispose", 1);
        AssertOlculdu(olcumler, "tbp.tenancy.datasource.connection.error", 1);
        Assert.Contains(1, olcumler["tbp.tenancy.datasource.active"]);
        Assert.Contains(-1, olcumler["tbp.tenancy.datasource.active"]);
    }

    private static TenantVeritabaniDataSourceOnbellegi OnbellekOlustur(
        int kapasite,
        TimeSpan? yasamSuresi = null,
        TimeSpan? bosKalmaSuresi = null,
        TimeSpan? temizlemeAraligi = null) =>
        new(new TenantVeritabaniDataSourceOnbellegiSecenekleri(
            kapasite,
            yasamSuresi ?? TimeSpan.FromHours(1),
            bosKalmaSuresi ?? TimeSpan.FromMinutes(5),
            temizlemeAraligi ?? TimeSpan.FromMinutes(1),
            TimeSpan.FromSeconds(3)));

    private static async Task DurumBekleAsync(Func<bool> kosul, TimeSpan zamanAsimi)
    {
        var bitis = DateTimeOffset.UtcNow + zamanAsimi;
        while (!kosul() && DateTimeOffset.UtcNow < bitis)
        {
            await Task.Delay(TimeSpan.FromMilliseconds(10));
        }

        Assert.True(kosul(), "Beklenen durum zaman asimi icinde olusmadi.");
    }

    private static void AssertOlculdu(
        ConcurrentDictionary<string, ConcurrentBag<long>> olcumler,
        string metrikAdi,
        long beklenenOlcum) =>
        Assert.Contains(beklenenOlcum, olcumler[metrikAdi]);
}
