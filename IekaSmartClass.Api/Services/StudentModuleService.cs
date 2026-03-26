using IekaSmartClass.Api.Data;
using IekaSmartClass.Api.Data.Entities;
using IekaSmartClass.Api.Services.Interface;
using Microsoft.EntityFrameworkCore;

namespace IekaSmartClass.Api.Services;

public class StudentModuleService(
    IApplicationDbContext db,
    IEmailService emailService,
    ILogger<StudentModuleService> logger) : IStudentModuleService
{
    private readonly IApplicationDbContext _db = db;
    private readonly IEmailService _emailService = emailService;
    private readonly ILogger<StudentModuleService> _logger = logger;

    public async Task<IReadOnlyList<StudentModule>> GetModulesAsync(CancellationToken cancellationToken = default)
    {
        return await _db.StudentModules
            .Include(m => m.Documents)
            .Include(m => m.Assignments)
            .Include(m => m.CreatedByUser)
            .OrderByDescending(m => m.CreatedAt)
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
        var module = new StudentModule(input.YearGrade, input.Topic, input.Lecturer, actorUserId);

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

    private async Task<List<AppUser>> GetActiveStudentsByYearGradeAsync(int yearGrade, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;

        // Get all active students
        var activeStudents = await _db.Users
            .Where(u => u.Role == "Student" && u.IsActive && u.StudentStartYear != null)
            .ToListAsync(cancellationToken);

        // Filter by computed year grade:
        // Year 1: Sep(startYear) to Sep(startYear+1)
        // Year 2: Sep(startYear+1) to Sep(startYear+2)
        // Year 3: Sep(startYear+2) to Sep(startYear+3)
        return activeStudents.Where(s =>
        {
            var startYear = s.StudentStartYear!.Value;
            var gradeStart = new DateTime(startYear + yearGrade - 1, 9, 1, 0, 0, 0, DateTimeKind.Utc);
            var gradeEnd = new DateTime(startYear + yearGrade, 9, 1, 0, 0, 0, DateTimeKind.Utc);
            return now >= gradeStart && now < gradeEnd;
        }).ToList();
    }
}
