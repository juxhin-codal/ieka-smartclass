using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IekaSmartClass.Api.Migrations
{
    /// <inheritdoc />
    public partial class UpdateSeedAdminToArtanXhiani : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "AspNetUsers",
                keyColumn: "Id",
                keyValue: new Guid("11111111-1111-1111-1111-111111111111"),
                columns: new[] { "Email", "FirstName", "LastName", "NormalizedEmail", "NormalizedUserName", "UserName" },
                values: new object[] { "artan.xhiani@ieka.al", "Artan", "Xhiani", "ARTAN.XHIANI@IEKA.AL", "ARTAN.XHIANI@IEKA.AL", "artan.xhiani@ieka.al" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "AspNetUsers",
                keyColumn: "Id",
                keyValue: new Guid("11111111-1111-1111-1111-111111111111"),
                columns: new[] { "Email", "FirstName", "LastName", "NormalizedEmail", "NormalizedUserName", "UserName" },
                values: new object[] { "admin@ieka.al", "Admin", "System", "ADMIN@IEKA.AL", "ADMIN@IEKA.AL", "admin@ieka.al" });
        }
    }
}
