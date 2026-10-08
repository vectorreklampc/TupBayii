using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace TupBayiProje.Moduller.Tenancy.Altyapi;

// Yalniz `dotnet ef migrations` icin tasarim zamani fabrikasi; baglanti acmaz, uygulama baslangicinda kullanilmaz.
internal sealed class MasterVeritabaniBaglamiTasarimFabrikasi : IDesignTimeDbContextFactory<MasterVeritabaniBaglami>
{
    public MasterVeritabaniBaglami CreateDbContext(string[] args) =>
        new(new DbContextOptionsBuilder<MasterVeritabaniBaglami>().UseNpgsql().Options);
}
