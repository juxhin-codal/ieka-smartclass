using IekaSmartClass.Api.Data.Entities;
using IekaSmartClass.Api.Data.Repositories.Interface;
using IekaSmartClass.Api.Services.Interface;
using Microsoft.EntityFrameworkCore;

namespace IekaSmartClass.Api.Services;

public class ReportsService(
    IRepository<AppUser> userRepository,
    IRepository<EventItem> eventRepository,
    IRepository<Participant> participantRepository) : IReportsService
{
    private readonly IRepository<AppUser> _userRepository = userRepository;
    private readonly IRepository<EventItem> _eventRepository = eventRepository;
    private readonly IRepository<Participant> _participantRepository = participantRepository;

    public async Task<DashboardStats> GetDashboardStatsAsync()
    {
        var users = await _userRepository.Query().Where(u => u.IsActive).ToListAsync();
        var totalMembers = users.Count;
        var totalEvents = await _eventRepository.Query().CountAsync();
        
        var totalCpdAwarded = await _participantRepository.Query()
            .Where(p => p.Attendance == "attended")
            .Join(_eventRepository.Query(), p => p.EventItemId, e => e.Id, (p, e) => e.CpdHours)
            .SumAsync(h => h);

        var compliants = users.Count(u => u.CpdHoursCompleted >= u.CpdHoursRequired);
        var compliancePercentage = totalMembers > 0 ? (double)compliants / totalMembers * 100 : 0;

        return new DashboardStats(totalMembers, totalEvents, totalCpdAwarded, Math.Round(compliancePercentage, 2));
    }
}
