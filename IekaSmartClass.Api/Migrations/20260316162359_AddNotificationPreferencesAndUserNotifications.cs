using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IekaSmartClass.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddNotificationPreferencesAndUserNotifications : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "NotifyBookingOpen",
                table: "AspNetUsers",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "NotifyByEmail",
                table: "AspNetUsers",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "NotifyBySms",
                table: "AspNetUsers",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "NotifyCpdDeadline",
                table: "AspNetUsers",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "NotifySessionReminder",
                table: "AspNetUsers",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "NotifySurveyReminder",
                table: "AspNetUsers",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.CreateTable(
                name: "UserNotifications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Type = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Title = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Body = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    Link = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    IsRead = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ReadAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    DeduplicationKey = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserNotifications", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserNotifications_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.UpdateData(
                table: "AspNetUsers",
                keyColumn: "Id",
                keyValue: new Guid("11111111-1111-1111-1111-111111111111"),
                columns: new[] { "NotifyBookingOpen", "NotifyByEmail", "NotifyCpdDeadline", "NotifySessionReminder", "NotifySurveyReminder" },
                values: new object[] { true, true, true, true, true });

            migrationBuilder.UpdateData(
                table: "AspNetUsers",
                keyColumn: "Id",
                keyValue: new Guid("22222222-2222-2222-2222-222222222222"),
                columns: new[] { "NotifyBookingOpen", "NotifyByEmail", "NotifyCpdDeadline", "NotifySessionReminder", "NotifySurveyReminder" },
                values: new object[] { true, true, true, true, true });

            migrationBuilder.UpdateData(
                table: "AspNetUsers",
                keyColumn: "Id",
                keyValue: new Guid("33333333-3333-3333-3333-333333333333"),
                columns: new[] { "NotifyBookingOpen", "NotifyByEmail", "NotifyCpdDeadline", "NotifySessionReminder", "NotifySurveyReminder" },
                values: new object[] { true, true, true, true, true });

            migrationBuilder.UpdateData(
                table: "AspNetUsers",
                keyColumn: "Id",
                keyValue: new Guid("44444444-4444-4444-4444-444444444444"),
                columns: new[] { "NotifyBookingOpen", "NotifyByEmail", "NotifyCpdDeadline", "NotifySessionReminder", "NotifySurveyReminder" },
                values: new object[] { true, true, true, true, true });

            migrationBuilder.UpdateData(
                table: "AspNetUsers",
                keyColumn: "Id",
                keyValue: new Guid("55555555-5555-5555-5555-555555555555"),
                columns: new[] { "NotifyBookingOpen", "NotifyByEmail", "NotifyCpdDeadline", "NotifySessionReminder", "NotifySurveyReminder" },
                values: new object[] { true, true, true, true, true });

            migrationBuilder.CreateIndex(
                name: "IX_UserNotifications_CreatedAtUtc",
                table: "UserNotifications",
                column: "CreatedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_UserNotifications_DeduplicationKey",
                table: "UserNotifications",
                column: "DeduplicationKey",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserNotifications_UserId",
                table: "UserNotifications",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UserNotifications");

            migrationBuilder.DropColumn(
                name: "NotifyBookingOpen",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "NotifyByEmail",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "NotifyBySms",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "NotifyCpdDeadline",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "NotifySessionReminder",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "NotifySurveyReminder",
                table: "AspNetUsers");
        }
    }
}
