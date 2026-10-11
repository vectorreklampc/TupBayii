using Microsoft.EntityFrameworkCore;
using TupBayiProje.Moduller.Tenancy.Domain;

namespace TupBayiProje.Moduller.Tenancy.Altyapi;

// Master DB baglami. Kapsam docs/mimari/Master-DB-Sema-Sozlesmesi.md whitelist'iyle sinirlidir;
// TBP-59 yalniz Tenant ve TenantVeritabani'ni esler. Tum tablolar ve migration gecmisi master semasindadir.
public sealed class MasterVeritabaniBaglami : DbContext
{
    public const string Sema = "master";

    public MasterVeritabaniBaglami(DbContextOptions<MasterVeritabaniBaglami> secenekler)
        : base(secenekler)
    {
    }

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder) =>
        optionsBuilder.UseNpgsql(npgsql => npgsql.MigrationsHistoryTable("__EFMigrationsHistory", Sema));

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(Sema);

        modelBuilder.Entity<Tenant>(varlik =>
        {
            varlik.ToTable("tenant");
            varlik.HasKey(tenant => tenant.Id).HasName("pk_tenant");
            varlik.Property(tenant => tenant.Id).HasColumnName("id").ValueGeneratedNever();
        });

        modelBuilder.Entity<TenantVeritabani>(varlik =>
        {
            varlik.ToTable("tenant_veritabani");
            varlik.HasKey(veritabani => veritabani.Id).HasName("pk_tenant_veritabani");
            varlik.Property(veritabani => veritabani.Id).HasColumnName("id").ValueGeneratedNever();
            varlik.Property(veritabani => veritabani.TenantId).HasColumnName("tenant_id");
            varlik.HasIndex(veritabani => veritabani.TenantId)
                .IsUnique()
                .HasDatabaseName("ix_tenant_veritabani_tenant_id");
            varlik.HasOne<Tenant>()
                .WithOne()
                .HasForeignKey<TenantVeritabani>(veritabani => veritabani.TenantId)
                .HasConstraintName("fk_tenant_veritabani_tenant")
                .OnDelete(DeleteBehavior.Restrict);
        });
    }
}
