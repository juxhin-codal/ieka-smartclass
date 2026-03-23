using IekaSmartClass.Api.Data.Entities;
using Microsoft.AspNetCore.Http;

namespace IekaSmartClass.Api.Services.Interface;

public interface IStazhService
{
    Task<IReadOnlyList<Stazh>> GetAllStazhetAsync();
    Task<Stazh?> GetStazhByIdAsync(Guid id);
    Task<IReadOnlyList<Stazh>> GetStazhetByMentorAsync(Guid mentorId);
    Task<IReadOnlyList<Stazh>> GetStazhetByStudentAsync(Guid studentId);
    Task<Guid> CreateStazhAsync(Guid mentorId, Guid studentId, string title, DateTime startDate, DateTime endDate, List<(DateTime Date, string Time, string? Notes)>? dates = null);
    Task AddDocumentFileAsync(Guid stazhId, IFormFile file, string? fileName, string? description, CancellationToken cancellationToken = default);
    Task AddDocumentAsync(Guid stazhId, string fileName, string fileUrl, string? description);
    Task<bool> DeleteDocumentAsync(Guid stazhId, Guid documentId, Guid actorUserId, string actorRole, CancellationToken cancellationToken = default);
    Task CompleteStazhAsync(Guid stazhId, string? feedback);
    Task CancelStazhAsync(Guid stazhId);
    Task SetFeedbackAsync(Guid stazhId, string feedback);
}
