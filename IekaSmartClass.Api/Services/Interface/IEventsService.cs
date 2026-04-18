using IekaSmartClass.Api.Data.Entities;
using IekaSmartClass.Api.Utilities.Pagination;
using Microsoft.AspNetCore.Http;

namespace IekaSmartClass.Api.Services.Interface;

public interface IEventsService
{
    Task<PaginatedList<EventItem>> GetEventsAsync(int pageNumber, int pageSize);
    Task<EventItem?> GetEventByIdAsync(Guid id);
    Task<Guid> CreateEventAsync(string name, string place, int sessionCapacity, int totalSessions, int cpdHours, decimal price = 0, string? lecturerName = null, string? webinarLink = null, List<string>? topics = null, List<(string Date, string Time, string? Location, bool RequireLocation, double? Latitude, double? Longitude)>? dates = null, List<string>? lecturerIds = null, string? feedbackQuestionsJson = null);
    Task<string> ReserveSeatAsync(Guid eventId, Guid userId, Guid dateId);
    Task<string> AssignMemberToSessionAsync(Guid eventId, Guid dateId, Guid memberId);
    Task<IReadOnlyList<EventItem>> GetMyModulesAsync(Guid userId);
    Task MarkAttendanceAsync(Guid eventId, Guid participantId, string status);
    Task CancelReservationAsync(Guid eventId, Guid participantId);
    Task RemoveParticipantFromSessionAsync(Guid eventId, Guid dateId, Guid participantId);
    Task DeleteEventAsync(Guid id);
    Task UpdateEventAsync(Guid id, string name, string place, int sessionCapacity, int totalSessions, int cpdHours, decimal price, string? lecturerName, string? webinarLink, List<string> topics, List<(Guid? Id, string Date, string Time, string? Location, bool RequireLocation, double? Latitude, double? Longitude)>? dates, List<string>? lecturerIds, string? feedbackQuestionsJson = null);
    Task MarkAsNotifiedAsync(Guid id);
    Task EndSessionAsync(Guid eventId, Guid dateId);
    Task<SessionParticipantsExportResult> ExportSessionParticipantsExcelAsync(Guid eventId, Guid dateId);
    Task<EventDocument> UploadDocumentAsync(Guid eventId, IFormFile file, Guid userId, string? displayName, CancellationToken cancellationToken = default);
    Task<EventDocument> AddDocumentAsync(Guid eventId, string fileName, string fileUrl, Guid userId);
    Task DeleteDocumentAsync(Guid eventId, Guid documentId);
    Task SubmitFeedbackAsync(Guid eventId, Guid? dateId, Guid userId, int? sessionRating, string? sessionComments, int? lecturerRating, string? lecturerComments, string? suggestions, string? questionnaireId = null, string? questionnaireTitle = null, IReadOnlyList<FeedbackAnswerInput>? answers = null);

    // ── Session QR Attendance ──
    Task<string> GenerateSessionQrTokenAsync(Guid eventId, Guid dateId, CancellationToken cancellationToken = default);
    Task<Participant> ScanSessionAttendanceAsync(string qrToken, Guid userId, double? latitude, double? longitude, CancellationToken cancellationToken = default);

    // ── Session Documents ──
    Task<EventDateDocument> UploadSessionDocumentAsync(Guid eventId, Guid dateId, IFormFile file, Guid userId, string? displayName, CancellationToken cancellationToken = default);
    Task DeleteSessionDocumentAsync(Guid eventId, Guid dateId, Guid documentId, CancellationToken cancellationToken = default);

    // ── Event Questionnaires (module-level) ──
    Task<EventQuestionnaire> CreateEventQuestionnaireAsync(Guid eventId, string title, List<EventQuestionnaireQuestionInput> questions, CancellationToken cancellationToken = default);
    Task<EventQuestionnaire> UpdateEventQuestionnaireAsync(Guid questionnaireId, string title, List<EventQuestionnaireQuestionInput> questions, CancellationToken cancellationToken = default);
    Task DeleteEventQuestionnaireAsync(Guid questionnaireId, CancellationToken cancellationToken = default);
    Task<EventQuestionnaire?> GetEventQuestionnaireDetailAsync(Guid questionnaireId, CancellationToken cancellationToken = default);
    Task<string> GenerateEventQuestionnaireQrTokenAsync(Guid questionnaireId, CancellationToken cancellationToken = default);
    Task<EventQuestionnaireResponse> SubmitEventQuestionnaireAsync(string qrToken, Guid userId, List<EventQuestionnaireAnswerInput> answers, CancellationToken cancellationToken = default);
    Task<EventQuestionnaire?> GetEventQuestionnaireByTokenAsync(string token, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<EventQuestionnaireResponse>> GetEventQuestionnaireResponsesAsync(Guid questionnaireId, CancellationToken cancellationToken = default);

    // ── Email actions per session ──
    Task<int> SendSessionQuestionnaireEmailsAsync(Guid eventId, Guid dateId, CancellationToken cancellationToken = default);
    Task<int> SendSessionDocumentsEmailAsync(Guid eventId, Guid dateId, CancellationToken cancellationToken = default);
}

public sealed record SessionParticipantsExportResult(byte[] Content, string ContentType, string FileName);
public sealed record FeedbackAnswerInput(string QuestionId, string Answer);
public sealed record EventQuestionnaireQuestionInput(string Text, QuestionType Type, int Order, string? OptionsJson = null, string? CorrectAnswer = null);
public sealed record EventQuestionnaireAnswerInput(Guid QuestionId, string AnswerText);
