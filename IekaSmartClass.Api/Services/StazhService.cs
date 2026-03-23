using IekaSmartClass.Api.Data;
using IekaSmartClass.Api.Data.Entities;
using IekaSmartClass.Api.Data.Repositories.Interface;
using IekaSmartClass.Api.Services.Interface;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace IekaSmartClass.Api.Services;

public class StazhService(
    IRepository<Stazh> stazhRepository,
    IFileStorageService fileStorageService,
    IApplicationDbContext dbContext) : IStazhService
{
    private const string MentorUploaderTag = "[uploader:mentor]";
    private const string StudentUploaderTag = "[uploader:student]";

    private readonly IRepository<Stazh> _stazhRepository = stazhRepository;
    private readonly IFileStorageService _fileStorageService = fileStorageService;
    private readonly IApplicationDbContext _dbContext = dbContext;

    public async Task<IReadOnlyList<Stazh>> GetAllStazhetAsync()
    {
        return await _stazhRepository.Query()
            .Include(s => s.Mentor)
            .Include(s => s.Student)
            .Include(s => s.Dates)
            .Include(s => s.Documents)
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync();
    }

    public async Task<Stazh?> GetStazhByIdAsync(Guid id)
    {
        return await _stazhRepository.Query()
            .Include(s => s.Mentor)
            .Include(s => s.Student)
            .Include(s => s.Dates)
            .Include(s => s.Documents)
            .FirstOrDefaultAsync(s => s.Id == id);
    }

    public async Task<IReadOnlyList<Stazh>> GetStazhetByMentorAsync(Guid mentorId)
    {
        await EnsureDocumentStazhetForMentorAsync(mentorId);

        return await _stazhRepository.Query()
            .Include(s => s.Student)
            .Include(s => s.Dates)
            .Include(s => s.Documents)
            .Where(s => s.MentorId == mentorId)
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync();
    }

    public async Task<IReadOnlyList<Stazh>> GetStazhetByStudentAsync(Guid studentId)
    {
        await EnsureDocumentStazhetForStudentAsync(studentId);

        return await _stazhRepository.Query()
            .Include(s => s.Mentor)
            .Include(s => s.Dates)
            .Include(s => s.Documents)
            .Where(s => s.StudentId == studentId)
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync();
    }

    public async Task<Guid> CreateStazhAsync(Guid mentorId, Guid studentId, string title, DateTime startDate, DateTime endDate, List<(DateTime Date, string Time, string? Notes)>? dates = null)
    {
        var stazh = new Stazh(mentorId, studentId, title, startDate, endDate);

        if (dates != null)
        {
            foreach (var d in dates)
                stazh.AddDate(new StazhDate(d.Date, d.Time, d.Notes));
        }

        await _stazhRepository.AddAsync(stazh);
        await _dbContext.SaveChangesAsync();
        return stazh.Id;
    }

    public async Task AddDocumentFileAsync(Guid stazhId, IFormFile file, string? fileName, string? description, CancellationToken cancellationToken = default)
    {
        var stazh = await _stazhRepository.Query()
            .FirstOrDefaultAsync(s => s.Id == stazhId, cancellationToken) ?? throw new KeyNotFoundException("Stazh not found.");

        var stored = await _fileStorageService.SaveAsync(
            file,
            scope: "training",
            ownerId: stazhId,
            preferredFileName: fileName,
            subFolders:
            [
                "mentor",
                stazh.MentorId.ToString("D"),
                "student",
                stazh.StudentId.ToString("D")
            ],
            cancellationToken: cancellationToken);

        await _dbContext.StazhDocuments.AddAsync(
            new StazhDocument(stazhId, stored.FileName, stored.PublicUrl, description),
            cancellationToken);
        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task AddDocumentAsync(Guid stazhId, string fileName, string fileUrl, string? description)
    {
        var exists = await _stazhRepository.Query().AnyAsync(s => s.Id == stazhId);
        if (!exists)
            throw new KeyNotFoundException("Stazh not found.");

        await _dbContext.StazhDocuments.AddAsync(new StazhDocument(stazhId, fileName, fileUrl, description));
        await _dbContext.SaveChangesAsync();
    }

    public async Task<bool> DeleteDocumentAsync(
        Guid stazhId,
        Guid documentId,
        Guid actorUserId,
        string actorRole,
        CancellationToken cancellationToken = default)
    {
        var documentEntry = await _dbContext.StazhDocuments
            .Where(x => x.Id == documentId && x.StazhId == stazhId)
            .Join(
                _dbContext.Stazhet,
                document => document.StazhId,
                stazh => stazh.Id,
                (document, stazh) => new
                {
                    Document = document,
                    stazh.MentorId,
                    stazh.StudentId
                })
            .FirstOrDefaultAsync(cancellationToken);

        if (documentEntry is null)
        {
            return false;
        }

        if (!string.Equals(actorRole, "Admin", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(actorRole, "Mentor", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(actorRole, "Student", StringComparison.OrdinalIgnoreCase))
        {
            throw new UnauthorizedAccessException();
        }

        if (string.Equals(actorRole, "Mentor", StringComparison.OrdinalIgnoreCase)
            && documentEntry.MentorId != actorUserId)
        {
            throw new UnauthorizedAccessException();
        }

        if (string.Equals(actorRole, "Student", StringComparison.OrdinalIgnoreCase))
        {
            if (documentEntry.StudentId != actorUserId)
            {
                throw new UnauthorizedAccessException();
            }

            if (!string.Equals(ParseDocumentOrigin(documentEntry.Document.Description), "student", StringComparison.Ordinal))
            {
                throw new InvalidOperationException("Mund të fshini vetëm dokumentet që i keni ngarkuar vetë.");
            }
        }

        _dbContext.StazhDocuments.Remove(documentEntry.Document);
        await _dbContext.SaveChangesAsync(cancellationToken);
        await _fileStorageService.DeleteByPublicUrlAsync(documentEntry.Document.FileUrl, cancellationToken);

        return true;
    }

    public async Task CompleteStazhAsync(Guid stazhId, string? feedback)
    {
        var stazh = await _stazhRepository.GetByIdAsync(stazhId) ?? throw new KeyNotFoundException("Stazh not found.");
        stazh.Complete(feedback);
        await _dbContext.SaveChangesAsync();
    }

    public async Task CancelStazhAsync(Guid stazhId)
    {
        var stazh = await _stazhRepository.GetByIdAsync(stazhId) ?? throw new KeyNotFoundException("Stazh not found.");
        stazh.Cancel();
        await _dbContext.SaveChangesAsync();
    }

    public async Task SetFeedbackAsync(Guid stazhId, string feedback)
    {
        var stazh = await _stazhRepository.GetByIdAsync(stazhId) ?? throw new KeyNotFoundException("Stazh not found.");
        stazh.SetFeedback(feedback);
        await _dbContext.SaveChangesAsync();
    }

    private async Task EnsureDocumentStazhetForMentorAsync(Guid mentorId, CancellationToken cancellationToken = default)
    {
        var assignedStudents = await _dbContext.Users
            .Where(x => x.Role == "Student" && x.MentorId == mentorId)
            .Select(x => new DocumentStazhSeed(
                x.Id,
                x.FirstName,
                x.LastName,
                x.StudentStartYear,
                x.StudentEndYear,
                x.StudentValidUntilUtc))
            .ToListAsync(cancellationToken);

        await EnsureDocumentStazhetForPairsAsync(mentorId, assignedStudents, cancellationToken);
    }

    private async Task EnsureDocumentStazhetForStudentAsync(Guid studentId, CancellationToken cancellationToken = default)
    {
        var student = await _dbContext.Users
            .Where(x => x.Id == studentId && x.Role == "Student")
            .Select(x => new
            {
                x.Id,
                x.FirstName,
                x.LastName,
                x.MentorId,
                x.StudentStartYear,
                x.StudentEndYear,
                x.StudentValidUntilUtc
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (student?.MentorId is not Guid mentorId)
        {
            return;
        }

        await EnsureDocumentStazhetForPairsAsync(
            mentorId,
            [
                new DocumentStazhSeed(
                    student.Id,
                    student.FirstName,
                    student.LastName,
                    student.StudentStartYear,
                    student.StudentEndYear,
                    student.StudentValidUntilUtc)
            ],
            cancellationToken);
    }

    private async Task EnsureDocumentStazhetForPairsAsync(
        Guid mentorId,
        IReadOnlyList<DocumentStazhSeed> students,
        CancellationToken cancellationToken)
    {
        if (students.Count == 0)
        {
            return;
        }

        var studentIds = students.Select(x => x.StudentId).Distinct().ToList();
        var existingStudentIds = await _stazhRepository.Query()
            .Where(x => x.MentorId == mentorId && studentIds.Contains(x.StudentId))
            .Select(x => x.StudentId)
            .Distinct()
            .ToListAsync(cancellationToken);

        var missingStudents = students
            .Where(x => !existingStudentIds.Contains(x.StudentId))
            .ToList();

        if (missingStudents.Count == 0)
        {
            return;
        }

        var scheduleBounds = await _dbContext.StudentTrainingSessions
            .Where(x => x.MentorId == mentorId && studentIds.Contains(x.StudentId))
            .GroupBy(x => x.StudentId)
            .Select(g => new
            {
                StudentId = g.Key,
                StartDate = g.Min(x => x.ScheduledDate),
                EndDate = g.Max(x => x.ScheduledDate)
            })
            .ToDictionaryAsync(
                x => x.StudentId,
                x => (StartDate: x.StartDate.Date, EndDate: x.EndDate.Date),
                cancellationToken);

        foreach (var student in missingStudents)
        {
            var (startDate, endDate) = ResolveStazhDates(student, scheduleBounds);
            var title = $"Stazh - {student.FirstName} {student.LastName}".Trim();

            await _stazhRepository.AddAsync(new Stazh(
                mentorId,
                student.StudentId,
                title,
                startDate,
                endDate));
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private static (DateTime StartDate, DateTime EndDate) ResolveStazhDates(
        DocumentStazhSeed student,
        IReadOnlyDictionary<Guid, (DateTime StartDate, DateTime EndDate)> scheduleBounds)
    {
        if (scheduleBounds.TryGetValue(student.StudentId, out var bounds))
        {
            return NormalizeDateRange(bounds.StartDate, bounds.EndDate);
        }

        var fallbackStartDate = student.StudentStartYear.HasValue
            ? new DateTime(student.StudentStartYear.Value, 1, 1)
            : DateTime.UtcNow.Date;

        var fallbackEndDate = student.StudentEndYear.HasValue
            ? new DateTime(student.StudentEndYear.Value, 12, 31)
            : student.StudentValidUntilUtc?.Date ?? fallbackStartDate.AddYears(1);

        return NormalizeDateRange(fallbackStartDate, fallbackEndDate);
    }

    private static (DateTime StartDate, DateTime EndDate) NormalizeDateRange(DateTime startDate, DateTime endDate)
    {
        var normalizedStart = startDate.Date;
        var normalizedEnd = endDate.Date;
        if (normalizedEnd < normalizedStart)
        {
            normalizedEnd = normalizedStart;
        }

        return (normalizedStart, normalizedEnd);
    }

    private static string ParseDocumentOrigin(string? description)
    {
        var raw = (description ?? string.Empty).Trim();
        if (raw.StartsWith(StudentUploaderTag, StringComparison.OrdinalIgnoreCase))
        {
            return "student";
        }

        if (raw.StartsWith(MentorUploaderTag, StringComparison.OrdinalIgnoreCase))
        {
            return "mentor";
        }

        return "unknown";
    }

    private sealed record DocumentStazhSeed(
        Guid StudentId,
        string FirstName,
        string LastName,
        int? StudentStartYear,
        int? StudentEndYear,
        DateTime? StudentValidUntilUtc);
}
