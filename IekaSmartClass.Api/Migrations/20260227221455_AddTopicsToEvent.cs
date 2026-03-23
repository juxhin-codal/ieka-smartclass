using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IekaSmartClass.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddTopicsToEvent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "TopicsCsv",
                table: "Events",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TopicsCsv",
                table: "Events");
        }
    }
}
