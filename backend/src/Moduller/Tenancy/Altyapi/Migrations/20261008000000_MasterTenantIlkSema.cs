using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TupBayiProje.Moduller.Tenancy.Altyapi.Migrations
{
    /// <inheritdoc />
    public partial class MasterTenantIlkSema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "master");

            migrationBuilder.CreateTable(
                name: "tenant",
                schema: "master",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_tenant", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "tenant_veritabani",
                schema: "master",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_tenant_veritabani", x => x.id);
                    table.ForeignKey(
                        name: "fk_tenant_veritabani_tenant",
                        column: x => x.tenant_id,
                        principalSchema: "master",
                        principalTable: "tenant",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_tenant_veritabani_tenant_id",
                schema: "master",
                table: "tenant_veritabani",
                column: "tenant_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Guvenlik degismezi: Down yalniz bos, atilabilir DB'de calisir; tenant verisi DROP ile kaybolamaz.
            // Tablolar once kilitlenir, boylece kontrol ile DROP arasinda eszamanli INSERT araya giremez.
            // Satir varsa DROP'tan once hata verilir; migration transaction'i geri alinir, sema ve gecmis korunur.
            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    LOCK TABLE master.tenant, master.tenant_veritabani IN ACCESS EXCLUSIVE MODE;
                    IF EXISTS (SELECT 1 FROM master.tenant) OR EXISTS (SELECT 1 FROM master.tenant_veritabani) THEN
                        RAISE EXCEPTION 'TBP-59: master tenant tablolari bos degil; MasterTenantIlkSema geri alinamaz.'
                            USING ERRCODE = 'object_not_in_prerequisite_state';
                    END IF;
                END
                $$;
                """);

            migrationBuilder.DropTable(
                name: "tenant_veritabani",
                schema: "master");

            migrationBuilder.DropTable(
                name: "tenant",
                schema: "master");
        }
    }
}
