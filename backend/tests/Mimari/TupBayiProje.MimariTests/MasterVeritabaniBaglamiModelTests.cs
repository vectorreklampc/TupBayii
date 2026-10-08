using Microsoft.EntityFrameworkCore;
using TupBayiProje.Moduller.Tenancy.Altyapi;
using TupBayiProje.Moduller.Tenancy.Domain;
using Xunit;

namespace TupBayiProje.MimariTests;

// TBP-59: TBP-58 whitelist oracle'i fixture yerine gercek MasterVeritabaniBaglami.Model uzerinde calisir.
// TBP-59 kapsami tam olarak Tenant ve TenantVeritabani'dir; modele eklenen her baska tip testi kirar.
public sealed class MasterVeritabaniBaglamiModelTests
{
    private const string MasterSemasi = "master";

    private static readonly Type[] BeklenenTipler = [typeof(Tenant), typeof(TenantVeritabani)];

    [Fact]
    public void Model_GercekMasterModeli_TamOlarakTenantVeTenantVeritabaniTipleriniIcerir()
    {
        using var baglam = BaglamOlustur();

        // Referans esitligiyle kume karsilastirmasi: eksik, fazla, owned, join veya yabanci assembly tipi gecemez.
        var modelTipleri = baglam.Model.GetEntityTypes().Select(varlik => varlik.ClrType).ToHashSet();
        Assert.True(
            modelTipleri.SetEquals(BeklenenTipler),
            $"Beklenen: [{string.Join(", ", BeklenenTipler.Select(tip => tip.FullName))}], " +
            $"model: [{string.Join(", ", modelTipleri.Select(tip => tip.AssemblyQualifiedName))}].");
        Assert.Equal(BeklenenTipler.Length, baglam.Model.GetEntityTypes().Count());
    }

    [Fact]
    public void ModeliDogrula_GercekMasterModeli_IhlalUretmez()
    {
        using var baglam = BaglamOlustur();

        Assert.Empty(MasterVeritabaniBeyazListesi.ModeliDogrula(baglam.Model, BeklenenTipler));
    }

    [Theory]
    [InlineData(typeof(Tenant), "tenant")]
    [InlineData(typeof(TenantVeritabani), "tenant_veritabani")]
    public void Model_GercekMasterModeli_TabloyuMasterSemasindaBeklenenAdaEsler(Type tip, string beklenenTablo)
    {
        using var baglam = BaglamOlustur();

        var varlik = baglam.Model.FindEntityType(tip);
        Assert.NotNull(varlik);
        Assert.Same(tip, varlik.ClrType);
        Assert.Equal(MasterSemasi, varlik.GetSchema());
        Assert.Equal(beklenenTablo, varlik.GetTableName());
    }

    // Model kurulumu baglanti acmaz; baglanti dizesi gerekmez.
    private static MasterVeritabaniBaglami BaglamOlustur() =>
        new(new DbContextOptionsBuilder<MasterVeritabaniBaglami>().UseNpgsql().Options);
}
