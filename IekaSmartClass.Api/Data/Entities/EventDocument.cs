namespace IekaSmartClass.Api.Data.Entities;

public class EventDocument
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid EventItemId { get; private set; }
    public string FileName { get; private set; }
    public string FileUrl { get; private set; }
    public DateTime UploadedAt { get; private set; }
    public Guid UploadedById { get; private set; } // who uploaded it

    [System.Text.Json.Serialization.JsonIgnore]
    public EventItem EventItem { get; private set; } = null!;

    public EventDocument(Guid eventItemId, string fileName, string fileUrl, Guid uploadedById)
    {
        EventItemId = eventItemId;
        FileName = fileName;
        FileUrl = fileUrl;
        UploadedById = uploadedById;
        UploadedAt = DateTime.UtcNow;
    }

    private EventDocument() { }
}
