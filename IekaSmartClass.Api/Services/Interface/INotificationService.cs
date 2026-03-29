using IekaSmartClass.Api.Data.Entities;

namespace IekaSmartClass.Api.Services.Interface;

public interface INotificationService
{
    Task<NotificationListDto> GetUserNotificationsAsync(Guid userId, int take = 20, CancellationToken cancellationToken = default);
    Task<NotificationPreferencesDto> GetNotificationPreferencesAsync(Guid userId, CancellationToken cancellationToken = default);
    Task UpdateNotificationPreferencesAsync(Guid userId, UpdateNotificationPreferencesDto request, CancellationToken cancellationToken = default);
    Task MarkAsReadAsync(Guid userId, Guid notificationId, CancellationToken cancellationToken = default);
    Task MarkAllAsReadAsync(Guid userId, CancellationToken cancellationToken = default);
    Task DeleteNotificationAsync(Guid userId, Guid notificationId, CancellationToken cancellationToken = default);
    Task ProcessScheduledNotificationsAsync(DateTime utcNow, CancellationToken cancellationToken = default);
    Task NotifyBookingOpenedAsync(Guid eventId, CancellationToken cancellationToken = default);
    Task NotifySurveyReminderForEndedSessionAsync(Guid eventId, Guid dateId, CancellationToken cancellationToken = default);
    Task NotifyStudentProfileChangedAsync(Guid studentId, List<string> changes, CancellationToken cancellationToken = default);
}

public static class NotificationTypeValues
{
    public const string Booking = "booking";
    public const string Reminder = "reminder";
    public const string Survey = "survey";
    public const string CpdDeadline = "cpd-deadline";
    public const string ProfileChange = "profile-change";
}

public sealed record NotificationPreferencesDto(
    bool NotifyByEmail,
    bool NotifyBySms,
    bool NotifyBookingOpen,
    bool NotifySessionReminder,
    bool NotifySurveyReminder,
    bool NotifyCpdDeadline);

public sealed record UpdateNotificationPreferencesDto(
    bool NotifyByEmail,
    bool NotifyBySms,
    bool NotifyBookingOpen,
    bool NotifySessionReminder,
    bool NotifySurveyReminder,
    bool NotifyCpdDeadline);

public sealed record UserNotificationDto(
    Guid Id,
    string Type,
    string Title,
    string Body,
    string? Link,
    bool IsRead,
    DateTime CreatedAtUtc);

public sealed record NotificationListDto(
    int UnreadCount,
    IReadOnlyList<UserNotificationDto> Items);
