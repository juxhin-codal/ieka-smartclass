using System.Text.Json;
using IekaSmartClass.Api.Data;
using IekaSmartClass.Api.Data.Entities;
using IekaSmartClass.Api.Data.Repositories.Interface;
using IekaSmartClass.Api.Services.Interface;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace IekaSmartClass.Api.Services;

internal sealed record ExportField(string Label, string Value);

public class ProfileService(
    IApplicationDbContext dbContext,
    IRepository<AppUser> userRepository,
    UserManager<AppUser> userManager,
    ILogger<ProfileService> logger) : IProfileService
{
    private readonly IApplicationDbContext _dbContext = dbContext;
    private readonly IRepository<AppUser> _userRepository = userRepository;
    private readonly UserManager<AppUser> _userManager = userManager;
    private readonly ILogger<ProfileService> _logger = logger;

    public async Task<AppUser?> GetMyProfileAsync(Guid userId)
    {
        return await _userRepository.GetByIdAsync(userId);
    }

    public async Task UpdateMyProfileAsync(Guid userId, string firstName, string lastName, string email, string? phone)
    {
        var user = await _userRepository.GetByIdAsync(userId) ?? throw new KeyNotFoundException("Profile not found.");

        user.UpdateProfile(firstName, lastName, email, phone);
        var result = await _userManager.UpdateAsync(user);
        if (!result.Succeeded)
        {
            var errors = string.Join(", ", result.Errors.Select(e => e.Description));
            throw new InvalidOperationException(errors);
        }
    }

    public async Task<UserDataExportFile> ExportMyDataAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var user = await _dbContext.Users
            .AsNoTracking()
            .Where(item => item.Id == userId)
            .Select(item => new
            {
                item.Id,
                item.FirstName,
                item.LastName,
                item.Email,
                item.Email2,
                item.MemberRegistryNumber,
                item.Role,
                item.PhoneNumber,
                item.MentorId,
                item.CpdHoursCompleted,
                item.CpdHoursRequired,
                item.IsActive,
                item.NotifyByEmail,
                item.NotifyBySms,
                item.NotifyBookingOpen,
                item.NotifySessionReminder,
                item.NotifySurveyReminder,
                item.NotifyCpdDeadline,
                item.StudentValidUntilUtc,
                item.StudentTrackingNumber,
                item.StudentNumber,
                item.StudentStartYear,
                item.StudentEndYear,
                item.Company,
                item.District,
                item.YearlyPaymentPaidYear,
                item.IsPendingConfirmation,
                item.EmailConfirmed,
                item.LockoutEnabled,
                item.LockoutEnd,
                item.PhoneNumberConfirmed,
                item.TwoFactorEnabled
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (user is null)
        {
            throw new KeyNotFoundException("Profile not found.");
        }

        var partialFailures = new List<string>();

        object notifications;
        try
        {
            notifications = await _dbContext.UserNotifications
                .AsNoTracking()
                .Where(item => item.UserId == userId)
                .OrderByDescending(item => item.CreatedAtUtc)
                .Select(item => new
                {
                    item.Id,
                    item.Type,
                    item.Title,
                    item.Body,
                    item.Link,
                    item.IsRead,
                    item.CreatedAtUtc,
                    item.ReadAtUtc
                })
                .ToListAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to export notifications for user {UserId}", userId);
            partialFailures.Add("notifications");
            notifications = Array.Empty<object>();
        }

        object moduleBookings;
        try
        {
            moduleBookings = await _dbContext.Participants
                .AsNoTracking()
                .Where(item => item.UserId == userId)
                .OrderByDescending(item => item.RegisteredAt)
                .Select(item => new
                {
                    item.Id,
                    item.EventItemId,
                    eventName = item.EventItem.Name,
                    eventPlace = item.EventItem.Place,
                    eventStatus = item.EventItem.Status,
                    eventCpdHours = item.EventItem.CpdHours,
                    item.DateId,
                    sessionDate = item.EventDate.Date,
                    sessionTime = item.EventDate.Time,
                    sessionLocation = item.EventDate.Location,
                    item.SeatNumber,
                    item.Status,
                    item.Attendance,
                    item.RegisteredAt
                })
                .ToListAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to export module bookings for user {UserId}", userId);
            partialFailures.Add("moduleBookings");
            moduleBookings = Array.Empty<object>();
        }

        object moduleFeedback;
        try
        {
            moduleFeedback = await _dbContext.EventFeedbacks
                .AsNoTracking()
                .Where(item => item.UserId == userId)
                .OrderByDescending(item => item.SubmittedAt)
                .Select(item => new
                {
                    item.Id,
                    item.EventItemId,
                    eventName = item.EventItem.Name,
                    item.DateId,
                    item.SessionRating,
                    item.SessionComments,
                    item.LecturerRating,
                    item.LecturerComments,
                    item.Suggestions,
                    item.SubmittedAt
                })
                .ToListAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to export module feedback for user {UserId}", userId);
            partialFailures.Add("moduleFeedback");
            moduleFeedback = Array.Empty<object>();
        }

        object trainingSessions;
        try
        {
            trainingSessions = await _dbContext.StudentTrainingSessions
                .AsNoTracking()
                .Where(item => item.StudentId == userId || item.MentorId == userId)
                .OrderByDescending(item => item.ScheduledDate)
                .ThenByDescending(item => item.StartTime)
                .Select(item => new
                {
                    item.Id,
                    item.StudentId,
                    studentName = item.Student.FirstName + " " + item.Student.LastName,
                    studentRegistryNumber = item.Student.MemberRegistryNumber,
                    item.MentorId,
                    mentorName = item.Mentor.FirstName + " " + item.Mentor.LastName,
                    mentorRegistryNumber = item.Mentor.MemberRegistryNumber,
                    scheduledDate = item.ScheduledDate,
                    item.StartTime,
                    item.EndTime,
                    item.AttendanceStatus,
                    item.Notes,
                    item.RejectionReason,
                    item.CreatedAt,
                    item.UpdatedAt
                })
                .ToListAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to export training sessions for user {UserId}", userId);
            partialFailures.Add("studentTraining.sessions");
            trainingSessions = Array.Empty<object>();
        }

        object stazhFeedback;
        try
        {
            stazhFeedback = await _dbContext.StudentTrainingStazhet
                .AsNoTracking()
                .Where(item => item.StudentId == userId || item.MentorId == userId || item.EndedByUserId == userId)
                .OrderByDescending(item => item.UpdatedAt)
                .Select(item => new
                {
                    item.Id,
                    item.StudentId,
                    studentName = item.Student.FirstName + " " + item.Student.LastName,
                    studentRegistryNumber = item.Student.MemberRegistryNumber,
                    item.MentorId,
                    mentorName = item.Mentor.FirstName + " " + item.Mentor.LastName,
                    mentorRegistryNumber = item.Mentor.MemberRegistryNumber,
                    item.Status,
                    item.StartedAt,
                    item.EndedAt,
                    item.EndedByUserId,
                    item.MentorFeedbackRating,
                    item.MentorFeedbackComment,
                    item.MentorFeedbackSubmittedAt,
                    item.StudentFeedbackRating,
                    item.StudentFeedbackComment,
                    item.StudentFeedbackSubmittedAt
                })
                .ToListAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to export final stazh feedback for user {UserId}", userId);
            partialFailures.Add("studentTraining.finalFeedback");
            stazhFeedback = Array.Empty<object>();
        }

        object stazhet;
        try
        {
            stazhet = await _dbContext.Stazhet
                .AsNoTracking()
                .Where(item => item.StudentId == userId || item.MentorId == userId)
                .OrderByDescending(item => item.CreatedAt)
                .Select(item => new
                {
                    item.Id,
                    item.Title,
                    item.Status,
                    item.StartDate,
                    item.EndDate,
                    item.Feedback,
                    item.CreatedAt,
                    item.StudentId,
                    studentName = item.Student.FirstName + " " + item.Student.LastName,
                    studentRegistryNumber = item.Student.MemberRegistryNumber,
                    item.MentorId,
                    mentorName = item.Mentor.FirstName + " " + item.Mentor.LastName,
                    mentorRegistryNumber = item.Mentor.MemberRegistryNumber,
                    dates = item.Dates
                        .OrderBy(date => date.Date)
                        .Select(date => new
                        {
                            date.Id,
                            date.Date,
                            date.Time,
                            date.Notes
                        })
                        .ToList(),
                    documents = item.Documents
                        .OrderByDescending(document => document.UploadedAt)
                        .Select(document => new
                        {
                            document.Id,
                            document.FileName,
                            document.FileUrl,
                            document.Description,
                            document.UploadedAt
                        })
                        .ToList()
                })
                .ToListAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to export stazh history for user {UserId}", userId);
            partialFailures.Add("studentTraining.stazhet");
            stazhet = Array.Empty<object>();
        }

        var fileSafeRegistry = string.IsNullOrWhiteSpace(user.MemberRegistryNumber)
            ? user.Id.ToString("N")
            : user.MemberRegistryNumber.Trim().Replace("/", "-").Replace("\\", "-").Replace(" ", "-");

        var exportedAtUtc = DateTime.UtcNow;
        var profileFields = new List<ExportField>
        {
            new("ID", user.Id.ToString()),
            new("Emri", $"{user.FirstName} {user.LastName}".Trim()),
            new("Email", FormatValue(user.Email)),
            new("Email 2", FormatValue(user.Email2)),
            new("Kodi i regjistrit", FormatValue(user.MemberRegistryNumber)),
            new("Roli", FormatValue(user.Role)),
            new("Telefoni", FormatValue(user.PhoneNumber)),
            new("Mentori", user.MentorId?.ToString() ?? "—"),
            new("Aktiv", FormatBoolean(user.IsActive)),
            new("Email i konfirmuar", FormatBoolean(user.EmailConfirmed)),
            new("Në pritje konfirmimi", FormatBoolean(user.IsPendingConfirmation)),
            new("Orë CPD të kryera", user.CpdHoursCompleted.ToString()),
            new("Orë CPD të kërkuara", user.CpdHoursRequired.ToString()),
            new("Valid deri në", user.StudentValidUntilUtc?.ToString("dd MMM yyyy") ?? "—"),
            new("Numri i studentit", FormatValue(user.StudentNumber)),
            new("Tracking number", user.StudentTrackingNumber?.ToString() ?? "—"),
            new("Viti i fillimit", user.StudentStartYear?.ToString() ?? "—"),
            new("Viti i mbarimit", user.StudentEndYear?.ToString() ?? "—"),
            new("Kompania", FormatValue(user.Company)),
            new("Qarku", FormatValue(user.District)),
            new("Pagesa vjetore", user.YearlyPaymentPaidYear?.ToString() ?? "—"),
            new("Telefoni i konfirmuar", FormatBoolean(user.PhoneNumberConfirmed)),
            new("2FA aktiv", FormatBoolean(user.TwoFactorEnabled)),
            new("Lockout aktiv", FormatBoolean(user.LockoutEnabled)),
            new("Lockout deri më", user.LockoutEnd?.ToString("dd MMM yyyy HH:mm") ?? "—")
        };

        var preferenceFields = new List<ExportField>
        {
            new("Njoftime me email", FormatBoolean(user.NotifyByEmail)),
            new("Njoftime SMS", FormatBoolean(user.NotifyBySms)),
            new("Hapje rezervimesh", FormatBoolean(user.NotifyBookingOpen)),
            new("Kujtesa seancash", FormatBoolean(user.NotifySessionReminder)),
            new("Kujtesa feedback", FormatBoolean(user.NotifySurveyReminder)),
            new("Afati CPD", FormatBoolean(user.NotifyCpdDeadline))
        };

        var content = GenerateExportPdf(
            $"{user.FirstName} {user.LastName}".Trim(),
            exportedAtUtc,
            profileFields,
            preferenceFields,
            partialFailures,
            notifications,
            moduleBookings,
            moduleFeedback,
            trainingSessions,
            stazhet,
            stazhFeedback);

        return new UserDataExportFile(
            $"ieka-te-dhenat-e-mia-{fileSafeRegistry}-{exportedAtUtc:yyyyMMddHHmmss}.pdf",
            content,
            "application/pdf");
    }

    private static byte[] GenerateExportPdf(
        string fullName,
        DateTime exportedAtUtc,
        IReadOnlyList<ExportField> profileFields,
        IReadOnlyList<ExportField> preferenceFields,
        IReadOnlyList<string> partialFailures,
        object notifications,
        object moduleBookings,
        object moduleFeedback,
        object trainingSessions,
        object stazhet,
        object stazhFeedback)
    {
        QuestPDF.Settings.License = LicenseType.Community;

        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(28);
                page.DefaultTextStyle(x => x.FontSize(10));

                page.Header().Column(column =>
                {
                    column.Spacing(4);
                    column.Item().Text("IEKA - Të Dhënat e Mia").FontSize(18).SemiBold();
                    column.Item().Text(string.IsNullOrWhiteSpace(fullName) ? "Përdorues pa emër" : fullName).FontSize(12);
                    column.Item().Text($"Gjeneruar më {exportedAtUtc:dd MMM yyyy HH:mm} UTC").FontSize(9).FontColor(Colors.Grey.Darken1);
                });

                page.Content().Column(column =>
                {
                    column.Spacing(14);
                    column.Item().Element(container => ComposeFieldsSection(container, "Profili", profileFields));
                    column.Item().Element(container => ComposeFieldsSection(container, "Preferencat e njoftimeve", preferenceFields));

                    if (partialFailures.Count > 0)
                    {
                        column.Item().Element(container => ComposeFailuresSection(container, partialFailures));
                    }

                    column.Item().Element(container => ComposeJsonSection(container, "Njoftimet", notifications));
                    column.Item().Element(container => ComposeJsonSection(container, "Rezervimet në module", moduleBookings));
                    column.Item().Element(container => ComposeJsonSection(container, "Feedback për module", moduleFeedback));
                    column.Item().Element(container => ComposeJsonSection(container, "Seancat e studimeve/stazhit", trainingSessions));
                    column.Item().Element(container => ComposeJsonSection(container, "Stazhet", stazhet));
                    column.Item().Element(container => ComposeJsonSection(container, "Vlerësimet finale të stazhit", stazhFeedback));
                });

                page.Footer().AlignCenter().Text(text =>
                {
                    text.Span("Faqja ");
                    text.CurrentPageNumber();
                    text.Span(" / ");
                    text.TotalPages();
                });
            });
        });

        return document.GeneratePdf();
    }

    private static void ComposeFieldsSection(IContainer container, string title, IReadOnlyList<ExportField> fields)
    {
        container
            .Border(1)
            .BorderColor(Colors.Grey.Lighten2)
            .Padding(12)
            .Column(column =>
            {
                column.Spacing(8);
                column.Item().Text(title).FontSize(13).SemiBold();

                foreach (var field in fields)
                {
                    column.Item().Row(row =>
                    {
                        row.ConstantItem(170).Text(field.Label).SemiBold();
                        row.RelativeItem().Text(field.Value);
                    });
                }
            });
    }

    private static void ComposeFailuresSection(IContainer container, IReadOnlyList<string> partialFailures)
    {
        container
            .Border(1)
            .BorderColor(Colors.Orange.Lighten2)
            .Background(Colors.Orange.Lighten5)
            .Padding(12)
            .Column(column =>
            {
                column.Spacing(6);
                column.Item().Text("Seksione që nuk u eksportuan plotësisht").FontSize(13).SemiBold();
                column.Item().Text("Eksporti u gjenerua, por këto pjesë dështuan në server gjatë përpunimit:").FontSize(9);

                foreach (var item in partialFailures)
                {
                    column.Item().Text($"- {item}");
                }
            });
    }

    private static void ComposeJsonSection(IContainer container, string title, object data)
    {
        var lines = JsonSerializer
            .Serialize(data, new JsonSerializerOptions { WriteIndented = true })
            .Split('\n', StringSplitOptions.None);

        container
            .Border(1)
            .BorderColor(Colors.Grey.Lighten2)
            .Padding(12)
            .Column(column =>
            {
                column.Spacing(4);
                column.Item().Text(title).FontSize(13).SemiBold();

                foreach (var line in lines)
                {
                    column.Item().Text(line.Replace("\r", string.Empty)).FontSize(8);
                }
            });
    }

    private static string FormatBoolean(bool value) => value ? "Po" : "Jo";

    private static string FormatValue(string? value) => string.IsNullOrWhiteSpace(value) ? "—" : value.Trim();
}
