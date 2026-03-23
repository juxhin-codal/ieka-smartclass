using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IekaSmartClass.Api.Migrations
{
    /// <inheritdoc />
    public partial class SeedAdminUser : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                table: "Users",
                columns: new[] { "Id", "CpdHoursCompleted", "CpdHoursRequired", "Email", "FirstName", "IsActive", "LastName", "MemberRegistryNumber", "PasscodeHash", "Phone", "Role" },
                values: new object[] { new Guid("11111111-1111-1111-1111-111111111111"), 0, 0, "admin@ieka.al", "Admin", true, "System", "admin001", "AQAAAAIAAYagAAAAED6a5t1RPIxnU0U+Jv7wZVV4GLlHAOtc+p0g0I75+Lfym7OOEZijLRgrubjefapC7g==", null, "Admin" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "Users",
                keyColumn: "Id",
                keyValue: new Guid("11111111-1111-1111-1111-111111111111"));
        }
    }
}
