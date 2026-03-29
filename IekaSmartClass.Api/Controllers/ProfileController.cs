using IekaSmartClass.Api.Services.Interface;
using IekaSmartClass.Api.Utilities;
using IekaSmartClass.Api.Utilities.Context;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IekaSmartClass.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ProfileController(IProfileService profileService, IRequestContext requestContext) : ControllerBase
{
    private readonly IProfileService _profileService = profileService;
    private readonly IRequestContext _requestContext = requestContext;

    [HttpGet]
    public async Task<IActionResult> GetProfile()
    {
        if (_requestContext.UserId == null) return Unauthorized();

        var profile = await _profileService.GetMyProfileAsync(_requestContext.UserId.Value);
        if (profile is null) return NotFound();

        var (prefix, number) = PhoneHelper.Split(profile.Phone);
        return Ok(new ProfileResponse(
                profile.Id,
                profile.FirstName,
                profile.LastName,
                profile.Email ?? string.Empty,
                profile.MemberRegistryNumber,
                profile.Role,
                prefix,
                number,
                profile.Phone,
                profile.IsEffectivelyActive(),
                profile.YearlyPaymentPaidYear,
                profile.EmailConfirmed,
                profile.IsPendingConfirmation));
    }

    [HttpPut]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest request)
    {
        if (_requestContext.UserId == null) return Unauthorized();

        var phone = request.PhonePrefix != null || request.PhoneNumber != null
            ? PhoneHelper.Combine(request.PhonePrefix, request.PhoneNumber)
            : request.Phone;

        await _profileService.UpdateMyProfileAsync(
            _requestContext.UserId.Value,
            request.FirstName,
            request.LastName,
            request.Email,
            phone);

        return NoContent();
    }

    [HttpGet("export")]
    public async Task<IActionResult> ExportProfileData(CancellationToken cancellationToken)
    {
        if (_requestContext.UserId == null) return Unauthorized();

        var export = await _profileService.ExportMyDataAsync(_requestContext.UserId.Value, cancellationToken);
        return File(export.Content, export.ContentType, export.FileName);
    }
}

public record UpdateProfileRequest(string FirstName, string LastName, string Email, string? PhonePrefix = null, string? PhoneNumber = null, string? Phone = null);
public record ProfileResponse(
    Guid Id,
    string FirstName,
    string LastName,
    string Email,
    string MemberRegistryNumber,
    string Role,
    string? PhonePrefix,
    string? PhoneNumber,
    string? Phone,
    bool IsActive,
    int? YearlyPaymentPaidYear,
    bool EmailConfirmed,
    bool IsPendingConfirmation);
