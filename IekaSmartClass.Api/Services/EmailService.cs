using System.Net;
using System.Text.RegularExpressions;
using IekaSmartClass.Api.Data.Entities;
using IekaSmartClass.Api.Services.Interface;
using IekaSmartClass.Api.Utilities.Settings;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using MimeKit;

namespace IekaSmartClass.Api.Services;

public class EmailService(
    IOptions<EmailSettings> emailOptions,
    IHostEnvironment hostEnvironment,
    ILogger<EmailService> logger) : IEmailService
{
    private readonly EmailSettings _settings = emailOptions.Value;
    private readonly IHostEnvironment _hostEnvironment = hostEnvironment;
    private readonly ILogger<EmailService> _logger = logger;

    public Task SendAccountConfirmationLinkAsync(AppUser user, string confirmationCode, CancellationToken cancellationToken = default)
    {
        var primaryEmail = GetPrimaryEmailOrThrow(user);
        var confirmLink = BuildUri("/activate-account", primaryEmail, confirmationCode);
        var body = RenderTemplate(
            "account-confirmation.html",
            new Dictionary<string, string>
            {
                ["RECIPIENT_NAME"] = $"{user.FirstName} {user.LastName}".Trim(),
                ["ACCOUNT_EMAIL"] = primaryEmail,
                ["REGISTRY_NUMBER"] = user.MemberRegistryNumber,
                ["ACCOUNT_ROLE"] = user.Role,
                ["ACTION_LINK"] = confirmLink
            });

        return SendUserEmailAsync(user, "Konfirmo llogarinë IEKA SmartClass", body, cancellationToken);
    }

    public Task SendAccountEmailChangedAsync(AppUser user, string? previousEmail, CancellationToken cancellationToken = default)
    {
        var primaryEmail = GetPrimaryEmailOrThrow(user);
        var body = RenderTemplate(
            "account-email-updated.html",
            new Dictionary<string, string>
            {
                ["RECIPIENT_NAME"] = $"{user.FirstName} {user.LastName}".Trim(),
                ["ACCOUNT_EMAIL"] = primaryEmail,
                ["PREVIOUS_EMAIL"] = string.IsNullOrWhiteSpace(previousEmail) ? "-" : previousEmail.Trim(),
                ["REGISTRY_NUMBER"] = user.MemberRegistryNumber,
                ["ACCOUNT_ROLE"] = user.Role
            });

        return SendUserEmailAsync(user, "Email-i i llogarisë u përditësua - IEKA SmartClass", body, cancellationToken);
    }

    public Task SendPasswordResetCodeAsync(AppUser user, string resetCode, CancellationToken cancellationToken = default)
    {
        var primaryEmail = GetPrimaryEmailOrThrow(user);
        var resetLink = BuildUri("/reset-password", primaryEmail, resetCode);

        var body = RenderTemplate(
            "password-reset.html",
            new Dictionary<string, string>
            {
                ["RECIPIENT_NAME"] = $"{user.FirstName} {user.LastName}".Trim(),
                ["OTP_CODE"] = resetCode,
                ["ACTION_LINK"] = resetLink
            });

        return SendUserEmailAsync(user, "Kodi i rivendosjes së fjalëkalimit - IEKA SmartClass", body, cancellationToken);
    }

    public Task SendPasswordResetLinkAsync(AppUser user, string resetCode, CancellationToken cancellationToken = default)
    {
        var primaryEmail = GetPrimaryEmailOrThrow(user);
        var resetLink = BuildUri("/reset-password", primaryEmail, resetCode);

        var body = RenderTemplate(
            "password-reset-link.html",
            new Dictionary<string, string>
            {
                ["RECIPIENT_NAME"] = $"{user.FirstName} {user.LastName}".Trim(),
                ["ACTION_LINK"] = resetLink
            });

        return SendUserEmailAsync(user, "Rivendosni fjalëkalimin - IEKA SmartClass", body, cancellationToken);
    }

    public Task SendLoginOtpCodeAsync(AppUser user, string otpCode, CancellationToken cancellationToken = default)
    {
        var body = RenderTemplate(
            "login-otp.html",
            new Dictionary<string, string>
            {
                ["RECIPIENT_NAME"] = $"{user.FirstName} {user.LastName}".Trim(),
                ["OTP_CODE"] = otpCode
            });

        return SendUserEmailAsync(user, "Kodi i hyrjes në IEKA SmartClass", body, cancellationToken);
    }

    public Task SendBookingOpenNotificationAsync(AppUser user, BookingOpenEmailItem item, CancellationToken cancellationToken = default)
    {
        var actionLink = BuildFrontendUri(item.ActionLink);

        var body = RenderTemplate(
            "booking-open.html",
            new Dictionary<string, string>
            {
                ["RECIPIENT_NAME"] = $"{user.FirstName} {user.LastName}".Trim(),
                ["MODULE_NAME"] = item.ModuleName,
                ["DATE_SUMMARY"] = item.DateSummary,
                ["LOCATION"] = item.Location,
                ["CPD_HOURS"] = item.CpdHours.ToString(),
                ["ACTION_LINK"] = actionLink
            });

        return SendUserEmailAsync(user, $"U hapën regjistrimet: {item.ModuleName}", body, cancellationToken);
    }

    public Task SendSessionReminderAsync(AppUser user, SessionReminderEmailItem item, CancellationToken cancellationToken = default)
    {
        var actionLink = BuildFrontendUri(item.ActionLink);

        var body = RenderTemplate(
            "session-reminder.html",
            new Dictionary<string, string>
            {
                ["RECIPIENT_NAME"] = $"{user.FirstName} {user.LastName}".Trim(),
                ["MODULE_NAME"] = item.ModuleName,
                ["SESSION_DATE"] = item.SessionDate.ToString("dd MMM yyyy"),
                ["SESSION_TIME"] = item.SessionTime,
                ["SESSION_LOCATION"] = item.SessionLocation,
                ["ACTION_LINK"] = actionLink
            });

        return SendUserEmailAsync(user, $"Kujtesë për sesionin: {item.ModuleName}", body, cancellationToken);
    }

    public Task SendSurveyReminderAsync(AppUser user, SurveyReminderEmailItem item, CancellationToken cancellationToken = default)
    {
        var actionLink = BuildFrontendUri(item.ActionLink);

        var body = RenderTemplate(
            "survey-reminder.html",
            new Dictionary<string, string>
            {
                ["RECIPIENT_NAME"] = $"{user.FirstName} {user.LastName}".Trim(),
                ["MODULE_NAME"] = item.ModuleName,
                ["SESSION_DATE"] = item.SessionDate.ToString("dd MMM yyyy"),
                ["QUESTIONNAIRE_TITLE"] = item.QuestionnaireTitle,
                ["ACTION_LINK"] = actionLink
            });

        return SendUserEmailAsync(user, $"Vlerësoni trajnimin: {item.ModuleName}", body, cancellationToken);
    }

    public Task SendCpdDeadlineReminderAsync(AppUser user, CpdDeadlineEmailItem item, CancellationToken cancellationToken = default)
    {
        var actionLink = BuildFrontendUri(item.ActionLink);

        var body = RenderTemplate(
            "cpd-deadline.html",
            new Dictionary<string, string>
            {
                ["RECIPIENT_NAME"] = $"{user.FirstName} {user.LastName}".Trim(),
                ["CURRENT_HOURS"] = item.CurrentHours.ToString(),
                ["REQUIRED_HOURS"] = item.RequiredHours.ToString(),
                ["REMAINING_HOURS"] = item.RemainingHours.ToString(),
                ["DEADLINE_DATE"] = item.DeadlineDate.ToString("dd MMM yyyy"),
                ["ACTION_LINK"] = actionLink
            });

        return SendUserEmailAsync(user, "Afati vjetor i CPD po afron", body, cancellationToken);
    }

    public Task SendStudentTrainingScheduleAsync(AppUser student, AppUser mentor, IReadOnlyList<TrainingScheduleEmailItem> sessions, CancellationToken cancellationToken = default)
    {
        var rows = BuildScheduleRows(sessions);
        var body = RenderTemplate(
            "student-training-schedule.html",
            new Dictionary<string, string>
            {
                ["RECIPIENT_NAME"] = $"{student.FirstName} {student.LastName}".Trim(),
                ["MENTOR_NAME"] = $"{mentor.FirstName} {mentor.LastName}".Trim(),
                ["RAW_SCHEDULE_ROWS"] = rows
            });

        return SendUserEmailAsync(student, "Orari i trajnimit të studentit - IEKA SmartClass", body, cancellationToken);
    }

    public Task SendStudentTrainingAttendanceRejectedAsync(AppUser student, AppUser mentor, TrainingScheduleEmailItem session, string? reason, CancellationToken cancellationToken = default)
    {
        var body = RenderTemplate(
            "student-training-rejected.html",
            new Dictionary<string, string>
            {
                ["RECIPIENT_NAME"] = $"{student.FirstName} {student.LastName}".Trim(),
                ["MENTOR_NAME"] = $"{mentor.FirstName} {mentor.LastName}".Trim(),
                ["SESSION_DATE"] = session.Date.ToString("dd MMM yyyy"),
                ["SESSION_TIME"] = $"{session.StartTime} - {session.EndTime}",
                ["REJECTION_REASON"] = string.IsNullOrWhiteSpace(reason) ? "Nuk është dhënë arsye." : reason.Trim()
            });

        return SendUserEmailAsync(student, "Njoftim për prezencën në trajnim - IEKA SmartClass", body, cancellationToken);
    }

    public Task SendStudentTrainingFeedbackRequestAsync(AppUser student, AppUser mentor, StudentTrainingStazhEmailItem stazh, string actionLink, CancellationToken cancellationToken = default)
    {
        var body = RenderTemplate(
            "student-training-feedback-request.html",
            new Dictionary<string, string>
            {
                ["RECIPIENT_NAME"] = $"{student.FirstName} {student.LastName}".Trim(),
                ["MENTOR_NAME"] = $"{mentor.FirstName} {mentor.LastName}".Trim(),
                ["STAZH_STARTED_AT"] = stazh.StartedAt.ToString("dd MMM yyyy"),
                ["STAZH_ENDED_AT"] = (stazh.EndedAt ?? DateTime.UtcNow).ToString("dd MMM yyyy"),
                ["MENTOR_RATING"] = stazh.MentorRating.ToString(),
                ["MENTOR_COMMENT"] = string.IsNullOrWhiteSpace(stazh.MentorComment) ? "Mentori nuk ka lënë koment shtesë." : stazh.MentorComment.Trim(),
                ["ACTION_LINK"] = actionLink
            });

        return SendUserEmailAsync(student, "Mbyllja e stazhit dhe formulari i feedback-ut - IEKA SmartClass", body, cancellationToken);
    }

    public Task SendSessionClosedParticipantsSummaryAsync(
        AppUser admin,
        SessionClosedAdminEmailItem summary,
        IReadOnlyList<SessionParticipantEmailItem> participants,
        CancellationToken cancellationToken = default)
    {
        var body = RenderTemplate(
            "session-closed-admin-summary.html",
            new Dictionary<string, string>
            {
                ["RECIPIENT_NAME"] = $"{admin.FirstName} {admin.LastName}".Trim(),
                ["MODULE_NAME"] = summary.ModuleName,
                ["SESSION_DATE"] = summary.SessionDate.ToString("dd MMM yyyy"),
                ["SESSION_TIME"] = summary.SessionTime,
                ["SESSION_LOCATION"] = string.IsNullOrWhiteSpace(summary.SessionLocation) ? "-" : summary.SessionLocation.Trim(),
                ["PARTICIPANT_COUNT"] = participants.Count.ToString(),
                ["RAW_PARTICIPANT_ROWS"] = BuildSessionParticipantRows(participants)
            });

        return SendUserEmailAsync(admin, $"Sesioni u mbyll: {summary.ModuleName} ({summary.SessionDate:dd MMM yyyy})", body, cancellationToken);
    }

    public Task SendStudentModuleNotificationAsync(AppUser student, string moduleTitle, int yearGrade, CancellationToken cancellationToken = default)
    {
        var yearLabel = yearGrade switch
        {
            1 => "Viti i Parë",
            2 => "Viti i Dytë",
            3 => "Viti i Tretë",
            _ => $"Viti {yearGrade}"
        };

        var body = $@"
<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;'>
    <h2 style='color: #1a365d;'>Modul i Ri Trajnimi</h2>
    <p>Përshëndetje {System.Net.WebUtility.HtmlEncode($"{student.FirstName} {student.LastName}")},</p>
    <p>Një modul i ri trajnimi është shtuar për ju:</p>
    <table style='width: 100%; border-collapse: collapse; margin: 16px 0;'>
        <tr>
            <td style='padding: 8px 12px; border: 1px solid #e2e8f0; background: #f7fafc; font-weight: bold;'>Moduli</td>
            <td style='padding: 8px 12px; border: 1px solid #e2e8f0;'>{System.Net.WebUtility.HtmlEncode(moduleTitle)}</td>
        </tr>
        <tr>
            <td style='padding: 8px 12px; border: 1px solid #e2e8f0; background: #f7fafc; font-weight: bold;'>Viti</td>
            <td style='padding: 8px 12px; border: 1px solid #e2e8f0;'>{yearLabel}</td>
        </tr>
    </table>
    <p>Ju lutem kontrolloni platformën për materialet e trajnimit.</p>
    {BuildPlatformButton()}
    <p style='color: #718096; font-size: 12px;'>IEKA SmartClass</p>
</div>";

        return SendUserEmailAsync(student, $"Modul i ri trajnimi: {moduleTitle} - IEKA SmartClass", body, cancellationToken);
    }

    public Task SendStudentModuleUpdateAsync(AppUser student, string moduleTitle, string changeDescription, CancellationToken cancellationToken = default)
    {
        var recipientName = WebUtility.HtmlEncode($"{student.FirstName} {student.LastName}");
        var moduleTitleEncoded = WebUtility.HtmlEncode(moduleTitle);
        var changeEncoded = WebUtility.HtmlEncode(changeDescription);

        var body = $@"<!DOCTYPE html>
<html lang='sq'>
<head><meta charset='UTF-8'/><meta name='viewport' content='width=device-width,initial-scale=1.0'/></head>
<body style='margin:0;padding:0;background-color:#f1f4f8;font-family:""Segoe UI"",Tahoma,Arial,sans-serif;color:#1f2937;'>
  <table role='presentation' cellpadding='0' cellspacing='0' border='0' width='100%' style='background-color:#f1f4f8;padding:24px 12px;'>
    <tr><td align='center'>
      <table role='presentation' cellpadding='0' cellspacing='0' border='0' width='100%' style='max-width:640px;background-color:#ffffff;border:1px solid #d0d7e2;'>
        <tr>
          <td style='padding:20px 28px;background-color:#0f2138;border-bottom:4px solid #24456d;'>
            <div style='font-size:20px;font-weight:700;color:#ffffff;'>IEKA SmartClass</div>
            <div style='margin-top:4px;font-size:12px;color:#c6d2e3;'>Njoftim për përditësim moduli</div>
          </td>
        </tr>
        <tr>
          <td style='padding:28px;'>
            <h1 style='margin:0 0 14px;font-size:22px;color:#0f172a;'>Përditësim i Modulit</h1>
            <p style='margin:0 0 16px;font-size:15px;line-height:1.7;color:#334155;'>
              Përshëndetje <strong>{recipientName}</strong>,
            </p>
            <p style='margin:0 0 16px;font-size:15px;line-height:1.7;color:#334155;'>
              Moduli <strong>{moduleTitleEncoded}</strong> ka ndryshimet e mëposhtme:
            </p>
            <div style='border-left:4px solid #2563eb;background-color:#eff6ff;padding:14px 18px;margin:0 0 20px;border-radius:0 4px 4px 0;'>
              <p style='margin:0;font-size:14px;line-height:1.6;color:#1e40af;'>{changeEncoded}</p>
            </div>
            <p style='margin:0 0 20px;font-size:14px;color:#475569;'>Ju lutem kontrolloni platformën për detaje të plota.</p>
            {BuildPlatformButton()}
            <p style='margin:24px 0 0;font-size:11px;color:#94a3b8;'>IEKA SmartClass · Ky është një email automatik.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>";

        return SendUserEmailAsync(student, $"Përditësim moduli: {moduleTitle} - IEKA SmartClass", body, cancellationToken);
    }

    public Task SendStudentAddedToModuleAsync(AppUser student, string moduleTitle, int yearGrade, string? location, IReadOnlyList<ModuleTopicEmailItem> topics, CancellationToken cancellationToken = default)
    {
        var yearLabel = yearGrade switch
        {
            1 => "Viti i Parë",
            2 => "Viti i Dytë",
            3 => "Viti i Tretë",
            _ => $"Viti {yearGrade}"
        };

        var recipientName = WebUtility.HtmlEncode($"{student.FirstName} {student.LastName}");
        var moduleTitleEncoded = WebUtility.HtmlEncode(moduleTitle);

        var topicRows = topics.Count > 0
            ? string.Join("", topics.Select((t, i) =>
            {
                var bg = i % 2 == 0 ? "#f8fafc" : "#ffffff";
                var dateStr = t.ScheduledDate.HasValue
                    ? t.ScheduledDate.Value.ToString("dd MMM yyyy")
                    : "—";
                return $@"<tr>
                  <td style='padding:10px 12px;border:1px solid #e2e8f0;background-color:{bg};font-size:13px;color:#1e293b;'>{WebUtility.HtmlEncode(t.Name)}</td>
                  <td style='padding:10px 12px;border:1px solid #e2e8f0;background-color:{bg};font-size:13px;color:#475569;'>{WebUtility.HtmlEncode(t.Lecturer)}</td>
                  <td style='padding:10px 12px;border:1px solid #e2e8f0;background-color:{bg};font-size:13px;color:#475569;white-space:nowrap;'>{dateStr}</td>
                </tr>";
            }))
            : @"<tr><td colspan='3' style='padding:10px 12px;border:1px solid #e2e8f0;color:#94a3b8;font-size:13px;'>Nuk ka tema të planifikuara ende.</td></tr>";

        var body = $@"<!DOCTYPE html>
<html lang='sq'>
<head><meta charset='UTF-8'/><meta name='viewport' content='width=device-width,initial-scale=1.0'/></head>
<body style='margin:0;padding:0;background-color:#f1f4f8;font-family:""Segoe UI"",Tahoma,Arial,sans-serif;color:#1f2937;'>
  <table role='presentation' cellpadding='0' cellspacing='0' border='0' width='100%' style='background-color:#f1f4f8;padding:24px 12px;'>
    <tr><td align='center'>
      <table role='presentation' cellpadding='0' cellspacing='0' border='0' width='100%' style='max-width:640px;background-color:#ffffff;border:1px solid #d0d7e2;'>
        <tr>
          <td style='padding:20px 28px;background-color:#0f2138;border-bottom:4px solid #24456d;'>
            <div style='font-size:20px;font-weight:700;color:#ffffff;'>IEKA SmartClass</div>
            <div style='margin-top:4px;font-size:12px;color:#c6d2e3;'>Caktim në modul trajnimi</div>
          </td>
        </tr>
        <tr>
          <td style='padding:28px;'>
            <h1 style='margin:0 0 14px;font-size:22px;color:#0f172a;'>Jeni Shtuar në Modul</h1>
            <p style='margin:0 0 20px;font-size:15px;line-height:1.7;color:#334155;'>
              Përshëndetje <strong>{recipientName}</strong>,<br/>
              jeni caktuar në modulin e trajnimit të mëposhtëm.
            </p>

            <!-- Module info card -->
            <div style='border:1px solid #dbe3f5;background-color:#f8fafc;padding:16px 20px;margin:0 0 24px;'>
              <p style='margin:0 0 6px;font-size:18px;font-weight:700;color:#0f172a;'>{moduleTitleEncoded}</p>
              <p style='margin:0 0 4px;font-size:13px;color:#475569;'>Viti akademik: <strong>{yearLabel}</strong></p>
              <p style='margin:0;font-size:13px;color:#475569;'>Vendndodhja: <strong>{WebUtility.HtmlEncode(location ?? "IEKA")}</strong></p>
            </div>

            <!-- Topics table -->
            <p style='margin:0 0 10px;font-size:14px;font-weight:600;color:#0f172a;'>Temat e Modulit</p>
            <table role='presentation' cellpadding='0' cellspacing='0' border='0' width='100%' style='border-collapse:collapse;margin:0 0 24px;'>
              <thead>
                <tr>
                  <th style='padding:10px 12px;border:1px solid #e2e8f0;background-color:#0f2138;color:#ffffff;font-size:12px;font-weight:600;text-align:left;'>Tema</th>
                  <th style='padding:10px 12px;border:1px solid #e2e8f0;background-color:#0f2138;color:#ffffff;font-size:12px;font-weight:600;text-align:left;'>Lektori</th>
                  <th style='padding:10px 12px;border:1px solid #e2e8f0;background-color:#0f2138;color:#ffffff;font-size:12px;font-weight:600;text-align:left;'>Data</th>
                </tr>
              </thead>
              <tbody>
                {topicRows}
              </tbody>
            </table>

            <p style='margin:0 0 20px;font-size:14px;color:#475569;'>Ju lutem kontrolloni platformën për materialet dhe detajet e trajnimit.</p>
            {BuildPlatformButton()}
            <p style='margin:24px 0 0;font-size:11px;color:#94a3b8;'>IEKA SmartClass · Ky është një email automatik.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>";

        return SendUserEmailAsync(student, $"Jeni shtuar në modulin: {moduleTitle} - IEKA SmartClass", body, cancellationToken);
    }

    public Task SendStudentRemovedFromModuleAsync(AppUser student, string moduleTitle, CancellationToken cancellationToken = default)
    {
        var body = $@"
<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;'>
    <h2 style='color: #1a365d;'>Hequr nga Moduli</h2>
    <p>Përshëndetje {System.Net.WebUtility.HtmlEncode($"{student.FirstName} {student.LastName}")},</p>
    <p>Ju njoftojmë se jeni hequr nga moduli <strong>{System.Net.WebUtility.HtmlEncode(moduleTitle)}</strong>.</p>
    <p>Nëse mendoni se kjo është gabim, ju lutem kontaktoni administratorin.</p>
    {BuildPlatformButton()}
    <p style='color: #718096; font-size: 12px;'>IEKA SmartClass</p>
</div>";

        return SendUserEmailAsync(student, $"Hequr nga moduli: {moduleTitle} - IEKA SmartClass", body, cancellationToken);
    }

    public Task SendStudentModuleResultAsync(AppUser student, string moduleTitle, string result, string? resultNote, CancellationToken cancellationToken = default)
    {
        var noteRow = string.IsNullOrWhiteSpace(resultNote)
            ? ""
            : $@"<tr>
            <td style='padding: 8px 12px; border: 1px solid #e2e8f0; background: #f7fafc; font-weight: bold;'>Shënim</td>
            <td style='padding: 8px 12px; border: 1px solid #e2e8f0;'>{System.Net.WebUtility.HtmlEncode(resultNote)}</td>
        </tr>";

        var body = $@"
<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;'>
    <h2 style='color: #1a365d;'>Rezultati i Modulit</h2>
    <p>Përshëndetje {System.Net.WebUtility.HtmlEncode($"{student.FirstName} {student.LastName}")},</p>
    <p>Rezultati juaj për modulin <strong>{System.Net.WebUtility.HtmlEncode(moduleTitle)}</strong> është publikuar:</p>
    <table style='width: 100%; border-collapse: collapse; margin: 16px 0;'>
        <tr>
            <td style='padding: 8px 12px; border: 1px solid #e2e8f0; background: #f7fafc; font-weight: bold;'>Moduli</td>
            <td style='padding: 8px 12px; border: 1px solid #e2e8f0;'>{System.Net.WebUtility.HtmlEncode(moduleTitle)}</td>
        </tr>
        <tr>
            <td style='padding: 8px 12px; border: 1px solid #e2e8f0; background: #f7fafc; font-weight: bold;'>Rezultati</td>
            <td style='padding: 8px 12px; border: 1px solid #e2e8f0; font-weight: bold; font-size: 16px;'>{System.Net.WebUtility.HtmlEncode(result)}</td>
        </tr>
        {noteRow}
    </table>
    <p>Ju lutem kontrolloni platformën për detaje të mëtejshme.</p>
    {BuildPlatformButton()}
    <p style='color: #718096; font-size: 12px;'>IEKA SmartClass</p>
</div>";

        return SendUserEmailAsync(student, $"Rezultati i modulit: {moduleTitle} - IEKA SmartClass", body, cancellationToken);
    }

    public Task SendEvaluationQuestionnaireAsync(AppUser user, EvaluationEmailItem item, CancellationToken cancellationToken = default)
    {
        var actionLink = BuildFrontendUri(item.ActionLink);

        var body = RenderTemplate(
            "evaluation-questionnaire.html",
            new Dictionary<string, string>
            {
                ["RECIPIENT_NAME"] = $"{user.FirstName} {user.LastName}".Trim(),
                ["QUESTIONNAIRE_TITLE"] = item.QuestionnaireTitle,
                ["RAW_EMAIL_BODY"] = item.EmailBody,
                ["ACTION_LINK"] = actionLink
            });

        return SendUserEmailAsync(user, item.EmailSubject, body, cancellationToken);
    }

    public Task SendLecturerFeedbackRequestAsync(AppUser user, LecturerFeedbackEmailItem item, CancellationToken cancellationToken = default)
    {
        var queryParams = new Dictionary<string, string> { ["token"] = item.FeedbackToken };
        if (!string.IsNullOrEmpty(item.FeedbackType))
            queryParams["type"] = item.FeedbackType;
        var actionLink = BuildFrontendUri("/lecturer-feedback", queryParams);

        var body = RenderTemplate(
            "lecturer-feedback-request.html",
            new Dictionary<string, string>
            {
                ["RECIPIENT_NAME"] = $"{user.FirstName} {user.LastName}".Trim(),
                ["MODULE_NAME"] = item.ModuleName,
                ["TOPIC_NAME"] = item.TopicName,
                ["SESSION_DATE"] = item.SessionDate,
                ["SESSION_TIME"] = item.SessionTime,
                ["LECTURER_NAME"] = item.LecturerName,
                ["TOPIC_LOCATION"] = item.TopicLocation,
                ["ACTION_LINK"] = actionLink,
                ["RAW_ACTION_LINK"] = actionLink
            });

        return SendUserEmailAsync(user, $"Vlerësoni lektorin: {item.TopicName}", body, cancellationToken);
    }

    public Task SendSessionDocumentsAsync(AppUser user, SessionDocumentsEmailItem item, CancellationToken cancellationToken = default)
    {
        var body = RenderTemplate(
            "session-documents.html",
            new Dictionary<string, string>
            {
                ["RECIPIENT_NAME"] = $"{user.FirstName} {user.LastName}".Trim(),
                ["MODULE_NAME"] = item.ModuleName,
                ["SESSION_DATE"] = item.SessionDate,
                ["RAW_DOCUMENTS_LIST"] = item.DocumentsListHtml
            });

        return SendUserEmailAsync(user, $"Dokumentet e sesionit: {item.ModuleName}", body, cancellationToken);
    }

    public Task SendModuleFeedbackRequestAsync(AppUser user, ModuleFeedbackEmailItem item, CancellationToken cancellationToken = default)
    {
        var actionLink = BuildFrontendUri(item.ActionLink);

        var stepsBlock = item.Scope == "lecturer"
            ? $"""
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="padding:0 36px 24px;">
                    <div style="font-size:12px;font-weight:700;color:#111827;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;">Formulari përmban 1 hap:</div>
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td style="padding:10px 14px;background-color:#eff6ff;border-radius:8px;">
                          <div style="font-size:13px;line-height:1.5;color:#1e40af;">
                            <strong style="color:#0f2138;">1.</strong>&ensp;VLERËSIMI I LEKTORIT &mdash; {System.Net.WebUtility.HtmlEncode(item.LecturerName)}
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              """
            : $"""
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="padding:0 36px 24px;">
                    <div style="font-size:12px;font-weight:700;color:#111827;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;">Formulari përmban 3 hapa:</div>
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td style="padding:10px 14px;background-color:#f0fdf4;border-radius:8px;">
                          <div style="font-size:13px;line-height:1.5;color:#166534;"><strong style="color:#0f2138;">1.</strong>&ensp;VLERËSIMI I PËRGJITHSHËM I ORGANIZIMIT</div>
                        </td>
                      </tr>
                      <tr><td style="height:6px;"></td></tr>
                      <tr>
                        <td style="padding:10px 14px;background-color:#eff6ff;border-radius:8px;">
                          <div style="font-size:13px;line-height:1.5;color:#1e40af;"><strong style="color:#0f2138;">2.</strong>&ensp;VLERËSIMI I LEKTORIT &mdash; {System.Net.WebUtility.HtmlEncode(item.LecturerName)}</div>
                        </td>
                      </tr>
                      <tr><td style="height:6px;"></td></tr>
                      <tr>
                        <td style="padding:10px 14px;background-color:#faf5ff;border-radius:8px;">
                          <div style="font-size:13px;line-height:1.5;color:#6b21a8;"><strong style="color:#0f2138;">3.</strong>&ensp;VLERËSIMI FINAL</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              """;

        var body = RenderTemplate(
            "module-feedback-request.html",
            new Dictionary<string, string>
            {
                ["RECIPIENT_NAME"] = $"{user.FirstName} {user.LastName}".Trim(),
                ["MODULE_TITLE"] = item.ModuleTitle,
                ["TOPIC_NAME"] = item.TopicName,
                ["LECTURER_NAME"] = item.LecturerName,
                ["SESSION_DATE"] = item.SessionDate,
                ["SESSION_TIME"] = item.SessionTime,
                ["LOCATION"] = item.Location,
                ["RAW_STEPS_BLOCK"] = stepsBlock,
                ["ACTION_LINK"] = actionLink,
                ["RAW_ACTION_LINK"] = actionLink
            });

        return SendUserEmailAsync(user, $"FORMULAR VLERËSIMI \u2013 MODUL TRAJNIMI {item.ModuleTitle} - {item.TopicName}", body, cancellationToken);
    }

    public Task SendManualModuleFeedbackRequestAsync(AppUser user, ManualModuleFeedbackEmailItem item, CancellationToken cancellationToken = default)
    {
        var actionLink = BuildFrontendUri(item.ActionLink);

        // Build dynamic section list HTML
        var sectionsHtml = string.Join("\n", item.SectionTitles.Select((title, i) =>
            $"""
            <tr><td style="height:6px;"></td></tr>
            <tr>
              <td style="padding:10px 14px;background-color:#f0f9ff;border-radius:8px;">
                <div style="font-size:13px;line-height:1.5;color:#0f4c81;">
                  <strong style="color:#0f2138;">{i + 1}.</strong>&ensp;{System.Net.WebUtility.HtmlEncode(title)}
                </div>
              </td>
            </tr>
            """));

        var body = RenderTemplate(
            "manual-module-feedback-request.html",
            new Dictionary<string, string>
            {
                ["RECIPIENT_NAME"] = $"{user.FirstName} {user.LastName}".Trim(),
                ["MODULE_TITLE"] = item.ModuleTitle,
                ["SECTIONS_COUNT"] = item.SectionTitles.Count.ToString(),
                ["SECTIONS_COUNT_LABEL"] = item.SectionTitles.Count == 1 ? "seksion" : "seksione",
                ["RAW_SECTIONS_LIST_HTML"] = sectionsHtml,
                ["ACTION_LINK"] = actionLink,
                ["RAW_ACTION_LINK"] = actionLink
            });

        return SendUserEmailAsync(user, $"FORMULAR VLERËSIMI \u2013 MODUL TRAJNIMI {item.ModuleTitle}", body, cancellationToken);
    }

    public Task SendModuleFeedbackReminderAsync(AppUser user, ModuleFeedbackReminderEmailItem item, CancellationToken cancellationToken = default)
    {
        var actionLink = BuildFrontendUri(item.ActionLink);

        var body = RenderTemplate(
            "module-feedback-reminder.html",
            new Dictionary<string, string>
            {
                ["RECIPIENT_NAME"] = $"{user.FirstName} {user.LastName}".Trim(),
                ["MODULE_TITLE"] = item.ModuleTitle,
                ["TOPIC_NAME"] = item.TopicName,
                ["LECTURER_NAME"] = item.LecturerName,
                ["SESSION_DATE"] = item.SessionDate,
                ["ACTION_LINK"] = actionLink,
                ["RAW_ACTION_LINK"] = actionLink
            });

        return SendUserEmailAsync(user, $"Kujtesë: Formulari i vlerësimit – {item.ModuleTitle} - {item.TopicName}", body, cancellationToken);
    }

    public Task SendReservationChoiceWarningAsync(AppUser user, ReservationChoiceWarningEmailItem item, CancellationToken cancellationToken = default)
    {
        var actionLink = BuildFrontendUri(item.ActionLink);

        var body = RenderTemplate(
            "reservation-choice-warning.html",
            new Dictionary<string, string>
            {
                ["RECIPIENT_NAME"] = $"{user.FirstName} {user.LastName}".Trim(),
                ["MODULE_NAME"] = item.ModuleName,
                ["RESERVED_DATES_HTML"] = item.ReservedDatesHtml,
                ["ACTION_LINK"] = actionLink,
                ["RAW_ACTION_LINK"] = actionLink
            });

        return SendUserEmailAsync(user, $"Zgjidhni datën e sesionit \u2013 {item.ModuleName}", body, cancellationToken);
    }

    public Task SendReservationCancelledAsync(AppUser user, ReservationCancelledEmailItem item, CancellationToken cancellationToken = default)
    {
        var actionLink = BuildFrontendUri(item.ActionLink);

        var body = RenderTemplate(
            "reservation-cancelled.html",
            new Dictionary<string, string>
            {
                ["RECIPIENT_NAME"] = $"{user.FirstName} {user.LastName}".Trim(),
                ["MODULE_NAME"] = item.ModuleName,
                ["CANCELLED_SESSION_DATE"] = item.CancelledSessionDate,
                ["CANCELLED_SESSION_TIME"] = item.CancelledSessionTime,
                ["REMAINING_SESSION_DATE"] = item.RemainingSessionDate,
                ["REMAINING_SESSION_TIME"] = item.RemainingSessionTime,
                ["ACTION_LINK"] = actionLink,
                ["RAW_ACTION_LINK"] = actionLink
            });

        return SendUserEmailAsync(user, $"Rezervimi juaj u anulua \u2013 {item.ModuleName}", body, cancellationToken);
    }

    public Task SendReservationSeatsAvailableAsync(AppUser user, ReservationSeatsAvailableEmailItem item, CancellationToken cancellationToken = default)
    {
        var actionLink = BuildFrontendUri(item.ActionLink);

        var body = RenderTemplate(
            "reservation-seats-available.html",
            new Dictionary<string, string>
            {
                ["RECIPIENT_NAME"] = $"{user.FirstName} {user.LastName}".Trim(),
                ["MODULE_NAME"] = item.ModuleName,
                ["AVAILABLE_SEATS_HTML"] = item.AvailableSeatsHtml,
                ["ACTION_LINK"] = actionLink,
                ["RAW_ACTION_LINK"] = actionLink
            });

        return SendUserEmailAsync(user, $"Vende të lira \u2013 {item.ModuleName}", body, cancellationToken);
    }

    private Task SendUserEmailAsync(AppUser user, string subject, string body, CancellationToken cancellationToken)
    {
        var recipientName = $"{user.FirstName} {user.LastName}".Trim();
        var recipientEmails = GetRecipientEmails(user);
        if (recipientEmails.Count == 0)
        {
            throw new InvalidOperationException("User has no email.");
        }

        return SendEmailAsync(recipientEmails, recipientName, subject, body, cancellationToken);
    }

    private async Task SendEmailAsync(IReadOnlyList<string> recipientEmails, string recipientName, string subject, string body, CancellationToken cancellationToken)
    {
        var smtp = _settings.Smtp;
        if (string.IsNullOrWhiteSpace(smtp.Host))
        {
            throw new InvalidOperationException("SMTP host is not configured.");
        }

        var fromAddress = string.IsNullOrWhiteSpace(smtp.FromAddress) ? smtp.Username : smtp.FromAddress;
        if (string.IsNullOrWhiteSpace(fromAddress))
        {
            throw new InvalidOperationException("SMTP from address is not configured.");
        }

        var fromName = string.IsNullOrWhiteSpace(smtp.FromName) ? _settings.AppName : smtp.FromName;

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(fromName, fromAddress));
        foreach (var recipientEmail in recipientEmails)
        {
            message.To.Add(new MailboxAddress(recipientName, recipientEmail));
        }
        message.Subject = subject;

        var bodyBuilder = new BodyBuilder
        {
            HtmlBody = body
        };

        message.Body = bodyBuilder.ToMessageBody();

        // MailKit supports implicit SSL (port 465) via SecureSocketOptions.SslOnConnect
        var secureOption = smtp.Port == 465
            ? SecureSocketOptions.SslOnConnect
            : SecureSocketOptions.StartTls;

        using var client = new MailKit.Net.Smtp.SmtpClient();
        if (_hostEnvironment.IsDevelopment())
        {
            client.ServerCertificateValidationCallback = (_, _, _, _) => true;
        }
        try
        {
            await client.ConnectAsync(smtp.Host.Trim(), smtp.Port, secureOption, cancellationToken);
            await client.AuthenticateAsync(smtp.Username, smtp.Password, cancellationToken);
            await client.SendAsync(message, cancellationToken);
            _logger.LogInformation("Email sent to {Recipients}", string.Join(", ", recipientEmails));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send email to {Recipients}", string.Join(", ", recipientEmails));
            throw;
        }
        finally
        {
            if (client.IsConnected)
                await client.DisconnectAsync(true, cancellationToken);
        }
    }

    private static IReadOnlyList<string> GetRecipientEmails(AppUser user)
    {
        var recipients = new List<string>();
        AddRecipient(recipients, user.Email);
        AddRecipient(recipients, user.Email2);
        return recipients;
    }

    private static string GetPrimaryEmailOrThrow(AppUser user)
    {
        var primaryEmail = user.Email?.Trim();
        if (string.IsNullOrWhiteSpace(primaryEmail))
        {
            throw new InvalidOperationException("User has no primary email.");
        }

        return primaryEmail;
    }

    private static void AddRecipient(List<string> recipients, string? email)
    {
        var trimmed = email?.Trim();
        if (string.IsNullOrWhiteSpace(trimmed))
        {
            return;
        }

        if (!recipients.Contains(trimmed, StringComparer.OrdinalIgnoreCase))
        {
            recipients.Add(trimmed);
        }
    }

    private string BuildUri(string path, string email, string code)
    {
        return BuildFrontendUri(path, new Dictionary<string, string>
        {
            ["email"] = email,
            ["code"] = code
        });
    }

    private string BuildFrontendUri(string relativePath)
    {
        var baseUrl = string.IsNullOrWhiteSpace(_settings.FrontendBaseUrl)
            ? "http://localhost:3000"
            : _settings.FrontendBaseUrl.TrimEnd('/');
        var normalizedPath = relativePath.StartsWith('/') ? relativePath : $"/{relativePath}";
        return $"{baseUrl}{normalizedPath}";
    }

    private string BuildFrontendUri(string path, IDictionary<string, string> queryParams)
    {
        var baseUrl = string.IsNullOrWhiteSpace(_settings.FrontendBaseUrl)
            ? "http://localhost:3000"
            : _settings.FrontendBaseUrl.TrimEnd('/');
        var normalizedPath = path.StartsWith('/') ? path : $"/{path}";
        var query = string.Join(
            "&",
            queryParams.Select(pair => $"{Uri.EscapeDataString(pair.Key)}={Uri.EscapeDataString(pair.Value)}"));
        return string.IsNullOrWhiteSpace(query)
            ? $"{baseUrl}{normalizedPath}"
            : $"{baseUrl}{normalizedPath}?{query}";
    }

    private string RenderTemplate(string fileName, IDictionary<string, string>? tokens = null)
    {
        var templatePath = Path.Combine(_hostEnvironment.ContentRootPath, "Templates", "Emails", fileName);
        if (!File.Exists(templatePath))
        {
            throw new InvalidOperationException($"Email template not found: {templatePath}");
        }

        var content = File.ReadAllText(templatePath);

        var mergedTokens = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["APP_NAME"] = _settings.AppName,
            ["PLATFORM_URL"] = string.IsNullOrWhiteSpace(_settings.FrontendBaseUrl)
                ? "http://localhost:3000"
                : _settings.FrontendBaseUrl.TrimEnd('/')
        };

        if (tokens is not null)
        {
            foreach (var pair in tokens)
            {
                mergedTokens[pair.Key] = pair.Value ?? string.Empty;
            }
        }

        foreach (var token in mergedTokens)
        {
            var value = token.Value ?? string.Empty;
            var isRaw = token.Key.StartsWith("RAW_", StringComparison.OrdinalIgnoreCase);
            content = ReplaceToken(content, token.Key, isRaw ? value : WebUtility.HtmlEncode(value));
        }

        return content;
    }

    private static string ReplaceToken(string template, string token, string value)
    {
        return Regex.Replace(template, @"\{\{\s*" + Regex.Escape(token) + @"\s*\}\}", value);
    }

    private string BuildPlatformButton()
    {
        var url = System.Net.WebUtility.HtmlEncode(string.IsNullOrWhiteSpace(_settings.FrontendBaseUrl)
            ? "http://localhost:3000"
            : _settings.FrontendBaseUrl.TrimEnd('/'));
        return $@"<table role='presentation' cellpadding='0' cellspacing='0' border='0' style='margin:20px 0 0;'>
        <tr>
            <td style='background-color:#0f2138;border-radius:6px;'>
                <a href='{url}' style='display:inline-block;padding:12px 24px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;'>
                    Hap Platformën
                </a>
            </td>
        </tr>
    </table>";
    }

    private static string BuildScheduleRows(IReadOnlyList<TrainingScheduleEmailItem> sessions)
    {
        if (sessions.Count == 0)
        {
            return "<tr><td colspan=\"3\" style=\"padding:10px;border:1px solid #dbe3f5;color:#4a5568;\">Nuk ka sesione të planifikuara aktualisht.</td></tr>";
        }

        return string.Join(
            string.Empty,
            sessions
                .OrderBy(x => x.Date)
                .ThenBy(x => x.StartTime)
                .Select(x =>
                    $"<tr>" +
                    $"<td style=\"padding:10px;border:1px solid #dbe3f5;color:#1f2937;\">{WebUtility.HtmlEncode(x.Date.ToString("dd MMM yyyy"))}</td>" +
                    $"<td style=\"padding:10px;border:1px solid #dbe3f5;color:#1f2937;\">{WebUtility.HtmlEncode($"{x.StartTime} - {x.EndTime}")}</td>" +
                    $"<td style=\"padding:10px;border:1px solid #dbe3f5;color:#4a5568;\">{WebUtility.HtmlEncode(string.IsNullOrWhiteSpace(x.Notes) ? "-" : x.Notes!.Trim())}</td>" +
                    $"</tr>"));
    }

    private static string BuildSessionParticipantRows(IReadOnlyList<SessionParticipantEmailItem> participants)
    {
        if (participants.Count == 0)
        {
            return "<tr><td colspan=\"5\" style=\"padding:10px;border:1px solid #dbe3f5;color:#4a5568;\">Nuk ka pjesëmarrës në këtë sesion.</td></tr>";
        }

        return string.Join(
            string.Empty,
            participants.Select(x =>
                $"<tr>" +
                $"<td style=\"padding:10px;border:1px solid #dbe3f5;color:#1f2937;\">{WebUtility.HtmlEncode(string.IsNullOrWhiteSpace(x.FullName) ? "-" : x.FullName)}</td>" +
                $"<td style=\"padding:10px;border:1px solid #dbe3f5;color:#1f2937;\">{WebUtility.HtmlEncode(string.IsNullOrWhiteSpace(x.RegistryNumber) ? "-" : x.RegistryNumber)}</td>" +
                $"<td style=\"padding:10px;border:1px solid #dbe3f5;color:#1f2937;\">{WebUtility.HtmlEncode(string.IsNullOrWhiteSpace(x.Email) ? "-" : x.Email)}</td>" +
                $"<td style=\"padding:10px;border:1px solid #dbe3f5;color:#1f2937;\">{WebUtility.HtmlEncode(x.BookingStatus)}</td>" +
                $"<td style=\"padding:10px;border:1px solid #dbe3f5;color:#1f2937;\">{WebUtility.HtmlEncode(x.AttendanceStatus)}</td>" +
                $"</tr>"));
    }
}
