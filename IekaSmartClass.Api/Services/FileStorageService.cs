using System.Text.RegularExpressions;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using IekaSmartClass.Api.Services.Interface;
using IekaSmartClass.Api.Utilities.Settings;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.Options;

namespace IekaSmartClass.Api.Services;

public class FileStorageService(
    IWebHostEnvironment environment,
    IOptions<StorageSettings> storageOptions) : IFileStorageService
{
    private static readonly Regex UnsafePathCharsRegex = new(@"[^a-zA-Z0-9\-_\.]", RegexOptions.Compiled);
    private static readonly FileExtensionContentTypeProvider ContentTypeProvider = new();
    private readonly IWebHostEnvironment _environment = environment;
    private readonly StorageSettings _storage = storageOptions.Value;
    private BlobContainerClient? _blobContainerClient;

    public async Task<StoredFileResult> SaveAsync(
        IFormFile file,
        string scope,
        Guid ownerId,
        string? preferredFileName = null,
        IReadOnlyList<string>? subFolders = null,
        CancellationToken cancellationToken = default)
    {
        if (file is null || file.Length == 0)
            throw new InvalidOperationException("No file was uploaded.");

        if (file.Length > _storage.MaxFileSizeBytes)
            throw new InvalidOperationException($"File exceeds max size {_storage.MaxFileSizeBytes} bytes.");

        var extension = Path.GetExtension(file.FileName)?.ToLowerInvariant() ?? string.Empty;
        if (!string.IsNullOrWhiteSpace(extension) &&
            _storage.AllowedExtensions is { Length: > 0 } &&
            !_storage.AllowedExtensions.Contains(extension, StringComparer.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException($"File extension '{extension}' is not allowed.");
        }

        var uploadedAtUtc = DateTime.UtcNow;
        var ownerRelativeRoot = BuildOwnerRelativeRoot(scope, ownerId, subFolders);
        var safeDisplayName = SanitizeDisplayFileName(preferredFileName, file.FileName, extension);
        var storedObjectName = BuildStoredObjectName(safeDisplayName, extension, uploadedAtUtc);
        var relativePath = CombineRelativePaths(
            ownerRelativeRoot,
            uploadedAtUtc.ToString("yyyy"),
            uploadedAtUtc.ToString("MM"),
            storedObjectName);

        var contentType = ResolveContentType(safeDisplayName, file.ContentType);

        if (_storage.UseBlobStorage)
        {
            var container = GetBlobContainerClient();
            await container.CreateIfNotExistsAsync(cancellationToken: cancellationToken);

            var blobClient = container.GetBlobClient(relativePath);
            await using var uploadStream = file.OpenReadStream();
            await blobClient.UploadAsync(
                uploadStream,
                new BlobUploadOptions
                {
                    HttpHeaders = new BlobHttpHeaders
                    {
                        ContentType = contentType,
                        ContentDisposition = $"attachment; filename=\"{safeDisplayName}\""
                    }
                },
                cancellationToken);
        }
        else
        {
            var absolutePath = Path.Combine(GetStorageRootPath(), relativePath);
            var absoluteDirectory = Path.GetDirectoryName(absolutePath)
                ?? throw new InvalidOperationException("Unable to resolve storage directory.");

            Directory.CreateDirectory(absoluteDirectory);
            await using var stream = new FileStream(absolutePath, FileMode.CreateNew, FileAccess.Write, FileShare.None);
            await file.CopyToAsync(stream, cancellationToken);
        }

        return new StoredFileResult(
            safeDisplayName,
            BuildPublicUrl(relativePath),
            relativePath,
            file.Length,
            contentType,
            uploadedAtUtc);
    }

    public async Task<IReadOnlyList<StoredFileResult>> ListAsync(
        string scope,
        Guid ownerId,
        IReadOnlyList<string>? subFolders = null,
        CancellationToken cancellationToken = default)
    {
        var ownerRelativeRoot = BuildOwnerRelativeRoot(scope, ownerId, subFolders);

        if (_storage.UseBlobStorage)
        {
            var results = new List<StoredFileResult>();
            var prefix = $"{ownerRelativeRoot.TrimEnd('/')}/";
            await foreach (var blobItem in GetBlobContainerClient().GetBlobsAsync(prefix: prefix, cancellationToken: cancellationToken))
            {
                if (string.IsNullOrWhiteSpace(blobItem.Name))
                    continue;

                var fileName = ParseDisplayFileNameFromStoredName(Path.GetFileName(blobItem.Name));
                results.Add(new StoredFileResult(
                    fileName,
                    BuildPublicUrl(blobItem.Name),
                    NormalizeRelativePath(blobItem.Name),
                    blobItem.Properties.ContentLength ?? 0,
                    blobItem.Properties.ContentType ?? "application/octet-stream",
                    blobItem.Properties.LastModified?.UtcDateTime ?? DateTime.UtcNow));
            }

            return results
                .OrderByDescending(x => x.UploadedAtUtc)
                .ToList();
        }

        var ownerAbsoluteRoot = Path.Combine(GetStorageRootPath(), ownerRelativeRoot);
        if (!Directory.Exists(ownerAbsoluteRoot))
            return [];

        return Directory.GetFiles(ownerAbsoluteRoot, "*", SearchOption.AllDirectories)
            .OrderByDescending(File.GetLastWriteTimeUtc)
            .Select(path =>
            {
                var info = new FileInfo(path);
                var relativePath = NormalizeRelativePath(Path.GetRelativePath(GetStorageRootPath(), path));
                var fileName = ParseDisplayFileNameFromStoredName(info.Name);
                return new StoredFileResult(
                    fileName,
                    BuildPublicUrl(relativePath),
                    relativePath,
                    info.Length,
                    ResolveContentType(fileName, null),
                    info.LastWriteTimeUtc);
            })
            .ToList();
    }

    public async Task<bool> DeleteForOwnerAsync(
        string scope,
        Guid ownerId,
        string relativePath,
        IReadOnlyList<string>? subFolders = null,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(relativePath))
            return false;

        var ownerRelativeRoot = BuildOwnerRelativeRoot(scope, ownerId, subFolders);
        var normalizedRelativePath = NormalizeRelativePath(relativePath);
        var requiredPrefix = $"{ownerRelativeRoot}/";
        if (!normalizedRelativePath.StartsWith(requiredPrefix, StringComparison.OrdinalIgnoreCase))
            return false;

        return await DeleteByRelativePathAsync(normalizedRelativePath, cancellationToken);
    }

    public async Task<bool> DeleteByPublicUrlAsync(string? publicUrl, CancellationToken cancellationToken = default)
    {
        var relativePath = TryExtractRelativePathFromPublicUrl(publicUrl);
        if (string.IsNullOrWhiteSpace(relativePath))
            return false;

        return await DeleteByRelativePathAsync(relativePath, cancellationToken);
    }

    public async Task<ResolvedStoredFile?> ResolveAsync(string relativePath, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(relativePath))
            return null;

        var normalizedRelative = NormalizeRelativePath(relativePath);
        if (normalizedRelative.Contains("..", StringComparison.Ordinal))
            return null;

        if (_storage.UseBlobStorage)
        {
            var blobClient = GetBlobContainerClient().GetBlobClient(normalizedRelative);
            if (!await blobClient.ExistsAsync(cancellationToken))
                return null;

            var download = await blobClient.DownloadStreamingAsync(cancellationToken: cancellationToken);
            var contentType = download.Value.Details.ContentType;
            if (string.IsNullOrWhiteSpace(contentType))
                contentType = ResolveContentType(normalizedRelative, null);

            return new ResolvedStoredFile(
                download.Value.Content,
                normalizedRelative,
                ParseDisplayFileNameFromStoredName(Path.GetFileName(normalizedRelative)),
                contentType,
                download.Value.Details.ContentLength);
        }

        var absolutePath = Path.GetFullPath(Path.Combine(GetStorageRootPath(), normalizedRelative));
        var storageRoot = GetStorageRootPath();
        if (!absolutePath.StartsWith(storageRoot, StringComparison.OrdinalIgnoreCase))
            return null;

        if (!File.Exists(absolutePath))
            return null;

        var info = new FileInfo(absolutePath);
        var fileName = ParseDisplayFileNameFromStoredName(info.Name);
        return new ResolvedStoredFile(
            new FileStream(absolutePath, FileMode.Open, FileAccess.Read, FileShare.Read),
            normalizedRelative,
            fileName,
            ResolveContentType(fileName, null),
            info.Length);
    }

    private async Task<bool> DeleteByRelativePathAsync(string relativePath, CancellationToken cancellationToken)
    {
        var normalizedRelative = NormalizeRelativePath(relativePath);
        if (normalizedRelative.Contains("..", StringComparison.Ordinal))
            return false;

        if (_storage.UseBlobStorage)
        {
            var blobClient = GetBlobContainerClient().GetBlobClient(normalizedRelative);
            var response = await blobClient.DeleteIfExistsAsync(cancellationToken: cancellationToken);
            return response.Value;
        }

        var absolutePath = Path.GetFullPath(Path.Combine(GetStorageRootPath(), normalizedRelative));
        var storageRoot = GetStorageRootPath();
        if (!absolutePath.StartsWith(storageRoot, StringComparison.OrdinalIgnoreCase))
            return false;

        if (!File.Exists(absolutePath))
            return false;

        File.Delete(absolutePath);
        CleanupEmptyParents(Path.GetDirectoryName(absolutePath), storageRoot);
        return true;
    }

    private BlobContainerClient GetBlobContainerClient()
    {
        if (_blobContainerClient is not null)
            return _blobContainerClient;

        if (string.IsNullOrWhiteSpace(_storage.BlobConnectionString))
            throw new InvalidOperationException("Blob storage connection string is not configured.");

        if (string.IsNullOrWhiteSpace(_storage.BlobContainerName))
            throw new InvalidOperationException("Blob storage container name is not configured.");

        _blobContainerClient = new BlobContainerClient(_storage.BlobConnectionString, _storage.BlobContainerName);
        return _blobContainerClient;
    }

    private string GetStorageRootPath()
    {
        var configured = _storage.RootPath?.Trim();
        if (string.IsNullOrWhiteSpace(configured))
            configured = "/storage";

        var absolute = Path.IsPathRooted(configured)
            ? configured
            : Path.Combine(_environment.ContentRootPath, configured);

        return Path.GetFullPath(absolute);
    }

    private static string BuildOwnerRelativeRoot(string scope, Guid ownerId, IReadOnlyList<string>? subFolders)
    {
        var segments = new List<string>
        {
            SanitizePathSegment(scope),
            ownerId.ToString("D")
        };

        if (subFolders is { Count: > 0 })
        {
            segments.AddRange(subFolders
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Select(SanitizePathSegment));
        }

        return string.Join('/', segments);
    }

    private string BuildPublicUrl(string relativePath)
    {
        var safeRelative = NormalizeRelativePath(relativePath);
        var publicBase = (_storage.PublicBaseUrl ?? "/api/LearningStorage/download").TrimEnd('/');
        if (string.IsNullOrWhiteSpace(publicBase))
            publicBase = "/api/LearningStorage/download";

        if (Uri.TryCreate(publicBase, UriKind.Absolute, out var absoluteBase))
            return $"{absoluteBase.ToString().TrimEnd('/')}/{safeRelative}";

        if (!publicBase.StartsWith('/'))
            publicBase = $"/{publicBase}";

        return $"{publicBase}/{safeRelative}";
    }

    private string? TryExtractRelativePathFromPublicUrl(string? publicUrl)
    {
        if (string.IsNullOrWhiteSpace(publicUrl))
            return null;

        var path = publicUrl.Trim();
        if (Uri.TryCreate(publicUrl, UriKind.Absolute, out var uri))
            path = uri.AbsolutePath;

        var publicBasePath = ExtractPublicBasePath();
        if (path.StartsWith(publicBasePath, StringComparison.OrdinalIgnoreCase))
        {
            var relativePath = path[publicBasePath.Length..].TrimStart('/');
            return string.IsNullOrWhiteSpace(relativePath) ? null : NormalizeRelativePath(relativePath);
        }

        if (!string.IsNullOrWhiteSpace(_storage.BlobContainerBaseUrl) &&
            Uri.TryCreate(_storage.BlobContainerBaseUrl, UriKind.Absolute, out var blobBaseUri) &&
            Uri.TryCreate(publicUrl, UriKind.Absolute, out var blobUri))
        {
            var blobBasePath = $"{blobBaseUri.AbsolutePath.TrimEnd('/')}/";
            if (blobUri.AbsolutePath.StartsWith(blobBasePath, StringComparison.OrdinalIgnoreCase))
            {
                var relativePath = blobUri.AbsolutePath[blobBasePath.Length..].TrimStart('/');
                return string.IsNullOrWhiteSpace(relativePath) ? null : NormalizeRelativePath(relativePath);
            }
        }

        return null;
    }

    private string ExtractPublicBasePath()
    {
        var publicBase = (_storage.PublicBaseUrl ?? "/api/LearningStorage/download").TrimEnd('/');
        if (string.IsNullOrWhiteSpace(publicBase))
            return "/api/LearningStorage/download/";

        if (Uri.TryCreate(publicBase, UriKind.Absolute, out var absolute))
        {
            var path = absolute.AbsolutePath.TrimEnd('/');
            return string.IsNullOrWhiteSpace(path) ? "/" : $"{path}/";
        }

        if (!publicBase.StartsWith('/'))
            publicBase = $"/{publicBase}";

        return $"{publicBase.TrimEnd('/')}/";
    }

    private static string BuildStoredObjectName(string displayName, string extension, DateTime uploadedAtUtc)
    {
        var safeBase = UnsafePathCharsRegex.Replace(
            Path.GetFileNameWithoutExtension(displayName).Trim().ToLowerInvariant(),
            "-");
        if (string.IsNullOrWhiteSpace(safeBase))
            safeBase = "file";

        var normalizedExtension = string.IsNullOrWhiteSpace(extension)
            ? string.Empty
            : extension.StartsWith('.') ? extension.ToLowerInvariant() : $".{extension.ToLowerInvariant()}";

        return $"{uploadedAtUtc:yyyyMMddHHmmssfff}-{Guid.NewGuid():N}__{safeBase}{normalizedExtension}";
    }

    private static string ParseDisplayFileNameFromStoredName(string storedName)
    {
        var fileName = Path.GetFileName(storedName);
        if (string.IsNullOrWhiteSpace(fileName))
            return "document";

        var separatorIndex = fileName.IndexOf("__", StringComparison.Ordinal);
        if (separatorIndex < 0 || separatorIndex + 2 >= fileName.Length)
            return fileName;

        return fileName[(separatorIndex + 2)..];
    }

    private static string SanitizeDisplayFileName(string? preferredFileName, string uploadedName, string extension)
    {
        var source = string.IsNullOrWhiteSpace(preferredFileName)
            ? uploadedName
            : preferredFileName;

        var baseName = Path.GetFileNameWithoutExtension(source);
        baseName = UnsafePathCharsRegex.Replace(baseName, " ").Trim();
        if (string.IsNullOrWhiteSpace(baseName))
            baseName = "Document";

        var normalizedExtension = string.IsNullOrWhiteSpace(extension)
            ? Path.GetExtension(uploadedName)
            : extension;

        normalizedExtension = string.IsNullOrWhiteSpace(normalizedExtension)
            ? string.Empty
            : normalizedExtension.StartsWith('.') ? normalizedExtension : $".{normalizedExtension}";

        return $"{baseName}{normalizedExtension}";
    }

    private static string SanitizePathSegment(string segment)
    {
        var trimmed = segment.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(trimmed))
            throw new InvalidOperationException("Storage path segment cannot be empty.");

        var safe = UnsafePathCharsRegex.Replace(trimmed, "-");
        safe = safe.Replace("..", "-", StringComparison.Ordinal);
        safe = safe.Trim('-');
        return string.IsNullOrWhiteSpace(safe) ? "item" : safe;
    }

    private static string ResolveContentType(string fileName, string? uploadedContentType)
    {
        if (!string.IsNullOrWhiteSpace(uploadedContentType))
            return uploadedContentType;

        if (ContentTypeProvider.TryGetContentType(fileName, out var contentType))
            return contentType;

        return "application/octet-stream";
    }

    private static string CombineRelativePaths(params string[] parts)
    {
        var cleaned = parts
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Select(NormalizeRelativePath)
            .ToArray();
        return string.Join('/', cleaned);
    }

    private static string NormalizeRelativePath(string value)
    {
        return value.Replace('\\', '/').Trim('/');
    }

    private static void CleanupEmptyParents(string? startDir, string stopAt)
    {
        if (string.IsNullOrWhiteSpace(startDir))
            return;

        var current = new DirectoryInfo(startDir);
        var stop = new DirectoryInfo(stopAt).FullName;

        while (current is not null &&
               current.Exists &&
               current.FullName.StartsWith(stop, StringComparison.OrdinalIgnoreCase) &&
               current.FullName.Length > stop.Length &&
               !current.EnumerateFileSystemInfos().Any())
        {
            current.Delete();
            current = current.Parent;
        }
    }
}
