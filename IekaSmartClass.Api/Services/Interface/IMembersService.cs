using IekaSmartClass.Api.Data.Entities;
using IekaSmartClass.Api.Utilities.Pagination;

namespace IekaSmartClass.Api.Services.Interface;

public interface IMembersService
{
    Task<PaginatedList<AppUser>> GetMembersAsync(string? search, int pageNumber, int pageSize);
    Task<AppUser?> GetMemberByIdAsync(Guid id);
    Task<StudentTrackingPreview> GetNextStudentTrackingPreviewAsync(CancellationToken cancellationToken = default);
    Task<Guid> AddMemberAsync(
        string firstName,
        string lastName,
        string email,
        string? email2,
        string registryNumber,
        string role,
        int cpdHoursRequired,
        string? phone,
        bool isActive = true,
        Guid? mentorId = null,
        string? validUntilMonth = null,
        int? studentTrackingNumber = null,
        string? studentNumber = null,
        int? studentStartYear = null,
        int? studentEndYear = null,
        string? company = null,
        string? district = null);
    Task AddMembersBulkAsync(IEnumerable<AppUser> members);
    Task UpdateMemberAsync(
        Guid id,
        string firstName,
        string lastName,
        string email,
        string? email2,
        string registryNumber,
        string? phone,
        string role,
        int cpdHoursRequired,
        bool isActive,
        Guid? mentorId = null,
        string? validUntilMonth = null,
        int? studentTrackingNumber = null,
        string? studentNumber = null,
        int? studentStartYear = null,
        int? studentEndYear = null,
        string? company = null,
        string? district = null);
    Task SendPasswordResetEmailAsync(Guid id, CancellationToken cancellationToken = default);
    Task UpdateMemberCpdAsync(Guid id, int addHours);
    Task DeactivateMemberAsync(Guid id);
    Task DeleteMemberAsync(Guid id, Guid? actorUserId = null);
    Task SetYearlyPaymentStatusAsync(Guid id, bool isPaid, int year);
}

public sealed record StudentTrackingPreview(int TrackingNumber, string StudentNumber);
