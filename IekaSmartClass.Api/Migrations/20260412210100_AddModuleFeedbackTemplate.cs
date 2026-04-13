using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace IekaSmartClass.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddModuleFeedbackTemplate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ModuleFeedbackTemplates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ModuleFeedbackTemplates", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ModuleFeedbackResponses",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TemplateId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    StudentModuleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    StudentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SubmittedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ModuleFeedbackResponses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ModuleFeedbackResponses_AspNetUsers_StudentId",
                        column: x => x.StudentId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_ModuleFeedbackResponses_ModuleFeedbackTemplates_TemplateId",
                        column: x => x.TemplateId,
                        principalTable: "ModuleFeedbackTemplates",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_ModuleFeedbackResponses_StudentModules_StudentModuleId",
                        column: x => x.StudentModuleId,
                        principalTable: "StudentModules",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ModuleFeedbackSections",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TemplateId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Order = table.Column<int>(type: "int", nullable: false),
                    RepeatsPerTopic = table.Column<bool>(type: "bit", nullable: false),
                    RatingLabelLow = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    RatingLabelHigh = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ModuleFeedbackSections", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ModuleFeedbackSections_ModuleFeedbackTemplates_TemplateId",
                        column: x => x.TemplateId,
                        principalTable: "ModuleFeedbackTemplates",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ModuleFeedbackSendLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TemplateId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    StudentModuleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SentAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    RecipientCount = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ModuleFeedbackSendLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ModuleFeedbackSendLogs_ModuleFeedbackTemplates_TemplateId",
                        column: x => x.TemplateId,
                        principalTable: "ModuleFeedbackTemplates",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_ModuleFeedbackSendLogs_StudentModules_StudentModuleId",
                        column: x => x.StudentModuleId,
                        principalTable: "StudentModules",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ModuleFeedbackQuestions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SectionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Text = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    Type = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Order = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ModuleFeedbackQuestions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ModuleFeedbackQuestions_ModuleFeedbackSections_SectionId",
                        column: x => x.SectionId,
                        principalTable: "ModuleFeedbackSections",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ModuleFeedbackAnswers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ResponseId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    QuestionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TopicId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    AnswerText = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ModuleFeedbackAnswers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ModuleFeedbackAnswers_ModuleFeedbackQuestions_QuestionId",
                        column: x => x.QuestionId,
                        principalTable: "ModuleFeedbackQuestions",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_ModuleFeedbackAnswers_ModuleFeedbackResponses_ResponseId",
                        column: x => x.ResponseId,
                        principalTable: "ModuleFeedbackResponses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ModuleFeedbackAnswers_StudentModuleTopics_TopicId",
                        column: x => x.TopicId,
                        principalTable: "StudentModuleTopics",
                        principalColumn: "Id");
                });

            migrationBuilder.InsertData(
                table: "ModuleFeedbackTemplates",
                columns: new[] { "Id", "CreatedAt", "Title", "UpdatedAt" },
                values: new object[] { new Guid("a0000001-0000-0000-0000-000000000001"), new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "FORMULAR VLERËSIMI – MODUL TRAJNIMI", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.InsertData(
                table: "ModuleFeedbackSections",
                columns: new[] { "Id", "Order", "RatingLabelHigh", "RatingLabelLow", "RepeatsPerTopic", "TemplateId", "Title" },
                values: new object[,]
                {
                    { new Guid("a0000002-0000-0000-0000-000000000001"), 0, "Shumë mirë", "Shumë keq", false, new Guid("a0000001-0000-0000-0000-000000000001"), "VLERËSIMI I PËRGJITHSHËM I ORGANIZIMIT" },
                    { new Guid("a0000002-0000-0000-0000-000000000002"), 1, "Shumë mirë", "Dobët", true, new Guid("a0000001-0000-0000-0000-000000000001"), "VLERËSIMI I LEKTORËVE" },
                    { new Guid("a0000002-0000-0000-0000-000000000003"), 2, "Shumë mirë", "Shumë keq", false, new Guid("a0000001-0000-0000-0000-000000000001"), "VLERËSIMI FINAL" }
                });

            migrationBuilder.InsertData(
                table: "ModuleFeedbackQuestions",
                columns: new[] { "Id", "Order", "SectionId", "Text", "Type" },
                values: new object[,]
                {
                    { new Guid("a0000003-0000-0000-0001-000000000001"), 0, new Guid("a0000002-0000-0000-0000-000000000001"), "Organizimi i modulit në përgjithësi", "Stars" },
                    { new Guid("a0000003-0000-0000-0001-000000000002"), 1, new Guid("a0000002-0000-0000-0000-000000000001"), "Kushtet e sallës / mjedisit të trajnimit", "Stars" },
                    { new Guid("a0000003-0000-0000-0001-000000000003"), 2, new Guid("a0000002-0000-0000-0000-000000000001"), "Materialet e trajnimit të ofruara", "Stars" },
                    { new Guid("a0000003-0000-0000-0001-000000000004"), 3, new Guid("a0000002-0000-0000-0000-000000000001"), "Respektimi i orareve të përcaktuara", "Stars" },
                    { new Guid("a0000003-0000-0000-0001-000000000005"), 4, new Guid("a0000002-0000-0000-0000-000000000001"), "Mbështetja nga stafi organizativ", "Stars" },
                    { new Guid("a0000003-0000-0000-0001-000000000006"), 5, new Guid("a0000002-0000-0000-0000-000000000001"), "Komente shtesë për organizimin (opsionale)", "FreeText" },
                    { new Guid("a0000003-0000-0000-0002-000000000001"), 0, new Guid("a0000002-0000-0000-0000-000000000002"), "Qartësia e shpjegimeve", "Stars" },
                    { new Guid("a0000003-0000-0000-0002-000000000002"), 1, new Guid("a0000002-0000-0000-0000-000000000002"), "Njohuritë e lektorit mbi temën", "Stars" },
                    { new Guid("a0000003-0000-0000-0002-000000000003"), 2, new Guid("a0000002-0000-0000-0000-000000000002"), "Lidhja e temës me praktikën profesionale", "Stars" },
                    { new Guid("a0000003-0000-0000-0002-000000000004"), 3, new Guid("a0000002-0000-0000-0000-000000000002"), "Komunikimi dhe ndërveprimi me pjesëmarrësit", "Stars" },
                    { new Guid("a0000003-0000-0000-0002-000000000005"), 4, new Guid("a0000002-0000-0000-0000-000000000002"), "Përgjigjet ndaj pyetjeve dhe diskutimeve", "Stars" },
                    { new Guid("a0000003-0000-0000-0002-000000000006"), 5, new Guid("a0000002-0000-0000-0000-000000000002"), "Menaxhimi i kohës gjatë sesionit", "Stars" },
                    { new Guid("a0000003-0000-0000-0002-000000000007"), 6, new Guid("a0000002-0000-0000-0000-000000000002"), "Dobishmëria e përgjithshme e sesionit", "Stars" },
                    { new Guid("a0000003-0000-0000-0002-000000000008"), 7, new Guid("a0000002-0000-0000-0000-000000000002"), "Komente shtesë për lektorin (opsionale)", "FreeText" },
                    { new Guid("a0000003-0000-0000-0003-000000000001"), 0, new Guid("a0000002-0000-0000-0000-000000000003"), "Moduli përmbushi pritshmëritë e mia", "Stars" },
                    { new Guid("a0000003-0000-0000-0003-000000000002"), 1, new Guid("a0000002-0000-0000-0000-000000000003"), "Çfarë ju pëlqeu më shumë në këtë modul?", "FreeText" },
                    { new Guid("a0000003-0000-0000-0003-000000000003"), 2, new Guid("a0000002-0000-0000-0000-000000000003"), "Çfarë do të sugjeronil të përmirësohet?", "FreeText" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_ModuleFeedbackAnswers_QuestionId",
                table: "ModuleFeedbackAnswers",
                column: "QuestionId");

            migrationBuilder.CreateIndex(
                name: "IX_ModuleFeedbackAnswers_ResponseId_QuestionId_TopicId",
                table: "ModuleFeedbackAnswers",
                columns: new[] { "ResponseId", "QuestionId", "TopicId" },
                unique: true,
                filter: "[TopicId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_ModuleFeedbackAnswers_TopicId",
                table: "ModuleFeedbackAnswers",
                column: "TopicId");

            migrationBuilder.CreateIndex(
                name: "IX_ModuleFeedbackQuestions_SectionId",
                table: "ModuleFeedbackQuestions",
                column: "SectionId");

            migrationBuilder.CreateIndex(
                name: "IX_ModuleFeedbackResponses_StudentId",
                table: "ModuleFeedbackResponses",
                column: "StudentId");

            migrationBuilder.CreateIndex(
                name: "IX_ModuleFeedbackResponses_StudentModuleId_StudentId",
                table: "ModuleFeedbackResponses",
                columns: new[] { "StudentModuleId", "StudentId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ModuleFeedbackResponses_TemplateId",
                table: "ModuleFeedbackResponses",
                column: "TemplateId");

            migrationBuilder.CreateIndex(
                name: "IX_ModuleFeedbackSections_TemplateId",
                table: "ModuleFeedbackSections",
                column: "TemplateId");

            migrationBuilder.CreateIndex(
                name: "IX_ModuleFeedbackSendLogs_StudentModuleId",
                table: "ModuleFeedbackSendLogs",
                column: "StudentModuleId");

            migrationBuilder.CreateIndex(
                name: "IX_ModuleFeedbackSendLogs_TemplateId",
                table: "ModuleFeedbackSendLogs",
                column: "TemplateId");

            migrationBuilder.CreateIndex(
                name: "IX_ModuleFeedbackTemplates_CreatedAt",
                table: "ModuleFeedbackTemplates",
                column: "CreatedAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ModuleFeedbackAnswers");

            migrationBuilder.DropTable(
                name: "ModuleFeedbackSendLogs");

            migrationBuilder.DropTable(
                name: "ModuleFeedbackQuestions");

            migrationBuilder.DropTable(
                name: "ModuleFeedbackResponses");

            migrationBuilder.DropTable(
                name: "ModuleFeedbackSections");

            migrationBuilder.DropTable(
                name: "ModuleFeedbackTemplates");
        }
    }
}
