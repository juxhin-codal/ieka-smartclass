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
            .AsNoTracking()
            .Include(m => m.Topics).ThenInclude(t => t.Documents)
            .Include(m => m.Topics).ThenInclude(t => t.Attendances)
            .Include(m => m.Topics).ThenInclude(t => t.Questionnaires).ThenInclude(q => q.Questions)
            .Include(m => m.Topics).ThenInclude(t => t.Questionnaires).ThenInclude(q => q.Responses)
            .Include(m => m.Assignments)
            .Include(m => m.CreatedByUser)
            .OrderByDescending(m => m.CreatedAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<StudentModule?> GetModuleByIdAsync(Guid moduleId, CancellationToken cancellationToken = default)
    {
        return await _db.StudentModules
            .AsNoTracking()
            .Include(m => m.Topics).ThenInclude(t => t.Documents)
            .Include(m => m.Topics).ThenInclude(t => t.Attendances)
            .Include(m => m.Topics).ThenInclude(t => t.Questionnaires).ThenInclude(q => q.Questions)
            .Include(m => m.Topics).ThenInclude(t => t.Questionnaires).ThenInclude(q => q.Responses)
            .Include(m => m.Assignments).ThenInclude(a => a.Student)
            .Include(m => m.CreatedByUser)
            .FirstOrDefaultAsync(m => m.Id == moduleId, cancellationToken);
    }

    public async Task<StudentModule> CreateModuleAsync(CreateStudentModuleInput input, Guid actorUserId, CancellationToken cancellationToken = default)
    {
        var module = new StudentModule(input.YearGrade, input.Title, actorUserId, input.Location);

        _db.StudentModules.Add(module);

        // Find all active students that match the year grade
        var matchingStudents = await GetActiveStudentsByYearGradeAsync(input.YearGrade, cancellationToken);

        // Apply exclusions
        if (input.ExcludedStudentIds is { Count: > 0 })
        {
            var excludeSet = input.ExcludedStudentIds.ToHashSet();
            matchingStudents = matchingStudents.Where(s => !excludeSet.Contains(s.Id)).ToList();
        }

        // Add additional students (from other years)
        if (input.AdditionalStudentIds is { Count: > 0 })
        {
            var existingIds = matchingStudents.Select(s => s.Id).ToHashSet();
            var additionalIds = input.AdditionalStudentIds.Where(id => !existingIds.Contains(id)).ToList();
            if (additionalIds.Count > 0)
            {
                var additionalStudents = await _db.Users
                    .Where(u => additionalIds.Contains(u.Id) && u.Role == "Student" && u.IsActive)
                    .ToListAsync(cancellationToken);
                matchingStudents.AddRange(additionalStudents);
            }
        }

        foreach (var student in matchingStudents)
        {
            var assignment = new StudentModuleAssignment(module.Id, student.Id);
            _db.StudentModuleAssignments.Add(assignment);
        }

        await _db.SaveChangesAsync(cancellationToken);

        // Send email notifications
        foreach (var student in matchingStudents)
        {
            try
            {
                await _emailService.SendStudentModuleNotificationAsync(
                    student, input.Title, input.YearGrade, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to send module notification to student {StudentId}", student.Id);
            }
        }

        return module;
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

    public async Task<IReadOnlyList<StudentModuleStudentItem>> GetAllActiveStudentsAsync(CancellationToken cancellationToken = default)
    {
        return await _db.Users
            .AsNoTracking()
            .Where(u => u.Role == "Student" && u.IsActive)
            .OrderBy(u => u.FirstName).ThenBy(u => u.LastName)
            .Select(s => new StudentModuleStudentItem(s.Id, s.FirstName, s.LastName, s.Email ?? string.Empty))
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<StudentModule>> GetMyModulesAsync(Guid studentId, CancellationToken cancellationToken = default)
    {
        return await _db.StudentModules
            .AsNoTracking()
            .Include(m => m.Topics).ThenInclude(t => t.Documents)
            .Include(m => m.Topics).ThenInclude(t => t.Attendances)
            .Include(m => m.Assignments)
            .Where(m => m.Assignments.Any(a => a.StudentId == studentId))
            .OrderByDescending(m => m.CreatedAt)
            .ToListAsync(cancellationToken);
    }

    public async Task NotifyStudentsAsync(Guid moduleId, CancellationToken cancellationToken = default)
    {
        var module = await _db.StudentModules
            .Include(m => m.Assignments).ThenInclude(a => a.Student)
            .FirstOrDefaultAsync(m => m.Id == moduleId, cancellationToken)
            ?? throw new KeyNotFoundException("Moduli nuk u gjet.");

        foreach (var assignment in module.Assignments)
        {
            if (assignment.Student is null) continue;
            try
            {
                await _emailService.SendStudentModuleNotificationAsync(
                    assignment.Student, module.Title, module.YearGrade, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to send module notification to student {StudentId}", assignment.StudentId);
            }
        }
    }

    // ── Topic CRUD ──────────────────────────────────────────────────────────

    public async Task<StudentModuleTopic> AddTopicAsync(Guid moduleId, string name, string lecturer, DateTime? scheduledDate, string? location, CancellationToken cancellationToken = default)
    {
        var module = await _db.StudentModules
            .Include(m => m.Topics)
            .Include(m => m.Assignments).ThenInclude(a => a.Student)
            .FirstOrDefaultAsync(m => m.Id == moduleId, cancellationToken)
            ?? throw new KeyNotFoundException("Module not found.");

        var topic = new StudentModuleTopic(moduleId, name, lecturer, scheduledDate, location);
        _db.StudentModuleTopics.Add(topic);
        await _db.SaveChangesAsync(cancellationToken);

        // Notify all assigned students about new topic
        var dateInfo = scheduledDate.HasValue ? $" ({scheduledDate.Value:dd MMM yyyy})" : "";
        var changeDesc = $"Temë e re u shtua: {name}{dateInfo}, Lektor: {lecturer}";
        await NotifyAssignedStudentsOfChangeAsync(module, changeDesc, cancellationToken);

        return topic;
    }

    public async Task<StudentModuleTopic> UpdateTopicAsync(Guid topicId, string name, string lecturer, DateTime? scheduledDate, string? location, CancellationToken cancellationToken = default)
    {
        var topic = await _db.StudentModuleTopics
            .Include(t => t.StudentModule).ThenInclude(m => m.Topics)
            .Include(t => t.StudentModule).ThenInclude(m => m.Assignments).ThenInclude(a => a.Student)
            .FirstOrDefaultAsync(t => t.Id == topicId, cancellationToken)
            ?? throw new KeyNotFoundException("Topic not found.");

        // Track what changed for notification
        var changes = new List<string>();
        if (topic.ScheduledDate != scheduledDate)
        {
            var oldDate = topic.ScheduledDate?.ToString("dd MMM yyyy") ?? "-";
            var newDate = scheduledDate?.ToString("dd MMM yyyy") ?? "-";
            changes.Add($"Data u ndryshua: {oldDate} → {newDate}");
        }
        if (!string.Equals(topic.Location, location, StringComparison.OrdinalIgnoreCase))
        {
            changes.Add($"Vendndodhja u ndryshua: {topic.Location ?? "-"} → {location ?? "-"}");
        }
        if (!string.Equals(topic.Name, name, StringComparison.Ordinal))
            changes.Add($"Emri i temës u ndryshua: {topic.Name} → {name}");
        if (!string.Equals(topic.Lecturer, lecturer, StringComparison.Ordinal))
            changes.Add($"Lektori u ndryshua: {topic.Lecturer} → {lecturer}");

        topic.Update(name, lecturer, scheduledDate, location);
        await _db.SaveChangesAsync(cancellationToken);

        // Notify if anything changed
        if (changes.Count > 0)
        {
            var changeDesc = $"Tema \"{name}\": {string.Join("; ", changes)}";
            await NotifyAssignedStudentsOfChangeAsync(topic.StudentModule, changeDesc, cancellationToken);
        }

        return topic;
    }

    public async Task DeleteTopicAsync(Guid topicId, CancellationToken cancellationToken = default)
    {
        var topic = await _db.StudentModuleTopics.FindAsync([topicId], cancellationToken)
            ?? throw new KeyNotFoundException("Topic not found.");

        _db.StudentModuleTopics.Remove(topic);
        await _db.SaveChangesAsync(cancellationToken);
    }

    // ── Documents (per topic) ───────────────────────────────────────────────

    public async Task<StudentModuleDocument> AddDocumentAsync(Guid topicId, string fileName, string fileUrl, string relativePath, long sizeBytes, CancellationToken cancellationToken = default)
    {
        var topicExists = await _db.StudentModuleTopics.AnyAsync(t => t.Id == topicId, cancellationToken);
        if (!topicExists)
            throw new KeyNotFoundException("Topic not found.");

        var document = new StudentModuleDocument(topicId, fileName, fileUrl, relativePath, sizeBytes);
        _db.StudentModuleDocuments.Add(document);
        await _db.SaveChangesAsync(cancellationToken);
        return document;
    }

    public async Task RemoveDocumentAsync(Guid topicId, Guid documentId, CancellationToken cancellationToken = default)
    {
        var document = await _db.StudentModuleDocuments
            .FirstOrDefaultAsync(d => d.Id == documentId && d.StudentModuleTopicId == topicId, cancellationToken)
            ?? throw new KeyNotFoundException("Dokumenti nuk u gjet.");

        await _fileStorageService.DeleteByPublicUrlAsync(document.FileUrl, cancellationToken);
        _db.StudentModuleDocuments.Remove(document);
        await _db.SaveChangesAsync(cancellationToken);
    }

    // ── QR & Attendance (per topic) ─────────────────────────────────────────

    public async Task<string> GenerateTopicQrTokenAsync(Guid topicId, CancellationToken cancellationToken = default)
    {
        var topic = await _db.StudentModuleTopics.FindAsync([topicId], cancellationToken)
            ?? throw new KeyNotFoundException("Tema nuk u gjet.");

        var expiresAt = DateTime.UtcNow.AddHours(8);
        return CreateTopicQrToken(topicId, expiresAt);
    }

    public async Task<StudentModuleTopicAttendance> ScanTopicQrAsync(string qrToken, Guid studentId, CancellationToken cancellationToken = default)
    {
        var normalized = NormalizeQrTokenInput(qrToken);
        var payload = ParseTopicQrToken(normalized);

        var expiresAt = DateTimeOffset.FromUnixTimeSeconds(payload.ExpiresAtUnix);
        if (expiresAt < DateTimeOffset.UtcNow)
            throw new InvalidOperationException("Kodi QR ka skaduar.");

        // Find the topic and its parent module
        var topic = await _db.StudentModuleTopics
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == payload.TopicId, cancellationToken)
            ?? throw new InvalidOperationException("Tema nuk u gjet.");

        // Only allow attendance on the same day as the topic's scheduled date
        if (topic.ScheduledDate.HasValue)
        {
            var topicDate = topic.ScheduledDate.Value.Date;
            var todayDate = DateTime.UtcNow.Date;
            if (topicDate != todayDate)
                throw new InvalidOperationException("Prezenca mund të regjistrohet vetëm në ditën e temës.");
        }

        // Verify the student is assigned to this module
        var isAssigned = await _db.StudentModuleAssignments
            .AnyAsync(a => a.StudentModuleId == topic.StudentModuleId && a.StudentId == studentId, cancellationToken);

        if (!isAssigned)
            throw new InvalidOperationException("Nuk jeni i/e caktuar në këtë modul.");

        // Check if already attended this topic
        var alreadyAttended = await _db.StudentModuleTopicAttendances
            .AnyAsync(a => a.TopicId == payload.TopicId && a.StudentId == studentId, cancellationToken);

        if (alreadyAttended)
            throw new InvalidOperationException("Prezenca për këtë temë është regjistruar tashmë.");

        var attendance = new StudentModuleTopicAttendance(payload.TopicId, studentId);
        _db.StudentModuleTopicAttendances.Add(attendance);
        await _db.SaveChangesAsync(cancellationToken);
        return attendance;
    }

    public async Task<StudentModuleTopicAttendance> MarkTopicAttendanceAsync(Guid topicId, Guid studentId, CancellationToken cancellationToken = default)
    {
        var topic = await _db.StudentModuleTopics
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == topicId, cancellationToken)
            ?? throw new KeyNotFoundException("Tema nuk u gjet.");

        var isAssigned = await _db.StudentModuleAssignments
            .AnyAsync(a => a.StudentModuleId == topic.StudentModuleId && a.StudentId == studentId, cancellationToken);
        if (!isAssigned)
            throw new InvalidOperationException("Studenti nuk është i caktuar në këtë modul.");

        var existing = await _db.StudentModuleTopicAttendances
            .FirstOrDefaultAsync(a => a.TopicId == topicId && a.StudentId == studentId, cancellationToken);
        if (existing != null)
            return existing;

        var attendance = new StudentModuleTopicAttendance(topicId, studentId);
        _db.StudentModuleTopicAttendances.Add(attendance);
        await _db.SaveChangesAsync(cancellationToken);
        return attendance;
    }

    public async Task RemoveTopicAttendanceAsync(Guid topicId, Guid studentId, CancellationToken cancellationToken = default)
    {
        var attendance = await _db.StudentModuleTopicAttendances
            .FirstOrDefaultAsync(a => a.TopicId == topicId && a.StudentId == studentId, cancellationToken)
            ?? throw new KeyNotFoundException("Prezenca nuk u gjet.");

        _db.StudentModuleTopicAttendances.Remove(attendance);
        await _db.SaveChangesAsync(cancellationToken);
    }

    private sealed record TopicQrPayload(Guid TopicId, long ExpiresAtUnix);

    private string CreateTopicQrToken(Guid topicId, DateTime expiresAt)
    {
        var payload = new TopicQrPayload(topicId, new DateTimeOffset(expiresAt).ToUnixTimeSeconds());
        var payloadJson = JsonSerializer.Serialize(payload);
        var payloadSegment = Base64UrlEncode(Encoding.UTF8.GetBytes(payloadJson));

        using var hmac = new HMACSHA256(_qrSigningKey);
        var signatureBytes = hmac.ComputeHash(Encoding.UTF8.GetBytes(payloadSegment));
        var signatureSegment = Base64UrlEncode(signatureBytes);

        return $"{payloadSegment}.{signatureSegment}";
    }

    private TopicQrPayload ParseTopicQrToken(string token)
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
            var payload = JsonSerializer.Deserialize<TopicQrPayload>(payloadJson)
                ?? throw new InvalidOperationException("Kodi QR është i pavlefshëm.");

            if (payload.TopicId == Guid.Empty || payload.ExpiresAtUnix <= 0)
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

    // ── Student management (add/remove from existing modules) ──────────────

    public async Task AddStudentsToModuleAsync(Guid moduleId, List<Guid> studentIds, CancellationToken cancellationToken = default)
    {
        var module = await _db.StudentModules
            .Include(m => m.Assignments)
            .Include(m => m.Topics)
            .FirstOrDefaultAsync(m => m.Id == moduleId, cancellationToken)
            ?? throw new KeyNotFoundException("Module not found.");

        var existingStudentIds = module.Assignments.Select(a => a.StudentId).ToHashSet();
        var newStudentIds = studentIds.Where(id => !existingStudentIds.Contains(id)).ToList();

        if (newStudentIds.Count == 0) return;

        var students = await _db.Users
            .Where(u => newStudentIds.Contains(u.Id) && u.Role == "Student" && u.IsActive)
            .ToListAsync(cancellationToken);

        foreach (var student in students)
        {
            _db.StudentModuleAssignments.Add(new StudentModuleAssignment(moduleId, student.Id));
        }

        await _db.SaveChangesAsync(cancellationToken);

        // Notify added students
        var topicNames = module.Topics.Select(t => t.Name).ToList();
        foreach (var student in students)
        {
            try
            {
                await _emailService.SendStudentAddedToModuleAsync(
                    student, module.Title, module.YearGrade, module.Location, topicNames, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to send add-to-module notification to student {StudentId}", student.Id);
            }
        }
    }

    public async Task RemoveStudentFromModuleAsync(Guid moduleId, Guid studentId, CancellationToken cancellationToken = default)
    {
        var module = await _db.StudentModules
            .AsNoTracking()
            .FirstOrDefaultAsync(m => m.Id == moduleId, cancellationToken)
            ?? throw new KeyNotFoundException("Module not found.");

        var assignment = await _db.StudentModuleAssignments
            .FirstOrDefaultAsync(a => a.StudentModuleId == moduleId && a.StudentId == studentId, cancellationToken)
            ?? throw new KeyNotFoundException("Student is not assigned to this module.");

        // Also remove any topic attendances for this student in this module
        var topicIds = await _db.StudentModuleTopics
            .Where(t => t.StudentModuleId == moduleId)
            .Select(t => t.Id)
            .ToListAsync(cancellationToken);

        if (topicIds.Count > 0)
        {
            var attendances = await _db.StudentModuleTopicAttendances
                .Where(a => topicIds.Contains(a.TopicId) && a.StudentId == studentId)
                .ToListAsync(cancellationToken);

            _db.StudentModuleTopicAttendances.RemoveRange(attendances);
        }

        _db.StudentModuleAssignments.Remove(assignment);
        await _db.SaveChangesAsync(cancellationToken);

        // Notify removed student
        var student = await _db.Users.FindAsync([studentId], cancellationToken);
        if (student is not null)
        {
            try
            {
                await _emailService.SendStudentRemovedFromModuleAsync(student, module.Title, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to send remove-from-module notification to student {StudentId}", studentId);
            }
        }
    }

    // ── Notification helper ──────────────────────────────────────────────────

    private async Task NotifyAssignedStudentsOfChangeAsync(StudentModule module, string changeDescription, CancellationToken cancellationToken)
    {
        var assignments = module.Assignments;
        foreach (var assignment in assignments)
        {
            if (assignment.Student is null) continue;
            try
            {
                await _emailService.SendStudentModuleUpdateAsync(
                    assignment.Student, module.Title, changeDescription, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to send module update notification to student {StudentId}", assignment.StudentId);
            }
        }
    }

    // ── Results ──────────────────────────────────────────────────────────────

    public async Task SetStudentResultAsync(Guid moduleId, Guid studentId, string result, string? note, CancellationToken cancellationToken = default)
    {
        var module = await _db.StudentModules
            .AsNoTracking()
            .FirstOrDefaultAsync(m => m.Id == moduleId, cancellationToken)
            ?? throw new KeyNotFoundException("Module not found.");

        var assignment = await _db.StudentModuleAssignments
            .Include(a => a.Student)
            .FirstOrDefaultAsync(a => a.StudentModuleId == moduleId && a.StudentId == studentId, cancellationToken)
            ?? throw new KeyNotFoundException("Student is not assigned to this module.");

        assignment.SetResult(result, note);
        await _db.SaveChangesAsync(cancellationToken);

        if (assignment.Student is not null)
        {
            try
            {
                await _emailService.SendStudentModuleResultAsync(
                    assignment.Student, module.Title, result, note, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to send result notification to student {StudentId}", studentId);
            }
        }
    }

    public async Task SetBulkResultsAsync(Guid moduleId, List<StudentResultInput> results, CancellationToken cancellationToken = default)
    {
        var module = await _db.StudentModules
            .AsNoTracking()
            .FirstOrDefaultAsync(m => m.Id == moduleId, cancellationToken)
            ?? throw new KeyNotFoundException("Module not found.");

        var studentIds = results.Select(r => r.StudentId).ToList();
        var assignments = await _db.StudentModuleAssignments
            .Include(a => a.Student)
            .Where(a => a.StudentModuleId == moduleId && studentIds.Contains(a.StudentId))
            .ToListAsync(cancellationToken);

        var assignmentMap = assignments.ToDictionary(a => a.StudentId);

        foreach (var r in results)
        {
            if (!assignmentMap.TryGetValue(r.StudentId, out var assignment)) continue;
            assignment.SetResult(r.Result, r.Note);
        }

        await _db.SaveChangesAsync(cancellationToken);

        // Notify all students
        foreach (var r in results)
        {
            if (!assignmentMap.TryGetValue(r.StudentId, out var assignment)) continue;
            if (assignment.Student is null) continue;
            try
            {
                await _emailService.SendStudentModuleResultAsync(
                    assignment.Student, module.Title, r.Result, r.Note, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to send result notification to student {StudentId}", r.StudentId);
            }
        }
    }

    // ── Questionnaires ────────────────────────────────────────────────────────

    public async Task<TopicQuestionnaire> CreateQuestionnaireAsync(Guid topicId, string title, List<QuestionnaireQuestionInput> questions, CancellationToken cancellationToken = default)
    {
        var topicExists = await _db.StudentModuleTopics.AnyAsync(t => t.Id == topicId, cancellationToken);
        if (!topicExists)
            throw new KeyNotFoundException("Topic not found.");

        var questionnaire = new TopicQuestionnaire(topicId, title);
        _db.TopicQuestionnaires.Add(questionnaire);

        foreach (var q in questions)
        {
            string? optionsJson = null;
            if (q.Type == QuestionType.Options && q.Options is { Count: > 0 })
                optionsJson = System.Text.Json.JsonSerializer.Serialize(q.Options);

            var question = new TopicQuestionnaireQuestion(questionnaire.Id, q.Text, q.Type, q.Order, optionsJson);
            _db.TopicQuestionnaireQuestions.Add(question);
        }

        await _db.SaveChangesAsync(cancellationToken);
        return questionnaire;
    }

    public async Task DeleteQuestionnaireAsync(Guid questionnaireId, CancellationToken cancellationToken = default)
    {
        var questionnaire = await _db.TopicQuestionnaires.FindAsync([questionnaireId], cancellationToken)
            ?? throw new KeyNotFoundException("Questionnaire not found.");

        _db.TopicQuestionnaires.Remove(questionnaire);
        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task<TopicQuestionnaire> UpdateQuestionnaireAsync(Guid questionnaireId, string title, List<QuestionnaireQuestionInput> questions, CancellationToken cancellationToken = default)
    {
        var questionnaire = await _db.TopicQuestionnaires
            .Include(q => q.Questions)
            .FirstOrDefaultAsync(q => q.Id == questionnaireId, cancellationToken)
            ?? throw new KeyNotFoundException("Questionnaire not found.");

        questionnaire.UpdateTitle(title);

        // Remove old questions
        _db.TopicQuestionnaireQuestions.RemoveRange(questionnaire.Questions);

        // Add new questions
        foreach (var q in questions)
        {
            string? optionsJson = null;
            if (q.Type == QuestionType.Options && q.Options is { Count: > 0 })
                optionsJson = System.Text.Json.JsonSerializer.Serialize(q.Options);

            var question = new TopicQuestionnaireQuestion(questionnaire.Id, q.Text, q.Type, q.Order, optionsJson);
            _db.TopicQuestionnaireQuestions.Add(question);
        }

        await _db.SaveChangesAsync(cancellationToken);
        return questionnaire;
    }

    public async Task<TopicQuestionnaire?> GetQuestionnaireAsync(Guid questionnaireId, CancellationToken cancellationToken = default)
    {
        return await _db.TopicQuestionnaires
            .AsNoTracking()
            .Include(q => q.Questions.OrderBy(x => x.Order))
            .Include(q => q.Responses).ThenInclude(r => r.Student)
            .Include(q => q.Responses).ThenInclude(r => r.Answers)
            .FirstOrDefaultAsync(q => q.Id == questionnaireId, cancellationToken);
    }

    public async Task<TopicQuestionnaire?> GetQuestionnaireByTopicAsync(Guid topicId, CancellationToken cancellationToken = default)
    {
        return await _db.TopicQuestionnaires
            .AsNoTracking()
            .Include(q => q.Questions.OrderBy(x => x.Order))
            .Include(q => q.Responses)
            .FirstOrDefaultAsync(q => q.TopicId == topicId, cancellationToken);
    }

    public async Task<string> GenerateQuestionnaireQrTokenAsync(Guid questionnaireId, CancellationToken cancellationToken = default)
    {
        var exists = await _db.TopicQuestionnaires.AnyAsync(q => q.Id == questionnaireId, cancellationToken);
        if (!exists)
            throw new KeyNotFoundException("Pyetësori nuk u gjet.");

        var expiresAt = DateTime.UtcNow.AddDays(30); // questionnaire QR lasts longer
        return CreateQuestionnaireQrToken(questionnaireId, expiresAt);
    }

    public async Task<TopicQuestionnaireResponse> SubmitQuestionnaireAsync(string qrToken, Guid studentId, List<QuestionnaireAnswerInput> answers, CancellationToken cancellationToken = default)
    {
        var normalized = NormalizeQrTokenInput(qrToken);
        var payload = ParseQuestionnaireQrToken(normalized);

        var expiresAt = DateTimeOffset.FromUnixTimeSeconds(payload.ExpiresAtUnix);
        if (expiresAt < DateTimeOffset.UtcNow)
            throw new InvalidOperationException("Kodi QR ka skaduar.");

        var questionnaire = await _db.TopicQuestionnaires
            .Include(q => q.Questions)
            .Include(q => q.Topic)
            .FirstOrDefaultAsync(q => q.Id == payload.QuestionnaireId, cancellationToken)
            ?? throw new InvalidOperationException("Pyetësori nuk u gjet.");

        // Verify the student is assigned to the parent module
        var isAssigned = await _db.StudentModuleAssignments
            .AnyAsync(a => a.StudentModuleId == questionnaire.Topic.StudentModuleId && a.StudentId == studentId, cancellationToken);
        if (!isAssigned)
            throw new InvalidOperationException("Nuk jeni i/e caktuar në këtë modul.");

        // Check if already answered
        var alreadyAnswered = await _db.TopicQuestionnaireResponses
            .AnyAsync(r => r.QuestionnaireId == payload.QuestionnaireId && r.StudentId == studentId, cancellationToken);
        if (alreadyAnswered)
            throw new InvalidOperationException("Keni plotësuar tashmë këtë pyetësor.");

        var response = new TopicQuestionnaireResponse(payload.QuestionnaireId, studentId);
        _db.TopicQuestionnaireResponses.Add(response);

        var questionIds = questionnaire.Questions.Select(q => q.Id).ToHashSet();
        foreach (var a in answers)
        {
            if (!questionIds.Contains(a.QuestionId)) continue;
            var answer = new TopicQuestionnaireAnswer(response.Id, a.QuestionId, a.Answer);
            _db.TopicQuestionnaireAnswers.Add(answer);
        }

        await _db.SaveChangesAsync(cancellationToken);
        return response;
    }

    public async Task<IReadOnlyList<TopicQuestionnaireResponse>> GetQuestionnaireResponsesAsync(Guid questionnaireId, CancellationToken cancellationToken = default)
    {
        return await _db.TopicQuestionnaireResponses
            .AsNoTracking()
            .Include(r => r.Student)
            .Include(r => r.Answers).ThenInclude(a => a.Question)
            .Where(r => r.QuestionnaireId == questionnaireId)
            .OrderBy(r => r.SubmittedAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<TopicQuestionnaireResponse>> GetMyQuestionnaireResponsesAsync(Guid studentId, CancellationToken cancellationToken = default)
    {
        return await _db.TopicQuestionnaireResponses
            .AsNoTracking()
            .Include(r => r.Questionnaire).ThenInclude(q => q.Topic).ThenInclude(t => t.StudentModule)
            .Include(r => r.Questionnaire).ThenInclude(q => q.Questions)
            .Include(r => r.Answers).ThenInclude(a => a.Question)
            .Where(r => r.StudentId == studentId)
            .OrderByDescending(r => r.SubmittedAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<(TopicQuestionnaire Questionnaire, bool AlreadyAnswered)> GetQuestionnaireByQrTokenAsync(string qrToken, Guid studentId, CancellationToken cancellationToken = default)
    {
        var normalized = NormalizeQrTokenInput(qrToken);
        var payload = ParseQuestionnaireQrToken(normalized);

        var expiresAt = DateTimeOffset.FromUnixTimeSeconds(payload.ExpiresAtUnix);
        if (expiresAt < DateTimeOffset.UtcNow)
            throw new InvalidOperationException("Kodi QR ka skaduar.");

        var questionnaire = await _db.TopicQuestionnaires
            .AsNoTracking()
            .Include(q => q.Questions.OrderBy(x => x.Order))
            .Include(q => q.Topic)
            .FirstOrDefaultAsync(q => q.Id == payload.QuestionnaireId, cancellationToken)
            ?? throw new InvalidOperationException("Pyetësori nuk u gjet.");

        var isAssigned = await _db.StudentModuleAssignments
            .AnyAsync(a => a.StudentModuleId == questionnaire.Topic.StudentModuleId && a.StudentId == studentId, cancellationToken);
        if (!isAssigned)
            throw new InvalidOperationException("Nuk jeni i/e caktuar në këtë modul.");

        var alreadyAnswered = await _db.TopicQuestionnaireResponses
            .AnyAsync(r => r.QuestionnaireId == payload.QuestionnaireId && r.StudentId == studentId, cancellationToken);

        return (questionnaire, alreadyAnswered);
    }

    // --- Questionnaire QR Token Helpers ---

    private sealed record QuestionnaireQrPayload(Guid QuestionnaireId, long ExpiresAtUnix);

    private string CreateQuestionnaireQrToken(Guid questionnaireId, DateTime expiresAt)
    {
        var payload = new QuestionnaireQrPayload(questionnaireId, new DateTimeOffset(expiresAt).ToUnixTimeSeconds());
        var payloadJson = JsonSerializer.Serialize(payload);
        var payloadSegment = Base64UrlEncode(Encoding.UTF8.GetBytes(payloadJson));

        using var hmac = new HMACSHA256(_qrSigningKey);
        var signatureBytes = hmac.ComputeHash(Encoding.UTF8.GetBytes(payloadSegment));
        var signatureSegment = Base64UrlEncode(signatureBytes);

        return $"{payloadSegment}.{signatureSegment}";
    }

    private QuestionnaireQrPayload ParseQuestionnaireQrToken(string token)
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
            var payload = JsonSerializer.Deserialize<QuestionnaireQrPayload>(payloadJson)
                ?? throw new InvalidOperationException("Kodi QR është i pavlefshëm.");

            if (payload.QuestionnaireId == Guid.Empty || payload.ExpiresAtUnix <= 0)
                throw new InvalidOperationException("Kodi QR është i pavlefshëm.");

            return payload;
        }
        catch (InvalidOperationException) { throw; }
        catch { throw new InvalidOperationException("Kodi QR është i pavlefshëm."); }
    }

    // --- Year Grade Filtering ---

    private async Task<List<AppUser>> GetActiveStudentsByYearGradeAsync(int yearGrade, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;

        // Load active students with a start year, then filter by year-grade in memory
        // because EF Core cannot translate new DateTime(...) to SQL.
        var students = await _db.Users
            .AsNoTracking()
            .Where(u => u.Role == "Student" && u.IsActive && u.StudentStartYear != null)
            .ToListAsync(cancellationToken);

        return students.Where(u => GetStudentCurrentYearGrade(u, now) == yearGrade).ToList();
    }

    /// <summary>
    /// Returns the current year grade (1, 2, or 3) for a student based on Jan-Dec calendar periods, or 0 if not in any active period.
    /// </summary>
    private static int GetStudentCurrentYearGrade(AppUser student, DateTime now)
    {
        if (student.StudentStartYear is null) return 0;

        var y1 = student.StudentStartYear.Value;
        var y2 = student.StudentYear2StartYear ?? y1 + 1;
        var y3 = student.StudentYear3StartYear ?? y2 + 1;

        // Year 1: Jan 1 of y1 to Dec 31 of y1
        if (now >= new DateTime(y1, 1, 1) && now < new DateTime(y2, 1, 1))
            return 1;

        // Year 2: Jan 1 of y2 to Dec 31 of y2
        if (now >= new DateTime(y2, 1, 1) && now < new DateTime(y3, 1, 1))
            return 2;

        // Year 3: Jan 1 of y3 to Dec 31 of y3
        if (now >= new DateTime(y3, 1, 1) && now < new DateTime(y3 + 1, 1, 1))
            return 3;

        return 0;
    }

    public async Task AutoAssignStudentToModulesAsync(Guid studentId, CancellationToken cancellationToken = default)
    {
        var student = await _db.Users
            .FirstOrDefaultAsync(u => u.Id == studentId && u.Role == "Student" && u.IsActive, cancellationToken);
        if (student?.StudentStartYear is null) return;

        var yearGrade = GetStudentCurrentYearGrade(student, DateTime.UtcNow);
        if (yearGrade == 0) return;

        // Find all modules for this year grade that have upcoming topics
        var modules = await _db.StudentModules
            .Include(m => m.Assignments)
            .Include(m => m.Topics)
            .Where(m => m.YearGrade == yearGrade)
            .ToListAsync(cancellationToken);

        var now = DateTime.UtcNow;
        var assigned = new List<StudentModule>();

        foreach (var module in modules)
        {
            // Skip if already assigned
            if (module.Assignments.Any(a => a.StudentId == studentId)) continue;

            // Only auto-assign to modules that have at least one upcoming topic
            var hasUpcoming = module.Topics.Any(t => t.ScheduledDate.HasValue && t.ScheduledDate.Value > now);
            if (!hasUpcoming) continue;

            _db.StudentModuleAssignments.Add(new StudentModuleAssignment(module.Id, studentId));
            assigned.Add(module);
        }

        if (assigned.Count > 0)
        {
            await _db.SaveChangesAsync(cancellationToken);

            // Notify student about each assigned module
            foreach (var module in assigned)
            {
                try
                {
                    var topicNames = module.Topics.Select(t => t.Name).ToList();
                    await _emailService.SendStudentAddedToModuleAsync(
                        student, module.Title, module.YearGrade, module.Location, topicNames, cancellationToken);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to send auto-assign notification for module {ModuleId} to student {StudentId}", module.Id, studentId);
                }
            }
        }
    }
}
