using IekaSmartClass.Api.Data.Entities;

namespace IekaSmartClass.Api.Services.Interface;

public interface IEvaluationService
{
    Task<IReadOnlyList<EvaluationQuestionnaire>> GetAllAsync(CancellationToken ct = default);
    Task<EvaluationQuestionnaire?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<EvaluationQuestionnaire> CreateAsync(CreateEvaluationInput input, CancellationToken ct = default);
    Task UpdateAsync(Guid id, UpdateEvaluationInput input, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
    Task<EvaluationSendResult> SendAsync(Guid id, CancellationToken ct = default);
    Task<(EvaluationQuestionnaire Questionnaire, bool AlreadyAnswered)> GetForFillingAsync(Guid id, Guid userId, CancellationToken ct = default);
    Task<EvaluationResponse> SubmitAsync(Guid id, Guid userId, List<EvaluationAnswerInput> answers, CancellationToken ct = default);
    Task<IReadOnlyList<EvaluationResponse>> GetResponsesAsync(Guid id, CancellationToken ct = default);
}

public sealed record CreateEvaluationInput(string Title, string? Description, string EmailSubject, string EmailBody, bool TargetMembers, bool TargetStudents, List<EvaluationQuestionInput> Questions);
public sealed record UpdateEvaluationInput(string Title, string? Description, string EmailSubject, string EmailBody, bool TargetMembers, bool TargetStudents, List<EvaluationQuestionInput> Questions);
public sealed record EvaluationQuestionInput(string Text, QuestionType Type, int Order, List<string>? Options);
public sealed record EvaluationAnswerInput(Guid QuestionId, string Answer);
public sealed record EvaluationSendResult(int RecipientCount, DateTime SentAt);
