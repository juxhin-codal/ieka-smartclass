using System.Net;
using System.Net.Mail;
using System.Net.Mime;
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
    private const string InlineLogoContentId = "ieka-smartclass-logo";

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
        var actionLink = NormalizeFrontendLink(item.ActionLink);

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
        var actionLink = NormalizeFrontendLink(item.ActionLink);

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
        var actionLink = NormalizeFrontendLink(item.ActionLink);

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
        var actionLink = NormalizeFrontendLink(item.ActionLink);

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
    <p style='color: #718096; font-size: 12px;'>IEKA SmartClass</p>
</div>";

        return SendUserEmailAsync(student, $"Modul i ri trajnimi: {moduleTitle} - IEKA SmartClass", body, cancellationToken);
    }

    public Task SendStudentModuleUpdateAsync(AppUser student, string moduleTitle, string changeDescription, CancellationToken cancellationToken = default)
    {
        var body = $@"
<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;'>
    <h2 style='color: #1a365d;'>Përditësim i Modulit</h2>
    <p>Përshëndetje {System.Net.WebUtility.HtmlEncode($"{student.FirstName} {student.LastName}")},</p>
    <p>Moduli <strong>{System.Net.WebUtility.HtmlEncode(moduleTitle)}</strong> ka ndryshime:</p>
    <div style='padding: 12px 16px; background: #f7fafc; border-left: 4px solid #3182ce; margin: 16px 0;'>
        {System.Net.WebUtility.HtmlEncode(changeDescription)}
    </div>
    <p>Ju lutem kontrolloni platformën për detaje.</p>
    <p style='color: #718096; font-size: 12px;'>IEKA SmartClass</p>
</div>";

        return SendUserEmailAsync(student, $"Përditësim moduli: {moduleTitle} - IEKA SmartClass", body, cancellationToken);
    }

    public Task SendStudentAddedToModuleAsync(AppUser student, string moduleTitle, int yearGrade, string? location, IReadOnlyList<string> topicNames, CancellationToken cancellationToken = default)
    {
        var yearLabel = yearGrade switch
        {
            1 => "Viti i Parë",
            2 => "Viti i Dytë",
            3 => "Viti i Tretë",
            _ => $"Viti {yearGrade}"
        };

        var topicRows = topicNames.Count > 0
            ? string.Join("", topicNames.Select(t =>
                $"<tr><td style='padding: 6px 12px; border: 1px solid #e2e8f0;'>{System.Net.WebUtility.HtmlEncode(t)}</td></tr>"))
            : "<tr><td style='padding: 6px 12px; border: 1px solid #e2e8f0; color: #718096;'>Nuk ka tema ende.</td></tr>";

        var body = $@"
<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;'>
    <h2 style='color: #1a365d;'>Jeni Shtuar në Modul</h2>
    <p>Përshëndetje {System.Net.WebUtility.HtmlEncode($"{student.FirstName} {student.LastName}")},</p>
    <p>Jeni shtuar në modulin e mëposhtëm:</p>
    <table style='width: 100%; border-collapse: collapse; margin: 16px 0;'>
        <tr>
            <td style='padding: 8px 12px; border: 1px solid #e2e8f0; background: #f7fafc; font-weight: bold;'>Moduli</td>
            <td style='padding: 8px 12px; border: 1px solid #e2e8f0;'>{System.Net.WebUtility.HtmlEncode(moduleTitle)}</td>
        </tr>
        <tr>
            <td style='padding: 8px 12px; border: 1px solid #e2e8f0; background: #f7fafc; font-weight: bold;'>Viti</td>
            <td style='padding: 8px 12px; border: 1px solid #e2e8f0;'>{yearLabel}</td>
        </tr>
        <tr>
            <td style='padding: 8px 12px; border: 1px solid #e2e8f0; background: #f7fafc; font-weight: bold;'>Vendndodhja</td>
            <td style='padding: 8px 12px; border: 1px solid #e2e8f0;'>{System.Net.WebUtility.HtmlEncode(location ?? "-")}</td>
        </tr>
    </table>
    <h3 style='color: #2d3748;'>Temat:</h3>
    <table style='width: 100%; border-collapse: collapse; margin: 8px 0;'>
        {topicRows}
    </table>
    <p>Ju lutem kontrolloni platformën për materialet e trajnimit.</p>
    <p style='color: #718096; font-size: 12px;'>IEKA SmartClass</p>
</div>";

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
    <p style='color: #718096; font-size: 12px;'>IEKA SmartClass</p>
</div>";

        return SendUserEmailAsync(student, $"Rezultati i modulit: {moduleTitle} - IEKA SmartClass", body, cancellationToken);
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

        var logoResource = TryLoadInlineLogoResource();
        var bodyBuilder = new BodyBuilder();

        if (logoResource is not null)
        {
            bodyBuilder.TextBody = BuildPlainTextBody(body);
            var linkedResource = bodyBuilder.LinkedResources.Add(
                InlineLogoContentId,
                logoResource.Value.bytes,
                MimeKit.ContentType.Parse(logoResource.Value.mimeType));
            linkedResource.ContentId = InlineLogoContentId;
            bodyBuilder.HtmlBody = body;
        }
        else
        {
            var htmlBody = body;
            if (body.Contains($"cid:{InlineLogoContentId}", StringComparison.OrdinalIgnoreCase))
            {
                htmlBody = body.Replace(
                    $"cid:{InlineLogoContentId}",
                    BuildPublicUri("/logo-transparent.png"),
                    StringComparison.OrdinalIgnoreCase);
            }
            bodyBuilder.HtmlBody = htmlBody;
        }

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

    private string BuildFrontendUri(string path, IDictionary<string, string> queryParams)
    {
        var baseUrl = (_settings.FrontendBaseUrl ?? "http://localhost:3000").TrimEnd('/');
        var normalizedPath = path.StartsWith('/') ? path : $"/{path}";
        var query = string.Join(
            "&",
            queryParams.Select(pair => $"{Uri.EscapeDataString(pair.Key)}={Uri.EscapeDataString(pair.Value)}"));
        return string.IsNullOrWhiteSpace(query)
            ? $"{baseUrl}{normalizedPath}"
            : $"{baseUrl}{normalizedPath}?{query}";
    }

    private string NormalizeFrontendLink(string link)
    {
        if (Uri.TryCreate(link, UriKind.Absolute, out var absolute))
        {
            return absolute.ToString();
        }

        var normalizedPath = link.StartsWith('/') ? link : $"/{link}";
        return $"{(_settings.FrontendBaseUrl ?? "http://localhost:3000").TrimEnd('/')}{normalizedPath}";
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
            ["LOGO_URL"] = BuildLogoUrlToken()
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

    private string BuildLogoUrlToken()
    {
        return TryResolveEmailLogoPath(out _)
            ? $"cid:{InlineLogoContentId}"
            : BuildPublicUri("/logo-transparent.png");
    }

    private AlternateView? CreateHtmlViewWithInlineLogo(string body)
    {
        if (!body.Contains($"cid:{InlineLogoContentId}", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        var logoResource = CreateInlineLogoResource();
        if (logoResource is null)
        {
            return null;
        }

        var htmlView = AlternateView.CreateAlternateViewFromString(body, null, MediaTypeNames.Text.Html);
        htmlView.LinkedResources.Add(logoResource);
        return htmlView;
    }

    private LinkedResource? CreateInlineLogoResource()
    {
        if (!TryResolveEmailLogoPath(out var logoPath))
        {
            return null;
        }

        try
        {
            var resource = new LinkedResource(logoPath, "image/png")
            {
                ContentId = InlineLogoContentId,
                TransferEncoding = TransferEncoding.Base64
            };
            resource.ContentType.Name = Path.GetFileName(logoPath);
            return resource;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not attach email logo from {LogoPath}", logoPath);
            return null;
        }
    }

    private (byte[] bytes, string mimeType)? TryLoadInlineLogoResource()
    {
        if (!TryResolveEmailLogoPath(out var logoPath))
            return null;

        try
        {
            return (File.ReadAllBytes(logoPath), "image/png");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not load email logo from {LogoPath}", logoPath);
            return null;
        }
    }

    private bool TryResolveEmailLogoPath(out string logoPath)
    {
        var candidates = new[]
        {
            Path.Combine(_hostEnvironment.ContentRootPath, "Templates", "Emails", "logo-transparent.png"),
            Path.Combine(_hostEnvironment.ContentRootPath, "..", "public", "logo-transparent.png"),
            Path.Combine(_hostEnvironment.ContentRootPath, "public", "logo-transparent.png")
        };

        foreach (var candidate in candidates)
        {
            var fullPath = Path.GetFullPath(candidate);
            if (File.Exists(fullPath))
            {
                logoPath = fullPath;
                return true;
            }
        }

        logoPath = string.Empty;
        return false;
    }

    private static string BuildPlainTextBody(string html)
    {
        var withLineBreaks = Regex.Replace(html, @"<\s*br\s*/?>", "\n", RegexOptions.IgnoreCase);
        withLineBreaks = Regex.Replace(withLineBreaks, @"<\s*/\s*(p|div|tr|li|h1|h2|h3)\s*>", "\n", RegexOptions.IgnoreCase);
        var withoutTags = Regex.Replace(withLineBreaks, "<[^>]+>", string.Empty);
        return WebUtility.HtmlDecode(withoutTags).Trim();
    }

    private string BuildPublicUri(string path)
    {
        var baseUrl = (_settings.FrontendBaseUrl ?? "http://localhost:3000").TrimEnd('/');
        var normalizedPath = path.StartsWith('/') ? path : $"/{path}";
        return $"{baseUrl}{normalizedPath}";
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
