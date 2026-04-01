using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace IekaSmartClass.Api.Migrations
{
    /// <inheritdoc />
    public partial class SecondADminUser : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "AspNetUsers",
                keyColumn: "Id",
                keyValue: new Guid("22222222-2222-2222-2222-222222222222"));

            migrationBuilder.DeleteData(
                table: "AspNetUsers",
                keyColumn: "Id",
                keyValue: new Guid("33333333-3333-3333-3333-333333333333"));

            migrationBuilder.DeleteData(
                table: "AspNetUsers",
                keyColumn: "Id",
                keyValue: new Guid("55555555-5555-5555-5555-555555555555"));

            migrationBuilder.DeleteData(
                table: "AspNetUsers",
                keyColumn: "Id",
                keyValue: new Guid("44444444-4444-4444-4444-444444444444"));

            migrationBuilder.InsertData(
                table: "AspNetUsers",
                columns: new[] { "Id", "AccessFailedCount", "Company", "ConcurrencyStamp", "CpdHoursCompleted", "CpdHoursRequired", "District", "Email", "Email2", "EmailConfirmationCode", "EmailConfirmationExpiresAt", "EmailConfirmed", "FirstName", "IsActive", "IsPendingConfirmation", "LastName", "LockoutEnabled", "LockoutEnd", "LoginOtpChallengeId", "LoginOtpCode", "LoginOtpExpiresAt", "MemberRegistryNumber", "MentorId", "NormalizedEmail", "NormalizedUserName", "NotifyBookingOpen", "NotifyByEmail", "NotifyCpdDeadline", "NotifySessionReminder", "NotifySurveyReminder", "PasscodeHash", "PasswordResetCode", "PasswordResetExpiresAt", "Phone", "PhoneNumberConfirmed", "Role", "SecurityStamp", "StudentEndYear", "StudentNumber", "StudentStartYear", "StudentTrackingNumber", "StudentValidUntilUtc", "StudentYear2StartYear", "StudentYear3StartYear", "TwoFactorEnabled", "UserName", "YearlyPaymentPaidYear" },
                values: new object[] { new Guid("f4a7e2c1-9b3d-4e8f-a6d5-7c2b1e0f3a9d"), 0, null, "b2c3d4e5-f6a7-8901-bcde-f12345678901", 0, 0, null, "juxhin@codalhub.com", null, null, null, true, "Juxhin", true, false, "Codalhub", false, null, null, null, null, "admin002", null, "JUXHIN@CODALHUB.COM", "JUXHIN@CODALHUB.COM", true, true, true, true, true, "AQAAAAIAAYagAAAAED6a5t1RPIxnU0U+Jv7wZVV4GLlHAOtc+p0g0I75+Lfym7OOEZijLRgrubjefapC7g==", null, null, null, false, "Admin", "a1b2c3d4-e5f6-7890-abcd-ef1234567890", null, null, null, null, null, null, null, false, "juxhin@codalhub.com", null });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "AspNetUsers",
                keyColumn: "Id",
                keyValue: new Guid("f4a7e2c1-9b3d-4e8f-a6d5-7c2b1e0f3a9d"));

            migrationBuilder.InsertData(
                table: "AspNetUsers",
                columns: new[] { "Id", "AccessFailedCount", "Company", "ConcurrencyStamp", "CpdHoursCompleted", "CpdHoursRequired", "District", "Email", "Email2", "EmailConfirmationCode", "EmailConfirmationExpiresAt", "EmailConfirmed", "FirstName", "IsActive", "IsPendingConfirmation", "LastName", "LockoutEnabled", "LockoutEnd", "LoginOtpChallengeId", "LoginOtpCode", "LoginOtpExpiresAt", "MemberRegistryNumber", "MentorId", "NormalizedEmail", "NormalizedUserName", "NotifyBookingOpen", "NotifyByEmail", "NotifyCpdDeadline", "NotifySessionReminder", "NotifySurveyReminder", "PasscodeHash", "PasswordResetCode", "PasswordResetExpiresAt", "Phone", "PhoneNumberConfirmed", "Role", "SecurityStamp", "StudentEndYear", "StudentNumber", "StudentStartYear", "StudentTrackingNumber", "StudentValidUntilUtc", "StudentYear2StartYear", "StudentYear3StartYear", "TwoFactorEnabled", "UserName", "YearlyPaymentPaidYear" },
                values: new object[,]
                {
                    { new Guid("22222222-2222-2222-2222-222222222222"), 0, null, "7d12a8c6-1605-4d2d-86bc-4e082b5d9917", 0, 0, null, "blerina.gashi@ieka.al", null, null, null, true, "Blerina", true, false, "Gashi", false, null, null, null, null, "LEKT01", null, "BLERINA.GASHI@IEKA.AL", "BLERINA.GASHI@IEKA.AL", true, true, true, true, true, "AQAAAAIAAYagAAAAED6a5t1RPIxnU0U+Jv7wZVV4GLlHAOtc+p0g0I75+Lfym7OOEZijLRgrubjefapC7g==", null, null, "+355691234567", false, "Lecturer", "dc22936a-9e96-4706-b657-6ca2545480ef", null, null, null, null, null, null, null, false, "blerina.gashi@ieka.al", null },
                    { new Guid("33333333-3333-3333-3333-333333333333"), 0, null, "eae76cc9-f949-4028-9dc6-4164ac4d35bc", 4, 20, null, "artan.hoxha@ieka.al", null, null, null, true, "Artan", true, false, "Hoxha", false, null, null, null, null, "IEKA-2045", null, "ARTAN.HOXHA@IEKA.AL", "ARTAN.HOXHA@IEKA.AL", true, true, true, true, true, "AQAAAAIAAYagAAAAED6a5t1RPIxnU0U+Jv7wZVV4GLlHAOtc+p0g0I75+Lfym7OOEZijLRgrubjefapC7g==", null, null, "+355692345678", false, "Member", "d8b377ab-b0e1-4dd1-95a5-05ac76ede2f0", null, null, null, null, null, null, null, false, "artan.hoxha@ieka.al", null },
                    { new Guid("44444444-4444-4444-4444-444444444444"), 0, null, "50c578ef-d1ad-4e21-b00c-211fd4a48c20", 0, 0, null, "dritan.shehi@ieka.al", null, null, null, true, "Dritan", true, false, "Shehi", false, null, null, null, null, "MENT01", null, "DRITAN.SHEHI@IEKA.AL", "DRITAN.SHEHI@IEKA.AL", true, true, true, true, true, "AQAAAAIAAYagAAAAED6a5t1RPIxnU0U+Jv7wZVV4GLlHAOtc+p0g0I75+Lfym7OOEZijLRgrubjefapC7g==", null, null, "+355693456789", false, "Mentor", "602efbc1-b231-445b-9394-a1944652f4b9", null, null, null, null, null, null, null, false, "dritan.shehi@ieka.al", null },
                    { new Guid("55555555-5555-5555-5555-555555555555"), 0, null, "8a15781b-f818-4fc3-88f7-e74ec87966d8", 0, 0, null, "sonila.krasniqi@ieka.al", null, null, null, true, "Sonila", true, false, "Krasniqi", false, null, null, null, null, "STU001", new Guid("44444444-4444-4444-4444-444444444444"), "SONILA.KRASNIQI@IEKA.AL", "SONILA.KRASNIQI@IEKA.AL", true, true, true, true, true, "AQAAAAIAAYagAAAAED6a5t1RPIxnU0U+Jv7wZVV4GLlHAOtc+p0g0I75+Lfym7OOEZijLRgrubjefapC7g==", null, null, "+355694567890", false, "Student", "d4cfb051-5fe4-471b-b163-c6c18d5bc206", null, null, null, null, null, null, null, false, "sonila.krasniqi@ieka.al", null }
                });
        }
    }
}
