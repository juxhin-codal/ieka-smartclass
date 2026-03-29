using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IekaSmartClass.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddTopicQuestionnaires : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TopicQuestionnaires",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TopicId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TopicQuestionnaires", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TopicQuestionnaires_StudentModuleTopics_TopicId",
                        column: x => x.TopicId,
                        principalTable: "StudentModuleTopics",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TopicQuestionnaireQuestions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    QuestionnaireId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Text = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    Type = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Order = table.Column<int>(type: "int", nullable: false),
                    OptionsJson = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TopicQuestionnaireQuestions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TopicQuestionnaireQuestions_TopicQuestionnaires_QuestionnaireId",
                        column: x => x.QuestionnaireId,
                        principalTable: "TopicQuestionnaires",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TopicQuestionnaireResponses",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    QuestionnaireId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    StudentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SubmittedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TopicQuestionnaireResponses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TopicQuestionnaireResponses_AspNetUsers_StudentId",
                        column: x => x.StudentId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_TopicQuestionnaireResponses_TopicQuestionnaires_QuestionnaireId",
                        column: x => x.QuestionnaireId,
                        principalTable: "TopicQuestionnaires",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TopicQuestionnaireAnswers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ResponseId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    QuestionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AnswerText = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TopicQuestionnaireAnswers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TopicQuestionnaireAnswers_TopicQuestionnaireQuestions_QuestionId",
                        column: x => x.QuestionId,
                        principalTable: "TopicQuestionnaireQuestions",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_TopicQuestionnaireAnswers_TopicQuestionnaireResponses_ResponseId",
                        column: x => x.ResponseId,
                        principalTable: "TopicQuestionnaireResponses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TopicQuestionnaireAnswers_QuestionId",
                table: "TopicQuestionnaireAnswers",
                column: "QuestionId");

            migrationBuilder.CreateIndex(
                name: "IX_TopicQuestionnaireAnswers_ResponseId_QuestionId",
                table: "TopicQuestionnaireAnswers",
                columns: new[] { "ResponseId", "QuestionId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TopicQuestionnaireQuestions_QuestionnaireId",
                table: "TopicQuestionnaireQuestions",
                column: "QuestionnaireId");

            migrationBuilder.CreateIndex(
                name: "IX_TopicQuestionnaireResponses_QuestionnaireId_StudentId",
                table: "TopicQuestionnaireResponses",
                columns: new[] { "QuestionnaireId", "StudentId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TopicQuestionnaireResponses_StudentId",
                table: "TopicQuestionnaireResponses",
                column: "StudentId");

            migrationBuilder.CreateIndex(
                name: "IX_TopicQuestionnaires_TopicId",
                table: "TopicQuestionnaires",
                column: "TopicId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TopicQuestionnaireAnswers");

            migrationBuilder.DropTable(
                name: "TopicQuestionnaireQuestions");

            migrationBuilder.DropTable(
                name: "TopicQuestionnaireResponses");

            migrationBuilder.DropTable(
                name: "TopicQuestionnaires");
        }
    }
}
