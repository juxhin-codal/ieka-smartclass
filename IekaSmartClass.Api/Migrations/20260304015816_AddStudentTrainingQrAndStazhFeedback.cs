using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IekaSmartClass.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddStudentTrainingQrAndStazhFeedback : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "StudentTrainingStazhet",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    StudentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MentorId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    StartedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EndedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    EndedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    MentorFeedbackRating = table.Column<int>(type: "int", nullable: true),
                    MentorFeedbackComment = table.Column<string>(type: "nvarchar(3000)", maxLength: 3000, nullable: true),
                    MentorFeedbackSubmittedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    StudentFeedbackRating = table.Column<int>(type: "int", nullable: true),
                    StudentFeedbackComment = table.Column<string>(type: "nvarchar(3000)", maxLength: 3000, nullable: true),
                    StudentFeedbackSubmittedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    StudentFeedbackToken = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    StudentFeedbackTokenExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StudentTrainingStazhet", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StudentTrainingStazhet_AspNetUsers_EndedByUserId",
                        column: x => x.EndedByUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_StudentTrainingStazhet_AspNetUsers_MentorId",
                        column: x => x.MentorId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_StudentTrainingStazhet_AspNetUsers_StudentId",
                        column: x => x.StudentId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_StudentTrainingStazhet_EndedByUserId",
                table: "StudentTrainingStazhet",
                column: "EndedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_StudentTrainingStazhet_MentorId",
                table: "StudentTrainingStazhet",
                column: "MentorId");

            migrationBuilder.CreateIndex(
                name: "IX_StudentTrainingStazhet_Status",
                table: "StudentTrainingStazhet",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_StudentTrainingStazhet_StudentFeedbackToken",
                table: "StudentTrainingStazhet",
                column: "StudentFeedbackToken",
                unique: true,
                filter: "[StudentFeedbackToken] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_StudentTrainingStazhet_StudentId",
                table: "StudentTrainingStazhet",
                column: "StudentId");

            migrationBuilder.CreateIndex(
                name: "IX_StudentTrainingStazhet_StudentId_MentorId_Status",
                table: "StudentTrainingStazhet",
                columns: new[] { "StudentId", "MentorId", "Status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "StudentTrainingStazhet");
        }
    }
}
