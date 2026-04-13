using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using IekaSmartClass.Api.Data.Entities;
using IekaSmartClass.Api.Services.Interface;
using IekaSmartClass.Api.Utilities.Context;

namespace IekaSmartClass.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ModuleFeedbackController(IModuleFeedbackService feedbackService) : ControllerBase
{
    [HttpGet("template")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetTemplate(CancellationToken ct)
    {
        var template = await feedbackService.GetTemplateAsync(ct);
        if (template is null) return NotFound();
        return Ok(MapTemplate(template));
    }

    [HttpPut("template")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateTemplate([FromBody] UpdateTemplateRequest request, CancellationToken ct)
    {
        try
        {
            var input = new UpdateModuleFeedbackTemplateInput(
                request.Title,
                request.Sections.Select(s => new UpdateModuleFeedbackSectionInput(
                    s.Title, s.Order, s.RepeatsPerTopic, s.RatingLabelLow, s.RatingLabelHigh,
                    s.Questions.Select(q => new UpdateModuleFeedbackQuestionInput(q.Text, q.Type, q.Order)).ToList()
                )).ToList());

            await feedbackService.UpdateTemplateAsync(input, ct);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("fill/{moduleId:guid}")]
    [Authorize(Roles = "Admin,Student,Member")]
    public async Task<IActionResult> GetForFilling(Guid moduleId, [FromQuery] string? sections, [FromServices] IRequestContext context, CancellationToken ct)
    {
        if (context.UserId is null) return Unauthorized();

        List<Guid>? sectionIds = null;
        if (!string.IsNullOrWhiteSpace(sections))
        {
            sectionIds = sections.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(s => Guid.TryParse(s, out var id) ? id : (Guid?)null)
                .Where(id => id.HasValue)
                .Select(id => id!.Value)
                .ToList();
        }

        try
        {
            var result = await feedbackService.GetForFillingAsync(moduleId, context.UserId.Value, sectionIds, ct);
            return Ok(new
            {
                Template = MapTemplate(result.Template),
                Topics = result.Topics.Select(t => new { t.Id, t.Name, t.Lecturer }),
                result.AlreadyAnswered
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("fill/{moduleId:guid}")]
    [Authorize(Roles = "Admin,Student,Member")]
    public async Task<IActionResult> Submit(Guid moduleId, [FromBody] SubmitModuleFeedbackRequest request,
        [FromServices] IRequestContext context, CancellationToken ct)
    {
        if (context.UserId is null) return Unauthorized();

        // Role gate: if the link was sent for a specific role, only that role may submit
        if (!string.IsNullOrEmpty(request.RequiredRole))
        {
            var userRole = context.UserRole ?? string.Empty;
            if (!string.Equals(userRole, request.RequiredRole, StringComparison.OrdinalIgnoreCase)
                && !string.Equals(userRole, "Admin", StringComparison.OrdinalIgnoreCase))
            {
                return StatusCode(403, new { message = "Formulari nuk është i destinuar për rolin tuaj." });
            }
        }

        try
        {
            var answers = request.Answers
                .Select(a => new ModuleFeedbackAnswerInput(a.QuestionId, a.TopicId, a.Answer))
                .ToList();
            await feedbackService.SubmitAsync(moduleId, context.UserId.Value, answers, request.SectionScope ?? "all", request.IsAnonymous, ct);
            return Ok(new { message = "Vlerësimi u plotësua me sukses." });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{moduleId:guid}/send")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> SendEmails(Guid moduleId, CancellationToken ct)
    {
        try
        {
            var result = await feedbackService.SendFeedbackEmailsAsync(moduleId, ct);
            return Ok(new { result.RecipientCount, SentAt = result.SentAt.ToString("o") });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{moduleId:guid}/send-manual")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> SendManual(Guid moduleId, [FromBody] ManualFeedbackSendRequest request, CancellationToken ct)
    {
        try
        {
            var result = await feedbackService.SendManualFeedbackEmailsAsync(
                moduleId, request.SectionIds, request.TargetRole, request.YearGrades, ct);
            return Ok(new { result.RecipientCount, SentAt = result.SentAt.ToString("o") });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("sections")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetSections(CancellationToken ct)
    {
        var template = await feedbackService.GetTemplateAsync(ct);
        if (template is null) return Ok(Array.Empty<object>());
        var sections = template.Sections
            .Where(s => !s.RepeatsPerTopic)
            .OrderBy(s => s.Order)
            .Select(s => new { s.Id, s.Title })
            .ToList();
        return Ok(sections);
    }

    [HttpPatch("sections/{sectionId:guid}/auto-send")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> PatchSectionAutoSend(Guid sectionId, [FromBody] PatchSectionAutoSendRequest request, CancellationToken ct)
    {
        try
        {
            await feedbackService.PatchSectionAutoSendAsync(sectionId, request.RepeatsPerTopic, ct);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpPost("send-lecturer-manual")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> SendLecturerManual([FromBody] LecturerFeedbackManualSendRequest request, CancellationToken ct)
    {
        try
        {
            var result = await feedbackService.SendLecturerFeedbackManuallyAsync(
                request.TargetRole, request.YearGrades, request.AdditionalSectionIds, request.TargetModuleId, ct);
            return Ok(new { result.EmailsSent, result.RecipientsReached, SentAt = result.SentAt.ToString("o") });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("my-responses")]
    [Authorize(Roles = "Student")]
    public async Task<IActionResult> GetMyResponses([FromServices] IRequestContext context, CancellationToken ct)
    {
        if (context.UserId is null) return Unauthorized();
        var responses = await feedbackService.GetMyResponsesAsync(context.UserId.Value, ct);
        return Ok(responses.Select(r => new
        {
            r.Id,
            r.StudentModuleId,
            ModuleTitle = r.StudentModule?.Title,
            ModuleYearGrade = r.StudentModule?.YearGrade,
            r.SectionScope,
            SubmittedAt = r.SubmittedAt.ToString("o"),
            Answers = r.Answers.Select(a => new
            {
                a.QuestionId,
                QuestionText = a.Question?.Text,
                QuestionType = a.Question?.Type,
                SectionTitle = a.Question?.Section?.Title,
                a.TopicId,
                TopicName = a.Topic?.Name,
                TopicLecturer = a.Topic?.Lecturer,
                a.AnswerText
            })
        }));
    }

    [HttpGet("{moduleId:guid}/responses")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetResponses(Guid moduleId, CancellationToken ct)
    {
        var responses = await feedbackService.GetResponsesAsync(moduleId, ct);
        return Ok(responses.Select(r => new
        {
            r.Id,
            r.StudentModuleId,
            r.StudentId,
            r.IsAnonymous,
            StudentName = r.IsAnonymous ? null : (r.Student != null ? $"{r.Student.FirstName} {r.Student.LastName}" : null),
            StudentEmail = r.IsAnonymous ? null : r.Student?.Email,
            SubmittedAt = r.SubmittedAt.ToString("o"),
            Answers = r.Answers.Select(a => new
            {
                a.Id,
                a.QuestionId,
                QuestionText = a.Question?.Text,
                QuestionType = a.Question?.Type,
                a.TopicId,
                TopicName = a.Topic?.Name,
                a.AnswerText
            })
        }));
    }

    [HttpGet("responses/all")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetAllResponses(CancellationToken ct)
    {
        var responses = await feedbackService.GetAllResponsesAsync(ct);
        return Ok(responses.Select(r => new
        {
            r.Id,
            r.StudentModuleId,
            ModuleTitle = r.StudentModule?.Title,
            ModuleYearGrade = r.StudentModule?.YearGrade,
            r.StudentId,
            r.IsAnonymous,
            StudentName = r.IsAnonymous ? null : (r.Student != null ? $"{r.Student.FirstName} {r.Student.LastName}" : null),
            StudentEmail = r.IsAnonymous ? null : r.Student?.Email,
            r.SectionScope,
            SubmittedAt = r.SubmittedAt.ToString("o"),
            Answers = r.Answers.Select(a => new
            {
                a.Id,
                a.QuestionId,
                QuestionText = a.Question?.Text,
                QuestionType = a.Question?.Type,
                SectionTitle = a.Question?.Section?.Title,
                a.TopicId,
                TopicName = a.Topic?.Name,
                TopicLecturer = a.Topic?.Lecturer,
                a.AnswerText
            })
        }));
    }

    private static object MapTemplate(ModuleFeedbackTemplate t) => new
    {
        t.Id,
        t.Title,
        CreatedAt = t.CreatedAt.ToString("o"),
        UpdatedAt = t.UpdatedAt.ToString("o"),
        Sections = t.Sections.OrderBy(s => s.Order).Select(s => new
        {
            s.Id,
            s.Title,
            s.Order,
            s.RepeatsPerTopic,
            s.RatingLabelLow,
            s.RatingLabelHigh,
            Questions = s.Questions.OrderBy(q => q.Order).Select(q => new
            {
                q.Id,
                q.Text,
                q.Type,
                q.Order
            })
        })
    };
}

public record UpdateTemplateRequest(string Title, List<ModuleFeedbackSectionRequest> Sections);
public record ModuleFeedbackSectionRequest(string Title, int Order, bool RepeatsPerTopic, string? RatingLabelLow, string? RatingLabelHigh, List<ModuleFeedbackQuestionRequest> Questions);
public record ModuleFeedbackQuestionRequest(string Text, QuestionType Type, int Order);
public record SubmitModuleFeedbackRequest(List<SubmitModuleFeedbackAnswerRequest> Answers, string? SectionScope, bool IsAnonymous = false, string? RequiredRole = null);
public record SubmitModuleFeedbackAnswerRequest(Guid QuestionId, Guid? TopicId, string Answer);
public record ManualFeedbackSendRequest(List<Guid> SectionIds, string TargetRole, List<int>? YearGrades);
public record LecturerFeedbackManualSendRequest(string TargetRole, List<int>? YearGrades, List<Guid>? AdditionalSectionIds, Guid? TargetModuleId = null);
public record PatchSectionAutoSendRequest(bool RepeatsPerTopic);
