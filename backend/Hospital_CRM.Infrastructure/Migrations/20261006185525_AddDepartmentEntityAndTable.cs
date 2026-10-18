using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hospital_CRM.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDepartmentEntityAndTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Departments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicId = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false, defaultValue: new Guid("00000000-0000-0000-0000-000000000000")),
                    Name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Description = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Departments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Departments_Clinics_ClinicId",
                        column: x => x.ClinicId,
                        principalTable: "Clinics",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_NurseProfiles_DepartmentId",
                table: "NurseProfiles",
                column: "DepartmentId");

            migrationBuilder.CreateIndex(
                name: "IX_Departments_ClinicId",
                table: "Departments",
                column: "ClinicId");

            migrationBuilder.CreateIndex(
                name: "IX_Departments_TenantId_ClinicId_Code",
                table: "Departments",
                columns: new[] { "TenantId", "ClinicId", "Code" },
                unique: true);

            migrationBuilder.Sql("UPDATE \"NurseProfiles\" SET \"DepartmentId\" = NULL WHERE \"DepartmentId\" IS NOT NULL AND \"DepartmentId\" NOT IN (SELECT \"Id\" FROM \"Departments\");");

            migrationBuilder.AddForeignKey(
                name: "FK_NurseProfiles_Departments_DepartmentId",
                table: "NurseProfiles",
                column: "DepartmentId",
                principalTable: "Departments",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_NurseProfiles_Departments_DepartmentId",
                table: "NurseProfiles");

            migrationBuilder.DropTable(
                name: "Departments");

            migrationBuilder.DropIndex(
                name: "IX_NurseProfiles_DepartmentId",
                table: "NurseProfiles");
        }
    }
}
