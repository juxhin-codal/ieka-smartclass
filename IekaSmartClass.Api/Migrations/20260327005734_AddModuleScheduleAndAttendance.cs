using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IekaSmartClass.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddModuleScheduleAndAttendance : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Location",
                table: "StudentModules",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ScheduledDate",
                table: "StudentModules",
                type: "datetime2",
                nullable: true);

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

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_StudentModules_ScheduledDate",
                table: "StudentModules");

            migrationBuilder.DropColumn(
                name: "Location",
                table: "StudentModules");

            migrationBuilder.DropColumn(
                name: "ScheduledDate",
                table: "StudentModules");

            migrationBuilder.DropColumn(
                name: "AttendedAt",
                table: "StudentModuleAssignments");
        }
    }
}
