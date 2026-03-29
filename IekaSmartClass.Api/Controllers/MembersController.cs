using IekaSmartClass.Api.Services.Interface;
using IekaSmartClass.Api.Utilities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace IekaSmartClass.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin")]
public class MembersController(IMembersService membersService) : ControllerBase
{
    private readonly IMembersService _membersService = membersService;

    [HttpGet]
    public async Task<IActionResult> GetMembers([FromQuery] string? search, [FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 50)
    {
        var members = await _membersService.GetMembersAsync(search, pageNumber, pageSize);
        return Ok(new
        {
            items = members.Items.Select(ToResponse),
            members.PageNumber,
            members.TotalPages,
            members.TotalCount,
            members.HasPreviousPage,
            members.HasNextPage
        });
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetMember(Guid id)
    {
        var member = await _membersService.GetMemberByIdAsync(id);
        return member is null ? NotFound() : Ok(ToResponse(member));
    }

    [HttpGet("student-tracking/next")]
    public async Task<IActionResult> GetNextStudentTrackingNumber(CancellationToken cancellationToken)
    {
        var preview = await _membersService.GetNextStudentTrackingPreviewAsync(cancellationToken);
        return Ok(preview);
    }

    [HttpPost]
    public async Task<IActionResult> AddMember([FromBody] AddMemberRequest request)
    {
        var phone = request.PhonePrefix != null || request.PhoneNumber != null
            ? PhoneHelper.Combine(request.PhonePrefix, request.PhoneNumber)
            : request.Phone;

        var id = await _membersService.AddMemberAsync(
            request.FirstName,
            request.LastName,
            request.Email,
            request.Email2,
            request.RegistryNumber,
            request.Role,
            request.CpdHoursRequired,
            phone,
            request.IsActive,
            request.MentorId,
            request.ValidUntilMonth,
            request.StudentTrackingNumber,
            request.StudentNumber,
            request.StudentStartYear,
            request.StudentEndYear,
            request.Company,
            request.District,
            request.StudentYear2StartYear,
            request.StudentYear3StartYear);

        return CreatedAtAction(
            nameof(GetMember),
            new { id },
            new MemberStatusResponse(
                true,
                "Anëtari u shtua si pending confirmation. U dërgua email për konfirmim dhe vendosje fjalëkalimi.",
                id));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateMember(Guid id, [FromBody] UpdateMemberRequest request)
    {
        var phone = request.PhonePrefix != null || request.PhoneNumber != null
            ? PhoneHelper.Combine(request.PhonePrefix, request.PhoneNumber)
            : request.Phone;

        await _membersService.UpdateMemberAsync(
            id,
            request.FirstName,
            request.LastName,
            request.Email,
            request.Email2,
            request.RegistryNumber,
            phone,
            request.Role,
            request.CpdHoursRequired,
            request.IsActive,
            request.MentorId,
            request.ValidUntilMonth,
            request.StudentTrackingNumber,
            request.StudentNumber,
            request.StudentStartYear,
            request.StudentEndYear,
            request.Company,
            request.District,
            request.StudentYear2StartYear,
            request.StudentYear3StartYear);
        return NoContent();
    }

    [HttpPost("{id:guid}/reset-password")]
    [HttpPost("{id:guid}/send-reset-email")]
    public async Task<IActionResult> ResetMemberPassword(
        Guid id,
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] ResetMemberPasswordRequest? request,
        CancellationToken cancellationToken)
    {
        await _membersService.SendPasswordResetEmailAsync(id, cancellationToken);
        return Ok(new { success = true, message = "Email-i i resetimit u dërgua." });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeactivateMember(Guid id)
    {
        await _membersService.DeactivateMemberAsync(id);
        return NoContent();
    }

    [HttpDelete("{id:guid}/permanent")]
    public async Task<IActionResult> DeleteMember(Guid id)
    {
        var actorUserIdString = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        var actorUserId = Guid.TryParse(actorUserIdString, out var parsed) ? parsed : (Guid?)null;
        await _membersService.DeleteMemberAsync(id, actorUserId);
        return NoContent();
    }

    [HttpPut("{id:guid}/yearly-payment")]
    public async Task<IActionResult> SetYearlyPayment(Guid id, [FromBody] SetYearlyPaymentRequest request)
    {
        await _membersService.SetYearlyPaymentStatusAsync(id, request.IsPaid, DateTime.UtcNow.Year);
        return NoContent();
    }

    private static MemberResponse ToResponse(Data.Entities.AppUser user)
    {
        var isExpired = user.IsStudentLoginExpired();
        var (phonePrefix, phoneNumber) = PhoneHelper.Split(user.Phone);
        return new(
            user.Id,
            user.FirstName,
            user.LastName,
            user.Email ?? string.Empty,
            user.Email2,
            user.MemberRegistryNumber,
            user.Role,
            phonePrefix,
            phoneNumber,
            user.Phone,
            user.CpdHoursCompleted,
            user.CpdHoursRequired,
            user.IsEffectivelyActive(),
            user.IsActive,
            isExpired,
            user.YearlyPaymentPaidYear,
            user.EmailConfirmed,
            user.IsPendingConfirmation,
            user.MentorId,
            user.StudentValidUntilUtc?.ToString("yyyy-MM"),
            user.StudentTrackingNumber,
            user.StudentNumber,
            user.StudentStartYear,
            user.StudentEndYear,
            user.StudentYear2StartYear,
            user.StudentYear3StartYear,
            user.Company,
            user.District);
    }
}

public record AddMemberRequest(
    string FirstName,
    string LastName,
    string Email,
    string? Email2,
    string RegistryNumber,
    string Role,
    int CpdHoursRequired,
    string? Phone = null,
    string? PhonePrefix = null,
    string? PhoneNumber = null,
    Guid? MentorId = null,
    bool IsActive = true,
    string? ValidUntilMonth = null,
    int? StudentTrackingNumber = null,
    string? StudentNumber = null,
    int? StudentStartYear = null,
    int? StudentEndYear = null,
    string? Company = null,
    string? District = null,
    int? StudentYear2StartYear = null,
    int? StudentYear3StartYear = null);
public record UpdateMemberRequest(
    string FirstName,
    string LastName,
    string Email,
    string? Email2,
    string RegistryNumber,
    string? Phone = null,
    string? PhonePrefix = null,
    string? PhoneNumber = null,
    string Role = "Member",
    int CpdHoursRequired = 0,
    Guid? MentorId = null,
    bool IsActive = true,
    string? ValidUntilMonth = null,
    int? StudentTrackingNumber = null,
    string? StudentNumber = null,
    int? StudentStartYear = null,
    int? StudentEndYear = null,
    string? Company = null,
    string? District = null,
    int? StudentYear2StartYear = null,
    int? StudentYear3StartYear = null);
public record ResetMemberPasswordRequest();
public record SetYearlyPaymentRequest(bool IsPaid);
public record MemberStatusResponse(bool Success, string Message, Guid Id);
public record MemberResponse(
    Guid Id,
    string FirstName,
    string LastName,
    string Email,
    string? Email2,
    string MemberRegistryNumber,
    string Role,
    string? PhonePrefix,
    string? PhoneNumber,
    string? Phone,
    int CpdHoursCompleted,
    int CpdHoursRequired,
    bool IsActive,
    bool AccountIsActive,
    bool IsExpired,
    int? YearlyPaymentPaidYear,
    bool EmailConfirmed,
    bool IsPendingConfirmation,
    Guid? MentorId,
    string? ValidUntilMonth,
    int? StudentTrackingNumber,
    string? StudentNumber,
    int? StudentStartYear,
    int? StudentEndYear,
    int? StudentYear2StartYear,
    int? StudentYear3StartYear,
    string? Company,
    string? District);
