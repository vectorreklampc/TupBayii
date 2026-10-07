using Xunit;

namespace TupBayiProje.MimariTests;

public sealed class MimariKuralMotoruTests
{
    [Fact]
    public void ProjeBagimliliklariniDogrula_DomainUygulamayaBaglanirsa_IhlalUretir()
    {
        var projeler = new[]
        {
            new ProjeTanim("Satis.Domain", "Satis", Katman.Domain, []),
            new ProjeTanim("Satis.Uygulama", "Satis", Katman.Uygulama, []),
            new ProjeTanim("Satis.HataliDomain", "Satis", Katman.Domain, ["Satis.Uygulama"]),
        };

        var ihlaller = MimariKuralMotoru.ProjeBagimliliklariniDogrula(projeler);

        Assert.Contains(ihlaller, ihlal => ihlal.Contains("Satis.HataliDomain", StringComparison.Ordinal));
    }

    [Fact]
    public void ProjeBagimliliklariniDogrula_ModulIciBaskaModuldenReferanslanirsa_IhlalUretir()
    {
        var projeler = new[]
        {
            new ProjeTanim("Stok.Domain", "Stok", Katman.Domain, []),
            new ProjeTanim("Satis.Uygulama", "Satis", Katman.Uygulama, ["Stok.Domain"]),
        };

        var ihlaller = MimariKuralMotoru.ProjeBagimliliklariniDogrula(projeler);

        Assert.Contains(ihlaller, ihlal => ihlal.Contains("modul siniri", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void ProjeBagimliliklariniDogrula_BaskaModulunSozlesmesiReferanslanirsa_IhlalUretmez()
    {
        var projeler = new[]
        {
            new ProjeTanim("Stok.Sozlesmeler", "Stok", Katman.Sozlesmeler, []),
            new ProjeTanim("Satis.Uygulama", "Satis", Katman.Uygulama, ["Stok.Sozlesmeler"]),
        };

        var ihlaller = MimariKuralMotoru.ProjeBagimliliklariniDogrula(projeler);

        Assert.Empty(ihlaller);
    }

    [Fact]
    public void VeritabaniSinirlariniDogrula_TenantBasinaFizikselVeritabaniBeyaniYoksa_IhlalUretir()
    {
        var proje = new VeritabaniProjesiTanim(
            "Satis.Altyapi",
            VeritabaniSiniri.Tenant,
            TenantBasinaFizikselVeritabani: false,
            ["SatisTenantVeritabaniBaglami"]);

        var ihlaller = MimariKuralMotoru.VeritabaniSinirlariniDogrula([proje]);

        Assert.Contains(ihlaller, ihlal => ihlal.Contains("tenant basina fiziksel", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void VeritabaniSinirlariniDogrula_MasterVeTenantBaglamlariAyniProjedeyse_IhlalUretir()
    {
        var proje = new VeritabaniProjesiTanim(
            "Tenancy.Altyapi",
            VeritabaniSiniri.Master,
            TenantBasinaFizikselVeritabani: false,
            ["MasterVeritabaniBaglami", "TenantVeritabaniBaglami"]);

        var ihlaller = MimariKuralMotoru.VeritabaniSinirlariniDogrula([proje]);

        Assert.Contains(ihlaller, ihlal => ihlal.Contains("Master", StringComparison.Ordinal));
    }

    [Fact]
    public void VeritabaniSinirlariniDogrula_BaglamSinirBeyanEtmiyorsa_IhlalUretir()
    {
        var proje = new VeritabaniProjesiTanim(
            "Belirsiz.Altyapi",
            VeritabaniSiniri.Yok,
            TenantBasinaFizikselVeritabani: false,
            ["BelirsizVeritabaniBaglami"]);

        var ihlaller = MimariKuralMotoru.VeritabaniSinirlariniDogrula([proje]);

        Assert.Contains(ihlaller, ihlal => ihlal.Contains("sinir", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void VeritabaniSinirlariniDogrula_MasterTenantOperasyonVarligiIceriyorsa_IhlalUretir()
    {
        var proje = new VeritabaniProjesiTanim(
            "Tenancy.Altyapi",
            VeritabaniSiniri.Master,
            TenantBasinaFizikselVeritabani: false,
            ["TenancyMasterVeritabaniBaglami"],
            ["Musteri"]);

        var ihlaller = MimariKuralMotoru.VeritabaniSinirlariniDogrula([proje]);

        Assert.Contains(ihlaller, ihlal => ihlal.Contains("tenant operasyon", StringComparison.OrdinalIgnoreCase));
    }
}
