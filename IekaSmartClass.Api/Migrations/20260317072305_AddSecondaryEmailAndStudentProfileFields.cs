using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IekaSmartClass.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddSecondaryEmailAndStudentProfileFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Company",
                table: "AspNetUsers",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "District",
                table: "AspNetUsers",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Email2",
                table: "AspNetUsers",
                type: "nvarchar(256)",
                maxLength: 256,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "StudentEndYear",
                table: "AspNetUsers",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "StudentNumber",
                table: "AspNetUsers",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "StudentStartYear",
                table: "AspNetUsers",
                type: "int",
                nullable: true);

            migrationBuilder.UpdateData(
                table: "AspNetUsers",
                keyColumn: "Id",
                keyValue: new Guid("11111111-1111-1111-1111-111111111111"),
                columns: new[] { "Company", "District", "Email2", "StudentEndYear", "StudentNumber", "StudentStartYear" },
                values: new object[] { null, null, null, null, null, null });

            migrationBuilder.UpdateData(
                table: "AspNetUsers",
                keyColumn: "Id",
                keyValue: new Guid("22222222-2222-2222-2222-222222222222"),
                columns: new[] { "Company", "District", "Email2", "StudentEndYear", "StudentNumber", "StudentStartYear" },
                values: new object[] { null, null, null, null, null, null });

            migrationBuilder.UpdateData(
                table: "AspNetUsers",
                keyColumn: "Id",
                keyValue: new Guid("33333333-3333-3333-3333-333333333333"),
                columns: new[] { "Company", "District", "Email2", "StudentEndYear", "StudentNumber", "StudentStartYear" },
                values: new object[] { null, null, null, null, null, null });

            migrationBuilder.UpdateData(
                table: "AspNetUsers",
                keyColumn: "Id",
                keyValue: new Guid("44444444-4444-4444-4444-444444444444"),
                columns: new[] { "Company", "District", "Email2", "StudentEndYear", "StudentNumber", "StudentStartYear" },
                values: new object[] { null, null, null, null, null, null });

            migrationBuilder.UpdateData(
                table: "AspNetUsers",
                keyColumn: "Id",
                keyValue: new Guid("55555555-5555-5555-5555-555555555555"),
                columns: new[] { "Company", "District", "Email2", "StudentEndYear", "StudentNumber", "StudentStartYear" },
                values: new object[] { null, null, null, null, null, null });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Company",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "District",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "Email2",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "StudentEndYear",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "StudentNumber",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "StudentStartYear",
                table: "AspNetUsers");
        }
    }
}
