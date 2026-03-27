using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using IekaSmartClass.Api.Data;
using IekaSmartClass.Api.Data.Entities;
using IekaSmartClass.Api.Services.Interface;
using IekaSmartClass.Api.Utilities.Settings;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace IekaSmartClass.Api.Services;

public class StudentModuleService(
    IApplicationDbContext db,
    IEmailService emailService,
    IFileStorageService fileStorageService,
    IOptions<JwtSettings> jwtOptions,
    ILogger<StudentModuleService> logger) : IStudentModuleService
{
    private readonly IApplicationDbContext _db = db;
    private readonly IEmailService _emailService = emailService;
    private readonly IFileStorageService _fileStorageService = fileStorageService;
    private readonly ILogger<StudentModuleService> _logger = logger;
    private readonly byte[] _qrSigningKey = Encoding.UTF8.GetBytes(
        string.IsNullOrWhiteSpace(jwtOptions.Value.Secret)
            ? "ieka-default-training-qr-signing-secret"
            : jwtOptions.Value.Secret);

    public async Task<IReadOnlyList<StudentModule>> GetModulesAsync(CancellationToken cancellationToken = default)
    {
        return await _db.StudentModules
            .Include(m => m.Documents)
            .Include(m => m.Assignments)
            .Include(m => m.CreatedByUser)
            .OrderByDescending(m => m.ScheduledDate)
            .ToListAsync(cancellationToken);
    }

    public async Task<StudentModule?> GetModuleByIdAsync(Guid moduleId, CancellationToken cancellationToken = default)
    {
        return await _db.StudentModules
            .Include(m => m.Documents)
            .Include(m => m.Assignments)
                .ThenInclude(a => a.Student)
            .Include(m => m.CreatedByUser)
            .FirstOrDefaultAsync(m => m.Id == moduleId, cancellationToken);
    }

    public async Task<StudentModule> CreateModuleAsync(CreateStudentModuleInput input, Guid actorUserId, CancellationToken cancellationToken = default)
    {
        var module = new StudentModule(input.YearGrade, input.Topic, input.Lecturer, actorUserId, input.ScheduledDate, input.Location);

        _db.StudentModules.Add(module);

        // Find all active students that match the year grade
        var matchingStudents = await GetActiveStudentsByYearGradeAsync(input.YearGrade, cancellationToken);

        foreach (var student in matchingStudents)
        {
            var assignment = new StudentModuleAssignment(module.Id, student.Id);
            _db.StudentModuleAssignments.Add(assignment);
        }

        await _db.SaveChangesAsync(cancellationToken);

        // Send email notifications to all assigned students (fire-and-forget per student)
        foreach (var student in matchingStudents)
        {
            try
            {
                await _emailService.SendStudentModuleNotificationAsync(
                    student,
                    input.Topic,
                    input.Lecturer,
                    input.YearGrade,
                    cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to send module notification to student {StudentId}", student.Id);
            }
        }

        return module;
    }

    public async Task<StudentModuleDocument> AddDocumentAsync(Guid moduleId, string fileName, string fileUrl, string relativePath, long sizeBytes, CancellationToken cancellationToken = default)
    {
        var moduleExists = await _db.StudentModules.AnyAsync(m => m.Id == moduleId, cancellationToken);
        if (!moduleExists)
            throw new KeyNotFoundException("Module not found.");

        var document = new StudentModuleDocument(moduleId, fileName, fileUrl, relativePath, sizeBytes);
        _db.StudentModuleDocuments.Add(document);
        await _db.SaveChangesAsync(cancellationToken);
        return document;
    }

    public async Task DeleteModuleAsync(Guid moduleId, Guid actorUserId, CancellationToken cancellationToken = default)
    {
        var module = await _db.StudentModules.FindAsync([moduleId], cancellationToken)
            ?? throw new KeyNotFoundException("Module not found.");

        _db.StudentModules.Remove(module);
        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<StudentModuleStudentItem>> GetStudentsByYearGradeAsync(int yearGrade, CancellationToken cancellationToken = default)
    {
        var students = await GetActiveStudentsByYearGradeAsync(yearGrade, cancellationToken);
        return students.Select(s => new StudentModuleStudentItem(s.Id, s.FirstName, s.LastName, s.Email ?? string.Empty)).ToList();
    }

    public async Task<string> GenerateModuleQrTokenAsync(Guid moduleId, CancellationToken cancellationToken = default)
    {
        var module = await _db.StudentModules.FindAsync([moduleId], cancellationToken)
            ?? throw new KeyNotFoundException("Moduli nuk u gjet.");

        // QR valid for 8 hours
        var expiresAt = DateTime.UtcNow.AddHours(8);
        return CreateModuleQrToken(moduleId, expiresAt);
    }

    public async Task<StudentModuleAssignment> ScanModuleQrAsync(string qrToken, Guid studentId, CancellationToken cancellationToken = default)
    {
        var normalized = NormalizeQrTokenInput(qrToken);
        var payload = ParseModuleQrToken(normalized);

        var expiresAt = DateTimeOffset.FromUnixTimeSeconds(payload.ExpiresAtUnix);
        if (expiresAt < DateTimeOffset.UtcNow)
        {
            throw new InvalidOperationException("Kodi QR ka skaduar.");
        }

        var assignment = await _db.StudentModuleAssignments
            .FirstOrDefaultAsync(a => a.StudentModuleId == payload.ModuleId && a.StudentId == studentId, cancellationToken)
            ?? throw new InvalidOperationException("Nuk jeni i/e caktuar në këtë modul.");

        assignment.MarkAttended();
        await _db.SaveChangesAsync(cancellationToken);
        return assignment;
    }

    public async Task<IReadOnlyList<StudentModule>> GetMyModulesAsync(Guid studentId, CancellationToken cancellationToken = default)
    {
        return await _db.StudentModules
            .Include(m => m.Documents)
            .Include(m => m.Assignments)
            .Where(m => m.Assignments.Any(a => a.StudentId == studentId))
            .OrderByDescending(m => m.ScheduledDate)
            .ToListAsync(cancellationToken);
    }

    public async Task UpdateModuleScheduleAsync(Guid moduleId, DateTime? scheduledDate, CancellationToken cancellationToken = default)
    {
        var module = await _db.StudentModules.FindAsync([moduleId], cancellationToken)
            ?? throw new KeyNotFoundException("Moduli nuk u gjet.");

        module.UpdateSchedule(scheduledDate);
        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task RemoveDocumentAsync(Guid moduleId, Guid documentId, CancellationToken cancellationToken = default)
    {
        var document = await _db.StudentModuleDocuments
            .FirstOrDefaultAsync(d => d.Id == documentId && d.StudentModuleId == moduleId, cancellationToken)
            ?? throw new KeyNotFoundException("Dokumenti nuk u gjet.");

        await _fileStorageService.DeleteByPublicUrlAsync(document.FileUrl, cancellationToken);
        _db.StudentModuleDocuments.Remove(document);
        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task NotifyStudentsAsync(Guid moduleId, CancellationToken cancellationToken = default)
    {
        var module = await _db.StudentModules
            .Include(m => m.Assignments)
                .ThenInclude(a => a.Student)
            .FirstOrDefaultAsync(m => m.Id == moduleId, cancellationToken)
            ?? throw new KeyNotFoundException("Moduli nuk u gjet.");

        foreach (var assignment in module.Assignments)
        {
            if (assignment.Student is null) continue;
            try
            {
                await _emailService.SendStudentModuleNotificationAsync(
                    assignment.Student,
                    module.Topic,
                    module.Lecturer,
                    module.YearGrade,
                    cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to send module notification to student {StudentId}", assignment.StudentId);
            }
        }
    }

    // --- QR Token Helpers ---

    private sealed record ModuleQrPayload(Guid ModuleId, long ExpiresAtUnix);

    private string CreateModuleQrToken(Guid moduleId, DateTime expiresAt)
    {
        var payload = new ModuleQrPayload(moduleId, new DateTimeOffset(expiresAt).ToUnixTimeSeconds());
        var payloadJson = JsonSerializer.Serialize(payload);
        var payloadSegment = Base64UrlEncode(Encoding.UTF8.GetBytes(payloadJson));

        using var hmac = new HMACSHA256(_qrSigningKey);
        var signatureBytes = hmac.ComputeHash(Encoding.UTF8.GetBytes(payloadSegment));
        var signatureSegment = Base64UrlEncode(signatureBytes);

        return $"{payloadSegment}.{signatureSegment}";
    }

    private ModuleQrPayload ParseModuleQrToken(string token)
    {
        if (string.IsNullOrWhiteSpace(token))
            throw new InvalidOperationException("Kodi QR është i pavlefshëm.");

        try
        {
            var parts = token.Trim().Split('.', StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length != 2)
                throw new InvalidOperationException("Kodi QR është i pavlefshëm.");

            var payloadSegment = parts[0];
            var signatureSegment = parts[1];

            var providedSignature = Base64UrlDecode(signatureSegment);

            using var hmac = new HMACSHA256(_qrSigningKey);
            var expectedSignature = hmac.ComputeHash(Encoding.UTF8.GetBytes(payloadSegment));

            if (providedSignature.Length != expectedSignature.Length ||
                !CryptographicOperations.FixedTimeEquals(providedSignature, expectedSignature))
                throw new InvalidOperationException("Kodi QR është i pavlefshëm.");

            var payloadJson = Encoding.UTF8.GetString(Base64UrlDecode(payloadSegment));
            var payload = JsonSerializer.Deserialize<ModuleQrPayload>(payloadJson)
                ?? throw new InvalidOperationException("Kodi QR është i pavlefshëm.");

            if (payload.ModuleId == Guid.Empty || payload.ExpiresAtUnix <= 0)
                throw new InvalidOperationException("Kodi QR është i pavlefshëm.");

            return payload;
        }
        catch (InvalidOperationException) { throw; }
        catch { throw new InvalidOperationException("Kodi QR është i pavlefshëm."); }
    }

    private static string NormalizeQrTokenInput(string rawInput)
    {
        var value = (rawInput ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(value))
            throw new InvalidOperationException("Kodi QR është i pavlefshëm.");

        foreach (var prefix in new[] { "IEKA-SM:", "IEKA-ST:", "IEKA-MT:" })
        {
            if (value.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            {
                value = value[prefix.Length..].Trim();
                break;
            }
        }

        if (LooksLikeJson(value) && TryExtractTokenFromJson(value, out var tokenFromJson))
            return tokenFromJson;

        if (Uri.TryCreate(value, UriKind.Absolute, out var uri))
        {
            var fromQuery = GetQueryParameter(uri.Query, "token")
                ?? GetQueryParameter(uri.Query, "qrToken")
                ?? GetQueryParameter(uri.Query, "code");

            if (!string.IsNullOrWhiteSpace(fromQuery))
                return fromQuery.Trim();

            var lastSegment = uri.Segments.LastOrDefault()?.Trim('/');
            if (!string.IsNullOrWhiteSpace(lastSegment) && lastSegment.Contains('.'))
                return lastSegment;
        }

        return value;
    }

    private static bool LooksLikeJson(string value)
        => value.Length >= 2 && value[0] == '{' && value[^1] == '}';

    private static bool TryExtractTokenFromJson(string json, out string token)
    {
        token = string.Empty;
        try
        {
            using var document = JsonDocument.Parse(json);
            if (document.RootElement.ValueKind != JsonValueKind.Object) return false;

            foreach (var propertyName in new[] { "qrToken", "token", "value", "data" })
            {
                if (!document.RootElement.TryGetProperty(propertyName, out var property)) continue;
                if (property.ValueKind == JsonValueKind.String)
                {
                    var candidate = property.GetString()?.Trim();
                    if (!string.IsNullOrWhiteSpace(candidate))
                    {
                        token = candidate;
                        return true;
                    }
                }
            }
            return false;
        }
        catch { return false; }
    }

    private static string? GetQueryParameter(string query, string key)
    {
        if (string.IsNullOrWhiteSpace(query)) return null;

        var normalized = query.StartsWith('?') ? query[1..] : query;
        var parts = normalized.Split('&', StringSplitOptions.RemoveEmptyEntries);
        foreach (var part in parts)
        {
            var kvp = part.Split('=', 2);
            if (kvp.Length == 0) continue;
            var name = Uri.UnescapeDataString(kvp[0]);
            if (!string.Equals(name, key, StringComparison.OrdinalIgnoreCase)) continue;
            return kvp.Length > 1 ? Uri.UnescapeDataString(kvp[1]) : string.Empty;
        }
        return null;
    }

    private static string Base64UrlEncode(byte[] bytes)
    {
        return Convert.ToBase64String(bytes)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }

    private static byte[] Base64UrlDecode(string input)
    {
        var normalized = input.Replace('-', '+').Replace('_', '/');
        var padding = 4 - (normalized.Length % 4);
        if (padding is > 0 and < 4)
            normalized = normalized.PadRight(normalized.Length + padding, '=');
        return Convert.FromBase64String(normalized);
    }

    // --- Year Grade Filtering ---

    private async Task<List<AppUser>> GetActiveStudentsByYearGradeAsync(int yearGrade, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;

        var activeStudents = await _db.Users
            .Where(u => u.Role == "Student" && u.IsActive && u.StudentStartYear != null)
            .ToListAsync(cancellationToken);

        return activeStudents.Where(s =>
        {
            var startYear = s.StudentStartYear!.Value;
            int gradeStartYear;
            int gradeEndYear;

            switch (yearGrade)
            {
                case 1:
                    gradeStartYear = startYear;
                    gradeEndYear = s.StudentYear2StartYear ?? startYear + 1;
                    break;
                case 2:
                    gradeStartYear = s.StudentYear2StartYear ?? startYear + 1;
                    gradeEndYear = s.StudentYear3StartYear ?? (s.StudentYear2StartYear ?? startYear + 1) + 1;
                    break;
                case 3:
                    gradeStartYear = s.StudentYear3StartYear ?? startYear + 2;
                    gradeEndYear = gradeStartYear + 1;
                    break;
                default:
                    return false;
            }

            var gradeStart = new DateTime(gradeStartYear, 9, 1, 0, 0, 0, DateTimeKind.Utc);
            var gradeEnd = new DateTime(gradeEndYear, 9, 1, 0, 0, 0, DateTimeKind.Utc);
            return now >= gradeStart && now < gradeEnd;
        }).ToList();
    }
}
