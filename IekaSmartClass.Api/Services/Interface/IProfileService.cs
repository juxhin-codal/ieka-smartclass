using IekaSmartClass.Api.Data.Entities;

namespace IekaSmartClass.Api.Services.Interface;

public interface IProfileService
{
    Task<AppUser?> GetMyProfileAsync(Guid userId);
    Task UpdateMyProfileAsync(Guid userId, string firstName, string lastName, string email, string? phone);
    Task<UserDataExportFile> ExportMyDataAsync(Guid userId, CancellationToken cancellationToken = default);
}

public sealed record UserDataExportFile(string FileName, byte[] Content, string ContentType);
