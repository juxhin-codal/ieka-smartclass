namespace IekaSmartClass.Api.Utilities.Settings;

public class StorageSettings
{
    public const string SectionName = "Storage";

    public bool UseBlobStorage { get; set; }

    // Relative paths are resolved from ContentRootPath unless this is absolute.
    public string RootPath { get; set; } = "/storage";

    // Can be absolute (https://domain/files) or path-only (/files).
    public string PublicBaseUrl { get; set; } = "/api/LearningStorage/download";

    public string? BlobConnectionString { get; set; }

    public string BlobContainerName { get; set; } = string.Empty;

    public string? BlobContainerBaseUrl { get; set; }

    public long MaxFileSizeBytes { get; set; } = 25 * 1024 * 1024; // 25 MB

    public string[] AllowedExtensions { get; set; } =
    [
        ".pdf",
        ".doc",
        ".docx",
        ".xls",
        ".xlsx",
        ".ppt",
        ".pptx",
        ".txt",
        ".png",
        ".jpg",
        ".jpeg",
        ".webp",
        ".zip"
    ];
}
