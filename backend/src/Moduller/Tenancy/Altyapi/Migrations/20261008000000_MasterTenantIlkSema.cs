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
            migrationBuilder.DropTable(
                name: "tenant_veritabani",
                schema: "master");

            migrationBuilder.DropTable(
                name: "tenant",
                schema: "master");
        }
    }
}
