using IekaSmartClass.Api.Data.Entities;

namespace IekaSmartClass.Api.Services.Interface;

public interface IStudentTrainingService
{
    Task<IReadOnlyList<ManageableStudentSummary>> GetManageableStudentsAsync(Guid actorUserId, string actorRole, Guid? requestedMentorId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<StudentTrainingSession>> GetStudentScheduleAsync(Guid studentId, Guid actorUserId, string actorRole, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<StudentTrainingSession>> UpsertStudentScheduleAsync(Guid studentId, Guid actorUserId, string actorRole, Guid? requestedMentorId, IReadOnlyList<TrainingScheduleInput> sessions, CancellationToken cancellationToken = default);
    Task<StudentAttendanceDayResult> GetAttendanceForDateAsync(DateTime selectedDate, Guid actorUserId, string actorRole, Guid? requestedMentorId, CancellationToken cancellationToken = default);
    Task MarkAttendanceAsync(Guid sessionId, string status, string? reason, Guid actorUserId, string actorRole, CancellationToken cancellationToken = default);
    Task<StudentTrainingQrResult> GetSessionQrAsync(Guid sessionId, Guid actorUserId, string actorRole, CancellationToken cancellationToken = default);
    Task<MentorAttendanceQrResult> GetMentorAttendanceQrAsync(DateTime selectedDate, Guid actorUserId, string actorRole, CancellationToken cancellationToken = default);
    Task<StudentTrainingSession> MarkAttendanceByQrAsync(string qrToken, Guid actorUserId, string actorRole, CancellationToken cancellationToken = default);
    Task<StudentTrainingSession> MarkAttendanceByMentorQrAsync(string qrToken, Guid actorUserId, string actorRole, CancellationToken cancellationToken = default);
    Task<StudentTrainingStazh> EndStazhAsync(Guid studentId, int mentorFeedbackRating, string? mentorFeedbackComment, Guid actorUserId, string actorRole, Guid? requestedMentorId = null, CancellationToken cancellationToken = default);
    Task<StudentTrainingStazh> GetStazhFeedbackByTokenAsync(string token, CancellationToken cancellationToken = default);
    Task<StudentTrainingStazh> SubmitStudentFeedbackAsync(string token, int studentFeedbackRating, string? studentFeedbackComment, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<StudentTrainingStazh>> GetStudentFeedbackHistoryAsync(Guid studentId, Guid actorUserId, string actorRole, CancellationToken cancellationToken = default);
}

public sealed record TrainingScheduleInput(DateTime Date, string StartTime, string EndTime, string? Notes);
public sealed record ManageableStudentSummary(AppUser Student, int AttendedSessions, int TotalSessions);

public sealed record StudentAttendanceDayResult(DateTime SelectedDate, IReadOnlyList<DateTime> EnabledDates, IReadOnlyList<StudentTrainingSession> Sessions);
public sealed record StudentTrainingQrResult(Guid SessionId, string Token, DateTime ExpiresAt);
public sealed record MentorAttendanceQrResult(Guid MentorId, DateTime Date, string Token, DateTime ExpiresAt);
