using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IekaSmartClass.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddLoginTwoFactorAndAspNetUsers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AspNetUserClaims_Users_UserId",
                table: "AspNetUserClaims");

            migrationBuilder.DropForeignKey(
                name: "FK_AspNetUserLogins_Users_UserId",
                table: "AspNetUserLogins");

            migrationBuilder.DropForeignKey(
                name: "FK_AspNetUserTokens_Users_UserId",
                table: "AspNetUserTokens");

            migrationBuilder.DropForeignKey(
                name: "FK_Participants_Users_UserId",
                table: "Participants");

            migrationBuilder.DropForeignKey(
                name: "FK_Stazhet_Users_MentorId",
                table: "Stazhet");

            migrationBuilder.DropForeignKey(
                name: "FK_Stazhet_Users_StudentId",
                table: "Stazhet");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Users",
                table: "Users");

            migrationBuilder.RenameTable(
                name: "Users",
                newName: "AspNetUsers");

            migrationBuilder.RenameIndex(
                name: "IX_Users_MemberRegistryNumber",
                table: "AspNetUsers",
                newName: "IX_AspNetUsers_MemberRegistryNumber");

            migrationBuilder.AddColumn<string>(
                name: "LoginOtpChallengeId",
                table: "AspNetUsers",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LoginOtpCode",
                table: "AspNetUsers",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LoginOtpExpiresAt",
                table: "AspNetUsers",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddPrimaryKey(
                name: "PK_AspNetUsers",
                table: "AspNetUsers",
                column: "Id");

            migrationBuilder.UpdateData(
                table: "AspNetUsers",
                keyColumn: "Id",
                keyValue: new Guid("11111111-1111-1111-1111-111111111111"),
                columns: new[] { "LoginOtpChallengeId", "LoginOtpCode", "LoginOtpExpiresAt" },
                values: new object[] { null, null, null });

            migrationBuilder.UpdateData(
                table: "AspNetUsers",
                keyColumn: "Id",
                keyValue: new Guid("22222222-2222-2222-2222-222222222222"),
                columns: new[] { "LoginOtpChallengeId", "LoginOtpCode", "LoginOtpExpiresAt" },
                values: new object[] { null, null, null });

            migrationBuilder.UpdateData(
                table: "AspNetUsers",
                keyColumn: "Id",
                keyValue: new Guid("33333333-3333-3333-3333-333333333333"),
                columns: new[] { "LoginOtpChallengeId", "LoginOtpCode", "LoginOtpExpiresAt" },
                values: new object[] { null, null, null });

            migrationBuilder.UpdateData(
                table: "AspNetUsers",
                keyColumn: "Id",
                keyValue: new Guid("44444444-4444-4444-4444-444444444444"),
                columns: new[] { "LoginOtpChallengeId", "LoginOtpCode", "LoginOtpExpiresAt" },
                values: new object[] { null, null, null });

            migrationBuilder.UpdateData(
                table: "AspNetUsers",
                keyColumn: "Id",
                keyValue: new Guid("55555555-5555-5555-5555-555555555555"),
                columns: new[] { "LoginOtpChallengeId", "LoginOtpCode", "LoginOtpExpiresAt" },
                values: new object[] { null, null, null });

            migrationBuilder.AddForeignKey(
                name: "FK_AspNetUserClaims_AspNetUsers_UserId",
                table: "AspNetUserClaims",
                column: "UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_AspNetUserLogins_AspNetUsers_UserId",
                table: "AspNetUserLogins",
                column: "UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_AspNetUserTokens_AspNetUsers_UserId",
                table: "AspNetUserTokens",
                column: "UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Participants_AspNetUsers_UserId",
                table: "Participants",
                column: "UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Stazhet_AspNetUsers_MentorId",
                table: "Stazhet",
                column: "MentorId",
                principalTable: "AspNetUsers",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Stazhet_AspNetUsers_StudentId",
                table: "Stazhet",
                column: "StudentId",
                principalTable: "AspNetUsers",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AspNetUserClaims_AspNetUsers_UserId",
                table: "AspNetUserClaims");

            migrationBuilder.DropForeignKey(
                name: "FK_AspNetUserLogins_AspNetUsers_UserId",
                table: "AspNetUserLogins");

            migrationBuilder.DropForeignKey(
                name: "FK_AspNetUserTokens_AspNetUsers_UserId",
                table: "AspNetUserTokens");

            migrationBuilder.DropForeignKey(
                name: "FK_Participants_AspNetUsers_UserId",
                table: "Participants");

            migrationBuilder.DropForeignKey(
                name: "FK_Stazhet_AspNetUsers_MentorId",
                table: "Stazhet");

            migrationBuilder.DropForeignKey(
                name: "FK_Stazhet_AspNetUsers_StudentId",
                table: "Stazhet");

            migrationBuilder.DropPrimaryKey(
                name: "PK_AspNetUsers",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "LoginOtpChallengeId",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "LoginOtpCode",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "LoginOtpExpiresAt",
                table: "AspNetUsers");

            migrationBuilder.RenameTable(
                name: "AspNetUsers",
                newName: "Users");

            migrationBuilder.RenameIndex(
                name: "IX_AspNetUsers_MemberRegistryNumber",
                table: "Users",
                newName: "IX_Users_MemberRegistryNumber");

            migrationBuilder.AddPrimaryKey(
                name: "PK_Users",
                table: "Users",
                column: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_AspNetUserClaims_Users_UserId",
                table: "AspNetUserClaims",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_AspNetUserLogins_Users_UserId",
                table: "AspNetUserLogins",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_AspNetUserTokens_Users_UserId",
                table: "AspNetUserTokens",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Participants_Users_UserId",
                table: "Participants",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Stazhet_Users_MentorId",
                table: "Stazhet",
                column: "MentorId",
                principalTable: "Users",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Stazhet_Users_StudentId",
                table: "Stazhet",
                column: "StudentId",
                principalTable: "Users",
                principalColumn: "Id");
        }
    }
}
