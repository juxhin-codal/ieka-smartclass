using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using IekaSmartClass.Api.Services.Interface;
using IekaSmartClass.Api.Utilities.Context;

namespace IekaSmartClass.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class EvaluationController(IEvaluationService evaluationService) : ControllerBase
{
    private readonly IEvaluationService _evaluationService = evaluationService;

    [HttpGet]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var list = await _evaluationService.GetAllAsync(ct);
        return Ok(list.Select(q => MapListItem(q)));
    }

    [HttpGet("{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var q = await _evaluationService.GetByIdAsync(id, ct);
        if (q is null) return NotFound();
        return Ok(MapDetail(q));
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Create([FromBody] CreateEvaluationRequest request, CancellationToken ct)
    {
        var input = new CreateEvaluationInput(
            request.Title, request.Description, request.EmailSubject,
            request.EmailBody, request.TargetMembers, request.TargetStudents,
            request.Questions.Select(q => new EvaluationQuestionInput(q.Text, q.Type, q.Order, q.Options)).ToList());

        var questionnaire = await _evaluationService.CreateAsync(input, ct);
        return Ok(MapDetail(questionnaire));
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateEvaluationRequest request, CancellationToken ct)
    {
        try
        {
            var input = new UpdateEvaluationInput(
                request.Title, request.Description, request.EmailSubject,
                request.EmailBody, request.TargetMembers, request.TargetStudents,
                request.Questions.Select(q => new EvaluationQuestionInput(q.Text, q.Type, q.Order, q.Options)).ToList());

            await _evaluationService.UpdateAsync(id, input, ct);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        try
        {
            await _evaluationService.DeleteAsync(id, ct);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{id:guid}/send")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Send(Guid id, CancellationToken ct)
    {
        try
        {
            var result = await _evaluationService.SendAsync(id, ct);
            return Ok(new { result.RecipientCount, SentAt = result.SentAt.ToString("o") });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("{id:guid}/responses")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetResponses(Guid id, CancellationToken ct)
    {
        var responses = await _evaluationService.GetResponsesAsync(id, ct);
        return Ok(responses.Select(r => new
        {
            r.Id,
            r.QuestionnaireId,
            r.UserId,
            UserName = r.User != null ? $"{r.User.FirstName} {r.User.LastName}" : null,
            UserEmail = r.User?.Email,
            UserRole = r.User?.Role,
            SubmittedAt = r.SubmittedAt.ToString("o"),
            Answers = r.Answers.Select(a => new
            {
                a.Id,
                a.QuestionId,
                QuestionText = a.Question?.Text,
                QuestionType = a.Question?.Type,
                a.AnswerText
            })
        }));
    }

    [HttpGet("fill/{id:guid}")]
    [Authorize(Roles = "Admin,Mentor,Lecturer,Member,Student")]
    public async Task<IActionResult> GetForFilling(Guid id, [FromServices] IRequestContext context, CancellationToken ct)
    {
        if (context.UserId is null) return Unauthorized();

        try
        {
            var (questionnaire, alreadyAnswered) = await _evaluationService.GetForFillingAsync(id, context.UserId.Value, ct);
            return Ok(new
            {
                questionnaire.Id,
                questionnaire.Title,
                questionnaire.Description,
                AlreadyAnswered = alreadyAnswered,
                Questions = questionnaire.Questions.Select(q => new
                {
                    q.Id,
                    q.Text,
                    q.Type,
                    q.Order,
                    Options = q.OptionsJson != null
                        ? System.Text.Json.JsonSerializer.Deserialize<List<string>>(q.OptionsJson)
                        : null
                })
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("fill/{id:guid}")]
    [Authorize(Roles = "Admin,Mentor,Lecturer,Member,Student")]
    public async Task<IActionResult> Submit(Guid id, [FromBody] SubmitEvaluationRequest request,
        [FromServices] IRequestContext context, CancellationToken ct)
    {
        if (context.UserId is null) return Unauthorized();

        try
        {
            var answers = request.Answers
                .Select(a => new EvaluationAnswerInput(a.QuestionId, a.Answer))
                .ToList();
            await _evaluationService.SubmitAsync(id, context.UserId.Value, answers, ct);
            return Ok(new { message = "Pyetësori u plotësua me sukses." });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    private static object MapListItem(Data.Entities.EvaluationQuestionnaire q) => new
    {
        q.Id,
        q.Title,
        q.Description,
        q.TargetMembers,
        q.TargetStudents,
        CreatedAt = q.CreatedAt.ToString("o"),
        UpdatedAt = q.UpdatedAt.ToString("o"),
        QuestionCount = q.Questions.Count,
        ResponseCount = q.Responses.Count,
        SendLogs = q.SendLogs.Select(s => new
        {
            s.Id,
            s.SentToMembers,
            s.SentToStudents,
            s.RecipientCount,
            SentAt = s.SentAt.ToString("o")
        })
    };

    private static object MapDetail(Data.Entities.EvaluationQuestionnaire q) => new
    {
        q.Id,
        q.Title,
        q.Description,
        q.EmailSubject,
        q.EmailBody,
        q.TargetMembers,
        q.TargetStudents,
        CreatedAt = q.CreatedAt.ToString("o"),
        UpdatedAt = q.UpdatedAt.ToString("o"),
        Questions = q.Questions.Select(x => new
        {
            x.Id,
            x.Text,
            x.Type,
            x.Order,
            Options = x.OptionsJson != null
                ? System.Text.Json.JsonSerializer.Deserialize<List<string>>(x.OptionsJson)
                : null
        }),
        Responses = q.Responses?.Select(r => new
        {
            r.Id,
            r.UserId,
            SubmittedAt = r.SubmittedAt.ToString("o")
        }),
        SendLogs = q.SendLogs?.Select(s => new
        {
            s.Id,
            s.SentToMembers,
            s.SentToStudents,
            s.RecipientCount,
            SentAt = s.SentAt.ToString("o")
        })
    };
}

public record CreateEvaluationRequest(
    string Title, string? Description, string EmailSubject, string EmailBody,
    bool TargetMembers, bool TargetStudents, List<QuestionRequest> Questions);

public record UpdateEvaluationRequest(
    string Title, string? Description, string EmailSubject, string EmailBody,
    bool TargetMembers, bool TargetStudents, List<QuestionRequest> Questions);

public record QuestionRequest(string Text, Data.Entities.QuestionType Type, int Order, List<string>? Options);

public record SubmitEvaluationRequest(List<SubmitAnswerRequest> Answers);

public record SubmitAnswerRequest(Guid QuestionId, string Answer);
