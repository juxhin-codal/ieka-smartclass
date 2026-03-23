namespace IekaSmartClass.Api.Data.Entities;

public class Stazh
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid MentorId { get; private set; }
    public Guid StudentId { get; private set; }
    public string Title { get; private set; }
    public DateTime StartDate { get; private set; }
    public DateTime EndDate { get; private set; }
    public string Status { get; private set; } // "active", "completed", "cancelled"
    public string? Feedback { get; private set; }
    public DateTime CreatedAt { get; private set; }

    // Navigation properties
    [System.Text.Json.Serialization.JsonIgnore]
    public AppUser Mentor { get; private set; } = null!;
    [System.Text.Json.Serialization.JsonIgnore]
    public AppUser Student { get; private set; } = null!;

    private readonly List<StazhDate> _dates = new();
    public IReadOnlyCollection<StazhDate> Dates => _dates.AsReadOnly();

    private readonly List<StazhDocument> _documents = new();
    public IReadOnlyCollection<StazhDocument> Documents => _documents.AsReadOnly();

    public Stazh(Guid mentorId, Guid studentId, string title, DateTime startDate, DateTime endDate)
    {
        MentorId = mentorId;
        StudentId = studentId;
        Title = title;
        StartDate = startDate;
        EndDate = endDate;
        Status = "active";
        CreatedAt = DateTime.UtcNow;
    }

    public void AddDate(StazhDate date) => _dates.Add(date);
    public void AddDocument(StazhDocument doc) => _documents.Add(doc);

    public void Complete(string? feedback)
    {
        Status = "completed";
        Feedback = feedback;
    }

    public void Cancel()
    {
        Status = "cancelled";
    }

    public void SetFeedback(string feedback)
    {
        Feedback = feedback;
    }

    // Parameterless constructor for EF Core
    private Stazh() { }
}

public class StazhDate
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid StazhId { get; private set; }
    public DateTime Date { get; private set; }
    public string Time { get; private set; }
    public string? Notes { get; private set; }

    [System.Text.Json.Serialization.JsonIgnore]
    public Stazh Stazh { get; private set; } = null!;

    public StazhDate(DateTime date, string time, string? notes = null)
    {
        Date = date;
        Time = time;
        Notes = notes;
    }

    private StazhDate() { }
}

public class StazhDocument
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid StazhId { get; private set; }
    public string FileName { get; private set; }
    public string FileUrl { get; private set; }
    public string? Description { get; private set; }
    public DateTime UploadedAt { get; private set; }

    [System.Text.Json.Serialization.JsonIgnore]
    public Stazh Stazh { get; private set; } = null!;

    public StazhDocument(string fileName, string fileUrl, string? description = null)
    {
        FileName = fileName;
        FileUrl = fileUrl;
        Description = description;
        UploadedAt = DateTime.UtcNow;
    }

    public StazhDocument(Guid stazhId, string fileName, string fileUrl, string? description = null)
        : this(fileName, fileUrl, description)
    {
        StazhId = stazhId;
    }

    private StazhDocument() { }
}
