using IekaSmartClass.Api.Services.Interface;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;

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
        var dates = request.Dates?.Select(d => (d.Date, d.Time)).ToList();
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
        var dates = request.Dates?.Select(d => (d.Id, d.Date, d.Time, d.Location)).ToList();
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
public record CreateEventDateRequest(string Date, string Time);

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
public record UpdateEventDateRequest(Guid? Id, string Date, string Time, string? Location = null);
public record FeedbackQuestionRequest(string Id, string Question, string Type, List<string>? Options);
public record FeedbackQuestionnaireRequest(string Id, string Title, List<FeedbackQuestionRequest>? Questions);

public record MarkAttendanceRequest(string Status);

public record AddEventDocumentRequest(string FileName, string FileUrl);
public record UploadEventDocumentRequest(IFormFile File, string? FileName);
