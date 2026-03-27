using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.AspNetCore.Identity;

namespace IekaSmartClass.Api.Data.Entities;

public class AppUser : IdentityUser<Guid>
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? Email2 { get; private set; }
    public string MemberRegistryNumber { get; set; } = string.Empty;
    public string Role { get; set; } = "Member";
    public Guid? MentorId { get; private set; }
    public int CpdHoursCompleted { get; private set; }
    public int CpdHoursRequired { get; private set; }
    public bool IsActive { get; private set; } = true;
    public bool NotifyByEmail { get; private set; } = true;
    public bool NotifyBySms { get; private set; }
    public bool NotifyBookingOpen { get; private set; } = true;
    public bool NotifySessionReminder { get; private set; } = true;
    public bool NotifySurveyReminder { get; private set; } = true;
    public bool NotifyCpdDeadline { get; private set; } = true;
    public DateTime? StudentValidUntilUtc { get; private set; }
    public int? StudentTrackingNumber { get; private set; }
    public string? StudentNumber { get; private set; }
    public int? StudentStartYear { get; private set; }
    public int? StudentEndYear { get; private set; }
    public int? StudentYear2StartYear { get; private set; }
    public int? StudentYear3StartYear { get; private set; }
    public string? Company { get; private set; }
    public string? District { get; private set; }
    public int? YearlyPaymentPaidYear { get; private set; }
    public bool IsPendingConfirmation { get; private set; }
    public string? EmailConfirmationCode { get; set; }
    public DateTime? EmailConfirmationExpiresAt { get; set; }
    public string? PasswordResetCode { get; set; }
    public DateTime? PasswordResetExpiresAt { get; set; }
    public string? LoginOtpCode { get; set; }
    public DateTime? LoginOtpExpiresAt { get; set; }
    public string? LoginOtpChallengeId { get; set; }

    // Compatibility alias for existing frontend/API payloads.
    [NotMapped]
    public string? Phone
    {
        get => PhoneNumber;
        set => PhoneNumber = value;
    }

    public AppUser(
        string firstName,
        string lastName,
        string email,
        string memberRegistryNumber,
        string role,
        int cpdHoursRequired,
        string? phone = null,
        bool isActive = true,
        Guid? mentorId = null,
        DateTime? studentValidUntilUtc = null,
        int? studentTrackingNumber = null,
        string? email2 = null,
        string? studentNumber = null,
        int? studentStartYear = null,
        int? studentEndYear = null,
        string? company = null,
        string? district = null)
    {
        Id = Guid.NewGuid();
        FirstName = firstName;
        LastName = lastName;
        Email = email;
        UserName = email;
        Email2 = NormalizeOptionalValue(email2);
        MemberRegistryNumber = memberRegistryNumber;
        Role = role;
        MentorId = string.Equals(role, "Student", StringComparison.OrdinalIgnoreCase) ? mentorId : null;
        CpdHoursRequired = cpdHoursRequired;
        PhoneNumber = phone;
        IsActive = isActive;
        StudentValidUntilUtc = string.Equals(role, "Student", StringComparison.OrdinalIgnoreCase) ? studentValidUntilUtc : null;
        SetStudentProfile(role, studentTrackingNumber, studentNumber, studentStartYear, studentEndYear, company, district);
    }

    public void Activate()
    {
        IsActive = true;
        IsPendingConfirmation = false;
    }

    public void Deactivate()
    {
        IsActive = false;
    }

    public void MarkPendingConfirmation()
    {
        IsPendingConfirmation = true;
    }

    public void ConfirmEmail()
    {
        IsPendingConfirmation = false;
    }

    public void SetActive(bool isActive)
    {
        IsActive = isActive;
        if (isActive)
        {
            YearlyPaymentPaidYear = null;
        }
    }

    public void UpdateProfile(string firstName, string lastName, string email, string? phone)
    {
        FirstName = firstName;
        LastName = lastName;
        Email = email;
        UserName = email;
        PhoneNumber = phone;
    }

    public void AdminUpdateProfile(
        string firstName,
        string lastName,
        string email,
        string? email2,
        string memberRegistryNumber,
        string? phone,
        string role,
        int cpdHoursRequired,
        bool isActive,
        Guid? mentorId,
        DateTime? studentValidUntilUtc,
        int? studentTrackingNumber,
        string? studentNumber,
        int? studentStartYear,
        int? studentEndYear,
        string? company,
        string? district,
        int? studentYear2StartYear = null,
        int? studentYear3StartYear = null)
    {
        UpdateProfile(firstName, lastName, email, phone);
        Email2 = NormalizeOptionalValue(email2);
        MemberRegistryNumber = memberRegistryNumber;
        Role = role;
        CpdHoursRequired = cpdHoursRequired;
        IsActive = isActive;
        MentorId = string.Equals(role, "Student", StringComparison.OrdinalIgnoreCase) ? mentorId : null;
        StudentValidUntilUtc = string.Equals(role, "Student", StringComparison.OrdinalIgnoreCase) ? studentValidUntilUtc : null;
        SetStudentProfile(role, studentTrackingNumber, studentNumber, studentStartYear, studentEndYear, company, district, studentYear2StartYear, studentYear3StartYear);
        if (isActive || role != "Member")
        {
            YearlyPaymentPaidYear = null;
        }
    }

    public bool IsStudentLoginExpired(DateTime? nowUtc = null)
    {
        if (!string.Equals(Role, "Student", StringComparison.OrdinalIgnoreCase) || !StudentValidUntilUtc.HasValue)
        {
            return false;
        }

        return (nowUtc ?? DateTime.UtcNow) > StudentValidUntilUtc.Value;
    }

    public bool IsEffectivelyActive(DateTime? nowUtc = null)
    {
        return IsActive && !IsStudentLoginExpired(nowUtc);
    }

    public void SetYearlyPaymentStatus(bool isPaid, int year)
    {
        if (Role != "Member")
        {
            YearlyPaymentPaidYear = null;
            return;
        }

        if (IsActive)
        {
            YearlyPaymentPaidYear = null;
            return;
        }

        YearlyPaymentPaidYear = isPaid ? year : null;
    }

    public void AddCpdHours(int hours)
    {
        if (hours < 0) throw new ArgumentException("Cannot add negative hours");
        CpdHoursCompleted += hours;
    }

    public void SetCpdHoursRequired(int hours)
    {
        CpdHoursRequired = Math.Max(0, hours);
    }

    public void SetMentor(Guid? mentorId)
    {
        MentorId = string.Equals(Role, "Student", StringComparison.OrdinalIgnoreCase) ? mentorId : null;
    }

    private void SetStudentProfile(
        string role,
        int? studentTrackingNumber,
        string? studentNumber,
        int? studentStartYear,
        int? studentEndYear,
        string? company,
        string? district,
        int? studentYear2StartYear = null,
        int? studentYear3StartYear = null)
    {
        if (!string.Equals(role, "Student", StringComparison.OrdinalIgnoreCase))
        {
            StudentTrackingNumber = null;
            StudentNumber = null;
            StudentStartYear = null;
            StudentEndYear = null;
            StudentYear2StartYear = null;
            StudentYear3StartYear = null;
            Company = null;
            District = null;
            return;
        }

        StudentTrackingNumber = studentTrackingNumber;
        StudentNumber = NormalizeOptionalValue(studentNumber)?.ToUpperInvariant();
        StudentStartYear = studentStartYear;
        StudentEndYear = studentEndYear;
        StudentYear2StartYear = studentYear2StartYear;
        StudentYear3StartYear = studentYear3StartYear;
        Company = NormalizeOptionalValue(company);
        District = NormalizeOptionalValue(district);
    }

    private static string? NormalizeOptionalValue(string? value)
    {
        var trimmed = value?.Trim();
        return string.IsNullOrWhiteSpace(trimmed) ? null : trimmed;
    }

    public void UpdateNotificationPreferences(
        bool notifyByEmail,
        bool notifyBySms,
        bool notifyBookingOpen,
        bool notifySessionReminder,
        bool notifySurveyReminder,
        bool notifyCpdDeadline)
    {
        NotifyByEmail = notifyByEmail;
        NotifyBySms = notifyBySms;
        NotifyBookingOpen = notifyBookingOpen;
        NotifySessionReminder = notifySessionReminder;
        NotifySurveyReminder = notifySurveyReminder;
        NotifyCpdDeadline = notifyCpdDeadline;
    }

    private AppUser() { }
}
