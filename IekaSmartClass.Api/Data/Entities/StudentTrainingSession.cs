using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace IekaSmartClass.Api.Data.Entities;

public class StudentTrainingSession
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid StudentId { get; private set; }
    public Guid MentorId { get; private set; }
    public DateTime ScheduledDate { get; private set; }
    public string StartTime { get; private set; }
    public string EndTime { get; private set; }
    public string AttendanceStatus { get; private set; }
    public string? Notes { get; private set; }
    public string? RejectionReason { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    [NotMapped]
    public string StudentFirstName => Student?.FirstName ?? string.Empty;

    [NotMapped]
    public string StudentLastName => Student?.LastName ?? string.Empty;

    [NotMapped]
    public string StudentEmail => Student?.Email ?? string.Empty;

    [NotMapped]
    public string StudentMemberRegistryNumber => Student?.MemberRegistryNumber ?? string.Empty;

    [NotMapped]
    public string MentorFirstName => Mentor?.FirstName ?? string.Empty;

    [NotMapped]
    public string MentorLastName => Mentor?.LastName ?? string.Empty;

    [NotMapped]
    public string MentorEmail => Mentor?.Email ?? string.Empty;

    [JsonIgnore]
    public AppUser Student { get; private set; } = null!;

    [JsonIgnore]
    public AppUser Mentor { get; private set; } = null!;

    public StudentTrainingSession(Guid studentId, Guid mentorId, DateTime scheduledDate, string startTime, string endTime, string? notes = null)
    {
        StudentId = studentId;
        MentorId = mentorId;
        ScheduledDate = scheduledDate.Date;
        StartTime = NormalizeTime(startTime);
        EndTime = NormalizeTime(endTime);
        Notes = NormalizeNotes(notes);
        AttendanceStatus = "pending";
        CreatedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public void UpdateSchedule(DateTime scheduledDate, string startTime, string endTime, string? notes)
    {
        ScheduledDate = scheduledDate.Date;
        StartTime = NormalizeTime(startTime);
        EndTime = NormalizeTime(endTime);
        Notes = NormalizeNotes(notes);
        if (AttendanceStatus != "attended" && AttendanceStatus != "rejected")
        {
            AttendanceStatus = "pending";
            RejectionReason = null;
        }
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkAttended()
    {
        AttendanceStatus = "attended";
        RejectionReason = null;
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkRejected(string? reason)
    {
        AttendanceStatus = "rejected";
        RejectionReason = NormalizeNotes(reason);
        UpdatedAt = DateTime.UtcNow;
    }

    private static string NormalizeTime(string time)
    {
        var normalized = (time ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(normalized))
            throw new ArgumentException("Time is required.");
        return normalized;
    }

    private static string? NormalizeNotes(string? value)
    {
        var normalized = value?.Trim();
        return string.IsNullOrWhiteSpace(normalized) ? null : normalized;
    }

    private StudentTrainingSession()
    {
        StartTime = string.Empty;
        EndTime = string.Empty;
        AttendanceStatus = "pending";
    }
}
