using IekaSmartClass.Api.Data;
using IekaSmartClass.Api.Data.Entities;
using IekaSmartClass.Api.Services.Interface;
using Microsoft.EntityFrameworkCore;

namespace IekaSmartClass.Api.Services;

public class NotificationService(
    IApplicationDbContext dbContext,
    IEmailService emailService,
    ILogger<NotificationService> logger) : INotificationService
{
    private static readonly TimeZoneInfo AppTimeZone = ResolveAppTimeZone();

    private readonly IApplicationDbContext _dbContext = dbContext;
    private readonly IEmailService _emailService = emailService;
    private readonly ILogger<NotificationService> _logger = logger;

    public async Task<NotificationListDto> GetUserNotificationsAsync(Guid userId, int take = 20, CancellationToken cancellationToken = default)
    {
        var safeTake = Math.Clamp(take, 1, 100);
        var items = await _dbContext.UserNotifications
            .AsNoTracking()
            .Where(x => x.UserId == userId)
            .OrderByDescending(x => x.CreatedAtUtc)
            .Take(safeTake)
            .Select(x => new UserNotificationDto(
                x.Id,
                x.Type,
                x.Title,
                x.Body,
                x.Link,
                x.IsRead,
                x.CreatedAtUtc))
            .ToListAsync(cancellationToken);

        var unreadCount = await _dbContext.UserNotifications
            .AsNoTracking()
            .CountAsync(x => x.UserId == userId && !x.IsRead, cancellationToken);

        return new NotificationListDto(unreadCount, items);
    }

    public async Task<NotificationPreferencesDto> GetNotificationPreferencesAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var user = await _dbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == userId, cancellationToken)
            ?? throw new KeyNotFoundException("Përdoruesi nuk u gjet.");

        return ToPreferences(user);
    }

    public async Task UpdateNotificationPreferencesAsync(Guid userId, UpdateNotificationPreferencesDto request, CancellationToken cancellationToken = default)
    {
        var user = await _dbContext.Users
            .FirstOrDefaultAsync(x => x.Id == userId, cancellationToken)
            ?? throw new KeyNotFoundException("Përdoruesi nuk u gjet.");

        user.UpdateNotificationPreferences(
            request.NotifyByEmail,
            request.NotifyBySms,
            request.NotifyBookingOpen,
            request.NotifySessionReminder,
            request.NotifySurveyReminder,
            request.NotifyCpdDeadline);

        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task MarkAsReadAsync(Guid userId, Guid notificationId, CancellationToken cancellationToken = default)
    {
        var notification = await _dbContext.UserNotifications
            .FirstOrDefaultAsync(x => x.Id == notificationId && x.UserId == userId, cancellationToken)
            ?? throw new KeyNotFoundException("Njoftimi nuk u gjet.");

        notification.MarkRead();
        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task MarkAllAsReadAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var notifications = await _dbContext.UserNotifications
            .Where(x => x.UserId == userId && !x.IsRead)
            .ToListAsync(cancellationToken);

        foreach (var notification in notifications)
        {
            notification.MarkRead();
        }

        if (notifications.Count > 0)
        {
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
    }

    public async Task DeleteNotificationAsync(Guid userId, Guid notificationId, CancellationToken cancellationToken = default)
    {
        var notification = await _dbContext.UserNotifications
            .FirstOrDefaultAsync(x => x.Id == notificationId && x.UserId == userId, cancellationToken)
            ?? throw new KeyNotFoundException("Njoftimi nuk u gjet.");

        _dbContext.UserNotifications.Remove(notification);
        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task ProcessScheduledNotificationsAsync(DateTime utcNow, CancellationToken cancellationToken = default)
    {
        await SendUpcomingSessionRemindersAsync(utcNow, cancellationToken);
        await SendCpdDeadlineRemindersAsync(utcNow, cancellationToken);
    }

    public async Task NotifyBookingOpenedAsync(Guid eventId, CancellationToken cancellationToken = default)
    {
        var eventItem = await _dbContext.Events
            .AsNoTracking()
            .Include(x => x.Dates)
            .FirstOrDefaultAsync(x => x.Id == eventId, cancellationToken)
            ?? throw new KeyNotFoundException("Moduli nuk u gjet.");

        var recipients = await _dbContext.Users
            .AsNoTracking()
            .Where(x =>
                x.Role == "Member" &&
                x.IsActive &&
                !x.IsPendingConfirmation &&
                x.NotifyBookingOpen)
            .ToListAsync(cancellationToken);

        if (recipients.Count == 0)
        {
            return;
        }

        var dateSummary = BuildDateSummary(eventItem);
        var title = $"U hapën regjistrimet për {eventItem.Name}";
        var body = string.IsNullOrWhiteSpace(dateSummary)
            ? $"{eventItem.Name} është tashmë i hapur për rezervim."
            : $"{eventItem.Name} është tashmë i hapur për rezervim. Seanca e parë është më {dateSummary}.";
        var link = $"/modules/{eventItem.Id}";

        foreach (var user in recipients)
        {
            var dedupeKey = $"booking-open:{eventItem.Id}:{user.Id}";
            await CreateNotificationAsync(
                user,
                NotificationTypeValues.Booking,
                title,
                body,
                link,
                dedupeKey,
                sendEmail: user.NotifyByEmail,
                sendEmailAction: ct => _emailService.SendBookingOpenNotificationAsync(
                    user,
                    new BookingOpenEmailItem(
                        eventItem.Name,
                        dateSummary,
                        string.IsNullOrWhiteSpace(eventItem.Place) ? "-" : eventItem.Place,
                        eventItem.CpdHours,
                        link),
                    ct),
                cancellationToken);
        }
    }

    public async Task NotifySurveyReminderForEndedSessionAsync(Guid eventId, Guid dateId, CancellationToken cancellationToken = default)
    {
        var eventItem = await _dbContext.Events
            .AsNoTracking()
            .Include(x => x.Dates)
            .Include(x => x.Participants)
                .ThenInclude(x => x.User)
            .FirstOrDefaultAsync(x => x.Id == eventId, cancellationToken)
            ?? throw new KeyNotFoundException("Moduli nuk u gjet.");

        var sessionDate = eventItem.Dates.FirstOrDefault(x => x.Id == dateId);
        if (sessionDate is null || !sessionDate.IsEnded)
        {
            return;
        }

        var questionnaire = eventItem.FeedbackQuestionnaires.FirstOrDefault();
        if (questionnaire is null || questionnaire.Questions.Count == 0)
        {
            return;
        }

        var submittedUserIds = await _dbContext.EventFeedbacks
            .AsNoTracking()
            .Where(x => x.EventItemId == eventId && x.DateId == dateId)
            .Select(x => x.UserId)
            .Distinct()
            .ToListAsync(cancellationToken);
        var submittedUserIdSet = submittedUserIds.ToHashSet();

        var attendees = eventItem.Participants
            .Where(x =>
                x.DateId == dateId &&
                x.Status == "registered" &&
                x.Attendance == "attended" &&
                !submittedUserIdSet.Contains(x.UserId))
            .Select(x => x.User)
            .Where(x => x is not null)
            .DistinctBy(x => x!.Id)
            .Cast<AppUser>()
            .ToList();

        if (attendees.Count == 0)
        {
            return;
        }

        var title = $"Plotëso feedback-un për {eventItem.Name}";
        var body = $"{eventItem.Name} ka përfunduar. Ju lutem plotësoni pyetësorin e feedback-ut.";
        var link = BuildQuestionnaireLink(eventItem.Id, dateId, questionnaire.Id);

        foreach (var user in attendees)
        {
            if (!CanReceiveNotification(user, user.NotifySurveyReminder))
            {
                continue;
            }

            var dedupeKey = $"survey-reminder:{eventItem.Id}:{dateId}:{user.Id}";
            await CreateNotificationAsync(
                user,
                NotificationTypeValues.Survey,
                title,
                body,
                link,
                dedupeKey,
                sendEmail: user.NotifyByEmail,
                sendEmailAction: ct => _emailService.SendSurveyReminderAsync(
                    user,
                    new SurveyReminderEmailItem(
                        eventItem.Name,
                        sessionDate.Date,
                        questionnaire.Title,
                        link),
                    ct),
                cancellationToken);
        }
    }

    private async Task SendUpcomingSessionRemindersAsync(DateTime utcNow, CancellationToken cancellationToken)
    {
        var localNow = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utcNow, DateTimeKind.Utc), AppTimeZone);
        var candidateDates = await _dbContext.EventDates
            .AsNoTracking()
            .Include(x => x.EventItem)
            .Where(x =>
                !x.IsEnded &&
                x.Date.Date >= localNow.Date &&
                x.Date.Date <= localNow.Date.AddDays(2))
            .ToListAsync(cancellationToken);

        // Filter to only dates within the 23-25h reminder window
        var eligibleDates = new List<EventDate>();
        foreach (var sessionDate in candidateDates)
        {
            var startLocal = TryGetSessionStartLocal(sessionDate);
            if (!startLocal.HasValue) continue;

            var hoursUntil = (startLocal.Value - localNow).TotalHours;
            if (hoursUntil > 0 && hoursUntil >= 23 && hoursUntil <= 25)
            {
                eligibleDates.Add(sessionDate);
            }
        }

        if (eligibleDates.Count == 0) return;

        // Load ALL participants for ALL eligible dates in ONE query (fixes N+1)
        var eligibleDateIds = eligibleDates.Select(d => d.Id).ToList();
        var allParticipants = await _dbContext.Participants
            .AsNoTracking()
            .Include(x => x.User)
            .Where(x => eligibleDateIds.Contains(x.DateId) && x.Status == "registered")
            .ToListAsync(cancellationToken);

        var participantsByDate = allParticipants
            .GroupBy(x => x.DateId)
            .ToDictionary(g => g.Key, g => g.ToList());

        foreach (var sessionDate in eligibleDates)
        {
            if (!participantsByDate.TryGetValue(sessionDate.Id, out var participants))
                continue;

            foreach (var participant in participants)
            {
                var user = participant.User;
                if (!CanReceiveNotification(user, user.NotifySessionReminder))
                {
                    continue;
                }

                var title = $"Kujtesë për sesionin: {sessionDate.EventItem.Name}";
                var body = $"{sessionDate.EventItem.Name} fillon më {sessionDate.Date:dd MMM yyyy} në orën {sessionDate.Time}.";
                var link = $"/modules/{sessionDate.EventItemId}";
                var dedupeKey = $"session-reminder:{sessionDate.EventItemId}:{sessionDate.Id}:{user.Id}";

                await CreateNotificationAsync(
                    user,
                    NotificationTypeValues.Reminder,
                    title,
                    body,
                    link,
                    dedupeKey,
                    sendEmail: user.NotifyByEmail,
                    sendEmailAction: ct => _emailService.SendSessionReminderAsync(
                        user,
                        new SessionReminderEmailItem(
                            sessionDate.EventItem.Name,
                            sessionDate.Date,
                            sessionDate.Time,
                            string.IsNullOrWhiteSpace(sessionDate.Location) ? sessionDate.EventItem.Place : sessionDate.Location!,
                            link),
                        ct),
                    cancellationToken);
            }
        }
    }

    private async Task SendCpdDeadlineRemindersAsync(DateTime utcNow, CancellationToken cancellationToken)
    {
        var localNow = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utcNow, DateTimeKind.Utc), AppTimeZone);
        var deadlineDate = new DateTime(localNow.Year, 12, 31);
        var daysUntilDeadline = (deadlineDate.Date - localNow.Date).Days;
        var reminderWindow = daysUntilDeadline switch
        {
            <= 7 and >= 0 => 7,
            <= 30 and > 7 => 30,
            _ => (int?)null
        };

        if (!reminderWindow.HasValue)
        {
            return;
        }

        var members = await _dbContext.Users
            .AsNoTracking()
            .Where(x =>
                x.Role == "Member" &&
                x.IsActive &&
                !x.IsPendingConfirmation &&
                x.NotifyCpdDeadline &&
                x.CpdHoursRequired > 0)
            .ToListAsync(cancellationToken);

        if (members.Count == 0)
        {
            return;
        }

        var memberIds = members.Select(x => x.Id).ToList();
        var attendedHours = await _dbContext.Participants
            .AsNoTracking()
            .Where(x =>
                memberIds.Contains(x.UserId) &&
                x.Status == "registered" &&
                x.Attendance == "attended")
            .Join(
                _dbContext.EventDates.AsNoTracking(),
                participant => participant.DateId,
                eventDate => eventDate.Id,
                (participant, eventDate) => new { participant.UserId, eventDate.EventItemId, eventDate.Date })
            .Where(x => x.Date.Year == localNow.Year)
            .Join(
                _dbContext.Events.AsNoTracking(),
                item => item.EventItemId,
                eventItem => eventItem.Id,
                (item, eventItem) => new { item.UserId, eventItem.CpdHours })
            .GroupBy(x => x.UserId)
            .Select(x => new { UserId = x.Key, Hours = x.Sum(item => item.CpdHours) })
            .ToDictionaryAsync(x => x.UserId, x => x.Hours, cancellationToken);

        foreach (var user in members)
        {
            if (!CanReceiveNotification(user, user.NotifyCpdDeadline))
            {
                continue;
            }

            var currentHours = user.CpdHoursCompleted + attendedHours.GetValueOrDefault(user.Id);
            var remainingHours = Math.Max(0, user.CpdHoursRequired - currentHours);
            if (remainingHours <= 0)
            {
                continue;
            }

            var title = "Afati vjetor i CPD po afron";
            var body = $"Ju mungojnë edhe {remainingHours} orë CPD për të përmbushur detyrimin vjetor.";
            var link = "/modules/browse";
            var dedupeKey = $"cpd-deadline:{localNow.Year}:{reminderWindow.Value}:{user.Id}";

            await CreateNotificationAsync(
                user,
                NotificationTypeValues.CpdDeadline,
                title,
                body,
                link,
                dedupeKey,
                sendEmail: user.NotifyByEmail,
                sendEmailAction: ct => _emailService.SendCpdDeadlineReminderAsync(
                    user,
                    new CpdDeadlineEmailItem(
                        currentHours,
                        user.CpdHoursRequired,
                        remainingHours,
                        deadlineDate,
                        link),
                    ct),
                cancellationToken);
        }
    }

    private async Task CreateNotificationAsync(
        AppUser user,
        string type,
        string title,
        string body,
        string? link,
        string dedupeKey,
        bool sendEmail,
        Func<CancellationToken, Task>? sendEmailAction,
        CancellationToken cancellationToken)
    {
        if (!CanReceiveNotification(user, isTypeEnabled: true))
        {
            return;
        }

        var created = await TryCreateNotificationAsync(user.Id, type, title, body, link, dedupeKey, cancellationToken);
        if (!created || !sendEmail || sendEmailAction is null)
        {
            return;
        }

        try
        {
            await sendEmailAction(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not send notification email '{NotificationType}' to {UserId}.", type, user.Id);
        }
    }

    private async Task<bool> TryCreateNotificationAsync(
        Guid userId,
        string type,
        string title,
        string body,
        string? link,
        string dedupeKey,
        CancellationToken cancellationToken)
    {
        var exists = await _dbContext.UserNotifications
            .AsNoTracking()
            .AnyAsync(x => x.DeduplicationKey == dedupeKey, cancellationToken);
        if (exists)
        {
            return false;
        }

        _dbContext.UserNotifications.Add(new UserNotification(userId, type, title, body, link, dedupeKey));
        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    private static NotificationPreferencesDto ToPreferences(AppUser user)
    {
        return new NotificationPreferencesDto(
            user.NotifyByEmail,
            user.NotifyBySms,
            user.NotifyBookingOpen,
            user.NotifySessionReminder,
            user.NotifySurveyReminder,
            user.NotifyCpdDeadline);
    }

    private static bool CanReceiveNotification(AppUser user, bool isTypeEnabled)
    {
        return isTypeEnabled && user.IsEffectivelyActive() && !user.IsPendingConfirmation;
    }

    private static string BuildDateSummary(EventItem eventItem)
    {
        var orderedDates = eventItem.Dates
            .OrderBy(x => x.Date)
            .Select(x => x.Date)
            .ToList();
        if (orderedDates.Count == 0)
        {
            return string.Empty;
        }

        if (orderedDates.Count == 1)
        {
            return orderedDates[0].ToString("dd MMM yyyy");
        }

        return $"{orderedDates[0]:dd MMM yyyy} - {orderedDates[^1]:dd MMM yyyy}";
    }

    private static DateTime? TryGetSessionStartLocal(EventDate sessionDate)
    {
        if (TimeSpan.TryParse(sessionDate.Time, out var time))
        {
            return sessionDate.Date.Date.Add(time);
        }

        if (DateTime.TryParse($"{sessionDate.Date:yyyy-MM-dd} {sessionDate.Time}", out var parsed))
        {
            return parsed;
        }

        return null;
    }

    private static string BuildQuestionnaireLink(Guid eventId, Guid dateId, string questionnaireId)
    {
        var parameters = new Dictionary<string, string>
        {
            ["eventId"] = eventId.ToString(),
            ["dateId"] = dateId.ToString(),
            ["questionnaireId"] = questionnaireId
        };

        var query = string.Join(
            "&",
            parameters.Select(pair => $"{Uri.EscapeDataString(pair.Key)}={Uri.EscapeDataString(pair.Value)}"));
        return $"/questionnaire?{query}";
    }

    private static TimeZoneInfo ResolveAppTimeZone()
    {
        foreach (var candidate in new[] { "Europe/Tirane", "Central Europe Standard Time" })
        {
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById(candidate);
            }
            catch
            {
                // Try the next candidate.
            }
        }

        return TimeZoneInfo.Utc;
    }
}
