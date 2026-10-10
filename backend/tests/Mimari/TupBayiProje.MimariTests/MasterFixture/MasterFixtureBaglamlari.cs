using Microsoft.EntityFrameworkCore;

namespace TupBayiProje.MimariTests.MasterFixture;

// Test-only EF fixture. Gercek MasterDbContext degildir; baglanti acmaz, yalnizca runtime model uretir.
// Her senaryo ayri baglam tipidir; EF model onbellegi baglam tipine gore tutulur.
public class WhitelistBaglami : DbContext
{
    // Fixture'in beklenen 14 CLR tipi; gercek Master entity tipleri TBP-59'dadir.
    public static IReadOnlyList<Type> BeklenenTipler { get; } =
    [
        typeof(Kullanici), typeof(KullaniciOturumu), typeof(Tenant), typeof(TenantVeritabani),
        typeof(TenantMigrationSurumu), typeof(TenantProvisioningIsi), typeof(TenantMigrationIsi),
        typeof(Abonelik), typeof(Lisans), typeof(Cihaz), typeof(OdemeNiyeti), typeof(OdemeDenemesi),
        typeof(OdemeSaglayiciOlayi), typeof(DenetimKaydi),
    ];

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder) =>
        optionsBuilder.UseNpgsql("Host=fixture-baglanti-acmaz");

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        ArgumentNullException.ThrowIfNull(modelBuilder);

        modelBuilder.HasDefaultSchema("master");

        foreach (var tip in BeklenenTipler)
        {
            var kayit = MasterVeritabaniBeyazListesi.Kayitlar.Single(kayit => kayit.VarlikAdi == tip.Name);
            modelBuilder.Entity(tip).ToTable(kayit.TabloAdi);
        }

        modelBuilder.Entity<Kullanici>().Ignore(kullanici => kullanici.Profil).Ignore(kullanici => kullanici.Tenantlar);
        modelBuilder.Entity<Tenant>().Ignore(tenant => tenant.Kullanicilar);
    }
}

public sealed class BilinmeyenEntityBaglami : WhitelistBaglami
{
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.Entity<Bilinmeyen>().ToTable("bilinmeyen");
    }
}

public sealed class MusteriBaglami : WhitelistBaglami
{
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.Entity<Musteri>().ToTable("musteri");
    }
}

public sealed class TedarikciBaglami : WhitelistBaglami
{
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.Entity<Tedarikci>().ToTable("tedarikci");
    }
}

public sealed class BackupBaglami : WhitelistBaglami
{
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.Entity<TenantYedekIsi>().ToTable("tenant_yedek_isi");
    }
}

public sealed class OwnedTipBaglami : WhitelistBaglami
{
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.Entity<Kullanici>().OwnsOne(kullanici => kullanici.Profil);
    }
}

public sealed class JoinTipiBaglami : WhitelistBaglami
{
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.Entity<Kullanici>()
            .HasMany(kullanici => kullanici.Tenantlar)
            .WithMany(tenant => tenant.Kullanicilar)
            .UsingEntity("KullaniciTenant");
    }
}

public sealed class YanlisTabloBaglami : WhitelistBaglami
{
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.Entity<Tenant>().ToTable("tenants");
    }
}

public sealed class YanlisSemaBaglami : WhitelistBaglami
{
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.Entity<Tenant>().ToTable("tenant", "public");
    }
}

public sealed class TabloBolmeBaglami : WhitelistBaglami
{
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.Entity<Tenant>().SplitToTable("tenant_ek", tablo => tablo.Property(tenant => tenant.Ad));
    }
}

public sealed class YabanciNamespaceBaglami : WhitelistBaglami
{
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.Ignore<Kullanici>();
        modelBuilder.Entity<Yabanci.Kullanici>().ToTable("kullanici");
    }
}

public sealed class YabanciAssemblyBaglami : WhitelistBaglami
{
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.Ignore<Kullanici>();
        modelBuilder.Entity(YabanciAssembly.Kullanici).ToTable("kullanici");
    }
}
