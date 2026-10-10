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
    public void DogrulanmisTenantBaglami_PublicKurucuyaSahipDegildir()
    {
        Assert.Empty(typeof(DogrulanmisTenantBaglami).GetConstructors(
            BindingFlags.Public | BindingFlags.Instance));
    }

    [Fact]
    public void PublicApi_YalnizDbDestekliSaglayicidanDogrulanmisTenantBaglamiUretir()
    {
        var ureticiler = UretimAssemblyleri
            .SelectMany(assembly => assembly.GetExportedTypes())
            .SelectMany(tip => tip.GetMethods(
                BindingFlags.Public | BindingFlags.Static | BindingFlags.Instance | BindingFlags.DeclaredOnly))
            // Property getter'lari yeni baglam uretmez; yalniz dogrulanmis ornegi tasir.
            .Where(metot => !metot.IsSpecialName)
            .Where(metot => DogrulanmisBaglamDondurur(metot.ReturnType))
            .Select(metot => $"{metot.DeclaringType!.FullName}.{metot.Name}")
            .ToArray();

        Assert.Equal(
            [$"{typeof(SentetikTenantBaglamiSaglayici).FullName}.{nameof(SentetikTenantBaglamiSaglayici.CozAsync)}"],
            ureticiler);
    }

    [Fact]
    public void PublicApi_RawTenantParametresiylePublicBaglamUretemez()
    {
        var tenantAlanlar = UretimAssemblyleri
            .SelectMany(assembly => assembly.GetExportedTypes())
            .SelectMany(tip => tip.GetMethods(BindingFlags.Public | BindingFlags.Static | BindingFlags.Instance))
            .Where(metot => metot.GetParameters().Any(parametre => parametre.ParameterType == typeof(Tenant)))
            .Where(metot => DogrulanmisBaglamDondurur(metot.ReturnType))
            .Select(metot => $"{metot.DeclaringType!.FullName}.{metot.Name}");

        Assert.Empty(tenantAlanlar);
    }

    private static bool DogrulanmisBaglamDondurur(Type donusTipi) =>
        donusTipi == typeof(DogrulanmisTenantBaglami) ||
        (donusTipi.IsGenericType &&
         (donusTipi.GetGenericTypeDefinition() == typeof(Task<>) ||
          donusTipi.GetGenericTypeDefinition() == typeof(ValueTask<>)) &&
         donusTipi.GetGenericArguments()[0] == typeof(DogrulanmisTenantBaglami));
}
