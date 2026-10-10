using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;

namespace TupBayiProje.Moduller.Audit.Altyapi;

public sealed class DenetimVeritabaniBaglami : DbContext
{
    public const string Sema = "master";
    public const string GecmisTablosu = "__AuditEFMigrationsHistory";

    public DenetimVeritabaniBaglami(DbContextOptions<DenetimVeritabaniBaglami> secenekler)
        : base(secenekler)
    {
    }

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder) =>
        optionsBuilder.UseNpgsql(npgsql => npgsql.MigrationsHistoryTable(GecmisTablosu, Sema));

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(Sema);

        modelBuilder.Entity<DenetimKaydi>(varlik =>
        {
            varlik.ToTable("denetim_kaydi", tablo =>
            {
                tablo.HasCheckConstraint(
                    "ck_denetim_kaydi_servis_kimligi",
                    "servis_kimligi = 'audit_runtime'");
                tablo.HasCheckConstraint(
                    "ck_denetim_kaydi_islem",
                    "islem = 'TENANT_SECRET_OKUMA_KARARI'");
                tablo.HasCheckConstraint(
                    "ck_denetim_kaydi_sonuc_gerekce",
                    "(sonuc = 'IZIN_VERILDI' AND gerekce_kodu IS NULL) OR " +
                    "(sonuc = 'REDDEDILDI' AND gerekce_kodu IS NOT NULL AND gerekce_kodu IN " +
                    "('ERISIM_REDDEDILDI', 'METADATA_GECERSIZ', 'SECRET_BULUNAMADI', " +
                    "'SECRET_SAGLAYICI_ERISILEMIYOR'))");
            });

            varlik.HasKey(kayit => kayit.Id).HasName("pk_denetim_kaydi");
            varlik.Property(kayit => kayit.Id)
                .HasColumnName("id")
                .HasColumnType("uuid")
                .ValueGeneratedNever();
            varlik.Property(kayit => kayit.KararKimligi)
                .HasConversion(kimlik => kimlik.Deger, deger => new KararKimligi(deger))
                .HasColumnName("karar_id")
                .HasColumnType("uuid")
                .ValueGeneratedNever();
            varlik.HasIndex(kayit => kayit.KararKimligi)
                .IsUnique()
                .HasDatabaseName("ux_denetim_kaydi_karar_id");
            var servis = varlik.Property(kayit => kayit.ServisKimligi)
                .HasColumnName("servis_kimligi")
                .HasColumnType("character varying(64)")
                .HasMaxLength(64)
                .HasDefaultValueSql("current_user")
                .ValueGeneratedOnAdd();
            servis.Metadata.SetBeforeSaveBehavior(PropertySaveBehavior.Ignore);
            varlik.Property(kayit => kayit.TenantId)
                .HasColumnName("tenant_id")
                .HasColumnType("uuid");
            varlik.Property(kayit => kayit.CorrelationKimligi)
                .HasConversion(kimlik => kimlik.Deger, deger => new CorrelationKimligi(deger))
                .HasColumnName("correlation_id")
                .HasColumnType("uuid");
            varlik.Property(kayit => kayit.Islem)
                .HasColumnName("islem")
                .HasColumnType("character varying(64)")
                .HasMaxLength(64);
            varlik.Property(kayit => kayit.Sonuc)
                .HasColumnName("sonuc")
                .HasColumnType("character varying(32)")
                .HasMaxLength(32);
            varlik.Property(kayit => kayit.GerekceKodu)
                .HasColumnName("gerekce_kodu")
                .HasColumnType("character varying(64)")
                .HasMaxLength(64);
            var zaman = varlik.Property(kayit => kayit.OlusturulmaZamani)
                .HasColumnName("olusturulma_zamani")
                .HasColumnType("timestamp with time zone")
                .HasDefaultValueSql("statement_timestamp()")
                .ValueGeneratedOnAdd();
            zaman.Metadata.SetBeforeSaveBehavior(PropertySaveBehavior.Ignore);
        });
    }
}
