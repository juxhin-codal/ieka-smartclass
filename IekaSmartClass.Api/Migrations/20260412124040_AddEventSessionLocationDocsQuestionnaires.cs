using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IekaSmartClass.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddEventSessionLocationDocsQuestionnaires : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "Latitude",
                table: "EventDates",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "Longitude",
                table: "EventDates",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "RequireLocation",
                table: "EventDates",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "EventDateDocuments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EventDateId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FileName = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    FileUrl = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    RelativePath = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    SizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    UploadedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UploadedById = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EventDateDocuments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EventDateDocuments_EventDates_EventDateId",
                        column: x => x.EventDateId,
                        principalTable: "EventDates",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EventQuestionnaires",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EventItemId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EventQuestionnaires", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EventQuestionnaires_Events_EventItemId",
                        column: x => x.EventItemId,
                        principalTable: "Events",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EventQuestionnaireQuestions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    QuestionnaireId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Text = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    Type = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Order = table.Column<int>(type: "int", nullable: false),
                    OptionsJson = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: true),
                    CorrectAnswer = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EventQuestionnaireQuestions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EventQuestionnaireQuestions_EventQuestionnaires_QuestionnaireId",
                        column: x => x.QuestionnaireId,
                        principalTable: "EventQuestionnaires",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EventQuestionnaireResponses",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    QuestionnaireId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SubmittedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EventQuestionnaireResponses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EventQuestionnaireResponses_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_EventQuestionnaireResponses_EventQuestionnaires_QuestionnaireId",
                        column: x => x.QuestionnaireId,
                        principalTable: "EventQuestionnaires",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EventQuestionnaireAnswers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ResponseId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    QuestionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AnswerText = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EventQuestionnaireAnswers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EventQuestionnaireAnswers_EventQuestionnaireQuestions_QuestionId",
                        column: x => x.QuestionId,
                        principalTable: "EventQuestionnaireQuestions",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_EventQuestionnaireAnswers_EventQuestionnaireResponses_ResponseId",
                        column: x => x.ResponseId,
                        principalTable: "EventQuestionnaireResponses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EventDateDocuments_EventDateId",
                table: "EventDateDocuments",
                column: "EventDateId");

            migrationBuilder.CreateIndex(
                name: "IX_EventQuestionnaireAnswers_QuestionId",
                table: "EventQuestionnaireAnswers",
                column: "QuestionId");

            migrationBuilder.CreateIndex(
                name: "IX_EventQuestionnaireAnswers_ResponseId_QuestionId",
                table: "EventQuestionnaireAnswers",
                columns: new[] { "ResponseId", "QuestionId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EventQuestionnaireQuestions_QuestionnaireId",
                table: "EventQuestionnaireQuestions",
                column: "QuestionnaireId");

            migrationBuilder.CreateIndex(
                name: "IX_EventQuestionnaireResponses_QuestionnaireId_UserId",
                table: "EventQuestionnaireResponses",
                columns: new[] { "QuestionnaireId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EventQuestionnaireResponses_UserId",
                table: "EventQuestionnaireResponses",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_EventQuestionnaires_EventItemId",
                table: "EventQuestionnaires",
                column: "EventItemId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EventDateDocuments");

            migrationBuilder.DropTable(
                name: "EventQuestionnaireAnswers");

            migrationBuilder.DropTable(
                name: "EventQuestionnaireQuestions");

            migrationBuilder.DropTable(
                name: "EventQuestionnaireResponses");

            migrationBuilder.DropTable(
                name: "EventQuestionnaires");

            migrationBuilder.DropColumn(
                name: "Latitude",
                table: "EventDates");

            migrationBuilder.DropColumn(
                name: "Longitude",
                table: "EventDates");

            migrationBuilder.DropColumn(
                name: "RequireLocation",
                table: "EventDates");
        }
    }
}
