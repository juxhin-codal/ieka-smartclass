using IekaSmartClass.Api.Data.Entities;

namespace IekaSmartClass.Api.Services.Interface;

public interface IEmailService
{
    Task SendAccountConfirmationLinkAsync(AppUser user, string confirmationCode, CancellationToken cancellationToken = default);
    Task SendAccountEmailChangedAsync(AppUser user, string? previousEmail, CancellationToken cancellationToken = default);
    Task SendPasswordResetCodeAsync(AppUser user, string resetCode, CancellationToken cancellationToken = default);
    Task SendPasswordResetLinkAsync(AppUser user, string resetCode, CancellationToken cancellationToken = default);
    Task SendLoginOtpCodeAsync(AppUser user, string otpCode, CancellationToken cancellationToken = default);
    Task SendBookingOpenNotificationAsync(AppUser user, BookingOpenEmailItem item, CancellationToken cancellationToken = default);
    Task SendSessionReminderAsync(AppUser user, SessionReminderEmailItem item, CancellationToken cancellationToken = default);
    Task SendSurveyReminderAsync(AppUser user, SurveyReminderEmailItem item, CancellationToken cancellationToken = default);
    Task SendCpdDeadlineReminderAsync(AppUser user, CpdDeadlineEmailItem item, CancellationToken cancellationToken = default);
    Task SendStudentTrainingScheduleAsync(AppUser student, AppUser mentor, IReadOnlyList<TrainingScheduleEmailItem> sessions, CancellationToken cancellationToken = default);
    Task SendStudentTrainingAttendanceRejectedAsync(AppUser student, AppUser mentor, TrainingScheduleEmailItem session, string? reason, CancellationToken cancellationToken = default);
    Task SendStudentTrainingFeedbackRequestAsync(AppUser student, AppUser mentor, StudentTrainingStazhEmailItem stazh, string actionLink, CancellationToken cancellationToken = default);
    Task SendSessionClosedParticipantsSummaryAsync(AppUser admin, SessionClosedAdminEmailItem summary, IReadOnlyList<SessionParticipantEmailItem> participants, CancellationToken cancellationToken = default);
    Task SendStudentModuleNotificationAsync(AppUser student, string moduleTitle, int yearGrade, CancellationToken cancellationToken = default);
    Task SendStudentModuleUpdateAsync(AppUser student, string moduleTitle, string changeDescription, CancellationToken cancellationToken = default);
    Task SendStudentAddedToModuleAsync(AppUser student, string moduleTitle, int yearGrade, string? location, IReadOnlyList<string> topicNames, CancellationToken cancellationToken = default);
    Task SendStudentRemovedFromModuleAsync(AppUser student, string moduleTitle, CancellationToken cancellationToken = default);
    Task SendStudentModuleResultAsync(AppUser student, string moduleTitle, string result, string? resultNote, CancellationToken cancellationToken = default);
    Task SendEvaluationQuestionnaireAsync(AppUser user, EvaluationEmailItem item, CancellationToken cancellationToken = default);
    Task SendLecturerFeedbackRequestAsync(AppUser user, LecturerFeedbackEmailItem item, CancellationToken cancellationToken = default);
    Task SendSessionDocumentsAsync(AppUser user, SessionDocumentsEmailItem item, CancellationToken cancellationToken = default);
}

public sealed record BookingOpenEmailItem(string ModuleName, string DateSummary, string Location, int CpdHours, string ActionLink);
public sealed record SessionReminderEmailItem(string ModuleName, DateTime SessionDate, string SessionTime, string SessionLocation, string ActionLink);
public sealed record SurveyReminderEmailItem(string ModuleName, DateTime SessionDate, string QuestionnaireTitle, string ActionLink);
public sealed record CpdDeadlineEmailItem(int CurrentHours, int RequiredHours, int RemainingHours, DateTime DeadlineDate, string ActionLink);
public sealed record TrainingScheduleEmailItem(DateTime Date, string StartTime, string EndTime, string? Notes);
public sealed record StudentTrainingStazhEmailItem(DateTime StartedAt, DateTime? EndedAt, int MentorRating, string? MentorComment);
public sealed record SessionClosedAdminEmailItem(string ModuleName, DateTime SessionDate, string SessionTime, string? SessionLocation);
public sealed record SessionParticipantEmailItem(string FullName, string RegistryNumber, string Email, string BookingStatus, string AttendanceStatus);
public sealed record EvaluationEmailItem(string QuestionnaireTitle, string EmailSubject, string EmailBody, string ActionLink);
public sealed record LecturerFeedbackEmailItem(string ModuleName, string TopicName, string SessionDate, string SessionTime, string LecturerName, string TopicLocation, string FeedbackToken, string? FeedbackType = null);
public sealed record SessionDocumentsEmailItem(string ModuleName, string SessionDate, string DocumentsListHtml);
