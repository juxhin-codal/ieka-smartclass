namespace IekaSmartClass.Api.Services.Interface;

public interface IReportsService
{
    Task<DashboardStats> GetDashboardStatsAsync();
}

public record DashboardStats(int TotalMembers, int TotalEvents, int TotalCpdAwarded, double AverageCompliancePercentage);
