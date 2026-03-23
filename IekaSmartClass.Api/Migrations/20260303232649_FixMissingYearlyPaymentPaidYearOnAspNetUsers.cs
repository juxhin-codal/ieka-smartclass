using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IekaSmartClass.Api.Migrations
{
    /// <inheritdoc />
    public partial class FixMissingYearlyPaymentPaidYearOnAspNetUsers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                IF COL_LENGTH('AspNetUsers', 'YearlyPaymentPaidYear') IS NULL
                BEGIN
                    ALTER TABLE [AspNetUsers] ADD [YearlyPaymentPaidYear] int NULL;
                END
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                IF COL_LENGTH('AspNetUsers', 'YearlyPaymentPaidYear') IS NOT NULL
                BEGIN
                    ALTER TABLE [AspNetUsers] DROP COLUMN [YearlyPaymentPaidYear];
                END
                """);
        }
    }
}
