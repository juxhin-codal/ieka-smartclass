using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IekaSmartClass.Api.Migrations
{
    /// <inheritdoc />
    public partial class AllowMultipleQuestionnairesPerTopic : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_TopicQuestionnaires_TopicId",
                table: "TopicQuestionnaires");

            migrationBuilder.CreateIndex(
                name: "IX_TopicQuestionnaires_TopicId",
                table: "TopicQuestionnaires",
                column: "TopicId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_TopicQuestionnaires_TopicId",
                table: "TopicQuestionnaires");

            migrationBuilder.CreateIndex(
                name: "IX_TopicQuestionnaires_TopicId",
                table: "TopicQuestionnaires",
                column: "TopicId",
                unique: true);
        }
    }
}
