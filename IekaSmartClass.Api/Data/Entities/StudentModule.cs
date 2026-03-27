namespace IekaSmartClass.Api.Data.Entities;

public class StudentModule
{
    public Guid Id { get; private set; }
    public int YearGrade { get; private set; } // 1, 2, or 3
    public string Topic { get; private set; } = string.Empty;
    public string Lecturer { get; private set; } = string.Empty;
    public DateTime? ScheduledDate { get; private set; }
    public string? Location { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public Guid CreatedByUserId { get; private set; }

    public AppUser CreatedByUser { get; private set; } = null!;
    public ICollection<StudentModuleDocument> Documents { get; private set; } = new List<StudentModuleDocument>();
    public ICollection<StudentModuleAssignment> Assignments { get; private set; } = new List<StudentModuleAssignment>();

    private StudentModule() { }

    public StudentModule(int yearGrade, string topic, string lecturer, Guid createdByUserId, DateTime? scheduledDate = null, string? location = null)
    {
        if (yearGrade < 1 || yearGrade > 3)
            throw new ArgumentException("Year grade must be 1, 2, or 3.", nameof(yearGrade));
        if (string.IsNullOrWhiteSpace(topic))
            throw new ArgumentException("Topic is required.", nameof(topic));
        if (string.IsNullOrWhiteSpace(lecturer))
            throw new ArgumentException("Lecturer is required.", nameof(lecturer));

        Id = Guid.NewGuid();
        YearGrade = yearGrade;
        Topic = topic.Trim();
        Lecturer = lecturer.Trim();
        ScheduledDate = scheduledDate;
        Location = string.IsNullOrWhiteSpace(location) ? null : location.Trim();
        CreatedByUserId = createdByUserId;
        CreatedAt = DateTime.UtcNow;
    }

    public void UpdateSchedule(DateTime? scheduledDate)
    {
        ScheduledDate = scheduledDate;
    }
}

public class StudentModuleDocument
{
    public Guid Id { get; private set; }
    public Guid StudentModuleId { get; private set; }
    public string FileName { get; private set; } = string.Empty;
    public string FileUrl { get; private set; } = string.Empty;
    public string RelativePath { get; private set; } = string.Empty;
    public long SizeBytes { get; private set; }
    public DateTime UploadedAt { get; private set; }

    public StudentModule StudentModule { get; private set; } = null!;

    private StudentModuleDocument() { }

    public StudentModuleDocument(Guid studentModuleId, string fileName, string fileUrl, string relativePath, long sizeBytes)
    {
        Id = Guid.NewGuid();
        StudentModuleId = studentModuleId;
        FileName = fileName;
        FileUrl = fileUrl;
        RelativePath = relativePath;
        SizeBytes = sizeBytes;
        UploadedAt = DateTime.UtcNow;
    }
}

public class StudentModuleAssignment
{
    public Guid Id { get; private set; }
    public Guid StudentModuleId { get; private set; }
    public Guid StudentId { get; private set; }
    public DateTime AssignedAt { get; private set; }
    public DateTime? AttendedAt { get; private set; }

    public StudentModule StudentModule { get; private set; } = null!;
    public AppUser Student { get; private set; } = null!;

    private StudentModuleAssignment() { }

    public StudentModuleAssignment(Guid studentModuleId, Guid studentId)
    {
        Id = Guid.NewGuid();
        StudentModuleId = studentModuleId;
        StudentId = studentId;
        AssignedAt = DateTime.UtcNow;
    }

    public void MarkAttended()
    {
        if (AttendedAt is not null)
            throw new InvalidOperationException("Studenti e ka konfirmuar tashmë prezencën.");
        AttendedAt = DateTime.UtcNow;
    }
}
