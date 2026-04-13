using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace IekaSmartClass.Api.Data.Entities;

public class Participant
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid EventItemId { get; private set; }
    public Guid UserId { get; private set; }
    public Guid DateId { get; private set; }
    public int SeatNumber { get; private set; }
    public DateTime RegisteredAt { get; private set; }
    public string Status { get; private set; }
    public string Attendance { get; private set; }
    public string? FeedbackToken { get; private set; }
    public bool QuestionnaireEmailSent { get; private set; }
    public bool ReservationWarningEmailSent { get; private set; }

    [NotMapped]
    public string FirstName => User?.FirstName ?? string.Empty;

    [NotMapped]
    public string LastName => User?.LastName ?? string.Empty;

    [NotMapped]
    public string Email => User?.Email ?? string.Empty;

    [NotMapped]
    public string MemberRegistryNumber => User?.MemberRegistryNumber ?? string.Empty;

    [JsonIgnore]
    public EventItem EventItem { get; private set; } = null!;

    [JsonIgnore]
    public AppUser User { get; private set; } = null!;

    [JsonIgnore]
    public EventDate EventDate { get; private set; } = null!;

    public Participant(Guid eventItemId, Guid userId, Guid dateId, int seatNumber, string status = "registered")
    {
        EventItemId = eventItemId;
        UserId = userId;
        DateId = dateId;
        SeatNumber = seatNumber;
        RegisteredAt = DateTime.UtcNow;
        Status = status;
        Attendance = "pending";
    }

    public void MarkAttended()
    {
        Attendance = "attended";
    }

    public void MarkAbsent()
    {
        Attendance = "absent";
    }

    /// <summary>Promote a waitlisted participant to registered and assign a seat.</summary>
    public void Promote(int seatNumber)
    {
        Status = "registered";
        SeatNumber = seatNumber;
    }

    public void SetFeedbackToken(string token)
    {
        FeedbackToken = token;
    }

    public void MarkQuestionnaireEmailSent()
    {
        QuestionnaireEmailSent = true;
    }

    public void MarkReservationWarningEmailSent()
    {
        ReservationWarningEmailSent = true;
    }

    private Participant() { }
}
