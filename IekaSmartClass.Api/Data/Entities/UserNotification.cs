namespace IekaSmartClass.Api.Data.Entities;

public class UserNotification
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid UserId { get; private set; }
    public string Type { get; private set; } = string.Empty;
    public string Title { get; private set; } = string.Empty;
    public string Body { get; private set; } = string.Empty;
    public string? Link { get; private set; }
    public bool IsRead { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime? ReadAtUtc { get; private set; }
    public string DeduplicationKey { get; private set; } = string.Empty;

    [System.Text.Json.Serialization.JsonIgnore]
    public AppUser User { get; private set; } = null!;

    public UserNotification(Guid userId, string type, string title, string body, string? link, string deduplicationKey)
    {
        UserId = userId;
        Type = type.Trim();
        Title = title.Trim();
        Body = body.Trim();
        Link = string.IsNullOrWhiteSpace(link) ? null : link.Trim();
        DeduplicationKey = deduplicationKey.Trim();
        IsRead = false;
        CreatedAtUtc = DateTime.UtcNow;
    }

    public void MarkRead()
    {
        if (IsRead)
        {
            return;
        }

        IsRead = true;
        ReadAtUtc = DateTime.UtcNow;
    }

    private UserNotification() { }
}
