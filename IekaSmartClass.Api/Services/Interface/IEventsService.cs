using IekaSmartClass.Api.Data.Entities;
using IekaSmartClass.Api.Utilities.Pagination;
using Microsoft.AspNetCore.Http;

namespace IekaSmartClass.Api.Services.Interface;

public interface IEventsService
{
    Task<PaginatedList<EventItem>> GetEventsAsync(int pageNumber, int pageSize);
    Task<EventItem?> GetEventByIdAsync(Guid id);
    Task<Guid> CreateEventAsync(string name, string place, int sessionCapacity, int totalSessions, int cpdHours, decimal price = 0, string? lecturerName = null, string? webinarLink = null, List<string>? topics = null, List<(string Date, string Time)>? dates = null, List<string>? lecturerIds = null, string? feedbackQuestionsJson = null);
    Task<string> ReserveSeatAsync(Guid eventId, Guid userId, Guid dateId);
    Task<IReadOnlyList<EventItem>> GetMyModulesAsync(Guid userId);
    Task MarkAttendanceAsync(Guid eventId, Guid participantId, string status);
    Task CancelReservationAsync(Guid eventId, Guid participantId);
    Task RemoveParticipantFromSessionAsync(Guid eventId, Guid dateId, Guid participantId);
    Task DeleteEventAsync(Guid id);
    Task UpdateEventAsync(Guid id, string name, string place, int sessionCapacity, int totalSessions, int cpdHours, decimal price, string? lecturerName, string? webinarLink, List<string> topics, List<(Guid? Id, string Date, string Time, string? Location)>? dates, List<string>? lecturerIds, string? feedbackQuestionsJson = null);
    Task MarkAsNotifiedAsync(Guid id);
    Task EndSessionAsync(Guid eventId, Guid dateId);
    Task<SessionParticipantsExportResult> ExportSessionParticipantsExcelAsync(Guid eventId, Guid dateId);
    Task<EventDocument> UploadDocumentAsync(Guid eventId, IFormFile file, Guid userId, string? displayName, CancellationToken cancellationToken = default);
    Task<EventDocument> AddDocumentAsync(Guid eventId, string fileName, string fileUrl, Guid userId);
    Task DeleteDocumentAsync(Guid eventId, Guid documentId);
    Task SubmitFeedbackAsync(Guid eventId, Guid? dateId, Guid userId, int? sessionRating, string? sessionComments, int? lecturerRating, string? lecturerComments, string? suggestions, string? questionnaireId = null, string? questionnaireTitle = null, IReadOnlyList<FeedbackAnswerInput>? answers = null);
}

public sealed record SessionParticipantsExportResult(byte[] Content, string ContentType, string FileName);
public sealed record FeedbackAnswerInput(string QuestionId, string Answer);
