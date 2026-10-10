using System.Transactions;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using TupBayiProje.Moduller.Audit.Altyapi;
using TupBayiProje.Moduller.Tenancy.Domain;
using TupBayiProje.Moduller.Tenancy.Uygulama;
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

    private async Task<(string AdminDizesi, DenetimYazici Yazici)> YaziciHazirlaAsync()
    {
        var adminDizesi = await postgreSql.BosVeritabaniOlusturAsync();
        await using var baglam = PostgreSqlKonteyneri.DenetimBaglamiOlustur(adminDizesi);
        await baglam.Database.MigrateAsync();
        await PostgreSqlKonteyneri.AuditYetkileriniUygulaAsync(adminDizesi);
        return (adminDizesi, new DenetimYazici(postgreSql.AuditRuntimeBaglantiDizesi(adminDizesi)));
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
}
