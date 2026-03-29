using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IekaSmartClass.Api.Migrations
{
    /// <inheritdoc />
    public partial class RestructureModulesAddTopics : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // ── Step 1: Add Title column (populated from Topic) ─────────────
            migrationBuilder.AddColumn<string>(
                name: "Title",
                table: "StudentModules",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: false,
                defaultValue: "");

            migrationBuilder.Sql("UPDATE [StudentModules] SET [Title] = [Topic]");

            // ── Step 2: Create StudentModuleTopics table ────────────────────
            migrationBuilder.CreateTable(
                name: "StudentModuleTopics",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    StudentModuleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Lecturer = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    ScheduledDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Location = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StudentModuleTopics", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StudentModuleTopics_StudentModules_StudentModuleId",
                        column: x => x.StudentModuleId,
                        principalTable: "StudentModules",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_StudentModuleTopics_StudentModuleId",
                table: "StudentModuleTopics",
                column: "StudentModuleId");

            migrationBuilder.CreateIndex(
                name: "IX_StudentModuleTopics_ScheduledDate",
                table: "StudentModuleTopics",
                column: "ScheduledDate");

            // ── Step 3: Migrate existing modules → one topic per module ─────
            migrationBuilder.Sql(@"
                INSERT INTO [StudentModuleTopics] ([Id], [StudentModuleId], [Name], [Lecturer], [ScheduledDate], [Location], [CreatedAt])
                SELECT NEWID(), [Id], [Topic], [Lecturer], [ScheduledDate], [Location], [CreatedAt]
                FROM [StudentModules]
            ");

            // ── Step 4: Create StudentModuleTopicAttendances table ──────────
            migrationBuilder.CreateTable(
                name: "StudentModuleTopicAttendances",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TopicId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    StudentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AttendedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StudentModuleTopicAttendances", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StudentModuleTopicAttendances_AspNetUsers_StudentId",
                        column: x => x.StudentId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_StudentModuleTopicAttendances_StudentModuleTopics_TopicId",
                        column: x => x.TopicId,
                        principalTable: "StudentModuleTopics",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_StudentModuleTopicAttendances_TopicId_StudentId",
                table: "StudentModuleTopicAttendances",
                columns: new[] { "TopicId", "StudentId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_StudentModuleTopicAttendances_StudentId",
                table: "StudentModuleTopicAttendances",
                column: "StudentId");

            // ── Step 5: Migrate AttendedAt from assignments → topic attendances ─
            migrationBuilder.Sql(@"
                INSERT INTO [StudentModuleTopicAttendances] ([Id], [TopicId], [StudentId], [AttendedAt])
                SELECT NEWID(), t.[Id], a.[StudentId], a.[AttendedAt]
                FROM [StudentModuleAssignments] a
                INNER JOIN [StudentModuleTopics] t ON t.[StudentModuleId] = a.[StudentModuleId]
                WHERE a.[AttendedAt] IS NOT NULL
            ");

            // ── Step 6: Migrate documents FK from StudentModuleId → StudentModuleTopicId ─
            migrationBuilder.AddColumn<Guid>(
                name: "StudentModuleTopicId",
                table: "StudentModuleDocuments",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.Sql(@"
                UPDATE d SET d.[StudentModuleTopicId] = t.[Id]
                FROM [StudentModuleDocuments] d
                INNER JOIN [StudentModuleTopics] t ON t.[StudentModuleId] = d.[StudentModuleId]
            ");

            migrationBuilder.DropForeignKey(
                name: "FK_StudentModuleDocuments_StudentModules_StudentModuleId",
                table: "StudentModuleDocuments");

            migrationBuilder.DropIndex(
                name: "IX_StudentModuleDocuments_StudentModuleId",
                table: "StudentModuleDocuments");

            migrationBuilder.DropColumn(
                name: "StudentModuleId",
                table: "StudentModuleDocuments");

            migrationBuilder.CreateIndex(
                name: "IX_StudentModuleDocuments_StudentModuleTopicId",
                table: "StudentModuleDocuments",
                column: "StudentModuleTopicId");

            migrationBuilder.AddForeignKey(
                name: "FK_StudentModuleDocuments_StudentModuleTopics_StudentModuleTopicId",
                table: "StudentModuleDocuments",
                column: "StudentModuleTopicId",
                principalTable: "StudentModuleTopics",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            // ── Step 7: Drop old columns from StudentModules ────────────────
            migrationBuilder.DropIndex(
                name: "IX_StudentModules_ScheduledDate",
                table: "StudentModules");

            migrationBuilder.DropColumn(name: "Topic", table: "StudentModules");
            migrationBuilder.DropColumn(name: "Lecturer", table: "StudentModules");
            migrationBuilder.DropColumn(name: "ScheduledDate", table: "StudentModules");

            // ── Step 8: Drop AttendedAt from assignments ────────────────────
            migrationBuilder.DropColumn(name: "AttendedAt", table: "StudentModuleAssignments");

        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_StudentModuleDocuments_StudentModuleTopics_StudentModuleTopicId",
                table: "StudentModuleDocuments");

            migrationBuilder.DropTable(
                name: "StudentModuleTopicAttendances");

            migrationBuilder.DropTable(
                name: "StudentModuleTopics");

            migrationBuilder.AddColumn<string>(
                name: "Topic",
                table: "StudentModules",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: false,
                defaultValue: "");

            migrationBuilder.Sql("UPDATE [StudentModules] SET [Topic] = [Title]");

            migrationBuilder.DropColumn(name: "Title", table: "StudentModules");

            migrationBuilder.AddColumn<string>(
                name: "Lecturer",
                table: "StudentModules",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "ScheduledDate",
                table: "StudentModules",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "StudentModuleId",
                table: "StudentModuleDocuments",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.DropIndex(
                name: "IX_StudentModuleDocuments_StudentModuleTopicId",
                table: "StudentModuleDocuments");

            migrationBuilder.DropColumn(
                name: "StudentModuleTopicId",
                table: "StudentModuleDocuments");

            migrationBuilder.CreateIndex(
                name: "IX_StudentModuleDocuments_StudentModuleId",
                table: "StudentModuleDocuments",
                column: "StudentModuleId");

            migrationBuilder.AddForeignKey(
                name: "FK_StudentModuleDocuments_StudentModules_StudentModuleId",
                table: "StudentModuleDocuments",
                column: "StudentModuleId",
                principalTable: "StudentModules",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddColumn<DateTime>(
                name: "AttendedAt",
                table: "StudentModuleAssignments",
                type: "datetime2",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_StudentModules_ScheduledDate",
                table: "StudentModules",
                column: "ScheduledDate");
        }
    }
}
