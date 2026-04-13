namespace IekaSmartClass.Api.Data.Entities;

public class EventDateDocument
{
    public Guid Id { get; private set; }
    public Guid EventDateId { get; private set; }
    public string FileName { get; private set; } = string.Empty;
    public string FileUrl { get; private set; } = string.Empty;
    public string RelativePath { get; private set; } = string.Empty;
    public long SizeBytes { get; private set; }
    public DateTime UploadedAt { get; private set; }
    public Guid UploadedById { get; private set; }

    [System.Text.Json.Serialization.JsonIgnore]
    public EventDate EventDate { get; private set; } = null!;

    private EventDateDocument() { }

    public EventDateDocument(Guid eventDateId, string fileName, string fileUrl, string relativePath, long sizeBytes, Guid uploadedById)
    {
        Id = Guid.NewGuid();
        EventDateId = eventDateId;
        FileName = fileName;
        FileUrl = fileUrl;
        RelativePath = relativePath;
        SizeBytes = sizeBytes;
        UploadedById = uploadedById;
        UploadedAt = DateTime.UtcNow;
    }
}
