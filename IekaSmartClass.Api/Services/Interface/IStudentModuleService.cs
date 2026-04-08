using IekaSmartClass.Api.Data.Entities;

namespace IekaSmartClass.Api.Services.Interface;

public interface IStudentModuleService
{
    Task<IReadOnlyList<StudentModule>> GetModulesAsync(CancellationToken cancellationToken = default);
    Task<StudentModule?> GetModuleByIdAsync(Guid moduleId, CancellationToken cancellationToken = default);
    Task<StudentModule> CreateModuleAsync(CreateStudentModuleInput input, Guid actorUserId, CancellationToken cancellationToken = default);
    Task DeleteModuleAsync(Guid moduleId, Guid actorUserId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<StudentModuleStudentItem>> GetStudentsByYearGradeAsync(int yearGrade, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<StudentModuleStudentItem>> GetAllActiveStudentsAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<StudentModule>> GetMyModulesAsync(Guid studentId, CancellationToken cancellationToken = default);
    Task NotifyStudentsAsync(Guid moduleId, CancellationToken cancellationToken = default);

    // Topic CRUD
    Task<StudentModuleTopic> AddTopicAsync(Guid moduleId, string name, string lecturer, DateTime? scheduledDate, string? location, bool requireLocation, double? latitude, double? longitude, CancellationToken cancellationToken = default);
    Task<StudentModuleTopic> UpdateTopicAsync(Guid topicId, string name, string lecturer, DateTime? scheduledDate, string? location, bool requireLocation, double? latitude, double? longitude, CancellationToken cancellationToken = default);
    Task DeleteTopicAsync(Guid topicId, CancellationToken cancellationToken = default);

    // Documents (per topic)
    Task<StudentModuleDocument> AddDocumentAsync(Guid topicId, string fileName, string fileUrl, string relativePath, long sizeBytes, CancellationToken cancellationToken = default);
    Task RemoveDocumentAsync(Guid topicId, Guid documentId, CancellationToken cancellationToken = default);

    // QR & attendance (per topic)
    Task<string> GenerateTopicQrTokenAsync(Guid topicId, CancellationToken cancellationToken = default);
    Task<StudentModuleTopicAttendance> ScanTopicQrAsync(string qrToken, Guid studentId, double? latitude = null, double? longitude = null, CancellationToken cancellationToken = default);
    Task<StudentModuleTopicAttendance> MarkTopicAttendanceAsync(Guid topicId, Guid studentId, CancellationToken cancellationToken = default);
    Task RemoveTopicAttendanceAsync(Guid topicId, Guid studentId, CancellationToken cancellationToken = default);

    // Student management on existing modules
    Task AddStudentsToModuleAsync(Guid moduleId, List<Guid> studentIds, CancellationToken cancellationToken = default);
    Task RemoveStudentFromModuleAsync(Guid moduleId, Guid studentId, CancellationToken cancellationToken = default);

    // Results
    Task SetStudentResultAsync(Guid moduleId, Guid studentId, string result, string? note, CancellationToken cancellationToken = default);
    Task SetBulkResultsAsync(Guid moduleId, List<StudentResultInput> results, CancellationToken cancellationToken = default);

    // Questionnaires
    Task<TopicQuestionnaire> CreateQuestionnaireAsync(Guid topicId, string title, List<QuestionnaireQuestionInput> questions, CancellationToken cancellationToken = default);
    Task<TopicQuestionnaire> UpdateQuestionnaireAsync(Guid questionnaireId, string title, List<QuestionnaireQuestionInput> questions, CancellationToken cancellationToken = default);
    Task DeleteQuestionnaireAsync(Guid questionnaireId, CancellationToken cancellationToken = default);
    Task<TopicQuestionnaire?> GetQuestionnaireAsync(Guid questionnaireId, CancellationToken cancellationToken = default);
    Task<TopicQuestionnaire?> GetQuestionnaireByTopicAsync(Guid topicId, CancellationToken cancellationToken = default);
    Task<string> GenerateQuestionnaireQrTokenAsync(Guid questionnaireId, CancellationToken cancellationToken = default);
    Task<TopicQuestionnaireResponse> SubmitQuestionnaireAsync(string qrToken, Guid studentId, List<QuestionnaireAnswerInput> answers, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<TopicQuestionnaireResponse>> GetQuestionnaireResponsesAsync(Guid questionnaireId, CancellationToken cancellationToken = default);
    Task<(TopicQuestionnaire Questionnaire, bool AlreadyAnswered)> GetQuestionnaireByQrTokenAsync(string qrToken, Guid studentId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<TopicQuestionnaireResponse>> GetMyQuestionnaireResponsesAsync(Guid studentId, CancellationToken cancellationToken = default);

    // Auto-assign new student to existing modules matching their year grade
    Task AutoAssignStudentToModulesAsync(Guid studentId, CancellationToken cancellationToken = default);

    // Reassign all students to correct modules based on Jan-Dec year grade logic
    Task<ReassignResult> ReassignAllStudentModulesAsync(CancellationToken cancellationToken = default);
}

public sealed record ReassignResult(int Added, int Removed);

public sealed record CreateStudentModuleInput(
    int YearGrade,
    string Title,
    string? Location = null,
    List<Guid>? ExcludedStudentIds = null,
    List<Guid>? AdditionalStudentIds = null);

public sealed record StudentModuleStudentItem(
    Guid StudentId,
    string FirstName,
    string LastName,
    string Email);

public sealed record StudentResultInput(
    Guid StudentId,
    string Result,
    string? Note = null);

public sealed record QuestionnaireQuestionInput(
    Guid? QuestionId,
    string Text,
    QuestionType Type,
    int Order,
    List<string>? Options = null,
    string? CorrectAnswer = null);

public sealed record QuestionnaireAnswerInput(
    Guid QuestionId,
    string Answer);
