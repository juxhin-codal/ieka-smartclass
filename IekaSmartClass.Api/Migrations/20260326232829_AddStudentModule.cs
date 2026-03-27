using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IekaSmartClass.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddStudentModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "StudentModules",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    YearGrade = table.Column<int>(type: "int", nullable: false),
                    Topic = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Lecturer = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StudentModules", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StudentModules_AspNetUsers_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "StudentModuleAssignments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    StudentModuleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    StudentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AssignedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StudentModuleAssignments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StudentModuleAssignments_AspNetUsers_StudentId",
                        column: x => x.StudentId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_StudentModuleAssignments_StudentModules_StudentModuleId",
                        column: x => x.StudentModuleId,
                        principalTable: "StudentModules",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "StudentModuleDocuments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    StudentModuleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FileName = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    FileUrl = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    RelativePath = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    SizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    UploadedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StudentModuleDocuments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StudentModuleDocuments_StudentModules_StudentModuleId",
                        column: x => x.StudentModuleId,
                        principalTable: "StudentModules",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_StudentModuleAssignments_StudentId",
                table: "StudentModuleAssignments",
                column: "StudentId");

            migrationBuilder.CreateIndex(
                name: "IX_StudentModuleAssignments_StudentModuleId",
                table: "StudentModuleAssignments",
                column: "StudentModuleId");

            migrationBuilder.CreateIndex(
                name: "IX_StudentModuleAssignments_StudentModuleId_StudentId",
                table: "StudentModuleAssignments",
                columns: new[] { "StudentModuleId", "StudentId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_StudentModuleDocuments_StudentModuleId",
                table: "StudentModuleDocuments",
                column: "StudentModuleId");

            migrationBuilder.CreateIndex(
                name: "IX_StudentModules_CreatedAt",
                table: "StudentModules",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_StudentModules_CreatedByUserId",
                table: "StudentModules",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_StudentModules_YearGrade",
                table: "StudentModules",
                column: "YearGrade");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "StudentModuleAssignments");

            migrationBuilder.DropTable(
                name: "StudentModuleDocuments");

            migrationBuilder.DropTable(
                name: "StudentModules");
        }
    }
}
