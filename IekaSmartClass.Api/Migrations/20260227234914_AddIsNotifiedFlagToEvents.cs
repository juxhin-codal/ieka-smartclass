using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IekaSmartClass.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddIsNotifiedFlagToEvents : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsNotified",
                table: "Events",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsNotified",
                table: "Events");
        }
    }
}
