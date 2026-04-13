using IekaSmartClass.Api.Data;
using IekaSmartClass.Api.Data.Entities;
using IekaSmartClass.Api.Services.Interface;
using Microsoft.EntityFrameworkCore;

namespace IekaSmartClass.Api.Services;

public class NotificationService(
    IApplicationDbContext dbContext,
    IEmailService emailService,
    IConfigurationService configService,
    ILogger<NotificationService> logger) : INotificationService
{
    private static readonly TimeZoneInfo AppTimeZone = ResolveAppTimeZone();

    private readonly IApplicationDbContext _dbContext = dbContext;
    private readonly IEmailService _emailService = emailService;
    private readonly IConfigurationService _configService = configService;
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
        await SendAutoLecturerFeedbackForTopicsAsync(utcNow, cancellationToken);
        await SendAutoLecturerFeedbackForSessionsAsync(utcNow, cancellationToken);
        await SendAutoSessionQuestionnaireEmailsAsync(utcNow, cancellationToken);
        await SendLecturerFeedbackRemindersAsync(utcNow, cancellationToken);
        await SendReservationChoiceWarningsAsync(utcNow, cancellationToken);
        await AutoCancelDuplicateReservationsAsync(utcNow, cancellationToken);
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

    private async Task SendAutoLecturerFeedbackForTopicsAsync(DateTime utcNow, CancellationToken cancellationToken)
    {
        var localNow = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utcNow, DateTimeKind.Utc), AppTimeZone);
        if (localNow.Hour < 18) return;
        if (!await IsModuleFeedbackAutoSendEnabledAsync()) return;

        var localToday = localNow.Date;

        // Find the lecturer section (RepeatsPerTopic) for section-scoped links
        var template = await _dbContext.ModuleFeedbackTemplates
            .Include(t => t.Sections)
            .FirstOrDefaultAsync(cancellationToken);
        var lecturerSection = template?.Sections.FirstOrDefault(s => s.RepeatsPerTopic);
        var sectionParam = lecturerSection != null ? $"?sections={lecturerSection.Id}&scope=lecturer" : "";

        var topics = await _dbContext.StudentModuleTopics
            .Include(t => t.StudentModule)
            .Include(t => t.Attendances)
                .ThenInclude(a => a.Student)
            .Where(t =>
                t.ScheduledDate.HasValue &&
                t.ScheduledDate.Value.Date == localToday &&
                t.Attendances.Any(a => a.FeedbackToken == null))
            .ToListAsync(cancellationToken);

        if (topics.Count == 0) return;

        foreach (var topic in topics)
        {
            var pendingAttendances = topic.Attendances
                .Where(a => a.FeedbackToken == null)
                .ToList();

            foreach (var att in pendingAttendances)
                att.SetFeedbackToken(Guid.NewGuid().ToString("N"));

            await _dbContext.SaveChangesAsync(cancellationToken);

            var sessionDateLabel = topic.ScheduledDate!.Value.ToString("dd MMM yyyy");
            var sessionTimeLabel = topic.ScheduledDate!.Value.ToString("HH:mm");

            foreach (var att in pendingAttendances)
            {
                try
                {
                    await _emailService.SendModuleFeedbackRequestAsync(
                        att.Student,
                        new ModuleFeedbackEmailItem(
                            topic.StudentModule.Title,
                            topic.Name,
                            topic.Lecturer,
                            sessionDateLabel,
                            sessionTimeLabel,
                            string.IsNullOrWhiteSpace(topic.Location) ? "IEKA" : topic.Location,
                            $"/module-feedback/{topic.StudentModule.Id}{sectionParam}"),
                        cancellationToken);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Auto-send module feedback failed for attendance {AttendanceId}", att.Id);
                }
            }
        }

        _logger.LogInformation("Auto-sent module feedback for {Count} topics scheduled today.", topics.Count);
    }

    private async Task SendAutoLecturerFeedbackForSessionsAsync(DateTime utcNow, CancellationToken cancellationToken)
    {
        var localNow = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utcNow, DateTimeKind.Utc), AppTimeZone);
        if (localNow.Hour < 18) return;
        if (!await IsModuleFeedbackAutoSendEnabledAsync()) return;

        var localToday = localNow.Date;

        // Find the lecturer section (RepeatsPerTopic) for section-scoped links
        var template = await _dbContext.ModuleFeedbackTemplates
            .Include(t => t.Sections)
            .FirstOrDefaultAsync(cancellationToken);
        var lecturerSection = template?.Sections.FirstOrDefault(s => s.RepeatsPerTopic);
        var sectionParam = lecturerSection != null ? $"?sections={lecturerSection.Id}&scope=lecturer" : "";

        var sessions = await _dbContext.EventDates
            .Include(d => d.EventItem)
            .Where(d =>
                d.Date.Date == localToday &&
                _dbContext.Participants.Any(p =>
                    p.DateId == d.Id &&
                    p.Attendance == "attended" &&
                    p.FeedbackToken == null))
            .ToListAsync(cancellationToken);

        if (sessions.Count == 0) return;

        foreach (var session in sessions)
        {
            var participants = await _dbContext.Participants
                .Include(p => p.User)
                .Where(p =>
                    p.DateId == session.Id &&
                    p.Attendance == "attended" &&
                    p.FeedbackToken == null)
                .ToListAsync(cancellationToken);

            if (participants.Count == 0) continue;

            foreach (var p in participants)
                p.SetFeedbackToken(Guid.NewGuid().ToString("N"));

            await _dbContext.SaveChangesAsync(cancellationToken);

            var sessionDateLabel = session.Date.ToString("dd MMM yyyy");
            var sessionTimeLabel = session.Date.ToString("HH:mm");
            var lecturerName = string.IsNullOrWhiteSpace(session.EventItem.LecturerName) ? "—" : session.EventItem.LecturerName;
            var locationLabel = string.IsNullOrWhiteSpace(session.Location) ? "IEKA" : session.Location;

            foreach (var p in participants)
            {
                try
                {
                    await _emailService.SendModuleFeedbackRequestAsync(
                        p.User,
                        new ModuleFeedbackEmailItem(
                            session.EventItem.Name,
                            sessionDateLabel,
                            lecturerName,
                            sessionDateLabel,
                            sessionTimeLabel,
                            locationLabel,
                            $"/module-feedback/{session.EventItem.Id}{sectionParam}"),
                        cancellationToken);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Auto-send session feedback failed for participant {ParticipantId}", p.Id);
                }
            }
        }

        _logger.LogInformation("Auto-sent module feedback for {Count} event sessions today.", sessions.Count);
    }

    private async Task SendAutoSessionQuestionnaireEmailsAsync(DateTime utcNow, CancellationToken cancellationToken)
    {
        var localNow = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utcNow, DateTimeKind.Utc), AppTimeZone);
        if (localNow.Hour < 18) return;
        if (!await IsModuleFeedbackAutoSendEnabledAsync()) return;

        var localToday = localNow.Date;

        var evalQuestionnaire = await _dbContext.EvaluationQuestionnaires
            .FirstOrDefaultAsync(q => q.Title == "End module questionaire", cancellationToken);

        if (evalQuestionnaire is null)
        {
            _logger.LogWarning("Cannot auto-send session questionnaires: 'End module questionaire' not found.");
            return;
        }

        var sessions = await _dbContext.EventDates
            .Where(d =>
                d.Date.Date == localToday &&
                _dbContext.Participants.Any(p =>
                    p.DateId == d.Id &&
                    p.Attendance == "attended" &&
                    !p.QuestionnaireEmailSent))
            .ToListAsync(cancellationToken);

        if (sessions.Count == 0) return;

        var actionLink = $"/evaluation/{evalQuestionnaire.Id}";
        var emailItem = new EvaluationEmailItem(
            evalQuestionnaire.Title,
            evalQuestionnaire.EmailSubject,
            evalQuestionnaire.EmailBody,
            actionLink);

        foreach (var session in sessions)
        {
            var participants = await _dbContext.Participants
                .Include(p => p.User)
                .Where(p =>
                    p.DateId == session.Id &&
                    p.Attendance == "attended" &&
                    !p.QuestionnaireEmailSent)
                .ToListAsync(cancellationToken);

            foreach (var p in participants)
            {
                try
                {
                    await _emailService.SendEvaluationQuestionnaireAsync(p.User, emailItem, cancellationToken);
                    p.MarkQuestionnaireEmailSent();
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Auto-send session questionnaire failed for participant {ParticipantId}", p.Id);
                }
            }

            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        _logger.LogInformation("Auto-sent session questionnaire emails for {Count} sessions today.", sessions.Count);
    }

    public async Task NotifyStudentProfileChangedAsync(Guid studentId, List<string> changes, CancellationToken cancellationToken = default)
    {
        if (changes.Count == 0) return;

        var student = await _dbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == studentId, cancellationToken);

        if (student is null) return;

        var title = "Profili juaj u përditësua";
        var body = "Ndryshimet e bëra:\n• " + string.Join("\n• ", changes);
        var dedupeKey = $"profile-change:{studentId}:{DateTime.UtcNow:yyyyMMddHHmmss}";

        await TryCreateNotificationAsync(
            studentId,
            NotificationTypeValues.ProfileChange,
            title,
            body,
            null,
            dedupeKey,
            cancellationToken);
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

    private async Task<bool> IsModuleFeedbackAutoSendEnabledAsync()
    {
        var value = await _configService.GetConfigValueAsync("ModuleFeedbackAutoSendEnabled");
        return string.Equals(value, "true", StringComparison.OrdinalIgnoreCase);
    }

    private async Task<bool> IsModuleFeedbackReminderEnabledAsync()
    {
        var value = await _configService.GetConfigValueAsync("ModuleFeedbackReminderEnabled");
        return string.Equals(value, "true", StringComparison.OrdinalIgnoreCase);
    }

    private async Task SendLecturerFeedbackRemindersAsync(DateTime utcNow, CancellationToken cancellationToken)
    {
        if (!await IsModuleFeedbackReminderEnabledAsync()) return;

        var cutoff = utcNow.AddHours(-48);

        var template = await _dbContext.ModuleFeedbackTemplates
            .Include(t => t.Sections)
            .FirstOrDefaultAsync(cancellationToken);
        var lecturerSection = template?.Sections.FirstOrDefault(s => s.RepeatsPerTopic);
        var sectionParam = lecturerSection != null ? $"?sections={lecturerSection.Id}&scope=lecturer" : "";

        // Find attendances where:
        //   - initial email was sent 48h+ ago
        //   - no reminder has been sent yet
        var overdue = await _dbContext.StudentModuleTopicAttendances
            .Include(a => a.Student)
            .Include(a => a.Topic)
                .ThenInclude(t => t.StudentModule)
            .Where(a =>
                a.FeedbackEmailSentAt != null &&
                a.FeedbackEmailSentAt <= cutoff &&
                a.ReminderSentAt == null)
            .ToListAsync(cancellationToken);

        if (overdue.Count == 0) return;

        // Batch-load which students have already submitted the lecturer section
        var studentModulePairs = overdue
            .Select(a => new { a.StudentId, a.Topic.StudentModuleId })
            .Distinct()
            .ToList();

        var studentIds = studentModulePairs.Select(x => x.StudentId).ToHashSet();
        var moduleIds = studentModulePairs.Select(x => x.StudentModuleId).ToHashSet();

        var submitted = await _dbContext.ModuleFeedbackResponses
            .Where(r =>
                r.SectionScope == "lecturer" &&
                studentIds.Contains(r.StudentId) &&
                moduleIds.Contains(r.StudentModuleId))
            .Select(r => new { r.StudentId, r.StudentModuleId })
            .ToListAsync(cancellationToken);

        var submittedSet = submitted
            .Select(r => (r.StudentId, r.StudentModuleId))
            .ToHashSet();

        int remindersSent = 0;

        foreach (var att in overdue)
        {
            // Skip if student already submitted the lecturer section for this module
            if (submittedSet.Contains((att.StudentId, att.Topic.StudentModuleId)))
            {
                att.SetReminderSent(); // mark to avoid re-checking next run
                continue;
            }

            var sessionDateLabel = att.Topic.ScheduledDate?.ToString("dd MMM yyyy") ?? "—";

            try
            {
                await _emailService.SendModuleFeedbackReminderAsync(
                    att.Student,
                    new ModuleFeedbackReminderEmailItem(
                        att.Topic.StudentModule.Title,
                        att.Topic.Name,
                        att.Topic.Lecturer,
                        sessionDateLabel,
                        $"/module-feedback/{att.Topic.StudentModuleId}{sectionParam}"),
                    cancellationToken);

                att.SetReminderSent();
                remindersSent++;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to send 48h reminder for attendance {AttendanceId}", att.Id);
            }
        }

        if (overdue.Count > 0)
            await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Sent {Count} module feedback 48h reminders.", remindersSent);
    }

    private async Task<bool> IsReservationAutoCancelEnabledAsync()
    {
        var value = await _configService.GetConfigValueAsync("ReservationAutoCancelEnabled");
        return string.Equals(value, "true", StringComparison.OrdinalIgnoreCase);
    }

    private async Task SendReservationChoiceWarningsAsync(DateTime utcNow, CancellationToken cancellationToken)
    {
        if (!await IsReservationAutoCancelEnabledAsync()) return;

        var localNow = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utcNow, DateTimeKind.Utc), AppTimeZone);
        var targetDate = localNow.Date.AddDays(7);

        // Find EventItems whose first session date is exactly 7 days from today
        var eventItems = await _dbContext.Events
            .Include(e => e.Dates)
            .Where(e => e.Dates.Any())
            .ToListAsync(cancellationToken);

        var eligibleEventIds = eventItems
            .Where(e => e.Dates.Min(d => d.Date).Date == targetDate)
            .Select(e => e.Id)
            .ToHashSet();

        if (eligibleEventIds.Count == 0) return;

        // Find participants with 2+ reservations for these events, not yet warned
        var participants = await _dbContext.Participants
            .Include(p => p.User)
            .Include(p => p.EventDate)
            .Include(p => p.EventItem)
            .Where(p =>
                eligibleEventIds.Contains(p.EventItemId) &&
                p.Status == "registered" &&
                !p.ReservationWarningEmailSent)
            .ToListAsync(cancellationToken);

        var grouped = participants
            .GroupBy(p => new { p.EventItemId, p.UserId })
            .Where(g => g.Count() > 1)
            .ToList();

        if (grouped.Count == 0) return;

        foreach (var group in grouped)
        {
            var user = group.First().User;
            var eventItem = group.First().EventItem;
            var reservations = group.OrderBy(p => p.EventDate.Date).ToList();

            var datesHtml = string.Join("", reservations.Select(p =>
            {
                var date = p.EventDate.Date.ToString("dd MMM yyyy");
                var time = string.IsNullOrWhiteSpace(p.EventDate.Time) ? "—" : p.EventDate.Time;
                var location = string.IsNullOrWhiteSpace(p.EventDate.Location) ? eventItem.Place : p.EventDate.Location;
                return $"<div style=\"font-size:13px;line-height:1.6;color:#92400e;padding:4px 0;\">&#128197; <strong>{date}</strong> — Ora {time}, {location}</div>";
            }));

            try
            {
                await _emailService.SendReservationChoiceWarningAsync(
                    user,
                    new ReservationChoiceWarningEmailItem(
                        eventItem.Name,
                        datesHtml,
                        $"/modules/{eventItem.Id}"),
                    cancellationToken);

                foreach (var p in group)
                    p.MarkReservationWarningEmailSent();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to send reservation choice warning to user {UserId} for event {EventId}", user.Id, eventItem.Id);
            }
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        _logger.LogInformation("Sent reservation choice warnings for {Count} users.", grouped.Count);
    }

    private async Task AutoCancelDuplicateReservationsAsync(DateTime utcNow, CancellationToken cancellationToken)
    {
        if (!await IsReservationAutoCancelEnabledAsync()) return;

        var localNow = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utcNow, DateTimeKind.Utc), AppTimeZone);
        var targetDate = localNow.Date.AddDays(6);

        // Find EventItems whose first session date is exactly 6 days from today
        var eventItems = await _dbContext.Events
            .Include(e => e.Dates)
            .Where(e => e.Dates.Any())
            .ToListAsync(cancellationToken);

        var eligibleEvents = eventItems
            .Where(e => e.Dates.Min(d => d.Date).Date == targetDate)
            .ToDictionary(e => e.Id);

        if (eligibleEvents.Count == 0) return;

        var eligibleEventIds = eligibleEvents.Keys.ToHashSet();

        // Find participants with 2+ reservations for these events
        var participants = await _dbContext.Participants
            .Include(p => p.User)
            .Include(p => p.EventDate)
            .Where(p =>
                eligibleEventIds.Contains(p.EventItemId) &&
                p.Status == "registered")
            .ToListAsync(cancellationToken);

        var grouped = participants
            .GroupBy(p => new { p.EventItemId, p.UserId })
            .Where(g => g.Count() > 1)
            .ToList();

        if (grouped.Count == 0) return;

        // Track cancellations for emails
        var cancellations = new List<(AppUser User, EventItem Event, EventDate CancelledDate, EventDate RemainingDate)>();
        var affectedEventIds = new HashSet<Guid>();

        foreach (var group in grouped)
        {
            var ordered = group.OrderBy(p => p.RegisteredAt).ToList();
            // Cancel the LAST booked (highest RegisteredAt)
            var toCancel = ordered.Last();
            var toKeep = ordered.First();
            var eventItem = eligibleEvents[group.Key.EventItemId];

            // Inline cancellation logic (same as CancelParticipantReservationInternalAsync)
            var cancelledDateId = toCancel.DateId;
            var eventDate = eventItem.Dates.FirstOrDefault(d => d.Id == cancelledDateId);

            _dbContext.Participants.Remove(toCancel);

            if (eventDate != null)
            {
                eventDate.DecrementParticipant();

                // Promote the earliest waitlisted person for this date
                var nextInLine = await _dbContext.Participants
                    .Where(p => p.EventItemId == group.Key.EventItemId && p.DateId == cancelledDateId && p.Status == "waitlisted")
                    .OrderBy(p => p.RegisteredAt)
                    .FirstOrDefaultAsync(cancellationToken);

                if (nextInLine != null)
                {
                    eventDate.IncrementParticipant();
                    nextInLine.Promote(eventDate.CurrentParticipants);
                }
            }

            cancellations.Add((toCancel.User, eventItem, toCancel.EventDate, toKeep.EventDate));
            affectedEventIds.Add(group.Key.EventItemId);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        _logger.LogInformation("Auto-cancelled {Count} duplicate reservations.", cancellations.Count);

        // Send cancellation emails
        foreach (var (user, eventItem, cancelledDate, remainingDate) in cancellations)
        {
            try
            {
                await _emailService.SendReservationCancelledAsync(
                    user,
                    new ReservationCancelledEmailItem(
                        eventItem.Name,
                        cancelledDate.Date.ToString("dd MMM yyyy"),
                        string.IsNullOrWhiteSpace(cancelledDate.Time) ? "—" : cancelledDate.Time,
                        remainingDate.Date.ToString("dd MMM yyyy"),
                        string.IsNullOrWhiteSpace(remainingDate.Time) ? "—" : remainingDate.Time,
                        $"/modules/{eventItem.Id}"),
                    cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to send reservation cancelled email to user {UserId}", user.Id);
            }
        }

        // Send available seats emails to unreserved members
        foreach (var eventId in affectedEventIds)
        {
            var eventItem = eligibleEvents[eventId];

            // Reload dates to get updated CurrentParticipants
            var freshDates = await _dbContext.EventDates
                .Where(d => d.EventItemId == eventId)
                .OrderBy(d => d.Date)
                .ToListAsync(cancellationToken);

            var seatsHtml = string.Join("", freshDates
                .Where(d => d.MaxParticipants > d.CurrentParticipants)
                .Select(d =>
                {
                    var available = d.MaxParticipants - d.CurrentParticipants;
                    var date = d.Date.ToString("dd MMM yyyy");
                    var time = string.IsNullOrWhiteSpace(d.Time) ? "—" : d.Time;
                    return $"<div style=\"font-size:13px;line-height:1.6;color:#065f46;padding:4px 0;\">&#128197; <strong>{date}</strong> — Ora {time} — <strong>{available} vende të lira</strong></div>";
                }));

            if (string.IsNullOrEmpty(seatsHtml)) continue;

            // Find members with 0 reservations for this event
            var reservedUserIds = await _dbContext.Participants
                .Where(p => p.EventItemId == eventId)
                .Select(p => p.UserId)
                .Distinct()
                .ToListAsync(cancellationToken);

            var reservedUserIdSet = reservedUserIds.ToHashSet();

            var unreservedMembers = await _dbContext.Users
                .Where(u =>
                    u.Role == "Member" &&
                    u.IsActive &&
                    !u.IsPendingConfirmation &&
                    !reservedUserIdSet.Contains(u.Id))
                .ToListAsync(cancellationToken);

            foreach (var member in unreservedMembers)
            {
                try
                {
                    await _emailService.SendReservationSeatsAvailableAsync(
                        member,
                        new ReservationSeatsAvailableEmailItem(
                            eventItem.Name,
                            seatsHtml,
                            $"/modules/{eventItem.Id}"),
                        cancellationToken);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to send seats available email to user {UserId}", member.Id);
                }
            }

            _logger.LogInformation("Sent available seats emails to {Count} unreserved members for event {EventId}.", unreservedMembers.Count, eventId);
        }
    }
}
