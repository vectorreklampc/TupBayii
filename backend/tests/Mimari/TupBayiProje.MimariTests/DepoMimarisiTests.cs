using Xunit;

namespace TupBayiProje.MimariTests;

public sealed class DepoMimarisiTests
{
    [Fact]
    public void Tara_BackendProjeleriGecerliyse_IhlalUretmez()
    {
        var backendKoku = BackendKokunuBul();

        var rapor = DepoMimariTarayicisi.Tara(backendKoku);

        Assert.True(rapor.IncelenenProjeSayisi > 0, "Mimari test en az bir uretim projesi incelemelidir.");
        Assert.Equal(4, rapor.CalistirilanKuralAilesiSayisi);
        Assert.Empty(rapor.Ihlaller);
    }

    [Fact]
    public void Tara_TenantBasinaFizikselVeritabaniEksikse_IhlalUretir()
    {
        var geciciBackend = Directory.CreateTempSubdirectory("tbp-mimari-");

        try
        {
            var projeDizini = Directory.CreateDirectory(Path.Combine(
                geciciBackend.FullName,
                "src",
                "Moduller",
                "Satis",
                "Altyapi",
                "Satis.Altyapi"));
            File.WriteAllText(
                Path.Combine(projeDizini.FullName, "Satis.Altyapi.csproj"),
                """
                <Project Sdk="Microsoft.NET.Sdk">
                  <PropertyGroup>
                    <TupBayiVeritabaniSiniri>Tenant</TupBayiVeritabaniSiniri>
                    <TupBayiTenantBasinaFizikselVeritabani>false</TupBayiTenantBasinaFizikselVeritabani>
                  </PropertyGroup>
                </Project>
                """);
            File.WriteAllText(
                Path.Combine(projeDizini.FullName, "SatisTenantVeritabaniBaglami.cs"),
                "internal sealed class SatisTenantVeritabaniBaglami : DbContext { }");

            var rapor = DepoMimariTarayicisi.Tara(geciciBackend.FullName);

            Assert.Contains(
                rapor.Ihlaller,
                ihlal => ihlal.Contains("tenant basina fiziksel", StringComparison.OrdinalIgnoreCase));
        }
        finally
        {
            Directory.Delete(geciciBackend.FullName, recursive: true);
        }
    }

    [Fact]
    public void Tara_TekProjeIcindeDomainUygulamayaBaglanirsa_IhlalUretir()
    {
        var geciciBackend = Directory.CreateTempSubdirectory("tbp-mimari-");

        try
        {
            var modulDizini = Directory.CreateDirectory(Path.Combine(
                geciciBackend.FullName,
                "src",
                "Moduller",
                "Satis"));
            File.WriteAllText(
                Path.Combine(modulDizini.FullName, "Satis.csproj"),
                "<Project Sdk=\"Microsoft.NET.Sdk\" />");
            var domainDizini = Directory.CreateDirectory(Path.Combine(modulDizini.FullName, "Domain"));
            File.WriteAllText(
                Path.Combine(domainDizini.FullName, "Satis.cs"),
                """
                using TupBayiProje.Moduller.Satis.Uygulama;
                namespace TupBayiProje.Moduller.Satis.Domain;
                internal sealed class Satis { }
                """);

            var rapor = DepoMimariTarayicisi.Tara(geciciBackend.FullName);

            Assert.Contains(
                rapor.Ihlaller,
                ihlal => ihlal.Contains("katman yonunu", StringComparison.OrdinalIgnoreCase));
        }
        finally
        {
            Directory.Delete(geciciBackend.FullName, recursive: true);
        }
    }

    [Fact]
    public void Tara_KatmanTipiKanonikNamespaceKullanmiyorsa_IhlalUretir()
    {
        var geciciBackend = Directory.CreateTempSubdirectory("tbp-mimari-");

        try
        {
            var modulDizini = Directory.CreateDirectory(Path.Combine(
                geciciBackend.FullName,
                "src",
                "Moduller",
                "Satis"));
            File.WriteAllText(
                Path.Combine(modulDizini.FullName, "Satis.csproj"),
                "<Project Sdk=\"Microsoft.NET.Sdk\" />");
            var domainDizini = Directory.CreateDirectory(Path.Combine(modulDizini.FullName, "Domain"));
            File.WriteAllText(
                Path.Combine(domainDizini.FullName, "Satis.cs"),
                "namespace Yanlis; internal sealed class Satis { }");

            var rapor = DepoMimariTarayicisi.Tara(geciciBackend.FullName);

            Assert.Contains(
                rapor.Ihlaller,
                ihlal => ihlal.Contains("namespace", StringComparison.OrdinalIgnoreCase));
        }
        finally
        {
            Directory.Delete(geciciBackend.FullName, recursive: true);
        }
    }

    [Fact]
    public void Tara_MasterDbSetTenantOperasyonVarligiIceriyorsa_IhlalUretir()
    {
        var geciciBackend = Directory.CreateTempSubdirectory("tbp-mimari-");

        try
        {
            var projeDizini = Directory.CreateDirectory(Path.Combine(
                geciciBackend.FullName,
                "src",
                "Moduller",
                "Tenancy",
                "Altyapi",
                "Tenancy.Altyapi"));
            File.WriteAllText(
                Path.Combine(projeDizini.FullName, "Tenancy.Altyapi.csproj"),
                """
                <Project Sdk="Microsoft.NET.Sdk">
                  <PropertyGroup>
                    <TupBayiVeritabaniSiniri>Master</TupBayiVeritabaniSiniri>
                  </PropertyGroup>
                </Project>
                """);
            File.WriteAllText(
                Path.Combine(projeDizini.FullName, "TenancyMasterVeritabaniBaglami.cs"),
                """
                namespace TupBayiProje.Moduller.Tenancy.Altyapi;
                internal sealed class TenancyMasterVeritabaniBaglami : DbContext
                {
                    public DbSet<Musteri> Musteriler { get; set; }
                }
                """);

            var rapor = DepoMimariTarayicisi.Tara(geciciBackend.FullName);

            Assert.Contains(
                rapor.Ihlaller,
                ihlal => ihlal.Contains("tenant operasyon", StringComparison.OrdinalIgnoreCase));
        }
        finally
        {
            Directory.Delete(geciciBackend.FullName, recursive: true);
        }
    }

    private static string BackendKokunuBul()
    {
        var dizin = new DirectoryInfo(AppContext.BaseDirectory);

        while (dizin is not null && !File.Exists(Path.Combine(dizin.FullName, "TupBayiProje.slnx")))
        {
            dizin = dizin.Parent;
        }

        return dizin?.FullName
            ?? throw new InvalidOperationException("Backend koku bulunamadi.");
    }
}
