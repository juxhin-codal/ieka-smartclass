using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IekaSmartClass.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddStudentModuleTopicFeedback : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "FeedbackToken",
                table: "StudentModuleTopicAttendances",
                type: "nvarchar(450)",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "StudentModuleTopicFeedbacks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TopicId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    StudentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Rating = table.Column<int>(type: "int", nullable: false),
                    Comment = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    IsAnonymous = table.Column<bool>(type: "bit", nullable: false),
                    SubmittedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StudentModuleTopicFeedbacks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StudentModuleTopicFeedbacks_AspNetUsers_StudentId",
                        column: x => x.StudentId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_StudentModuleTopicFeedbacks_StudentModuleTopics_TopicId",
                        column: x => x.TopicId,
                        principalTable: "StudentModuleTopics",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_StudentModuleTopicAttendances_FeedbackToken",
                table: "StudentModuleTopicAttendances",
                column: "FeedbackToken",
                unique: true,
                filter: "[FeedbackToken] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_StudentModuleTopicFeedbacks_StudentId",
                table: "StudentModuleTopicFeedbacks",
                column: "StudentId");

            migrationBuilder.CreateIndex(
                name: "IX_StudentModuleTopicFeedbacks_TopicId_StudentId",
                table: "StudentModuleTopicFeedbacks",
                columns: new[] { "TopicId", "StudentId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "StudentModuleTopicFeedbacks");

            migrationBuilder.DropIndex(
                name: "IX_StudentModuleTopicAttendances_FeedbackToken",
                table: "StudentModuleTopicAttendances");

            migrationBuilder.DropColumn(
                name: "FeedbackToken",
                table: "StudentModuleTopicAttendances");
        }
    }
}
