namespace IekaSmartClass.Api.Data.Entities;

public class EventDate
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid EventItemId { get; private set; }
    public DateTime Date { get; private set; }
    public string Time { get; private set; }
    public int MaxParticipants { get; private set; }
    public int CurrentParticipants { get; private set; }
    public string? Location { get; private set; }
    public bool IsEnded { get; private set; } = false;
    public bool RequireLocation { get; private set; } = false;
    public double? Latitude { get; private set; }
    public double? Longitude { get; private set; }

    [System.Text.Json.Serialization.JsonIgnore]
    public EventItem EventItem { get; private set; } = null!;
    public ICollection<EventDateDocument> Documents { get; private set; } = new List<EventDateDocument>();

    public EventDate(DateTime date, string time, int maxParticipants, string? location = null)
    {
        Date = date;
        Time = time;
        MaxParticipants = maxParticipants;
        CurrentParticipants = 0;
        Location = location;
    }

    public void SetLocation(string? location) => Location = location;

    public void UpdateDetails(DateTime date, string time, string? location,
        bool requireLocation = false, double? latitude = null, double? longitude = null)
    {
        Date = date;
        Time = time;
        Location = location;
        RequireLocation = requireLocation;
        Latitude = latitude;
        Longitude = longitude;
    }

    public void SetLocationCoordinates(bool requireLocation, double? latitude, double? longitude)
    {
        RequireLocation = requireLocation;
        Latitude = latitude;
        Longitude = longitude;
    }

    public void IncrementParticipant()
    {
        if (CurrentParticipants >= MaxParticipants)
            throw new InvalidOperationException("Session is full.");
        CurrentParticipants++;
    }

    public void DecrementParticipant()
    {
        if (CurrentParticipants > 0)
            CurrentParticipants--;
    }

    public void EndSession()
    {
        IsEnded = true;
    }

    private EventDate() { }
}
