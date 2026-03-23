using IekaSmartClass.Api.Services.Interface;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IekaSmartClass.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController(IAuthService authService) : ControllerBase
{
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login([FromBody] LoginRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var challenge = await authService.StartLoginAsync(request.Identifier, request.Password, cancellationToken);
            return Ok(new LoginChallengeResponse(
                true,
                "Kodi OTP u dërgua. Kontrolloni email-in dhe WhatsApp.",
                challenge.ChallengeId,
                challenge.EmailHint,
                challenge.PhoneHint,
                challenge.ExpiresInSeconds));
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new StatusResponse(false, ex.Message));
        }
    }

    [HttpPost("verify-2fa")]
    [AllowAnonymous]
    public async Task<IActionResult> VerifyTwoFactor([FromBody] VerifyTwoFactorRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var (token, user) = await authService.VerifyLoginOtpAsync(request.ChallengeId, request.Code, cancellationToken);
            return Ok(new AuthResponse(
                token,
                user.Id,
                user.FirstName,
                user.LastName,
                user.Role,
                user.Email ?? string.Empty,
                user.MemberRegistryNumber,
                user.IsEffectivelyActive(),
                user.YearlyPaymentPaidYear,
                user.EmailConfirmed,
                user.IsPendingConfirmation));
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new StatusResponse(false, ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new StatusResponse(false, ex.Message));
        }
    }

    [HttpPost("resend-2fa")]
    [AllowAnonymous]
    public async Task<IActionResult> ResendTwoFactor([FromBody] ResendTwoFactorRequest request, CancellationToken cancellationToken)
    {
        try
        {
            await authService.ResendLoginOtpAsync(request.ChallengeId, cancellationToken);
            return Ok(new StatusResponse(true, "Kodi OTP u ridërgua."));
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new StatusResponse(false, ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new StatusResponse(false, ex.Message));
        }
    }

    [HttpPost("forgot-password")]
    [AllowAnonymous]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request, CancellationToken cancellationToken)
    {
        try
        {
            await authService.SendForgotPasswordAsync(request.Email, cancellationToken);
            return Ok(new StatusResponse(true, "Kodi sekret i resetimit u dërgua."));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new StatusResponse(false, ex.Message));
        }
    }

    [HttpPost("resend-confirmation")]
    [AllowAnonymous]
    public async Task<IActionResult> ResendConfirmation([FromBody] ForgotPasswordRequest request, CancellationToken cancellationToken)
    {
        try
        {
            await authService.ResendAccountConfirmationAsync(request.Email, cancellationToken);
            return Ok(new StatusResponse(true, "Email-i i konfirmimit u ridërgua."));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new StatusResponse(false, ex.Message));
        }
    }

    [HttpPost("verify-reset-code")]
    [AllowAnonymous]
    public async Task<IActionResult> VerifyResetCode([FromBody] VerifyResetCodeRequest request, CancellationToken cancellationToken)
    {
        try
        {
            await authService.VerifyResetCodeAsync(request.Email, request.Code, cancellationToken);
            return Ok(new StatusResponse(true, "Kodi i resetimit u verifikua."));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new StatusResponse(false, ex.Message));
        }
    }

    [HttpPost("confirm-email-link")]
    [AllowAnonymous]
    public async Task<IActionResult> ConfirmEmailLink([FromBody] ConfirmEmailLinkRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var resetCode = await authService.ConfirmEmailFromLinkAsync(request.Email, request.Code, cancellationToken);
            return Ok(new ConfirmEmailLinkResponse(
                true,
                "Email-i u konfirmua. Vendos fjalëkalimin e ri.",
                request.Email,
                resetCode));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new ConfirmEmailLinkResponse(false, ex.Message, request.Email, null));
        }
    }

    [HttpPost("reset-password")]
    [AllowAnonymous]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request, CancellationToken cancellationToken)
    {
        try
        {
            await authService.ResetPasswordAsync(request.Email, request.Code, request.NewPassword, request.ConfirmNewPassword, cancellationToken);
            return Ok(new StatusResponse(true, "Fjalëkalimi u përditësua me sukses."));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new StatusResponse(false, ex.Message));
        }
    }
}

public record LoginRequest(string Identifier, string Password);
public record VerifyTwoFactorRequest(string ChallengeId, string Code);
public record ResendTwoFactorRequest(string ChallengeId);
public record ForgotPasswordRequest(string Email);
public record VerifyResetCodeRequest(string Email, string Code);
public record ConfirmEmailLinkRequest(string Email, string Code);
public record ResetPasswordRequest(string Email, string Code, string NewPassword, string ConfirmNewPassword);
public record LoginChallengeResponse(
    bool Success,
    string Message,
    string ChallengeId,
    string? EmailHint,
    string? PhoneHint,
    int ExpiresInSeconds);

public record AuthResponse(
    string Token,
    Guid UserId,
    string FirstName,
    string LastName,
    string Role,
    string Email,
    string RegistryNumber,
    bool IsActive,
    int? YearlyPaymentPaidYear,
    bool EmailConfirmed,
    bool IsPendingConfirmation);

public record StatusResponse(bool Success, string Message);
public record ConfirmEmailLinkResponse(bool Success, string Message, string Email, string? ResetCode);
