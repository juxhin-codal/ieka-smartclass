using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IekaSmartClass.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddStudentTrainingSchedulingAndAttendance : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "StudentTrainingSessions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    StudentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MentorId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ScheduledDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    StartTime = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    EndTime = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    AttendanceStatus = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    RejectionReason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StudentTrainingSessions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StudentTrainingSessions_AspNetUsers_MentorId",
                        column: x => x.MentorId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_StudentTrainingSessions_AspNetUsers_StudentId",
                        column: x => x.StudentId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_StudentTrainingSessions_MentorId",
                table: "StudentTrainingSessions",
                column: "MentorId");

            migrationBuilder.CreateIndex(
                name: "IX_StudentTrainingSessions_ScheduledDate",
                table: "StudentTrainingSessions",
                column: "ScheduledDate");

            migrationBuilder.CreateIndex(
                name: "IX_StudentTrainingSessions_StudentId",
                table: "StudentTrainingSessions",
                column: "StudentId");

            migrationBuilder.CreateIndex(
                name: "IX_StudentTrainingSessions_StudentId_MentorId_ScheduledDate",
                table: "StudentTrainingSessions",
                columns: new[] { "StudentId", "MentorId", "ScheduledDate" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "StudentTrainingSessions");
        }
    }
}
