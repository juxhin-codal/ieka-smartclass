using IekaSmartClass.Api.Data.Entities;

namespace IekaSmartClass.Api.Services.Interface;

public interface IStudentModuleService
{
    Task<IReadOnlyList<StudentModule>> GetModulesAsync(CancellationToken cancellationToken = default);
    Task<StudentModule?> GetModuleByIdAsync(Guid moduleId, CancellationToken cancellationToken = default);
    Task<StudentModule> CreateModuleAsync(CreateStudentModuleInput input, Guid actorUserId, CancellationToken cancellationToken = default);
    Task<StudentModuleDocument> AddDocumentAsync(Guid moduleId, string fileName, string fileUrl, string relativePath, long sizeBytes, CancellationToken cancellationToken = default);
    Task DeleteModuleAsync(Guid moduleId, Guid actorUserId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<StudentModuleStudentItem>> GetStudentsByYearGradeAsync(int yearGrade, CancellationToken cancellationToken = default);
}

public sealed record CreateStudentModuleInput(
    int YearGrade,
    string Topic,
    string Lecturer);

public sealed record StudentModuleStudentItem(
    Guid StudentId,
    string FirstName,
    string LastName,
    string Email);
