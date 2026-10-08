using Microsoft.EntityFrameworkCore;
using TupBayiProje.Moduller.Tenancy.Altyapi;
using Xunit;

namespace TupBayiProje.MimariTests;

// TBP-59: Master migration zinciri gercek modelle uyumlu olmali; model degisip migration eklenmezse test kirilir.
public sealed class MasterVeritabaniGocTests
{
    [Fact]
    public void Migrationlar_GercekMasterModeli_BekleyenModelDegisikligiIcermez()
    {
        using var baglam = BaglamOlustur();

        Assert.False(baglam.Database.HasPendingModelChanges());
    }

    [Fact]
    public void Migrationlar_GercekMasterModeli_YalnizIlkSemaMigrationiniIcerir()
    {
        using var baglam = BaglamOlustur();

        Assert.Equal(["20261008000000_MasterTenantIlkSema"], baglam.Database.GetMigrations());
    }

    private static MasterVeritabaniBaglami BaglamOlustur() =>
        new(new DbContextOptionsBuilder<MasterVeritabaniBaglami>().UseNpgsql().Options);
}
