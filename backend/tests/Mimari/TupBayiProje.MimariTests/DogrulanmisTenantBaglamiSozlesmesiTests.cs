using System.Reflection;
using TupBayiProje.Moduller.Audit.Altyapi;
using TupBayiProje.Moduller.Tenancy.Altyapi;
using TupBayiProje.Moduller.Tenancy.Domain;
using TupBayiProje.Moduller.Tenancy.Sozlesmeler;
using Xunit;

namespace TupBayiProje.MimariTests;

public sealed class DogrulanmisTenantBaglamiSozlesmesiTests
{
    private static readonly Assembly[] UretimAssemblyleri =
    [
        typeof(Tenant).Assembly,
        typeof(DogrulanmisTenantBaglami).Assembly,
        typeof(SentetikTenantBaglamiSaglayici).Assembly,
        Assembly.Load("TupBayiProje.Moduller.Tenancy.Uygulama"),
        typeof(DenetimKarari).Assembly,
    ];

    [Fact]
    public void DogrulanmisTenantBaglami_PublicKurucuyaVeDonusumOperatorunaSahipDegildir()
    {
        Assert.Empty(typeof(DogrulanmisTenantBaglami).GetConstructors(
            BindingFlags.Public | BindingFlags.Instance));
        Assert.DoesNotContain(
            typeof(DogrulanmisTenantBaglami).GetMethods(BindingFlags.Public | BindingFlags.Static),
            metot => metot.Name is "op_Implicit" or "op_Explicit");
    }

    [Fact]
    public void PublicApi_YalnizDbDestekliSaglayicidanDogrulanmisTenantBaglamiUretir()
    {
        var ureticiler = PublicUreticiler()
            .Select(metot => $"{metot.DeclaringType!.FullName}.{metot.Name}")
            .Order(StringComparer.Ordinal)
            .ToArray();

        Assert.Equal(
            [
                $"{typeof(SentetikTenantBaglamiSaglayici).FullName}.{nameof(SentetikTenantBaglamiSaglayici.CozAsync)}",
                $"{typeof(SentetikTenantBaglamiSaglayici).FullName}.{nameof(SentetikTenantBaglamiSaglayici.TumunuCozAsync)}",
            ],
            ureticiler);
    }

    [Fact]
    public void PublicUreticiler_YalnizMasterBaglantisiVeIptalAlirRawKimlikAlmaz()
    {
        Assert.All(PublicUreticiler(), metot => Assert.Equal(
            [typeof(string), typeof(CancellationToken)],
            metot.GetParameters().Select(parametre => parametre.ParameterType)));
    }

    [Fact]
    public void PublicApi_RawTenantVeyaGuidParametresiylePublicBaglamUretemez()
    {
        var rawAlanlar = UretimAssemblyleri
            .SelectMany(assembly => assembly.GetExportedTypes())
            .SelectMany(tip => tip.GetMethods(BindingFlags.Public | BindingFlags.Static | BindingFlags.Instance))
            .Where(metot => metot.GetParameters().Any(parametre =>
                parametre.ParameterType == typeof(Tenant) || parametre.ParameterType == typeof(Guid)))
            .Where(metot => DogrulanmisBaglamIcerir(metot.ReturnType))
            .Select(metot => $"{metot.DeclaringType!.FullName}.{metot.Name}");

        Assert.Empty(rawAlanlar);
    }

    private static IEnumerable<MethodInfo> PublicUreticiler() =>
        UretimAssemblyleri
            .SelectMany(assembly => assembly.GetExportedTypes())
            .SelectMany(tip => tip.GetMethods(
                BindingFlags.Public | BindingFlags.Static | BindingFlags.Instance | BindingFlags.DeclaredOnly))
            // Property getter'lari yeni baglam uretmez; yalniz dogrulanmis ornegi tasir.
            .Where(metot => !metot.IsSpecialName)
            .Where(metot => DogrulanmisBaglamIcerir(metot.ReturnType));

    // Task, ValueTask, koleksiyon veya dizi icindeki baglam da uretim sayilir.
    private static bool DogrulanmisBaglamIcerir(Type tip) =>
        tip == typeof(DogrulanmisTenantBaglami) ||
        (tip.HasElementType && DogrulanmisBaglamIcerir(tip.GetElementType()!)) ||
        (tip.IsGenericType && tip.GetGenericArguments().Any(DogrulanmisBaglamIcerir));
}
