using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IekaSmartClass.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddTopicGeolocationFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "Latitude",
                table: "StudentModuleTopics",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "Longitude",
                table: "StudentModuleTopics",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "RequireLocation",
                table: "StudentModuleTopics",
                type: "bit",
                nullable: false,
                defaultValue: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Latitude",
                table: "StudentModuleTopics");

            migrationBuilder.DropColumn(
                name: "Longitude",
                table: "StudentModuleTopics");

            migrationBuilder.DropColumn(
                name: "RequireLocation",
                table: "StudentModuleTopics");
        }
    }
}
