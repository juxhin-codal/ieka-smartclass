using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IekaSmartClass.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddLecturerFeedbackToken : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "FeedbackToken",
                table: "Participants",
                type: "nvarchar(450)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsAnonymous",
                table: "EventFeedbacks",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "IX_Participants_FeedbackToken",
                table: "Participants",
                column: "FeedbackToken",
                unique: true,
                filter: "[FeedbackToken] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Participants_FeedbackToken",
                table: "Participants");

            migrationBuilder.DropColumn(
                name: "FeedbackToken",
                table: "Participants");

            migrationBuilder.DropColumn(
                name: "IsAnonymous",
                table: "EventFeedbacks");
        }
    }
}
