using IekaSmartClass.Api.Data.Entities;

namespace IekaSmartClass.Api.Services.Interface;

public interface IModuleFeedbackService
{
    Task<ModuleFeedbackTemplate?> GetTemplateAsync(CancellationToken ct = default);
    Task UpdateTemplateAsync(UpdateModuleFeedbackTemplateInput input, CancellationToken ct = default);
    Task PatchSectionAutoSendAsync(Guid sectionId, bool repeatsPerTopic, CancellationToken ct = default);
    Task<ModuleFeedbackFillResult> GetForFillingAsync(Guid moduleId, Guid studentId, List<Guid>? sectionIds = null, CancellationToken ct = default);
    Task SubmitAsync(Guid moduleId, Guid studentId, List<ModuleFeedbackAnswerInput> answers, string sectionScope = "all", bool isAnonymous = false, CancellationToken ct = default);
    Task<ModuleFeedbackSendResult> SendFeedbackEmailsAsync(Guid moduleId, CancellationToken ct = default);
    Task<ModuleFeedbackSendResult> SendManualFeedbackEmailsAsync(Guid moduleId, List<Guid> sectionIds, string targetRole, List<int>? yearGrades, CancellationToken ct = default);
    Task<LecturerFeedbackManualSendResult> SendLecturerFeedbackManuallyAsync(string targetRole, List<int>? yearGrades, List<Guid>? additionalSectionIds, Guid? targetModuleId = null, CancellationToken ct = default);
    Task<IReadOnlyList<ModuleFeedbackResponse>> GetResponsesAsync(Guid moduleId, CancellationToken ct = default);
    Task<IReadOnlyList<ModuleFeedbackResponse>> GetAllResponsesAsync(CancellationToken ct = default);
    Task<IReadOnlyList<ModuleFeedbackResponse>> GetMyResponsesAsync(Guid studentId, CancellationToken ct = default);
}

public sealed record UpdateModuleFeedbackTemplateInput(string Title, List<UpdateModuleFeedbackSectionInput> Sections);
public sealed record UpdateModuleFeedbackSectionInput(string Title, int Order, bool RepeatsPerTopic, string? RatingLabelLow, string? RatingLabelHigh, List<UpdateModuleFeedbackQuestionInput> Questions);
public sealed record UpdateModuleFeedbackQuestionInput(string Text, QuestionType Type, int Order);
public sealed record ModuleFeedbackAnswerInput(Guid QuestionId, Guid? TopicId, string Answer);
public sealed record ModuleFeedbackFillResult(ModuleFeedbackTemplate Template, IReadOnlyList<ModuleFeedbackTopicInfo> Topics, bool AlreadyAnswered);
public sealed record ModuleFeedbackTopicInfo(Guid Id, string Name, string? Lecturer);
public sealed record ModuleFeedbackSendResult(int RecipientCount, DateTime SentAt);
public sealed record LecturerFeedbackManualSendResult(int EmailsSent, int RecipientsReached, DateTime SentAt);
