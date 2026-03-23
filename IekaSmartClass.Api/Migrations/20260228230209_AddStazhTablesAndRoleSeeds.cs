using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace IekaSmartClass.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddStazhTablesAndRoleSeeds : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Stazhet",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MentorId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    StudentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    StartDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EndDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Feedback = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Stazhet", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Stazhet_Users_MentorId",
                        column: x => x.MentorId,
                        principalTable: "Users",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_Stazhet_Users_StudentId",
                        column: x => x.StudentId,
                        principalTable: "Users",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "StazhDates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    StazhId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Date = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Time = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StazhDates", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StazhDates_Stazhet_StazhId",
                        column: x => x.StazhId,
                        principalTable: "Stazhet",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "StazhDocuments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    StazhId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FileName = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    FileUrl = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UploadedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StazhDocuments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StazhDocuments_Stazhet_StazhId",
                        column: x => x.StazhId,
                        principalTable: "Stazhet",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "Users",
                columns: new[] { "Id", "CpdHoursCompleted", "CpdHoursRequired", "Email", "FirstName", "IsActive", "LastName", "MemberRegistryNumber", "PasscodeHash", "Phone", "Role" },
                values: new object[,]
                {
                    { new Guid("22222222-2222-2222-2222-222222222222"), 0, 0, "blerina.gashi@ieka.al", "Blerina", true, "Gashi", "LEKT01", "AQAAAAIAAYagAAAAED6a5t1RPIxnU0U+Jv7wZVV4GLlHAOtc+p0g0I75+Lfym7OOEZijLRgrubjefapC7g==", "+355691234567", "Lecturer" },
                    { new Guid("33333333-3333-3333-3333-333333333333"), 4, 20, "artan.hoxha@ieka.al", "Artan", true, "Hoxha", "IEKA-2045", "AQAAAAIAAYagAAAAED6a5t1RPIxnU0U+Jv7wZVV4GLlHAOtc+p0g0I75+Lfym7OOEZijLRgrubjefapC7g==", "+355692345678", "Member" },
                    { new Guid("44444444-4444-4444-4444-444444444444"), 0, 0, "dritan.shehi@ieka.al", "Dritan", true, "Shehi", "MENT01", "AQAAAAIAAYagAAAAED6a5t1RPIxnU0U+Jv7wZVV4GLlHAOtc+p0g0I75+Lfym7OOEZijLRgrubjefapC7g==", "+355693456789", "Mentor" },
                    { new Guid("55555555-5555-5555-5555-555555555555"), 0, 0, "sonila.krasniqi@ieka.al", "Sonila", true, "Krasniqi", "STU001", "AQAAAAIAAYagAAAAED6a5t1RPIxnU0U+Jv7wZVV4GLlHAOtc+p0g0I75+Lfym7OOEZijLRgrubjefapC7g==", "+355694567890", "Student" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_StazhDates_StazhId",
                table: "StazhDates",
                column: "StazhId");

            migrationBuilder.CreateIndex(
                name: "IX_StazhDocuments_StazhId",
                table: "StazhDocuments",
                column: "StazhId");

            migrationBuilder.CreateIndex(
                name: "IX_Stazhet_MentorId",
                table: "Stazhet",
                column: "MentorId");

            migrationBuilder.CreateIndex(
                name: "IX_Stazhet_StudentId",
                table: "Stazhet",
                column: "StudentId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "StazhDates");

            migrationBuilder.DropTable(
                name: "StazhDocuments");

            migrationBuilder.DropTable(
                name: "Stazhet");

            migrationBuilder.DeleteData(
                table: "Users",
                keyColumn: "Id",
                keyValue: new Guid("22222222-2222-2222-2222-222222222222"));

            migrationBuilder.DeleteData(
                table: "Users",
                keyColumn: "Id",
                keyValue: new Guid("33333333-3333-3333-3333-333333333333"));

            migrationBuilder.DeleteData(
                table: "Users",
                keyColumn: "Id",
                keyValue: new Guid("44444444-4444-4444-4444-444444444444"));

            migrationBuilder.DeleteData(
                table: "Users",
                keyColumn: "Id",
                keyValue: new Guid("55555555-5555-5555-5555-555555555555"));
        }
    }
}
