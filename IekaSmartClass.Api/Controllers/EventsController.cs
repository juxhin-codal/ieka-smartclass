using IekaSmartClass.Api.Services.Interface;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using IekaSmartClass.Api.Data;
using IekaSmartClass.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace IekaSmartClass.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class EventsController(IEventsService eventsService) : ControllerBase
{
    private readonly IEventsService _eventsService = eventsService;

    [HttpGet]
    [Authorize]
    public async Task<IActionResult> GetEvents([FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 100)
    {
        var events = await _eventsService.GetEventsAsync(pageNumber, pageSize);
        return Ok(events);
    }

    [HttpGet("{id:guid}")]
    [Authorize]
    public async Task<IActionResult> GetEvent(Guid id)
    {
        var result = await _eventsService.GetEventByIdAsync(id);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> CreateEvent([FromBody] CreateEventRequest request)
    {
        var dates = request.Dates?.Select(d => (d.Date, d.Time, d.Location, d.RequireLocation, d.Latitude, d.Longitude)).ToList();
        var feedbackJson = BuildFeedbackQuestionsJson(request.FeedbackQuestions, request.FeedbackQuestionnaires);
        var id = await _eventsService.CreateEventAsync(
            request.Name, request.Place, request.SessionCapacity, request.TotalSessions, request.CpdHours,
            request.Price, request.LecturerName, request.WebinarLink,
            request.Topics ?? [],
            dates ?? [],
            request.LecturerIds,
            feedbackJson);

        return CreatedAtAction(nameof(GetEvent), new { id }, id);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateEvent(Guid id, [FromBody] UpdateEventRequest request)
    {
        var dates = request.Dates?.Select(d => (d.Id, d.Date, d.Time, d.Location, d.RequireLocation, d.Latitude, d.Longitude)).ToList();
        var feedbackJson = BuildFeedbackQuestionsJson(request.FeedbackQuestions, request.FeedbackQuestionnaires);
        await _eventsService.UpdateEventAsync(
            id, request.Name, request.Place, request.SessionCapacity, request.TotalSessions, request.CpdHours,
            request.Price, request.LecturerName, request.WebinarLink,
            request.Topics ?? [],
            dates,
            request.LecturerIds,
            feedbackJson);

        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteEvent(Guid id)
    {
        await _eventsService.DeleteEventAsync(id);
        return NoContent();
    }

    [HttpPost("{id:guid}/notify")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> MarkAsNotified(Guid id)
    {
        await _eventsService.MarkAsNotifiedAsync(id);
        return NoContent();
    }

    [HttpPost("{id:guid}/reserve/{dateId:guid}")]
    [Authorize]
    public async Task<IActionResult> ReserveSeat(Guid id, Guid dateId,
        [FromServices] IekaSmartClass.Api.Utilities.Context.IRequestContext context)
    {
        if (context.UserId == null) return Unauthorized();
        var status = await _eventsService.ReserveSeatAsync(id, context.UserId.Value, dateId);
        // Return the booking status so the frontend can show the correct confirmation
        return Ok(new { status });
    }

    [HttpGet("my-modules")]
    [Authorize]
    public async Task<IActionResult> GetMyModules(
        [FromServices] IekaSmartClass.Api.Utilities.Context.IRequestContext context)
    {
        if (context.UserId == null) return Unauthorized();
        var result = await _eventsService.GetMyModulesAsync(context.UserId.Value);
        return Ok(result);
    }

    [HttpPut("{id:guid}/participants/{participantId:guid}/attendance")]
    [Authorize(Roles = "Admin,Lecturer")]
    public async Task<IActionResult> MarkAttendance(Guid id, Guid participantId,
        [FromBody] MarkAttendanceRequest request)
    {
        await _eventsService.MarkAttendanceAsync(id, participantId, request.Status);
        return NoContent();
    }

    [HttpDelete("{id:guid}/participants/{participantId:guid}")]
    [Authorize]
    public async Task<IActionResult> CancelReservation(Guid id, Guid participantId)
    {
        await _eventsService.CancelReservationAsync(id, participantId);
        return NoContent();
    }

    [HttpDelete("{id:guid}/sessions/{dateId:guid}/participants/{participantId:guid}")]
    [Authorize(Roles = "Admin,Lecturer")]
    public async Task<IActionResult> RemoveParticipantFromSession(Guid id, Guid dateId, Guid participantId)
    {
        await _eventsService.RemoveParticipantFromSessionAsync(id, dateId, participantId);
        return NoContent();
    }

    [HttpPost("{id:guid}/sessions/{dateId:guid}/participants")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> AddMemberToSession(Guid id, Guid dateId, [FromBody] AddEventParticipantRequest request)
    {
        try
        {
            var status = await _eventsService.AssignMemberToSessionAsync(id, dateId, request.UserId);
            return Ok(new { status });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{id:guid}/sessions/{dateId:guid}/end")]
    [Authorize(Roles = "Admin,Lecturer")]
    public async Task<IActionResult> EndSession(Guid id, Guid dateId)
    {
        await _eventsService.EndSessionAsync(id, dateId);
        return NoContent();
    }

    [HttpGet("{id:guid}/sessions/{dateId:guid}/participants/export")]
    [Authorize(Roles = "Admin,Lecturer")]
    public async Task<IActionResult> ExportSessionParticipants(Guid id, Guid dateId)
    {
        var export = await _eventsService.ExportSessionParticipantsExcelAsync(id, dateId);
        return File(export.Content, export.ContentType, export.FileName);
    }

    [HttpPost("{id:guid}/documents")]
    [Authorize(Roles = "Admin,Lecturer")]
    public async Task<IActionResult> AddDocument(Guid id, [FromBody] AddEventDocumentRequest request)
    {
        var userIdString = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(userIdString, out var userId)) return Unauthorized();

        var doc = await _eventsService.AddDocumentAsync(id, request.FileName, request.FileUrl, userId);
        return Ok(doc);
    }

    [HttpPost("{id:guid}/documents/upload")]
    [Authorize(Roles = "Admin,Lecturer")]
    public async Task<IActionResult> UploadDocument(
        Guid id,
        [FromForm] UploadEventDocumentRequest request,
        [FromServices] IekaSmartClass.Api.Utilities.Context.IRequestContext context,
        CancellationToken cancellationToken)
    {
        if (context.UserId is null)
            return Unauthorized();

        if (request.File is null || request.File.Length == 0)
            return BadRequest(new { message = "File is required." });

        var document = await _eventsService.UploadDocumentAsync(
            id,
            request.File,
            context.UserId.Value,
            request.FileName,
            cancellationToken);

        return Ok(document);
    }

    [HttpDelete("{id:guid}/documents/{documentId:guid}")]
    [Authorize(Roles = "Admin,Lecturer")]
    public async Task<IActionResult> DeleteDocument(Guid id, Guid documentId)
    {
        await _eventsService.DeleteDocumentAsync(id, documentId);
        return NoContent();
    }

    [HttpPost("{id:guid}/feedback")]
    [Authorize]
    public async Task<IActionResult> SubmitFeedback(Guid id, [FromBody] SubmitFeedbackRequest request)
    {
        var userIdString = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(userIdString, out var userId)) return Unauthorized();

        try
        {
            await _eventsService.SubmitFeedbackAsync(
                id,
                request.DateId,
                userId,
                request.SessionRating,
                request.SessionComments,
                request.LecturerRating,
                request.LecturerComments,
                request.Suggestions,
                request.QuestionnaireId,
                request.QuestionnaireTitle,
                request.Answers?.Select(answer => new FeedbackAnswerInput(answer.QuestionId, answer.Answer)).ToList());
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // ── Lecturer Feedback via Email Token ──────────────────────────────────────

    [HttpPost("{eventId:guid}/dates/{dateId:guid}/send-lecturer-feedback-emails")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> SendLecturerFeedbackEmails(
        Guid eventId, Guid dateId,
        [FromServices] IApplicationDbContext db,
        [FromServices] IEmailService emailService,
        CancellationToken cancellationToken)
    {
        var eventItem = await db.Events
            .Include(e => e.Dates)
            .FirstOrDefaultAsync(e => e.Id == eventId, cancellationToken);
        if (eventItem is null) return NotFound();

        var sessionDate = eventItem.Dates.FirstOrDefault(d => d.Id == dateId);
        if (sessionDate is null) return NotFound();

        var participants = await db.Participants
            .Include(p => p.User)
            .Where(p => p.EventItemId == eventId && p.DateId == dateId && p.Attendance == "attended")
            .ToListAsync(cancellationToken);

        if (participants.Count == 0) return Ok(new { sent = 0 });

        foreach (var p in participants)
            p.SetFeedbackToken(Guid.NewGuid().ToString("N"));

        await db.SaveChangesAsync(cancellationToken);

        var sessionDateLabel = sessionDate.Date.ToString("dd MMM yyyy");
        var sessionTimeLabel = sessionDate.Date.ToString("HH:mm");
        var lecturerName = string.IsNullOrWhiteSpace(eventItem.LecturerName) ? "—" : eventItem.LecturerName;
        var locationLabel = string.IsNullOrWhiteSpace(sessionDate.Location) ? "IEKA" : sessionDate.Location;
        int sent = 0;
        foreach (var p in participants)
        {
            try
            {
                await emailService.SendModuleFeedbackRequestAsync(
                    p.User,
                    new ModuleFeedbackEmailItem(
                        eventItem.Name,
                        sessionDateLabel,
                        lecturerName,
                        sessionDateLabel,
                        sessionTimeLabel,
                        locationLabel,
                        $"/module-feedback/{eventItem.Id}"),
                    cancellationToken);
                sent++;
            }
            catch { /* continue sending other emails */ }
        }

        return Ok(new { sent });
    }

    [HttpGet("lecturer-feedback/info")]
    [AllowAnonymous]
    public async Task<IActionResult> GetLecturerFeedbackInfo(
        [FromQuery] string token,
        [FromServices] IApplicationDbContext db,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(token)) return BadRequest();

        var participant = await db.Participants
            .Include(p => p.EventItem).ThenInclude(e => e.Dates)
            .FirstOrDefaultAsync(p => p.FeedbackToken == token, cancellationToken);

        if (participant is null) return NotFound();

        var sessionDate = participant.EventItem.Dates.FirstOrDefault(d => d.Id == participant.DateId);
        var alreadySubmitted = await db.EventFeedbacks.AnyAsync(
            f => f.EventItemId == participant.EventItemId && f.DateId == participant.DateId && f.UserId == participant.UserId,
            cancellationToken);

        return Ok(new
        {
            eventName = participant.EventItem.Name,
            sessionDate = sessionDate?.Date.ToString("dd MMM yyyy") ?? "—",
            lecturerName = participant.EventItem.LecturerName ?? "—",
            alreadySubmitted
        });
    }

    [HttpPost("lecturer-feedback/submit")]
    [AllowAnonymous]
    public async Task<IActionResult> SubmitLecturerFeedback(
        [FromQuery] string token,
        [FromBody] SubmitLecturerFeedbackRequest request,
        [FromServices] IApplicationDbContext db,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(token)) return BadRequest();

        var participant = await db.Participants
            .Include(p => p.EventItem)
            .FirstOrDefaultAsync(p => p.FeedbackToken == token, cancellationToken);

        if (participant is null) return NotFound();

        var alreadySubmitted = await db.EventFeedbacks.AnyAsync(
            f => f.EventItemId == participant.EventItemId && f.DateId == participant.DateId && f.UserId == participant.UserId,
            cancellationToken);

        if (alreadySubmitted) return Conflict(new { message = "Feedback është dërguar tashmë." });

        var rating = Math.Clamp(request.Rating, 1, 5);
        var feedback = new EventFeedback(participant.EventItemId, participant.DateId, participant.UserId, rating, request.Comment?.Trim(), request.IsAnonymous);
        db.EventFeedbacks.Add(feedback);
        await db.SaveChangesAsync(cancellationToken);

        return NoContent();
    }

    [HttpGet("feedback/all")]
    [Authorize(Roles = "Admin,Lecturer")]
    public async Task<IActionResult> GetAllLecturerFeedback(
        [FromServices] IApplicationDbContext db,
        CancellationToken cancellationToken)
    {
        var feedbacks = await db.EventFeedbacks
            .Include(f => f.EventItem).ThenInclude(e => e.Dates)
            .Where(f => f.LecturerRating > 0)
            .OrderByDescending(f => f.SubmittedAt)
            .ToListAsync(cancellationToken);

        var userIds = feedbacks.Where(f => !f.IsAnonymous).Select(f => f.UserId).Distinct().ToList();
        var users = await db.Users
            .Where(u => userIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, cancellationToken);

        var result = feedbacks.Select(f =>
        {
            var sessionDate = f.EventItem.Dates.FirstOrDefault(d => d.Id == f.DateId);
            users.TryGetValue(f.UserId, out var user);
            return new
            {
                eventId = f.EventItemId.ToString(),
                eventName = f.EventItem.Name,
                dateId = f.DateId?.ToString(),
                sessionDate = sessionDate?.Date.ToString("dd MMM yyyy"),
                lecturerName = f.EventItem.LecturerName,
                rating = f.LecturerRating,
                comment = f.LecturerComments,
                isAnonymous = f.IsAnonymous,
                firstName = f.IsAnonymous ? null : user?.FirstName,
                lastName = f.IsAnonymous ? null : user?.LastName,
                submittedAt = f.SubmittedAt
            };
        });

        return Ok(result);
    }

    private static string? BuildFeedbackQuestionsJson(
        List<FeedbackQuestionRequest>? feedbackQuestions,
        List<FeedbackQuestionnaireRequest>? feedbackQuestionnaires)
    {
        if (feedbackQuestionnaires is not null)
        {
            return System.Text.Json.JsonSerializer.Serialize(new
            {
                questionnaires = feedbackQuestionnaires.Select(questionnaire => new
                {
                    id = questionnaire.Id,
                    title = questionnaire.Title,
                    questions = questionnaire.Questions ?? []
                })
            });
        }

        if (feedbackQuestions is not null)
        {
            return System.Text.Json.JsonSerializer.Serialize(feedbackQuestions);
        }

        return null;
    }

    // ── Session QR Attendance ────────────────────────────────────────────

    [HttpGet("{eventId:guid}/dates/{dateId:guid}/qr")]
    [Authorize(Roles = "Admin,Lecturer")]
    public async Task<IActionResult> GenerateSessionQr(Guid eventId, Guid dateId, CancellationToken cancellationToken)
    {
        try
        {
            var token = await _eventsService.GenerateSessionQrTokenAsync(eventId, dateId, cancellationToken);
            return Ok(new { token });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpPost("attendance/scan")]
    [Authorize]
    public async Task<IActionResult> ScanSessionAttendance(
        [FromBody] ScanEventAttendanceRequest request,
        [FromServices] IekaSmartClass.Api.Utilities.Context.IRequestContext context,
        CancellationToken cancellationToken)
    {
        if (context.UserId == null) return Unauthorized();

        try
        {
            var participant = await _eventsService.ScanSessionAttendanceAsync(
                request.QrToken, context.UserId.Value, request.Latitude, request.Longitude, cancellationToken);
            return Ok(new { participantId = participant.Id, attendance = participant.Attendance });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // ── Session Documents ──────────────────────────────────────────────

    [HttpPost("{eventId:guid}/dates/{dateId:guid}/documents/upload")]
    [Authorize(Roles = "Admin,Lecturer")]
    public async Task<IActionResult> UploadSessionDocument(
        Guid eventId, Guid dateId,
        [FromForm] UploadEventDocumentRequest request,
        [FromServices] IekaSmartClass.Api.Utilities.Context.IRequestContext context,
        CancellationToken cancellationToken)
    {
        if (context.UserId is null) return Unauthorized();
        if (request.File is null || request.File.Length == 0)
            return BadRequest(new { message = "File is required." });

        try
        {
            var document = await _eventsService.UploadSessionDocumentAsync(
                eventId, dateId, request.File, context.UserId.Value, request.FileName, cancellationToken);
            return Ok(document);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpDelete("{eventId:guid}/dates/{dateId:guid}/documents/{documentId:guid}")]
    [Authorize(Roles = "Admin,Lecturer")]
    public async Task<IActionResult> DeleteSessionDocument(Guid eventId, Guid dateId, Guid documentId, CancellationToken cancellationToken)
    {
        try
        {
            await _eventsService.DeleteSessionDocumentAsync(eventId, dateId, documentId, cancellationToken);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    // ── Event Questionnaires (module-level) ─────────────────────────────

    [HttpPost("{eventId:guid}/questionnaires")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> CreateEventQuestionnaire(
        Guid eventId, [FromBody] CreateEventQuestionnaireRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var questionnaire = await _eventsService.CreateEventQuestionnaireAsync(
                eventId, request.Title, request.Questions, cancellationToken);
            return Ok(questionnaire);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpGet("questionnaires/{questionnaireId:guid}")]
    [Authorize(Roles = "Admin,Lecturer")]
    public async Task<IActionResult> GetEventQuestionnaire(Guid questionnaireId, CancellationToken cancellationToken)
    {
        var questionnaire = await _eventsService.GetEventQuestionnaireDetailAsync(questionnaireId, cancellationToken);
        return questionnaire is null ? NotFound() : Ok(questionnaire);
    }

    [HttpPut("questionnaires/{questionnaireId:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateEventQuestionnaire(
        Guid questionnaireId, [FromBody] UpdateEventQuestionnaireRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var questionnaire = await _eventsService.UpdateEventQuestionnaireAsync(
                questionnaireId, request.Title, request.Questions, cancellationToken);
            return Ok(questionnaire);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpDelete("questionnaires/{questionnaireId:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteEventQuestionnaire(Guid questionnaireId, CancellationToken cancellationToken)
    {
        try
        {
            await _eventsService.DeleteEventQuestionnaireAsync(questionnaireId, cancellationToken);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpGet("questionnaires/{questionnaireId:guid}/qr")]
    [Authorize(Roles = "Admin,Lecturer")]
    public async Task<IActionResult> GenerateEventQuestionnaireQr(Guid questionnaireId, CancellationToken cancellationToken)
    {
        try
        {
            var token = await _eventsService.GenerateEventQuestionnaireQrTokenAsync(questionnaireId, cancellationToken);
            return Ok(new { token });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpGet("questionnaires/by-token")]
    [Authorize]
    public async Task<IActionResult> GetEventQuestionnaireByToken([FromQuery] string token, CancellationToken cancellationToken)
    {
        try
        {
            var questionnaire = await _eventsService.GetEventQuestionnaireByTokenAsync(token, cancellationToken);
            return questionnaire is null ? NotFound() : Ok(questionnaire);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("questionnaires/submit")]
    [Authorize]
    public async Task<IActionResult> SubmitEventQuestionnaire(
        [FromBody] SubmitEventQuestionnaireRequest request,
        [FromServices] IekaSmartClass.Api.Utilities.Context.IRequestContext context,
        CancellationToken cancellationToken)
    {
        if (context.UserId == null) return Unauthorized();

        try
        {
            var response = await _eventsService.SubmitEventQuestionnaireAsync(
                request.QrToken, context.UserId.Value, request.Answers, cancellationToken);
            return Ok(new { responseId = response.Id });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("questionnaires/{questionnaireId:guid}/responses")]
    [Authorize(Roles = "Admin,Lecturer")]
    public async Task<IActionResult> GetEventQuestionnaireResponses(Guid questionnaireId, CancellationToken cancellationToken)
    {
        var responses = await _eventsService.GetEventQuestionnaireResponsesAsync(questionnaireId, cancellationToken);
        return Ok(responses);
    }

    // ── Send Emails per Session ─────────────────────────────────────────

    [HttpPost("{eventId:guid}/dates/{dateId:guid}/send-questionnaire-emails")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> SendSessionQuestionnaireEmails(Guid eventId, Guid dateId, CancellationToken cancellationToken)
    {
        try
        {
            var sent = await _eventsService.SendSessionQuestionnaireEmailsAsync(eventId, dateId, cancellationToken);
            return Ok(new { sent });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{eventId:guid}/dates/{dateId:guid}/send-documents-email")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> SendSessionDocumentsEmail(Guid eventId, Guid dateId, CancellationToken cancellationToken)
    {
        try
        {
            var sent = await _eventsService.SendSessionDocumentsEmailAsync(eventId, dateId, cancellationToken);
            return Ok(new { sent });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}

public record SubmitFeedbackRequest(
    Guid? DateId,
    int? SessionRating,
    string? SessionComments,
    int? LecturerRating,
    string? LecturerComments,
    string? Suggestions,
    string? QuestionnaireId,
    string? QuestionnaireTitle,
    List<SubmitFeedbackAnswerRequest>? Answers);

public record SubmitFeedbackAnswerRequest(string QuestionId, string Answer);

public record CreateEventRequest(
    string Name,
    string Place,
    int SessionCapacity,
    int TotalSessions,
    int CpdHours,
    decimal Price,
    string? LecturerName,
    string? WebinarLink,
    List<string>? Topics,
    List<CreateEventDateRequest>? Dates,
    List<string>? LecturerIds,
    List<FeedbackQuestionRequest>? FeedbackQuestions,
    List<FeedbackQuestionnaireRequest>? FeedbackQuestionnaires
);
public record CreateEventDateRequest(string Date, string Time, string? Location = null, bool RequireLocation = false, double? Latitude = null, double? Longitude = null);

public record UpdateEventRequest(
    string Name,
    string Place,
    int SessionCapacity,
    int TotalSessions,
    int CpdHours,
    decimal Price,
    string? LecturerName,
    string? WebinarLink,
    List<string>? Topics,
    List<UpdateEventDateRequest>? Dates,
    List<string>? LecturerIds,
    List<FeedbackQuestionRequest>? FeedbackQuestions,
    List<FeedbackQuestionnaireRequest>? FeedbackQuestionnaires
);
public record UpdateEventDateRequest(Guid? Id, string Date, string Time, string? Location = null, bool RequireLocation = false, double? Latitude = null, double? Longitude = null);
public record FeedbackQuestionRequest(string Id, string Question, string Type, List<string>? Options);
public record FeedbackQuestionnaireRequest(string Id, string Title, List<FeedbackQuestionRequest>? Questions);

public record MarkAttendanceRequest(string Status);

public record AddEventDocumentRequest(string FileName, string FileUrl);
public record UploadEventDocumentRequest(IFormFile File, string? FileName);
public record AddEventParticipantRequest(Guid UserId);
public record SubmitLecturerFeedbackRequest(int Rating, string? Comment, bool IsAnonymous);
public record ScanEventAttendanceRequest(string QrToken, double? Latitude, double? Longitude);
public record CreateEventQuestionnaireRequest(string Title, List<EventQuestionnaireQuestionInput> Questions);
public record UpdateEventQuestionnaireRequest(string Title, List<EventQuestionnaireQuestionInput> Questions);
public record SubmitEventQuestionnaireRequest(string QrToken, List<EventQuestionnaireAnswerInput> Answers);
