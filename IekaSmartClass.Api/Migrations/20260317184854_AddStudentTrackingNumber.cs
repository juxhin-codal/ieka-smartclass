using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IekaSmartClass.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddStudentTrackingNumber : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "StudentTrackingNumber",
                table: "AspNetUsers",
                type: "int",
                nullable: true);

            migrationBuilder.Sql(
                """
                UPDATE [AspNetUsers]
                SET [StudentTrackingNumber] = COALESCE(
                    TRY_CONVERT(int, CASE
                        WHEN [StudentNumber] LIKE 'ST[0-9]%' THEN STUFF([StudentNumber], 1, 2, '')
                        ELSE NULL
                    END),
                    TRY_CONVERT(int, CASE
                        WHEN [MemberRegistryNumber] LIKE 'ST[0-9]%' THEN
                            CASE
                                WHEN CHARINDEX('-', [MemberRegistryNumber]) > 0
                                    THEN SUBSTRING([MemberRegistryNumber], 3, CHARINDEX('-', [MemberRegistryNumber]) - 3)
                                ELSE SUBSTRING([MemberRegistryNumber], 3, LEN([MemberRegistryNumber]) - 2)
                            END
                        ELSE NULL
                    END)
                )
                WHERE [Role] = 'Student' AND [StudentTrackingNumber] IS NULL;
                """);

            migrationBuilder.UpdateData(
                table: "AspNetUsers",
                keyColumn: "Id",
                keyValue: new Guid("11111111-1111-1111-1111-111111111111"),
                column: "StudentTrackingNumber",
                value: null);

            migrationBuilder.UpdateData(
                table: "AspNetUsers",
                keyColumn: "Id",
                keyValue: new Guid("22222222-2222-2222-2222-222222222222"),
                column: "StudentTrackingNumber",
                value: null);

            migrationBuilder.UpdateData(
                table: "AspNetUsers",
                keyColumn: "Id",
                keyValue: new Guid("33333333-3333-3333-3333-333333333333"),
                column: "StudentTrackingNumber",
                value: null);

            migrationBuilder.UpdateData(
                table: "AspNetUsers",
                keyColumn: "Id",
                keyValue: new Guid("44444444-4444-4444-4444-444444444444"),
                column: "StudentTrackingNumber",
                value: null);

            migrationBuilder.UpdateData(
                table: "AspNetUsers",
                keyColumn: "Id",
                keyValue: new Guid("55555555-5555-5555-5555-555555555555"),
                column: "StudentTrackingNumber",
                value: null);

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUsers_StudentTrackingNumber",
                table: "AspNetUsers",
                column: "StudentTrackingNumber");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_AspNetUsers_StudentTrackingNumber",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "StudentTrackingNumber",
                table: "AspNetUsers");
        }
    }
}
