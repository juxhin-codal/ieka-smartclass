using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IekaSmartClass.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddEventFeedbacks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "EventFeedbacks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EventItemId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DateId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SessionRating = table.Column<int>(type: "int", nullable: false),
                    SessionComments = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LecturerRating = table.Column<int>(type: "int", nullable: false),
                    LecturerComments = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Suggestions = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    SubmittedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EventFeedbacks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EventFeedbacks_Events_EventItemId",
                        column: x => x.EventItemId,
                        principalTable: "Events",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EventFeedbacks_EventItemId",
                table: "EventFeedbacks",
                column: "EventItemId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EventFeedbacks");
        }
    }
}
