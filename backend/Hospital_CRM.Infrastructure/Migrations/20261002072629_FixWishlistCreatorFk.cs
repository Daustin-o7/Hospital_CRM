using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hospital_CRM.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class FixWishlistCreatorFk : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_WishlistItems_Users_CreatorId",
                table: "WishlistItems");

            migrationBuilder.DropIndex(
                name: "IX_WishlistItems_CreatorId",
                table: "WishlistItems");

            migrationBuilder.DropColumn(
                name: "CreatorId",
                table: "WishlistItems");

            migrationBuilder.AlterColumn<string>(
                name: "Text",
                table: "WishlistItems",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.CreateIndex(
                name: "IX_WishlistItems_CreatedBy",
                table: "WishlistItems",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_WishlistItems_TenantId_Status",
                table: "WishlistItems",
                columns: new[] { "TenantId", "Status" });

            migrationBuilder.AddForeignKey(
                name: "FK_WishlistItems_Users_CreatedBy",
                table: "WishlistItems",
                column: "CreatedBy",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_WishlistItems_Users_CreatedBy",
                table: "WishlistItems");

            migrationBuilder.DropIndex(
                name: "IX_WishlistItems_CreatedBy",
                table: "WishlistItems");

            migrationBuilder.DropIndex(
                name: "IX_WishlistItems_TenantId_Status",
                table: "WishlistItems");

            migrationBuilder.AlterColumn<string>(
                name: "Text",
                table: "WishlistItems",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(1000)",
                oldMaxLength: 1000);

            migrationBuilder.AddColumn<Guid>(
                name: "CreatorId",
                table: "WishlistItems",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.CreateIndex(
                name: "IX_WishlistItems_CreatorId",
                table: "WishlistItems",
                column: "CreatorId");

            migrationBuilder.AddForeignKey(
                name: "FK_WishlistItems_Users_CreatorId",
                table: "WishlistItems",
                column: "CreatorId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
