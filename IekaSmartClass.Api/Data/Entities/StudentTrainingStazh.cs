using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace IekaSmartClass.Api.Data.Entities;

public class StudentTrainingStazh
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid StudentId { get; private set; }
    public Guid MentorId { get; private set; }
    public string Status { get; private set; }
    public DateTime StartedAt { get; private set; }
    public DateTime? EndedAt { get; private set; }
    public Guid? EndedByUserId { get; private set; }

    public int? MentorFeedbackRating { get; private set; }
    public string? MentorFeedbackComment { get; private set; }
    public DateTime? MentorFeedbackSubmittedAt { get; private set; }

    public int? StudentFeedbackRating { get; private set; }
    public string? StudentFeedbackComment { get; private set; }
    public DateTime? StudentFeedbackSubmittedAt { get; private set; }

    public string? StudentFeedbackToken { get; private set; }
    public DateTime? StudentFeedbackTokenExpiresAt { get; private set; }

    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    [JsonIgnore]
    public AppUser Student { get; private set; } = null!;

    [JsonIgnore]
    public AppUser Mentor { get; private set; } = null!;

    [JsonIgnore]
    public AppUser? EndedByUser { get; private set; }

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

    public StudentTrainingStazh(Guid studentId, Guid mentorId, DateTime? startedAt = null)
    {
        StudentId = studentId;
        MentorId = mentorId;
        Status = "active";
        StartedAt = (startedAt ?? DateTime.UtcNow).Date;
        CreatedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public void End(Guid endedByUserId, int mentorFeedbackRating, string? mentorFeedbackComment, string feedbackToken, DateTime feedbackTokenExpiresAt)
    {
        if (Status == "ended")
        {
            throw new InvalidOperationException("Stazhi është mbyllur tashmë.");
        }

        if (mentorFeedbackRating is < 1 or > 5)
        {
            throw new InvalidOperationException("Vlerësimi i mentorit duhet të jetë nga 1 deri në 5.");
        }

        if (string.IsNullOrWhiteSpace(feedbackToken))
        {
            throw new InvalidOperationException("Token-i i feedback-ut është i pavlefshëm.");
        }

        Status = "ended";
        EndedAt = DateTime.UtcNow;
        EndedByUserId = endedByUserId;

        MentorFeedbackRating = mentorFeedbackRating;
        MentorFeedbackComment = NormalizeComment(mentorFeedbackComment, 3000);
        MentorFeedbackSubmittedAt = DateTime.UtcNow;

        StudentFeedbackToken = feedbackToken.Trim();
        StudentFeedbackTokenExpiresAt = feedbackTokenExpiresAt;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SubmitStudentFeedback(int rating, string? comment)
    {
        if (Status != "ended")
        {
            throw new InvalidOperationException("Stazhi duhet të jetë i mbyllur për të dërguar feedback.");
        }

        if (StudentFeedbackSubmittedAt.HasValue)
        {
            throw new InvalidOperationException("Feedback-u i studentit është dërguar tashmë.");
        }

        if (rating is < 1 or > 5)
        {
            throw new InvalidOperationException("Vlerësimi duhet të jetë nga 1 deri në 5.");
        }

        StudentFeedbackRating = rating;
        StudentFeedbackComment = NormalizeComment(comment, 3000);
        StudentFeedbackSubmittedAt = DateTime.UtcNow;
        StudentFeedbackToken = null;
        StudentFeedbackTokenExpiresAt = null;
        UpdatedAt = DateTime.UtcNow;
    }

    public bool IsFeedbackTokenValid(string token)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            return false;
        }

        if (string.IsNullOrWhiteSpace(StudentFeedbackToken) || StudentFeedbackTokenExpiresAt is null)
        {
            return false;
        }

        if (!string.Equals(StudentFeedbackToken, token.Trim(), StringComparison.Ordinal))
        {
            return false;
        }

        return DateTime.UtcNow <= StudentFeedbackTokenExpiresAt.Value;
    }

    private static string? NormalizeComment(string? value, int maxLength)
    {
        var normalized = value?.Trim();
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return null;
        }

        return normalized.Length <= maxLength ? normalized : normalized[..maxLength];
    }

    private StudentTrainingStazh()
    {
        Status = "active";
    }
}
