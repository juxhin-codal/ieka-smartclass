using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using IekaSmartClass.Api.Data;
using IekaSmartClass.Api.Data.Entities;
using IekaSmartClass.Api.Services.Interface;
using IekaSmartClass.Api.Utilities.Settings;

namespace IekaSmartClass.Api.Services;

public class EvaluationService(
    IApplicationDbContext db,
    IEmailService emailService,
    IOptions<EmailSettings> emailOptions,
    ILogger<EvaluationService> logger) : IEvaluationService
{
    private readonly string _frontendBaseUrl = (emailOptions.Value.FrontendBaseUrl ?? "http://localhost:3000").TrimEnd('/');

    public async Task<IReadOnlyList<EvaluationQuestionnaire>> GetAllAsync(CancellationToken ct = default)
    {
        return await db.EvaluationQuestionnaires
            .Include(q => q.Questions.OrderBy(x => x.Order))
            .Include(q => q.Responses)
            .Include(q => q.SendLogs)
            .OrderByDescending(q => q.CreatedAt)
            .ToListAsync(ct);
    }

    public async Task<EvaluationQuestionnaire?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await db.EvaluationQuestionnaires
            .Include(q => q.Questions.OrderBy(x => x.Order))
            .Include(q => q.Responses)
            .Include(q => q.SendLogs.OrderByDescending(s => s.SentAt))
            .FirstOrDefaultAsync(q => q.Id == id, ct);
    }

    public async Task<EvaluationQuestionnaire> CreateAsync(CreateEvaluationInput input, CancellationToken ct = default)
    {
        var questionnaire = new EvaluationQuestionnaire(
            input.Title, input.Description, input.EmailSubject,
            input.EmailBody, input.TargetMembers, input.TargetStudents);

        foreach (var q in input.Questions)
        {
            var optionsJson = q.Type == QuestionType.Options && q.Options?.Count > 0
                ? JsonSerializer.Serialize(q.Options)
                : null;
            questionnaire.Questions.Add(new EvaluationQuestion(
                questionnaire.Id, q.Text, q.Type, q.Order, optionsJson));
        }

        db.EvaluationQuestionnaires.Add(questionnaire);
        await db.SaveChangesAsync(ct);
        return questionnaire;
    }

    public async Task UpdateAsync(Guid id, UpdateEvaluationInput input, CancellationToken ct = default)
    {
        var questionnaire = await db.EvaluationQuestionnaires
            .Include(q => q.Questions)
            .FirstOrDefaultAsync(q => q.Id == id, ct)
            ?? throw new InvalidOperationException("Questionnaire not found.");

        questionnaire.Update(input.Title, input.Description, input.EmailSubject,
            input.EmailBody, input.TargetMembers, input.TargetStudents);

        db.EvaluationQuestions.RemoveRange(questionnaire.Questions);

        foreach (var q in input.Questions)
        {
            var optionsJson = q.Type == QuestionType.Options && q.Options?.Count > 0
                ? JsonSerializer.Serialize(q.Options)
                : null;
            questionnaire.Questions.Add(new EvaluationQuestion(
                questionnaire.Id, q.Text, q.Type, q.Order, optionsJson));
        }

        await db.SaveChangesAsync(ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var questionnaire = await db.EvaluationQuestionnaires
            .FirstOrDefaultAsync(q => q.Id == id, ct)
            ?? throw new InvalidOperationException("Questionnaire not found.");

        db.EvaluationQuestionnaires.Remove(questionnaire);
        await db.SaveChangesAsync(ct);
    }

    public async Task<EvaluationSendResult> SendAsync(Guid id, CancellationToken ct = default)
    {
        var questionnaire = await db.EvaluationQuestionnaires
            .FirstOrDefaultAsync(q => q.Id == id, ct)
            ?? throw new InvalidOperationException("Questionnaire not found.");

        var query = db.Users.Where(u => u.IsActive && u.Email != null);

        if (questionnaire.TargetMembers && questionnaire.TargetStudents)
            query = query.Where(u => u.Role == "Member" || u.Role == "Student");
        else if (questionnaire.TargetMembers)
            query = query.Where(u => u.Role == "Member");
        else if (questionnaire.TargetStudents)
            query = query.Where(u => u.Role == "Student");
        else
            return new EvaluationSendResult(0, DateTime.UtcNow);

        var users = await query.ToListAsync(ct);
        var actionLink = $"{_frontendBaseUrl}/evaluation/{questionnaire.Id}";
        var emailItem = new EvaluationEmailItem(
            questionnaire.Title, questionnaire.EmailSubject,
            questionnaire.EmailBody, actionLink);

        var sentCount = 0;
        foreach (var user in users)
        {
            try
            {
                await emailService.SendEvaluationQuestionnaireAsync(user, emailItem, ct);
                sentCount++;
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Failed to send evaluation email to user {UserId}", user.Id);
            }
        }

        var sendLog = new EvaluationSendLog(questionnaire.Id,
            questionnaire.TargetMembers, questionnaire.TargetStudents, sentCount);
        db.EvaluationSendLogs.Add(sendLog);
        await db.SaveChangesAsync(ct);

        return new EvaluationSendResult(sentCount, sendLog.SentAt);
    }

    public async Task<(EvaluationQuestionnaire Questionnaire, bool AlreadyAnswered)> GetForFillingAsync(
        Guid id, Guid userId, CancellationToken ct = default)
    {
        var questionnaire = await db.EvaluationQuestionnaires
            .Include(q => q.Questions.OrderBy(x => x.Order))
            .FirstOrDefaultAsync(q => q.Id == id, ct)
            ?? throw new InvalidOperationException("Questionnaire not found.");

        var alreadyAnswered = await db.EvaluationResponses
            .AnyAsync(r => r.QuestionnaireId == id && r.UserId == userId, ct);

        return (questionnaire, alreadyAnswered);
    }

    public async Task<EvaluationResponse> SubmitAsync(
        Guid id, Guid userId, List<EvaluationAnswerInput> answers, CancellationToken ct = default)
    {
        var exists = await db.EvaluationResponses
            .AnyAsync(r => r.QuestionnaireId == id && r.UserId == userId, ct);
        if (exists)
            throw new InvalidOperationException("Ju keni plotësuar tashmë këtë pyetësor.");

        var response = new EvaluationResponse(id, userId);
        foreach (var a in answers)
            response.Answers.Add(new EvaluationAnswer(response.Id, a.QuestionId, a.Answer));

        db.EvaluationResponses.Add(response);
        await db.SaveChangesAsync(ct);
        return response;
    }

    public async Task<IReadOnlyList<EvaluationResponse>> GetResponsesAsync(Guid id, CancellationToken ct = default)
    {
        return await db.EvaluationResponses
            .Include(r => r.User)
            .Include(r => r.Answers).ThenInclude(a => a.Question)
            .Where(r => r.QuestionnaireId == id)
            .OrderByDescending(r => r.SubmittedAt)
            .ToListAsync(ct);
    }
}
