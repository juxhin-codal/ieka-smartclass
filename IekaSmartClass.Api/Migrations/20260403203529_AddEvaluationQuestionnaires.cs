using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IekaSmartClass.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddEvaluationQuestionnaires : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "EvaluationQuestionnaires",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    EmailSubject = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    EmailBody = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: false),
                    TargetMembers = table.Column<bool>(type: "bit", nullable: false),
                    TargetStudents = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EvaluationQuestionnaires", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "EvaluationQuestions",
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
                    table.PrimaryKey("PK_EvaluationQuestions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EvaluationQuestions_EvaluationQuestionnaires_QuestionnaireId",
                        column: x => x.QuestionnaireId,
                        principalTable: "EvaluationQuestionnaires",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EvaluationResponses",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    QuestionnaireId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SubmittedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EvaluationResponses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EvaluationResponses_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_EvaluationResponses_EvaluationQuestionnaires_QuestionnaireId",
                        column: x => x.QuestionnaireId,
                        principalTable: "EvaluationQuestionnaires",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EvaluationSendLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    QuestionnaireId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SentAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    SentToMembers = table.Column<bool>(type: "bit", nullable: false),
                    SentToStudents = table.Column<bool>(type: "bit", nullable: false),
                    RecipientCount = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EvaluationSendLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EvaluationSendLogs_EvaluationQuestionnaires_QuestionnaireId",
                        column: x => x.QuestionnaireId,
                        principalTable: "EvaluationQuestionnaires",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EvaluationAnswers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ResponseId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    QuestionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AnswerText = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EvaluationAnswers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EvaluationAnswers_EvaluationQuestions_QuestionId",
                        column: x => x.QuestionId,
                        principalTable: "EvaluationQuestions",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_EvaluationAnswers_EvaluationResponses_ResponseId",
                        column: x => x.ResponseId,
                        principalTable: "EvaluationResponses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationAnswers_QuestionId",
                table: "EvaluationAnswers",
                column: "QuestionId");

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationAnswers_ResponseId_QuestionId",
                table: "EvaluationAnswers",
                columns: new[] { "ResponseId", "QuestionId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationQuestionnaires_CreatedAt",
                table: "EvaluationQuestionnaires",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationQuestions_QuestionnaireId",
                table: "EvaluationQuestions",
                column: "QuestionnaireId");

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationResponses_QuestionnaireId_UserId",
                table: "EvaluationResponses",
                columns: new[] { "QuestionnaireId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationResponses_UserId",
                table: "EvaluationResponses",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationSendLogs_QuestionnaireId",
                table: "EvaluationSendLogs",
                column: "QuestionnaireId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EvaluationAnswers");

            migrationBuilder.DropTable(
                name: "EvaluationSendLogs");

            migrationBuilder.DropTable(
                name: "EvaluationQuestions");

            migrationBuilder.DropTable(
                name: "EvaluationResponses");

            migrationBuilder.DropTable(
                name: "EvaluationQuestionnaires");
        }
    }
}
