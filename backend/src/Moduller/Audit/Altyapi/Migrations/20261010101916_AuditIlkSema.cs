using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TupBayiProje.Moduller.Audit.Altyapi.Migrations
{
    /// <inheritdoc />
    public partial class AuditIlkSema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "master");

            migrationBuilder.CreateTable(
                name: "denetim_kaydi",
                schema: "master",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    karar_id = table.Column<Guid>(type: "uuid", nullable: false),
                    servis_kimligi = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false, defaultValueSql: "current_user"),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    correlation_id = table.Column<Guid>(type: "uuid", nullable: false),
                    islem = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    sonuc = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    gerekce_kodu = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    olusturulma_zamani = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "statement_timestamp()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_denetim_kaydi", x => x.id);
                    table.CheckConstraint("ck_denetim_kaydi_islem", "islem = 'TENANT_SECRET_OKUMA_KARARI'");
                    table.CheckConstraint("ck_denetim_kaydi_servis_kimligi", "servis_kimligi = 'audit_runtime'");
                    table.CheckConstraint("ck_denetim_kaydi_sonuc_gerekce", "(sonuc = 'IZIN_VERILDI' AND gerekce_kodu IS NULL) OR (sonuc = 'REDDEDILDI' AND gerekce_kodu IS NOT NULL AND gerekce_kodu IN ('ERISIM_REDDEDILDI', 'METADATA_GECERSIZ', 'SECRET_BULUNAMADI', 'SECRET_SAGLAYICI_ERISILEMIYOR'))");
                });

            migrationBuilder.CreateIndex(
                name: "ux_denetim_kaydi_karar_id",
                schema: "master",
                table: "denetim_kaydi",
                column: "karar_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "denetim_kaydi",
                schema: "master");
        }
    }
}
