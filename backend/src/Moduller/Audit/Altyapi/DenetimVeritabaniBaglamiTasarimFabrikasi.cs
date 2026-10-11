using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace TupBayiProje.Moduller.Audit.Altyapi;

internal sealed class DenetimVeritabaniBaglamiTasarimFabrikasi
    : IDesignTimeDbContextFactory<DenetimVeritabaniBaglami>
{
    public DenetimVeritabaniBaglami CreateDbContext(string[] args) =>
        new(new DbContextOptionsBuilder<DenetimVeritabaniBaglami>().UseNpgsql().Options);
}
