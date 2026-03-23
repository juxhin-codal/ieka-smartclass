using Microsoft.AspNetCore.Http;

namespace IekaSmartClass.Api.Services.Interface;

public interface IFileStorageService
{
    Task<StoredFileResult> SaveAsync(
        IFormFile file,
        string scope,
        Guid ownerId,
        string? preferredFileName = null,
        IReadOnlyList<string>? subFolders = null,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<StoredFileResult>> ListAsync(
        string scope,
        Guid ownerId,
        IReadOnlyList<string>? subFolders = null,
        CancellationToken cancellationToken = default);

    Task<bool> DeleteForOwnerAsync(
        string scope,
        Guid ownerId,
        string relativePath,
        IReadOnlyList<string>? subFolders = null,
        CancellationToken cancellationToken = default);

    Task<bool> DeleteByPublicUrlAsync(string? publicUrl, CancellationToken cancellationToken = default);

    Task<ResolvedStoredFile?> ResolveAsync(string relativePath, CancellationToken cancellationToken = default);
}

public sealed record StoredFileResult(
    string FileName,
    string PublicUrl,
    string RelativePath,
    long SizeBytes,
    string ContentType,
    DateTime UploadedAtUtc);

public sealed record ResolvedStoredFile(
    Stream ContentStream,
    string RelativePath,
    string FileName,
    string ContentType,
    long SizeBytes);
