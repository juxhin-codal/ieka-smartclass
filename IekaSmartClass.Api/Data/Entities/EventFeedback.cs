namespace IekaSmartClass.Api.Data.Entities;

public class EventFeedback
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid EventItemId { get; private set; }
    public Guid? DateId { get; private set; } // Optional: tying feedback to a specific session
    public Guid UserId { get; private set; } // The participant

    // Step 1: feedback for sessions, topics and class (1-5 rating or text)
    public int SessionRating { get; private set; }
    public string? SessionComments { get; private set; }

    // Step 2: feedback for lecturer
    public int LecturerRating { get; private set; }
    public string? LecturerComments { get; private set; }

    // Step 3: suggestions
    public string? Suggestions { get; private set; }

    public bool IsAnonymous { get; private set; }
    public DateTime SubmittedAt { get; private set; }

    [System.Text.Json.Serialization.JsonIgnore]
    public EventItem EventItem { get; private set; } = null!;

    public EventFeedback(Guid eventItemId, Guid? dateId, Guid userId, int sessionRating, string? sessionComments, int lecturerRating, string? lecturerComments, string? suggestions)
    {
        EventItemId = eventItemId;
        DateId = dateId;
        UserId = userId;
        SessionRating = sessionRating;
        SessionComments = sessionComments;
        LecturerRating = lecturerRating;
        LecturerComments = lecturerComments;
        Suggestions = suggestions;
        SubmittedAt = DateTime.UtcNow;
    }

    // Constructor for lecturer-only feedback submitted via email token link
    public EventFeedback(Guid eventItemId, Guid? dateId, Guid userId, int lecturerRating, string? lecturerComments, bool isAnonymous)
    {
        EventItemId = eventItemId;
        DateId = dateId;
        UserId = userId;
        LecturerRating = lecturerRating;
        LecturerComments = lecturerComments;
        IsAnonymous = isAnonymous;
        SubmittedAt = DateTime.UtcNow;
    }

    private EventFeedback() { }
}
