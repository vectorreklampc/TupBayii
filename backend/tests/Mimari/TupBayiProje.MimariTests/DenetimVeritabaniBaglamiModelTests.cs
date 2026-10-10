using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using TupBayiProje.Moduller.Audit.Altyapi;
using Xunit;

namespace TupBayiProje.MimariTests;

public sealed class DenetimVeritabaniBaglamiModelTests
{
    private static readonly string[] BeklenenKolonlar =
    [
        "CorrelationKimligi:correlation_id:uuid",
        "GerekceKodu:gerekce_kodu:character varying(64)",
        "Id:id:uuid",
        "Islem:islem:character varying(64)",
        "KararKimligi:karar_id:uuid",
        "OlusturulmaZamani:olusturulma_zamani:timestamp with time zone",
        "ServisKimligi:servis_kimligi:character varying(64)",
        "Sonuc:sonuc:character varying(32)",
        "TenantId:tenant_id:uuid",
    ];

    [Fact]
    public void Model_TamYalnizDenetimKaydiniIcerir()
    {
        using var baglam = BaglamOlustur();

        var varlik = Assert.Single(baglam.Model.GetEntityTypes());
        Assert.Equal(typeof(DenetimKaydi), varlik.ClrType);
        Assert.Equal("master", varlik.GetSchema());
        Assert.Equal("denetim_kaydi", varlik.GetTableName());
    }

    [Fact]
    public void Model_DokuzKolonVeBeklenenTipleriEsler()
    {
        using var baglam = BaglamOlustur();
        var varlik = baglam.Model.FindEntityType(typeof(DenetimKaydi));
        Assert.NotNull(varlik);
        var tablo = StoreObjectIdentifier.Table("denetim_kaydi", "master");

        var kolonlar = varlik.GetProperties()
            .Select(ozellik => $"{ozellik.Name}:{ozellik.GetColumnName(tablo)}:{ozellik.GetColumnType()}")
            .Order(StringComparer.Ordinal)
            .ToArray();

        Assert.Equal(BeklenenKolonlar, kolonlar);
        Assert.Equal(9, kolonlar.Length);
    }

    [Fact]
    public void Model_KimliklerUygulamaUretimli_ServisVeZamanDbVarsayilanlidir()
    {
        using var baglam = BaglamOlustur();
        var varlik = baglam.Model.FindEntityType(typeof(DenetimKaydi));
        Assert.NotNull(varlik);

        Assert.Equal(ValueGenerated.Never, varlik.FindProperty(nameof(DenetimKaydi.Id))!.ValueGenerated);
        Assert.Equal(ValueGenerated.Never, varlik.FindProperty(nameof(DenetimKaydi.KararKimligi))!.ValueGenerated);
        Assert.Equal("current_user", varlik.FindProperty(nameof(DenetimKaydi.ServisKimligi))!.GetDefaultValueSql());
        Assert.Equal("statement_timestamp()", varlik.FindProperty(nameof(DenetimKaydi.OlusturulmaZamani))!.GetDefaultValueSql());
    }

    private static DenetimVeritabaniBaglami BaglamOlustur() =>
        new(new DbContextOptionsBuilder<DenetimVeritabaniBaglami>().UseNpgsql().Options);
}
