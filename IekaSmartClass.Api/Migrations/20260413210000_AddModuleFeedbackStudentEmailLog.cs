using IekaSmartClass.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IekaSmartClass.Api.Migrations
{
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20260413210000_AddModuleFeedbackStudentEmailLog")]
    public partial class AddModuleFeedbackStudentEmailLog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ModuleFeedbackStudentEmailLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    StudentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    StudentModuleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SectionKey = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    SentAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ModuleFeedbackStudentEmailLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ModuleFeedbackStudentEmailLogs_AspNetUsers_StudentId",
                        column: x => x.StudentId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ModuleFeedbackStudentEmailLogs_StudentModules_StudentModuleId",
                        column: x => x.StudentModuleId,
                        principalTable: "StudentModules",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ModuleFeedbackStudentEmailLogs_StudentId",
                table: "ModuleFeedbackStudentEmailLogs",
                column: "StudentId");

            migrationBuilder.CreateIndex(
                name: "IX_ModuleFeedbackStudentEmailLogs_StudentModuleId",
                table: "ModuleFeedbackStudentEmailLogs",
                column: "StudentModuleId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "ModuleFeedbackStudentEmailLogs");
        }
    }
}
