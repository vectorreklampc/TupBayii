using System.Reflection;
using TupBayiProje.Moduller.Audit.Altyapi;
using TupBayiProje.Moduller.Tenancy.Domain;
using Xunit;

namespace TupBayiProje.MimariTests;

public sealed class AuditKararSozlesmesiTests
{
    [Theory]
    [InlineData(typeof(KararKimligi))]
    [InlineData(typeof(CorrelationKimligi))]
    public void KimlikTipi_RawGuidIlePublicOlusturulamaz(Type kimlikTipi)
    {
        Assert.Empty(kimlikTipi.GetConstructors(BindingFlags.Public | BindingFlags.Instance));
        Assert.DoesNotContain(
            kimlikTipi.GetMethods(BindingFlags.Public | BindingFlags.Static),
            metot => metot.Name is "op_Implicit" or "op_Explicit");
    }

    [Theory]
    [InlineData(typeof(KararKimligi))]
    [InlineData(typeof(CorrelationKimligi))]
    public void HostFabrikasi_UuidV7Uretir(Type kimlikTipi)
    {
        var karar = IzinKarariOlustur();
        var deger = kimlikTipi == typeof(KararKimligi)
            ? karar.KararKimligi.TestDegeri
            : karar.CorrelationKimligi.TestDegeri;

        Assert.Equal(7, deger.Version);
    }

    [Fact]
    public void Retry_AyniKararVeCorrelationKimligiOrnekleriniKorur()
    {
        var karar = IzinKarariOlustur();

        var retry = karar;

        Assert.Equal(karar.KararKimligi, retry.KararKimligi);
        Assert.Equal(karar.CorrelationKimligi, retry.CorrelationKimligi);
    }

    private static DenetimKarari IzinKarariOlustur() =>
        DenetimKarariFabrikasi.IzinKarariOlustur(
            DogrulanmisTenantBaglami.TenanttenOlustur(Tenant.Olustur()));
}
