using IekaSmartClass.Api.Data;
using IekaSmartClass.Api.Data.Entities;
using IekaSmartClass.Api.Data.Repositories.Interface;
using IekaSmartClass.Api.Services.Interface;
using IekaSmartClass.Api.Utilities.Pagination;
using ClosedXML.Excel;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace IekaSmartClass.Api.Services;

public class EventsService(
    IRepository<EventItem> eventRepository,
    IRepository<Participant> participantRepository,
    IFileStorageService fileStorageService,
    IApplicationDbContext dbContext,
    IEmailService emailService,
    INotificationService notificationService,
    ILogger<EventsService> logger) : IEventsService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };
    private const int ReservationGraceDays = 5;
    private const int ReservationRestrictionDays = 7;

    private readonly IRepository<EventItem> _eventRepository = eventRepository;
    private readonly IRepository<Participant> _participantRepository = participantRepository;
    private readonly IFileStorageService _fileStorageService = fileStorageService;
    private readonly IApplicationDbContext _dbContext = dbContext;
    private readonly IEmailService _emailService = emailService;
    private readonly INotificationService _notificationService = notificationService;
    private readonly ILogger<EventsService> _logger = logger;

    private async Task SyncEventStatusesAsync(IEnumerable<EventItem> events)
    {
        var hasChanges = false;
        foreach (var eventItem in events)
        {
            if (eventItem.RefreshStatusFromDates())
            {
                hasChanges = true;
            }
        }

        if (hasChanges)
        {
            await _dbContext.SaveChangesAsync();
        }
    }

    public async Task<PaginatedList<EventItem>> GetEventsAsync(int pageNumber, int pageSize)
    {
        await ApplyExtraReservationAutoCancellationAsync();

        var paged = await PaginatedList<EventItem>.CreateAsync(
            _eventRepository.Query()
                .Include(e => e.Dates)
                .Include(e => e.Participants)
                    .ThenInclude(p => p.User)
                .OrderByDescending(e => e.CreatedAt),
            pageNumber,
            pageSize);

        await SyncEventStatusesAsync(paged.Items);
        return paged;
    }

    public async Task<EventItem?> GetEventByIdAsync(Guid id)
    {
        await ApplyExtraReservationAutoCancellationAsync();

        var eventItem = await _eventRepository.Query()
            .Include(x => x.Dates)
            .Include(e => e.Participants)
                .ThenInclude(p => p.User)
            .Include(e => e.Documents)
            .FirstOrDefaultAsync(x => x.Id == id);

        if (eventItem is not null)
        {
            await SyncEventStatusesAsync([eventItem]);
        }

        return eventItem;
    }

    public async Task<Guid> CreateEventAsync(string name, string place, int sessionCapacity, int totalSessions, int cpdHours, decimal price = 0, string? lecturerName = null, string? webinarLink = null, List<string>? topics = null, List<(string Date, string Time)>? dates = null, List<string>? lecturerIds = null, string? feedbackQuestionsJson = null)
    {
        var eventItem = new EventItem(name, place, sessionCapacity, totalSessions, cpdHours, price, lecturerName, webinarLink, lecturerIds);

        if (topics is { Count: > 0 })
            eventItem.SetTopics(topics);

        if (feedbackQuestionsJson is not null)
            eventItem.SetFeedbackConfiguration(feedbackQuestionsJson);

        await _eventRepository.AddAsync(eventItem);

        if (dates is { Count: > 0 })
        {
            foreach (var d in dates)
            {
                if (DateTime.TryParse(d.Date, out var parsedDate))
                    eventItem.AddDate(new EventDate(parsedDate, d.Time, sessionCapacity));
            }
        }

        await _dbContext.SaveChangesAsync();
        return eventItem.Id;
    }

    /// <returns>"registered" or "waitlisted"</returns>
    public async Task<string> ReserveSeatAsync(Guid eventId, Guid userId, Guid dateId)
    {
        var existingEvent = await _eventRepository.Query()
            .Include(x => x.Dates)
            .FirstOrDefaultAsync(x => x.Id == eventId) ?? throw new KeyNotFoundException("Event not found.");

        var user = await _dbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == userId)
            ?? throw new KeyNotFoundException("User not found.");

        var currentYear = DateTime.UtcNow.Year;
        var hasYearlyInactivePayment = user.YearlyPaymentPaidYear.HasValue && user.YearlyPaymentPaidYear.Value == currentYear;
        var requiresPerModulePayment = string.Equals(user.Role, "Member", StringComparison.OrdinalIgnoreCase)
            && !user.IsActive
            && !hasYearlyInactivePayment;

        if (requiresPerModulePayment && existingEvent.Price > 0)
        {
            throw new InvalidOperationException(
                $"Nuk mund të rezervoni këtë modul pa pagesën vjetore. Administratori duhet t'ju shënojë si \"Paguar\" për vitin {currentYear}.");
        }

        await ApplyExtraReservationAutoCancellationAsync(userId);

        var existingDate = existingEvent.Dates.FirstOrDefault(x => x.Id == dateId)
            ?? throw new KeyNotFoundException("Date not found.");

        // Check if user already reserved this specific session
        var alreadyThisDate = await _participantRepository.Query()
            .AnyAsync(x => x.EventItemId == eventId && x.UserId == userId && x.DateId == dateId);

        if (alreadyThisDate)
            throw new InvalidOperationException("User has already reserved this session.");

        var startsWithinRestrictionWindow = IsWithinReservationRestrictionWindow(existingEvent, DateTime.UtcNow);
        var maxReservationsAllowed = startsWithinRestrictionWindow ? 1 : 2;

        // Enforce max allowed session reservations per member per module
        var existingReservations = await _participantRepository.Query()
            .CountAsync(x => x.EventItemId == eventId && x.UserId == userId);

        if (existingReservations >= maxReservationsAllowed)
        {
            if (maxReservationsAllowed == 1)
            {
                throw new InvalidOperationException("Ky modul fillon brenda 7 ditëve. Mund të rezervoni vetëm 1 sesion.");
            }

            throw new InvalidOperationException("Maximum 2 session reservations per module. Cancel one to reserve another.");
        }

        bool isSessionFull = existingDate.CurrentParticipants >= existingDate.MaxParticipants;

        if (isSessionFull)
        {
            // Place on waitlist — no seat number, no capacity increment
            var waitlistParticipant = new Participant(eventId, userId, dateId, seatNumber: 0, status: "waitlisted");
            await _participantRepository.AddAsync(waitlistParticipant);
            await _dbContext.SaveChangesAsync();
            return "waitlisted";
        }

        // Normal registration
        existingDate.IncrementParticipant();
        existingEvent.IncrementParticipant();

        var participant = new Participant(eventId, userId, dateId, existingDate.CurrentParticipants);
        await _participantRepository.AddAsync(participant);
        await _dbContext.SaveChangesAsync();
        return "registered";
    }

    public async Task<IReadOnlyList<EventItem>> GetMyModulesAsync(Guid userId)
    {
        await ApplyExtraReservationAutoCancellationAsync(userId);

        var participantEventIds = await _participantRepository.Query()
            .Where(p => p.UserId == userId)
            .Select(p => p.EventItemId)
            .Distinct()
            .ToListAsync();

        var modules = await _eventRepository.Query()
            .Include(e => e.Dates)
            .Include(e => e.Participants)
                .ThenInclude(p => p.User)
            .Where(e => participantEventIds.Contains(e.Id))
            .ToListAsync();

        await SyncEventStatusesAsync(modules);
        return modules;
    }

    public async Task<SessionParticipantsExportResult> ExportSessionParticipantsExcelAsync(Guid eventId, Guid dateId)
    {
        var eventItem = await _eventRepository.Query()
            .Include(e => e.Dates)
            .Include(e => e.Participants)
                .ThenInclude(p => p.User)
            .FirstOrDefaultAsync(e => e.Id == eventId) ?? throw new KeyNotFoundException("Event not found.");

        var sessionDate = eventItem.Dates.FirstOrDefault(d => d.Id == dateId) ?? throw new KeyNotFoundException("Session date not found.");
        var participants = eventItem.Participants
            .Where(p => p.DateId == dateId)
            .OrderBy(p => p.Status == "registered" ? 0 : 1)
            .ThenBy(p => p.SeatNumber)
            .ThenBy(p => p.RegisteredAt)
            .ToList();

        using var workbook = new XLWorkbook();
        var worksheet = workbook.Worksheets.Add("Pjesemarresit");

        worksheet.Cell(1, 1).Value = "Moduli";
        worksheet.Cell(1, 2).Value = eventItem.Name;
        worksheet.Cell(2, 1).Value = "Sesioni";
        worksheet.Cell(2, 2).Value = $"{sessionDate.Date:dd.MM.yyyy} {sessionDate.Time}";
        worksheet.Cell(3, 1).Value = "Vendndodhja";
        worksheet.Cell(3, 2).Value = string.IsNullOrWhiteSpace(sessionDate.Location) ? "-" : sessionDate.Location;
        worksheet.Cell(4, 1).Value = "Pjesëmarrës";
        worksheet.Cell(4, 2).Value = participants.Count;

        var headerRow = 6;
        worksheet.Cell(headerRow, 1).Value = "#";
        worksheet.Cell(headerRow, 2).Value = "Emri";
        worksheet.Cell(headerRow, 3).Value = "Nr. Regjistri";
        worksheet.Cell(headerRow, 4).Value = "Email";
        worksheet.Cell(headerRow, 5).Value = "Rezervimi";
        worksheet.Cell(headerRow, 6).Value = "Prezenca";
        worksheet.Cell(headerRow, 7).Value = "Vendi";
        worksheet.Cell(headerRow, 8).Value = "Regjistruar më";

        for (var index = 0; index < participants.Count; index++)
        {
            var participant = participants[index];
            var row = headerRow + 1 + index;
            worksheet.Cell(row, 1).Value = index + 1;
            worksheet.Cell(row, 2).Value = BuildParticipantDisplayName(participant);
            worksheet.Cell(row, 3).Value = participant.MemberRegistryNumber;
            worksheet.Cell(row, 4).Value = participant.Email;
            worksheet.Cell(row, 5).Value = MapBookingStatus(participant.Status);
            worksheet.Cell(row, 6).Value = MapAttendanceStatus(participant.Attendance);
            worksheet.Cell(row, 7).Value = participant.SeatNumber > 0 ? participant.SeatNumber.ToString() : "-";
            worksheet.Cell(row, 8).Value = participant.RegisteredAt;
            worksheet.Cell(row, 8).Style.DateFormat.Format = "dd.MM.yyyy HH:mm";
        }

        var metadataRange = worksheet.Range(1, 1, 4, 2);
        metadataRange.Style.Font.Bold = true;

        var tableRangeEndRow = Math.Max(headerRow + 1, headerRow + participants.Count);
        var tableRange = worksheet.Range(headerRow, 1, tableRangeEndRow, 8);
        tableRange.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
        tableRange.Style.Border.InsideBorder = XLBorderStyleValues.Thin;
        worksheet.Row(headerRow).Style.Font.Bold = true;
        worksheet.Row(headerRow).Style.Fill.BackgroundColor = XLColor.FromHtml("#F1F5F9");

        worksheet.Columns().AdjustToContents();

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);

        var safeModuleName = BuildSafeFileName(eventItem.Name);
        var fileName = $"pjesemarresit-{safeModuleName}-{sessionDate.Date:yyyyMMdd}.xlsx";

        return new SessionParticipantsExportResult(
            stream.ToArray(),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            fileName);
    }

    public async Task MarkAttendanceAsync(Guid eventId, Guid participantId, string status)
    {
        var participant = await _participantRepository.Query()
            .FirstOrDefaultAsync(p => p.Id == participantId && p.EventItemId == eventId) 
            ?? throw new KeyNotFoundException("Participant not found.");

        if (status.Equals("attended", StringComparison.OrdinalIgnoreCase))
        {
            participant.MarkAttended();
            // A member can only be confirmed in one session per module.
            var otherBookingsInModule = await _participantRepository.Query()
                .Where(p => p.EventItemId == eventId && p.UserId == participant.UserId && p.Id != participant.Id)
                .ToListAsync();

            var eventItem = await _eventRepository.Query()
                .Include(x => x.Dates)
                .FirstOrDefaultAsync(x => x.Id == eventId);

            foreach (var otherBooking in otherBookingsInModule)
            {
                await CancelParticipantReservationInternalAsync(otherBooking, eventItem);
            }
        }
        else if (status.Equals("absent", StringComparison.OrdinalIgnoreCase)
                 || status.Equals("rejected", StringComparison.OrdinalIgnoreCase))
            participant.MarkAbsent();
        else
            throw new ArgumentException("Invalid attendance status.");

        await _dbContext.SaveChangesAsync();
    }

    public async Task CancelReservationAsync(Guid eventId, Guid participantId)
    {
        var participant = await _participantRepository.Query()
            .FirstOrDefaultAsync(p => p.Id == participantId && p.EventItemId == eventId)
            ?? throw new KeyNotFoundException("Participant not found.");

        var existingEvent = await _eventRepository.Query()
            .Include(x => x.Dates)
            .FirstOrDefaultAsync(x => x.Id == eventId);
        await CancelParticipantReservationInternalAsync(participant, existingEvent);

        await _dbContext.SaveChangesAsync();
    }

    public async Task RemoveParticipantFromSessionAsync(Guid eventId, Guid dateId, Guid participantId)
    {
        var participant = await _participantRepository.Query()
            .FirstOrDefaultAsync(p => p.Id == participantId && p.EventItemId == eventId && p.DateId == dateId)
            ?? throw new KeyNotFoundException("Participant not found in this session.");

        var existingEvent = await _eventRepository.Query()
            .Include(x => x.Dates)
            .FirstOrDefaultAsync(x => x.Id == eventId);
        await CancelParticipantReservationInternalAsync(participant, existingEvent);

        await _dbContext.SaveChangesAsync();
    }

    public async Task DeleteEventAsync(Guid id)
    {
        var eventItem = await _eventRepository.Query()
            .Include(e => e.Dates)
            .Include(e => e.Participants)
            .FirstOrDefaultAsync(e => e.Id == id) ?? throw new KeyNotFoundException("Event not found.");

        _eventRepository.Delete(eventItem);
        await _dbContext.SaveChangesAsync();
    }

    public async Task UpdateEventAsync(Guid id, string name, string place, int sessionCapacity, int totalSessions, int cpdHours, decimal price, string? lecturerName, string? webinarLink, List<string> topics, List<(Guid? Id, string Date, string Time, string? Location)>? dates, List<string>? lecturerIds, string? feedbackQuestionsJson = null)
    {
        var eventItem = await _eventRepository.Query()
            .Include(e => e.Dates)
            .FirstOrDefaultAsync(e => e.Id == id) ?? throw new KeyNotFoundException("Event not found.");

        var isEndedModule = eventItem.Dates.Count > 0 && eventItem.Dates.All(d => d.IsEnded);
        if (isEndedModule)
        {
            throw new InvalidOperationException("Nuk mund të modifikoni modulin e përfunduar.");
        }

        eventItem.UpdateDetails(name, place, sessionCapacity, totalSessions, cpdHours, price, lecturerName, webinarLink, topics, lecturerIds, feedbackQuestionsJson);

        if (dates != null)
        {
            foreach (var dateRequest in dates)
            {
                if (!DateTime.TryParse(dateRequest.Date, out var parsedDate)) continue;

                if (dateRequest.Id.HasValue && dateRequest.Id.Value != Guid.Empty)
                {
                    var existingDate = eventItem.Dates.FirstOrDefault(x => x.Id == dateRequest.Id.Value);
                    if (existingDate != null)
                    {
                        existingDate.UpdateDetails(parsedDate, dateRequest.Time, dateRequest.Location);
                    }
                }
                else
                {
                    // Match by Date just in case ID is missing but it is the same exact day
                    var existingDate = eventItem.Dates.FirstOrDefault(x => x.Date.Date == parsedDate.Date);
                    if (existingDate != null)
                    {
                        existingDate.UpdateDetails(parsedDate, dateRequest.Time, dateRequest.Location);
                    }
                    else
                    {
                        eventItem.AddDate(new EventDate(parsedDate, dateRequest.Time, sessionCapacity, dateRequest.Location));
                    }
                }
            }
        }

        await _dbContext.SaveChangesAsync();
    }

    public async Task MarkAsNotifiedAsync(Guid id)
    {
        var eventItem = await _eventRepository.Query().FirstOrDefaultAsync(e => e.Id == id) ?? throw new KeyNotFoundException("Event not found.");
        eventItem.MarkAsNotified();
        await _dbContext.SaveChangesAsync();
        try
        {
            await _notificationService.NotifyBookingOpenedAsync(id);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Booking-open notifications failed for module {ModuleId}.", id);
        }
    }

    public async Task EndSessionAsync(Guid eventId, Guid dateId)
    {
        var eventItem = await _eventRepository.Query()
            .Include(e => e.Dates)
            .Include(e => e.Participants)
                .ThenInclude(p => p.User)
            .FirstOrDefaultAsync(e => e.Id == eventId) ?? throw new KeyNotFoundException("Event not found.");

        var date = eventItem.Dates.FirstOrDefault(d => d.Id == dateId) ?? throw new KeyNotFoundException("Session date not found.");

        if (date.IsEnded)
        {
            return;
        }

        date.EndSession();
        eventItem.RefreshStatusFromDates();

        if (string.Equals(eventItem.Status, "past", StringComparison.OrdinalIgnoreCase))
        {
            DeduplicateCompletedModuleParticipants(eventItem);
        }

        await _dbContext.SaveChangesAsync();

        await NotifyAdminsAboutClosedSessionAsync(eventItem, date);
        try
        {
            await _notificationService.NotifySurveyReminderForEndedSessionAsync(eventItem.Id, date.Id);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Survey reminder notifications failed for module {ModuleId} session {SessionId}.", eventItem.Id, date.Id);
        }
    }

    public async Task<EventDocument> UploadDocumentAsync(Guid eventId, IFormFile file, Guid userId, string? displayName, CancellationToken cancellationToken = default)
    {
        _ = await _eventRepository.Query()
            .FirstOrDefaultAsync(e => e.Id == eventId, cancellationToken)
            ?? throw new KeyNotFoundException("Event not found.");

        var stored = await _fileStorageService.SaveAsync(
            file,
            scope: "module",
            ownerId: eventId,
            preferredFileName: displayName,
            cancellationToken: cancellationToken);

        var eventDocument = new EventDocument(eventId, stored.FileName, stored.PublicUrl, userId);
        _dbContext.EventDocuments.Add(eventDocument);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return eventDocument;
    }

    public async Task<EventDocument> AddDocumentAsync(Guid eventId, string fileName, string fileUrl, Guid userId)
    {
        var eventItem = await _eventRepository.Query().FirstOrDefaultAsync(e => e.Id == eventId) ?? throw new KeyNotFoundException("Event not found.");
        var doc = new EventDocument(eventId, fileName, fileUrl, userId);
        
        _dbContext.EventDocuments.Add(doc);
        await _dbContext.SaveChangesAsync();
        return doc;
    }

    public async Task DeleteDocumentAsync(Guid eventId, Guid documentId)
    {
        var doc = await _dbContext.EventDocuments.FirstOrDefaultAsync(d => d.Id == documentId && d.EventItemId == eventId)
            ?? throw new KeyNotFoundException("Document not found.");

        _dbContext.EventDocuments.Remove(doc);
        await _dbContext.SaveChangesAsync();
        await _fileStorageService.DeleteByPublicUrlAsync(doc.FileUrl);
    }

    public async Task SubmitFeedbackAsync(Guid eventId, Guid? dateId, Guid userId, int? sessionRating, string? sessionComments, int? lecturerRating, string? lecturerComments, string? suggestions, string? questionnaireId = null, string? questionnaireTitle = null, IReadOnlyList<FeedbackAnswerInput>? answers = null)
    {
        var normalizedQuestionnaireId = string.IsNullOrWhiteSpace(questionnaireId)
            ? null
            : questionnaireId.Trim();

        var existingFeedbackEntries = await _dbContext.EventFeedbacks
            .Where(f => f.EventItemId == eventId && f.DateId == dateId && f.UserId == userId)
            .ToListAsync();

        var alreadySubmitted = normalizedQuestionnaireId is null
            ? existingFeedbackEntries.Any(f => string.IsNullOrWhiteSpace(ExtractQuestionnaireId(f.Suggestions)))
            : existingFeedbackEntries.Any(f => string.Equals(
                ExtractQuestionnaireId(f.Suggestions),
                normalizedQuestionnaireId,
                StringComparison.OrdinalIgnoreCase));

        if (alreadySubmitted)
        {
            throw new InvalidOperationException("Feedback already submitted for this session.");
        }

        var normalizedAnswers = answers?
            .Where(answer => !string.IsNullOrWhiteSpace(answer.QuestionId) && !string.IsNullOrWhiteSpace(answer.Answer))
            .Select(answer => new FeedbackAnswerPayload(answer.QuestionId.Trim(), answer.Answer.Trim()))
            .ToList() ?? [];

        var computedSessionRating = ClampRating(sessionRating ?? InferRatingFromAnswers(normalizedAnswers));
        var computedLecturerRating = ClampRating(lecturerRating ?? computedSessionRating);

        var payload = new QuestionnaireSubmissionPayload(
            normalizedQuestionnaireId,
            string.IsNullOrWhiteSpace(questionnaireTitle) ? null : questionnaireTitle.Trim(),
            normalizedAnswers,
            string.IsNullOrWhiteSpace(suggestions) ? null : suggestions.Trim());

        var serializedPayload = JsonSerializer.Serialize(payload, JsonOptions);
        var mergedSuggestions = normalizedQuestionnaireId is null
            ? serializedPayload
            : $"{BuildQuestionnaireMarker(normalizedQuestionnaireId)}{serializedPayload}";

        var feedback = new EventFeedback(
            eventId,
            dateId,
            userId,
            computedSessionRating,
            string.IsNullOrWhiteSpace(sessionComments) ? null : sessionComments.Trim(),
            computedLecturerRating,
            string.IsNullOrWhiteSpace(lecturerComments) ? null : lecturerComments.Trim(),
            mergedSuggestions);
        _dbContext.EventFeedbacks.Add(feedback);
        await _dbContext.SaveChangesAsync();
    }

    private async Task NotifyAdminsAboutClosedSessionAsync(EventItem eventItem, EventDate sessionDate)
    {
        var participantsForSession = eventItem.Participants
            .Where(p => p.DateId == sessionDate.Id)
            .OrderBy(p => p.Status == "registered" ? 0 : 1)
            .ThenBy(p => p.SeatNumber)
            .ThenBy(p => p.RegisteredAt)
            .Select(p => new SessionParticipantEmailItem(
                BuildParticipantDisplayName(p),
                p.MemberRegistryNumber,
                p.Email,
                MapBookingStatus(p.Status),
                MapAttendanceStatus(p.Attendance)))
            .ToList();

        var admins = await _dbContext.Users
            .AsNoTracking()
            .Where(u =>
                u.IsActive &&
                !string.IsNullOrWhiteSpace(u.Email) &&
                u.Role == "Admin")
            .ToListAsync();

        if (admins.Count == 0)
        {
            return;
        }

        var summary = new SessionClosedAdminEmailItem(
            eventItem.Name,
            sessionDate.Date,
            sessionDate.Time,
            sessionDate.Location);

        foreach (var admin in admins)
        {
            try
            {
                await _emailService.SendSessionClosedParticipantsSummaryAsync(
                    admin,
                    summary,
                    participantsForSession);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(
                    ex,
                    "Could not send closed-session summary to admin {AdminEmail} for module {ModuleId} session {SessionId}.",
                    admin.Email,
                    eventItem.Id,
                    sessionDate.Id);
            }
        }
    }

    private void DeduplicateCompletedModuleParticipants(EventItem eventItem)
    {
        var duplicateGroups = eventItem.Participants
            .GroupBy(x => x.UserId)
            .Where(group => group.Count() > 1)
            .ToList();

        foreach (var group in duplicateGroups)
        {
            var keep = group
                .OrderBy(x => x.Attendance == "attended" ? 0 : 1)
                .ThenBy(x => x.Status == "registered" ? 0 : 1)
                .ThenBy(x => x.RegisteredAt)
                .First();

            foreach (var duplicate in group.Where(x => x.Id != keep.Id))
            {
                if (duplicate.Status == "registered")
                {
                    var duplicateDate = eventItem.Dates.FirstOrDefault(x => x.Id == duplicate.DateId);
                    duplicateDate?.DecrementParticipant();
                }

                _participantRepository.Delete(duplicate);
            }
        }
    }

    private async Task<int> ApplyExtraReservationAutoCancellationAsync(Guid? userId = null)
    {
        var now = DateTime.UtcNow;
        var reservationsQuery = _participantRepository.Query();
        if (userId.HasValue)
        {
            reservationsQuery = reservationsQuery.Where(x => x.UserId == userId.Value);
        }

        var allReservations = await reservationsQuery.ToListAsync();
        var groupedReservations = allReservations
            .GroupBy(x => new { x.EventItemId, x.UserId })
            .Where(group => group.Count() > 1)
            .ToList();

        if (groupedReservations.Count == 0)
        {
            return 0;
        }

        var eventIds = groupedReservations
            .Select(group => group.Key.EventItemId)
            .Distinct()
            .ToList();
        var eventsById = await _eventRepository.Query()
            .Include(x => x.Dates)
            .Where(x => eventIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id);

        var cancelledCount = 0;
        foreach (var group in groupedReservations)
        {
            if (!eventsById.TryGetValue(group.Key.EventItemId, out var eventItem))
            {
                continue;
            }

            if (!IsWithinReservationRestrictionWindow(eventItem, now))
            {
                continue;
            }

            var extraReservations = group
                .OrderBy(x => x.RegisteredAt)
                .Skip(1)
                .Where(x => now - x.RegisteredAt >= TimeSpan.FromDays(ReservationGraceDays))
                .ToList();

            foreach (var reservation in extraReservations)
            {
                await CancelParticipantReservationInternalAsync(reservation, eventItem);
                cancelledCount++;
            }
        }

        if (cancelledCount > 0)
        {
            await _dbContext.SaveChangesAsync();
        }

        return cancelledCount;
    }

    private async Task CancelParticipantReservationInternalAsync(Participant participant, EventItem? existingEvent = null)
    {
        var wasRegistered = participant.Status == "registered";
        var cancelledDateId = participant.DateId;
        var eventId = participant.EventItemId;

        _participantRepository.Delete(participant);

        if (!wasRegistered)
        {
            return;
        }

        if (existingEvent == null)
        {
            existingEvent = await _eventRepository.Query()
                .Include(x => x.Dates)
                .FirstOrDefaultAsync(x => x.Id == eventId);
        }

        if (existingEvent == null)
        {
            return;
        }

        var existingDate = existingEvent.Dates.FirstOrDefault(x => x.Id == cancelledDateId);
        existingDate?.DecrementParticipant();

        // Promote the earliest waitlisted person for this date.
        var nextInLine = await _participantRepository.Query()
            .Where(p => p.EventItemId == eventId && p.DateId == cancelledDateId && p.Status == "waitlisted")
            .OrderBy(p => p.RegisteredAt)
            .FirstOrDefaultAsync();

        if (nextInLine != null && existingDate != null)
        {
            existingDate.IncrementParticipant();
            nextInLine.Promote(existingDate.CurrentParticipants);
        }
    }

    private static bool IsWithinReservationRestrictionWindow(EventItem eventItem, DateTime now)
    {
        if (eventItem.Dates.Count == 0)
        {
            return false;
        }

        var firstSessionDate = eventItem.Dates.Min(x => x.Date).Date;
        var today = now.Date;
        return firstSessionDate >= today && firstSessionDate <= today.AddDays(ReservationRestrictionDays);
    }

    private static string MapBookingStatus(string status) => status switch
    {
        "registered" => "Konfirmuar",
        "waitlisted" => "Në pritje",
        _ => status
    };

    private static string MapAttendanceStatus(string attendance) => attendance switch
    {
        "attended" => "I pranishëm",
        "absent" => "Refuzuar",
        _ => "Në pritje"
    };

    private static string BuildParticipantDisplayName(Participant participant)
    {
        var fullName = $"{participant.FirstName} {participant.LastName}".Trim();
        if (!string.IsNullOrWhiteSpace(fullName))
        {
            return fullName;
        }

        if (!string.IsNullOrWhiteSpace(participant.MemberRegistryNumber))
        {
            return participant.MemberRegistryNumber;
        }

        return string.IsNullOrWhiteSpace(participant.Email) ? "-" : participant.Email;
    }

    private static string BuildSafeFileName(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return "modul";
        }

        var invalidChars = Path.GetInvalidFileNameChars();
        var cleaned = new string(name
            .Trim()
            .Select(ch => invalidChars.Contains(ch) ? '-' : ch)
            .ToArray());

        return string.IsNullOrWhiteSpace(cleaned) ? "modul" : cleaned;
    }

    private static int InferRatingFromAnswers(IReadOnlyList<FeedbackAnswerPayload> answers)
    {
        var ratings = answers
            .Select(answer => int.TryParse(answer.Answer, out var value) ? value : (int?)null)
            .Where(value => value.HasValue)
            .Select(value => value!.Value)
            .Where(value => value is >= 1 and <= 5)
            .ToList();

        if (ratings.Count == 0)
        {
            return 5;
        }

        return (int)Math.Round(ratings.Average(), MidpointRounding.AwayFromZero);
    }

    private static int ClampRating(int rating) => Math.Min(5, Math.Max(1, rating));

    private static string BuildQuestionnaireMarker(string questionnaireId) => $"[QID:{questionnaireId}]";

    private static string? ExtractQuestionnaireId(string? suggestions)
    {
        if (string.IsNullOrWhiteSpace(suggestions) || !suggestions.StartsWith("[QID:", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        var closing = suggestions.IndexOf(']');
        if (closing <= 5)
        {
            return null;
        }

        return suggestions[5..closing];
    }
}

public sealed record FeedbackAnswerPayload(string QuestionId, string Answer);
public sealed record QuestionnaireSubmissionPayload(string? QuestionnaireId, string? QuestionnaireTitle, IReadOnlyList<FeedbackAnswerPayload> Answers, string? Suggestions);
