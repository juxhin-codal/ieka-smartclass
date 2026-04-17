using IekaSmartClass.Api.Data;
using IekaSmartClass.Api.Data.Entities;
using IekaSmartClass.Api.Data.Repositories.Interface;
using IekaSmartClass.Api.Services.Interface;
using IekaSmartClass.Api.Utilities.Pagination;
using IekaSmartClass.Api.Utilities.Settings;
using ClosedXML.Excel;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace IekaSmartClass.Api.Services;

public class EventsService(
    IRepository<EventItem> eventRepository,
    IRepository<Participant> participantRepository,
    IFileStorageService fileStorageService,
    IApplicationDbContext dbContext,
    IEmailService emailService,
    INotificationService notificationService,
    IOptions<JwtSettings> jwtOptions,
    IOptions<LocationSettings> locationOptions,
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
    private readonly LocationSettings _locationSettings = locationOptions.Value;
    private readonly byte[] _qrSigningKey = Encoding.UTF8.GetBytes(
        string.IsNullOrWhiteSpace(jwtOptions.Value.Secret)
            ? "ieka-default-event-qr-signing-secret"
            : jwtOptions.Value.Secret);

    private async Task SyncEventStatusesAsync(IEnumerable<EventItem> events)
    {
        var hasChanges = false;
        foreach (var eventItem in events)
        {
            if (eventItem.RefreshStatusFromDates())
            {
                hasChanges = true;
            }

            if (eventItem.ReconcileParticipantCounts())
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
                .ThenInclude(d => d.Documents)
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

    public Task<string> ReserveSeatAsync(Guid eventId, Guid userId, Guid dateId)
        => ReserveSeatCoreAsync(eventId, userId, dateId);

    public async Task<string> AssignMemberToSessionAsync(Guid eventId, Guid dateId, Guid memberId)
    {
        var existingEvent = await _eventRepository.Query()
            .Include(x => x.Dates)
                .ThenInclude(d => d.Documents)
            .Include(x => x.Documents)
            .FirstOrDefaultAsync(x => x.Id == eventId) ?? throw new KeyNotFoundException("Event not found.");

        var user = await _dbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == memberId)
            ?? throw new KeyNotFoundException("User not found.");

        if (!string.Equals(user.Role, "Member", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Vetëm anëtarët mund të shtohen manualisht në një sesion CPD.");
        }

        await ApplyExtraReservationAutoCancellationAsync(memberId);

        var existingDate = existingEvent.Dates.FirstOrDefault(x => x.Id == dateId)
            ?? throw new KeyNotFoundException("Date not found.");

        if (existingDate.IsEnded)
        {
            throw new InvalidOperationException("Ky sesion është mbyllur dhe nuk pranon regjistrime të reja.");
        }

        var alreadyThisDate = await _participantRepository.Query()
            .AnyAsync(x => x.EventItemId == eventId && x.UserId == memberId && x.DateId == dateId);

        if (alreadyThisDate)
            throw new InvalidOperationException("Ky anëtar është tashmë i regjistruar në këtë sesion.");

        var startsWithinRestrictionWindow = IsWithinReservationRestrictionWindow(existingEvent, DateTime.UtcNow);
        var maxReservationsAllowed = startsWithinRestrictionWindow ? 1 : 2;

        var existingReservations = await _participantRepository.Query()
            .CountAsync(x => x.EventItemId == eventId && x.UserId == memberId);

        if (existingReservations >= maxReservationsAllowed)
        {
            if (maxReservationsAllowed == 1)
            {
                throw new InvalidOperationException("Ky modul fillon brenda 7 ditëve. Anëtari mund të ketë vetëm 1 sesion.");
            }

            throw new InvalidOperationException("Anëtari ka arritur maksimumin prej 2 rezervimesh për këtë modul.");
        }

        string status;
        if (existingDate.CurrentParticipants >= existingDate.MaxParticipants)
        {
            var waitlistParticipant = new Participant(eventId, memberId, dateId, seatNumber: 0, status: "waitlisted");
            await _participantRepository.AddAsync(waitlistParticipant);
            status = "waitlisted";
        }
        else
        {
            existingDate.IncrementParticipant();
            existingEvent.IncrementParticipant();

            var participant = new Participant(eventId, memberId, dateId, existingDate.CurrentParticipants);
            await _participantRepository.AddAsync(participant);
            status = "registered";
        }

        await _dbContext.SaveChangesAsync();

        try
        {
            await SendMemberSessionAssignmentEmailAsync(existingEvent, existingDate, user, status);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to send manual session assignment email for event {EventId} to user {UserId}", eventId, memberId);
        }

        return status;
    }

    /// <returns>"registered" or "waitlisted"</returns>
    private async Task<string> ReserveSeatCoreAsync(Guid eventId, Guid userId, Guid dateId)
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
                .ThenInclude(d => d.Documents)
            .Include(e => e.Participants)
            .Include(e => e.Documents)
            .Include(e => e.Feedbacks)
            .Include(e => e.EventQuestionnaires)
                .ThenInclude(q => q.Responses)
                    .ThenInclude(r => r.Answers)
            .FirstOrDefaultAsync(e => e.Id == id) ?? throw new KeyNotFoundException("Event not found.");

        var eventDateDocuments = eventItem.Dates.SelectMany(d => d.Documents).ToList();
        var questionnaireResponses = eventItem.EventQuestionnaires.SelectMany(q => q.Responses).ToList();
        var questionnaireAnswers = questionnaireResponses.SelectMany(r => r.Answers).ToList();

        foreach (var docUrl in eventItem.Documents.Select(d => d.FileUrl).Concat(eventDateDocuments.Select(d => d.FileUrl)))
        {
            try
            {
                await _fileStorageService.DeleteByPublicUrlAsync(docUrl);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to delete stored event file for event {EventId}", id);
            }
        }

        if (questionnaireAnswers.Count > 0)
        {
            _dbContext.EventQuestionnaireAnswers.RemoveRange(questionnaireAnswers);
        }

        if (questionnaireResponses.Count > 0)
        {
            _dbContext.EventQuestionnaireResponses.RemoveRange(questionnaireResponses);
        }

        if (eventItem.EventQuestionnaires.Count > 0)
        {
            _dbContext.EventQuestionnaires.RemoveRange(eventItem.EventQuestionnaires);
        }

        if (eventItem.Feedbacks.Count > 0)
        {
            _dbContext.EventFeedbacks.RemoveRange(eventItem.Feedbacks);
        }

        if (eventDateDocuments.Count > 0)
        {
            _dbContext.EventDateDocuments.RemoveRange(eventDateDocuments);
        }

        if (eventItem.Participants.Count > 0)
        {
            _dbContext.Participants.RemoveRange(eventItem.Participants);
        }

        if (eventItem.Documents.Count > 0)
        {
            _dbContext.EventDocuments.RemoveRange(eventItem.Documents);
        }

        if (eventItem.Dates.Count > 0)
        {
            _dbContext.EventDates.RemoveRange(eventItem.Dates);
        }

        _eventRepository.Delete(eventItem);
        await _dbContext.SaveChangesAsync();
    }

    public async Task UpdateEventAsync(Guid id, string name, string place, int sessionCapacity, int totalSessions, int cpdHours, decimal price, string? lecturerName, string? webinarLink, List<string> topics, List<(Guid? Id, string Date, string Time, string? Location, bool RequireLocation, double? Latitude, double? Longitude)>? dates, List<string>? lecturerIds, string? feedbackQuestionsJson = null)
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
                        existingDate.UpdateDetails(parsedDate, dateRequest.Time, dateRequest.Location, dateRequest.RequireLocation, dateRequest.Latitude, dateRequest.Longitude);
                    }
                }
                else
                {
                    // Match by Date just in case ID is missing but it is the same exact day
                    var existingDate = eventItem.Dates.FirstOrDefault(x => x.Date.Date == parsedDate.Date);
                    if (existingDate != null)
                    {
                        existingDate.UpdateDetails(parsedDate, dateRequest.Time, dateRequest.Location, dateRequest.RequireLocation, dateRequest.Latitude, dateRequest.Longitude);
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
                    eventItem.DecrementParticipant();
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
        existingEvent.DecrementParticipant();

        // Promote the earliest waitlisted person for this date.
        var nextInLine = await _participantRepository.Query()
            .Where(p => p.EventItemId == eventId && p.DateId == cancelledDateId && p.Status == "waitlisted")
            .OrderBy(p => p.RegisteredAt)
            .FirstOrDefaultAsync();

        if (nextInLine != null && existingDate != null)
        {
            existingDate.IncrementParticipant();
            existingEvent.IncrementParticipant();
            nextInLine.Promote(existingDate.CurrentParticipants);
        }
    }

    private async Task SendMemberSessionAssignmentEmailAsync(EventItem eventItem, EventDate selectedDate, AppUser user, string status)
    {
        var emailItem = new MemberSessionAssignmentEmailItem(
            eventItem.Name,
            status,
            selectedDate.Date.ToString("dd MMM yyyy"),
            string.IsNullOrWhiteSpace(selectedDate.Time) ? "-" : selectedDate.Time,
            string.IsNullOrWhiteSpace(selectedDate.Location) ? eventItem.Place : selectedDate.Location!.Trim(),
            eventItem.CpdHours,
            BuildSessionDatesHtml(eventItem, selectedDate.Id),
            BuildDocumentListHtml(eventItem.Documents.Select(d => (d.FileName, d.FileUrl))),
            BuildDocumentListHtml(selectedDate.Documents.Select(d => (d.FileName, d.FileUrl))),
            $"/modules/{eventItem.Id}");

        await _emailService.SendMemberSessionAssignmentAsync(user, emailItem);
    }

    private static string BuildSessionDatesHtml(EventItem eventItem, Guid selectedDateId)
    {
        if (eventItem.Dates.Count == 0)
        {
            return string.Empty;
        }

        return string.Join("", eventItem.Dates
            .OrderBy(d => d.Date)
            .Select(date =>
            {
                var isSelected = date.Id == selectedDateId;
                var bgColor = isSelected ? "#eff6ff" : "#f8fafc";
                var borderColor = isSelected ? "#60a5fa" : "#e2e8f0";
                var location = string.IsNullOrWhiteSpace(date.Location) ? eventItem.Place : date.Location!.Trim();
                var badge = isSelected
                    ? "<span style='display:inline-block;margin-left:8px;padding:2px 8px;border-radius:999px;background-color:#dbeafe;color:#1d4ed8;font-size:11px;font-weight:700;'>Sesioni juaj</span>"
                    : string.Empty;

                return $"""
                <div style="margin-bottom:8px;padding:10px 12px;border:1px solid {borderColor};background-color:{bgColor};border-radius:8px;">
                  <div style="font-size:13px;font-weight:600;color:#0f172a;">{System.Net.WebUtility.HtmlEncode(date.Date.ToString("dddd, dd MMM yyyy"))}{badge}</div>
                  <div style="margin-top:4px;font-size:12px;color:#475569;">Ora: {System.Net.WebUtility.HtmlEncode(string.IsNullOrWhiteSpace(date.Time) ? "-" : date.Time)}</div>
                  <div style="margin-top:2px;font-size:12px;color:#475569;">Vendndodhja: {System.Net.WebUtility.HtmlEncode(location)}</div>
                </div>
                """;
            }));
    }

    private static string BuildDocumentListHtml(IEnumerable<(string Name, string Url)> documents)
    {
        var items = documents
            .Where(d => !string.IsNullOrWhiteSpace(d.Name))
            .Select(d =>
            {
                var name = System.Net.WebUtility.HtmlEncode(d.Name.Trim());
                var url = string.IsNullOrWhiteSpace(d.Url) ? null : System.Net.WebUtility.HtmlEncode(d.Url.Trim());
                return url is null
                    ? $"""<div style="margin-bottom:8px;font-size:13px;color:#0f172a;">• {name}</div>"""
                    : $"""<div style="margin-bottom:8px;font-size:13px;"><a href="{url}" style="color:#1d4ed8;text-decoration:none;">• {name}</a></div>""";
            })
            .ToList();

        return items.Count == 0 ? string.Empty : string.Join("", items);
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

    // ── Session QR-based Attendance ────────────────────────────────────────

    private sealed record EventSessionQrPayload(Guid EventId, Guid DateId, long ExpiresAtUnix);
    private sealed record EventQuestionnaireQrPayload(Guid QuestionnaireId, long ExpiresAtUnix);

    public async Task<string> GenerateSessionQrTokenAsync(Guid eventId, Guid dateId, CancellationToken cancellationToken = default)
    {
        var eventItem = await _eventRepository.Query()
            .Include(e => e.Dates)
            .FirstOrDefaultAsync(e => e.Id == eventId, cancellationToken)
            ?? throw new KeyNotFoundException("Moduli nuk u gjet.");

        var sessionDate = eventItem.Dates.FirstOrDefault(d => d.Id == dateId)
            ?? throw new KeyNotFoundException("Sesioni nuk u gjet.");

        var expiresAt = DateTime.UtcNow.AddHours(8);
        var payload = new EventSessionQrPayload(eventId, dateId, new DateTimeOffset(expiresAt).ToUnixTimeSeconds());
        return CreateSignedToken(payload);
    }

    public async Task<Participant> ScanSessionAttendanceAsync(string qrToken, Guid userId, double? latitude, double? longitude, CancellationToken cancellationToken = default)
    {
        var normalized = NormalizeQrInput(qrToken);
        var payload = ParseSignedToken<EventSessionQrPayload>(normalized);

        var expiresAt = DateTimeOffset.FromUnixTimeSeconds(payload.ExpiresAtUnix);
        if (expiresAt < DateTimeOffset.UtcNow)
            throw new InvalidOperationException("Kodi QR ka skaduar.");

        var sessionDate = await _dbContext.EventDates
            .AsNoTracking()
            .FirstOrDefaultAsync(d => d.Id == payload.DateId && d.EventItemId == payload.EventId, cancellationToken)
            ?? throw new InvalidOperationException("Sesioni nuk u gjet.");

        // Only allow attendance on the same day (Europe/Tirane)
        var cetZone = TimeZoneInfo.FindSystemTimeZoneById("Europe/Tirane");
        var todayDate = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, cetZone).Date;
        if (sessionDate.Date.Date != todayDate)
            throw new InvalidOperationException("Prezenca mund të regjistrohet vetëm në ditën e sesionit.");

        // Geolocation validation
        if (sessionDate.RequireLocation && sessionDate.Latitude.HasValue && sessionDate.Longitude.HasValue)
        {
            if (latitude is null || longitude is null)
                throw new InvalidOperationException("Vendndodhja juaj nuk mund të përcaktohet. Ju lutem aktivizoni GPS-in.");

            var distance = HaversineDistanceMeters(latitude.Value, longitude.Value, sessionDate.Latitude.Value, sessionDate.Longitude.Value);
            if (distance > _locationSettings.MaxDistanceMeters)
                throw new InvalidOperationException("Ju ndodheni larg vendit të mësimit.");
        }

        // Find the participant for this event+date+user
        var participant = await _dbContext.Participants
            .FirstOrDefaultAsync(p => p.EventItemId == payload.EventId && p.DateId == payload.DateId && p.UserId == userId && p.Status == "registered", cancellationToken)
            ?? throw new InvalidOperationException("Nuk jeni i/e regjistruar në këtë sesion.");

        if (participant.Attendance == "attended")
            throw new InvalidOperationException("Prezenca është regjistruar tashmë.");

        participant.MarkAttended();
        await _dbContext.SaveChangesAsync(cancellationToken);
        return participant;
    }

    // ── Session Documents ──────────────────────────────────────────────────

    public async Task<EventDateDocument> UploadSessionDocumentAsync(Guid eventId, Guid dateId, IFormFile file, Guid userId, string? displayName, CancellationToken cancellationToken = default)
    {
        var sessionDate = await _dbContext.EventDates
            .FirstOrDefaultAsync(d => d.Id == dateId && d.EventItemId == eventId, cancellationToken)
            ?? throw new KeyNotFoundException("Sesioni nuk u gjet.");

        var fileResult = await _fileStorageService.SaveAsync(file, "event-sessions", userId, cancellationToken: cancellationToken);
        var name = string.IsNullOrWhiteSpace(displayName) ? file.FileName : displayName;
        var doc = new EventDateDocument(dateId, name, fileResult.PublicUrl, fileResult.RelativePath, file.Length, userId);
        _dbContext.EventDateDocuments.Add(doc);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return doc;
    }

    public async Task DeleteSessionDocumentAsync(Guid eventId, Guid dateId, Guid documentId, CancellationToken cancellationToken = default)
    {
        var doc = await _dbContext.EventDateDocuments
            .FirstOrDefaultAsync(d => d.Id == documentId && d.EventDateId == dateId, cancellationToken)
            ?? throw new KeyNotFoundException("Dokumenti nuk u gjet.");

        if (!string.IsNullOrWhiteSpace(doc.FileUrl))
        {
            try { await _fileStorageService.DeleteByPublicUrlAsync(doc.FileUrl, cancellationToken); }
            catch (Exception ex) { _logger.LogWarning(ex, "Failed to delete file {Url}", doc.FileUrl); }
        }

        _dbContext.EventDateDocuments.Remove(doc);
        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    // ── Event Questionnaires (module-level) ────────────────────────────────

    public async Task<EventQuestionnaire> CreateEventQuestionnaireAsync(Guid eventId, string title, List<EventQuestionnaireQuestionInput> questions, CancellationToken cancellationToken = default)
    {
        var eventItem = await _eventRepository.Query().FirstOrDefaultAsync(e => e.Id == eventId, cancellationToken)
            ?? throw new KeyNotFoundException("Moduli nuk u gjet.");

        var questionnaire = new EventQuestionnaire(eventId, title);
        _dbContext.EventQuestionnaires.Add(questionnaire);

        foreach (var q in questions)
        {
            var question = new EventQuestionnaireQuestion(questionnaire.Id, q.Text, q.Type, q.Order, q.OptionsJson, q.CorrectAnswer);
            _dbContext.EventQuestionnaireQuestions.Add(question);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        return await _dbContext.EventQuestionnaires
            .AsNoTracking()
            .Include(q => q.Questions)
            .Include(q => q.Responses)
            .FirstAsync(q => q.Id == questionnaire.Id, cancellationToken);
    }

    public async Task<EventQuestionnaire> UpdateEventQuestionnaireAsync(Guid questionnaireId, string title, List<EventQuestionnaireQuestionInput> questions, CancellationToken cancellationToken = default)
    {
        var questionnaire = await _dbContext.EventQuestionnaires
            .Include(q => q.Questions)
            .FirstOrDefaultAsync(q => q.Id == questionnaireId, cancellationToken)
            ?? throw new KeyNotFoundException("Pyetësori nuk u gjet.");

        questionnaire.UpdateTitle(title);

        // Remove old questions and add new ones
        foreach (var old in questionnaire.Questions.ToList())
            _dbContext.EventQuestionnaireQuestions.Remove(old);

        foreach (var q in questions)
        {
            var question = new EventQuestionnaireQuestion(questionnaireId, q.Text, q.Type, q.Order, q.OptionsJson, q.CorrectAnswer);
            _dbContext.EventQuestionnaireQuestions.Add(question);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        return await _dbContext.EventQuestionnaires
            .AsNoTracking()
            .Include(q => q.Questions)
            .Include(q => q.Responses)
            .FirstAsync(q => q.Id == questionnaireId, cancellationToken);
    }

    public async Task DeleteEventQuestionnaireAsync(Guid questionnaireId, CancellationToken cancellationToken = default)
    {
        var questionnaire = await _dbContext.EventQuestionnaires
            .FirstOrDefaultAsync(q => q.Id == questionnaireId, cancellationToken)
            ?? throw new KeyNotFoundException("Pyetësori nuk u gjet.");

        _dbContext.EventQuestionnaires.Remove(questionnaire);
        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task<EventQuestionnaire?> GetEventQuestionnaireDetailAsync(Guid questionnaireId, CancellationToken cancellationToken = default)
    {
        return await _dbContext.EventQuestionnaires
            .AsNoTracking()
            .Include(q => q.Questions.OrderBy(x => x.Order))
            .Include(q => q.Responses).ThenInclude(r => r.Answers)
            .Include(q => q.Responses).ThenInclude(r => r.User)
            .FirstOrDefaultAsync(q => q.Id == questionnaireId, cancellationToken);
    }

    public async Task<string> GenerateEventQuestionnaireQrTokenAsync(Guid questionnaireId, CancellationToken cancellationToken = default)
    {
        var questionnaire = await _dbContext.EventQuestionnaires
            .FirstOrDefaultAsync(q => q.Id == questionnaireId, cancellationToken)
            ?? throw new KeyNotFoundException("Pyetësori nuk u gjet.");

        var expiresAt = DateTime.UtcNow.AddDays(30);
        var payload = new EventQuestionnaireQrPayload(questionnaireId, new DateTimeOffset(expiresAt).ToUnixTimeSeconds());
        return CreateSignedToken(payload);
    }

    public async Task<EventQuestionnaire?> GetEventQuestionnaireByTokenAsync(string token, CancellationToken cancellationToken = default)
    {
        var normalized = NormalizeQrInput(token);
        var payload = ParseSignedToken<EventQuestionnaireQrPayload>(normalized);

        var expiresAt = DateTimeOffset.FromUnixTimeSeconds(payload.ExpiresAtUnix);
        if (expiresAt < DateTimeOffset.UtcNow)
            throw new InvalidOperationException("Kodi QR ka skaduar.");

        return await _dbContext.EventQuestionnaires
            .AsNoTracking()
            .Include(q => q.Questions.OrderBy(x => x.Order))
            .FirstOrDefaultAsync(q => q.Id == payload.QuestionnaireId, cancellationToken);
    }

    public async Task<EventQuestionnaireResponse> SubmitEventQuestionnaireAsync(string qrToken, Guid userId, List<EventQuestionnaireAnswerInput> answers, CancellationToken cancellationToken = default)
    {
        var normalized = NormalizeQrInput(qrToken);
        var payload = ParseSignedToken<EventQuestionnaireQrPayload>(normalized);

        var expiresAt = DateTimeOffset.FromUnixTimeSeconds(payload.ExpiresAtUnix);
        if (expiresAt < DateTimeOffset.UtcNow)
            throw new InvalidOperationException("Kodi QR ka skaduar.");

        var questionnaire = await _dbContext.EventQuestionnaires
            .Include(q => q.Questions)
            .FirstOrDefaultAsync(q => q.Id == payload.QuestionnaireId, cancellationToken)
            ?? throw new InvalidOperationException("Pyetësori nuk u gjet.");

        var alreadySubmitted = await _dbContext.EventQuestionnaireResponses
            .AnyAsync(r => r.QuestionnaireId == payload.QuestionnaireId && r.UserId == userId, cancellationToken);
        if (alreadySubmitted)
            throw new InvalidOperationException("Pyetësori është plotësuar tashmë.");

        var response = new EventQuestionnaireResponse(payload.QuestionnaireId, userId);
        _dbContext.EventQuestionnaireResponses.Add(response);

        var questionIds = questionnaire.Questions.Select(q => q.Id).ToHashSet();
        foreach (var answer in answers)
        {
            if (!questionIds.Contains(answer.QuestionId)) continue;
            var answerEntity = new EventQuestionnaireAnswer(response.Id, answer.QuestionId, answer.AnswerText);
            _dbContext.EventQuestionnaireAnswers.Add(answerEntity);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return response;
    }

    public async Task<IReadOnlyList<EventQuestionnaireResponse>> GetEventQuestionnaireResponsesAsync(Guid questionnaireId, CancellationToken cancellationToken = default)
    {
        return await _dbContext.EventQuestionnaireResponses
            .AsNoTracking()
            .Where(r => r.QuestionnaireId == questionnaireId)
            .Include(r => r.Answers)
            .Include(r => r.User)
            .OrderByDescending(r => r.SubmittedAt)
            .ToListAsync(cancellationToken);
    }

    // ── Send Questionnaire Emails per Session ──────────────────────────────

    public async Task<int> SendSessionQuestionnaireEmailsAsync(Guid eventId, Guid dateId, CancellationToken cancellationToken = default)
    {
        var eventItem = await _eventRepository.Query()
            .Include(e => e.Dates)
            .FirstOrDefaultAsync(e => e.Id == eventId, cancellationToken)
            ?? throw new KeyNotFoundException("Moduli nuk u gjet.");

        var sessionDate = eventItem.Dates.FirstOrDefault(d => d.Id == dateId)
            ?? throw new KeyNotFoundException("Sesioni nuk u gjet.");

        // Find the "End module questionaire" evaluation questionnaire by title
        var evalQuestionnaire = await _dbContext.EvaluationQuestionnaires
            .FirstOrDefaultAsync(q => q.Title == "End module questionaire", cancellationToken)
            ?? throw new InvalidOperationException("Pyetësori 'End module questionaire' nuk ekziston. Krijoni atë në faqen e konfigurimeve.");

        // Get attended participants for this session
        var participants = await _dbContext.Participants
            .Include(p => p.User)
            .Where(p => p.EventItemId == eventId && p.DateId == dateId && p.Attendance == "attended")
            .ToListAsync(cancellationToken);

        if (participants.Count == 0) return 0;

        var actionLink = $"/evaluation/{evalQuestionnaire.Id}";
        var emailItem = new EvaluationEmailItem(
            evalQuestionnaire.Title,
            evalQuestionnaire.EmailSubject,
            evalQuestionnaire.EmailBody,
            actionLink);

        int sent = 0;
        foreach (var p in participants)
        {
            try
            {
                await _emailService.SendEvaluationQuestionnaireAsync(p.User, emailItem, cancellationToken);
                sent++;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to send questionnaire email to {Email}", p.User.Email);
            }
        }

        return sent;
    }

    // ── Send Session Documents Email ───────────────────────────────────────

    public async Task<int> SendSessionDocumentsEmailAsync(Guid eventId, Guid dateId, CancellationToken cancellationToken = default)
    {
        var eventItem = await _eventRepository.Query()
            .Include(e => e.Dates).ThenInclude(d => d.Documents)
            .Include(e => e.Documents)
            .FirstOrDefaultAsync(e => e.Id == eventId, cancellationToken)
            ?? throw new KeyNotFoundException("Moduli nuk u gjet.");

        var sessionDate = eventItem.Dates.FirstOrDefault(d => d.Id == dateId)
            ?? throw new KeyNotFoundException("Sesioni nuk u gjet.");

        // Gather documents: module-level + session-level for this date and earlier dates
        var allDocs = new List<(string Name, string Url)>();

        // Module-level docs
        foreach (var doc in eventItem.Documents)
            allDocs.Add((doc.FileName, doc.FileUrl));

        // Session-level docs for this date and past dates
        var sessionDates = eventItem.Dates
            .Where(d => d.Date.Date <= sessionDate.Date.Date)
            .ToList();

        foreach (var sd in sessionDates)
        {
            foreach (var doc in sd.Documents)
                allDocs.Add((doc.FileName, doc.FileUrl));
        }

        if (allDocs.Count == 0)
            throw new InvalidOperationException("Nuk ka dokumente për t'u dërguar.");

        // Get attended participants
        var participants = await _dbContext.Participants
            .Include(p => p.User)
            .Where(p => p.EventItemId == eventId && p.DateId == dateId && p.Attendance == "attended")
            .ToListAsync(cancellationToken);

        if (participants.Count == 0) return 0;

        // Build HTML list of document links
        var docLinksHtml = string.Join("",
            allDocs.Select(d => $"<p style=\"margin:4px 0;\">📄 <strong>{System.Net.WebUtility.HtmlEncode(d.Name)}</strong></p>"));

        var sessionDateLabel = sessionDate.Date.ToString("dd MMM yyyy");
        var emailItem = new SessionDocumentsEmailItem(eventItem.Name, sessionDateLabel, docLinksHtml);

        int sent = 0;
        foreach (var p in participants)
        {
            try
            {
                await _emailService.SendSessionDocumentsAsync(p.User, emailItem, cancellationToken);
                sent++;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to send documents email to {Email}", p.User.Email);
            }
        }

        return sent;
    }

    // ── QR Signing Helpers ─────────────────────────────────────────────────

    private string CreateSignedToken<T>(T payload)
    {
        var payloadJson = JsonSerializer.Serialize(payload);
        var payloadSegment = Base64UrlEncode(Encoding.UTF8.GetBytes(payloadJson));

        using var hmac = new HMACSHA256(_qrSigningKey);
        var signatureBytes = hmac.ComputeHash(Encoding.UTF8.GetBytes(payloadSegment));
        var signatureSegment = Base64UrlEncode(signatureBytes);

        return $"{payloadSegment}.{signatureSegment}";
    }

    private T ParseSignedToken<T>(string token)
    {
        if (string.IsNullOrWhiteSpace(token))
            throw new InvalidOperationException("Kodi QR është i pavlefshëm.");

        try
        {
            var parts = token.Trim().Split('.', StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length != 2)
                throw new InvalidOperationException("Kodi QR është i pavlefshëm.");

            var payloadSegment = parts[0];
            var signatureSegment = parts[1];

            var providedSignature = Base64UrlDecode(signatureSegment);

            using var hmac = new HMACSHA256(_qrSigningKey);
            var expectedSignature = hmac.ComputeHash(Encoding.UTF8.GetBytes(payloadSegment));

            if (providedSignature.Length != expectedSignature.Length ||
                !CryptographicOperations.FixedTimeEquals(providedSignature, expectedSignature))
                throw new InvalidOperationException("Kodi QR është i pavlefshëm.");

            var payloadJson = Encoding.UTF8.GetString(Base64UrlDecode(payloadSegment));
            return JsonSerializer.Deserialize<T>(payloadJson)
                ?? throw new InvalidOperationException("Kodi QR është i pavlefshëm.");
        }
        catch (InvalidOperationException) { throw; }
        catch { throw new InvalidOperationException("Kodi QR është i pavlefshëm."); }
    }

    private static string NormalizeQrInput(string rawInput)
    {
        var value = (rawInput ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(value))
            throw new InvalidOperationException("Kodi QR është i pavlefshëm.");

        foreach (var prefix in new[] { "IEKA-EV:", "IEKA-EQ:", "IEKA-SM:", "IEKA-ST:", "IEKA-MT:" })
        {
            if (value.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            {
                value = value[prefix.Length..].Trim();
                break;
            }
        }

        // Handle JSON payloads
        if (value.Length >= 2 && value[0] == '{' && value[^1] == '}')
        {
            try
            {
                using var document = JsonDocument.Parse(value);
                if (document.RootElement.ValueKind == JsonValueKind.Object)
                {
                    foreach (var propertyName in new[] { "qrToken", "token", "value", "data" })
                    {
                        if (document.RootElement.TryGetProperty(propertyName, out var property) && property.ValueKind == JsonValueKind.String)
                        {
                            var candidate = property.GetString()?.Trim();
                            if (!string.IsNullOrWhiteSpace(candidate))
                                return candidate;
                        }
                    }
                }
            }
            catch { /* not JSON */ }
        }

        // Handle URL payloads
        if (Uri.TryCreate(value, UriKind.Absolute, out var uri))
        {
            var queryString = uri.Query.StartsWith('?') ? uri.Query[1..] : uri.Query;
            var queryParts = queryString.Split('&', StringSplitOptions.RemoveEmptyEntries);
            foreach (var part in queryParts)
            {
                var kvp = part.Split('=', 2);
                if (kvp.Length == 0) continue;
                var name = Uri.UnescapeDataString(kvp[0]);
                if (string.Equals(name, "token", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(name, "qrToken", StringComparison.OrdinalIgnoreCase))
                {
                    return kvp.Length > 1 ? Uri.UnescapeDataString(kvp[1]).Trim() : string.Empty;
                }
            }

            var lastSegment = uri.Segments.LastOrDefault()?.Trim('/');
            if (!string.IsNullOrWhiteSpace(lastSegment) && lastSegment.Contains('.'))
                return lastSegment;
        }

        return value;
    }

    private static string Base64UrlEncode(byte[] bytes)
        => Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static byte[] Base64UrlDecode(string input)
    {
        var normalized = input.Replace('-', '+').Replace('_', '/');
        var padding = 4 - (normalized.Length % 4);
        if (padding is > 0 and < 4)
            normalized = normalized.PadRight(normalized.Length + padding, '=');
        return Convert.FromBase64String(normalized);
    }

    private static double HaversineDistanceMeters(double lat1, double lon1, double lat2, double lon2)
    {
        const double R = 6_371_000;
        var dLat = (lat2 - lat1) * (Math.PI / 180);
        var dLon = (lon2 - lon1) * (Math.PI / 180);
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(lat1 * (Math.PI / 180)) * Math.Cos(lat2 * (Math.PI / 180)) *
                Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        return R * 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
    }
}

public sealed record FeedbackAnswerPayload(string QuestionId, string Answer);
public sealed record QuestionnaireSubmissionPayload(string? QuestionnaireId, string? QuestionnaireTitle, IReadOnlyList<FeedbackAnswerPayload> Answers, string? Suggestions);
