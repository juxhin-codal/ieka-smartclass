using IekaSmartClass.Api.Data.Entities;

namespace IekaSmartClass.Api.Services.Interface;

public interface IAuthService
{
    Task<LoginChallengeResult> StartLoginAsync(string identifier, string password, CancellationToken cancellationToken = default);
    Task<(string Token, AppUser User)> VerifyLoginOtpAsync(string challengeId, string otpCode, CancellationToken cancellationToken = default);
    Task ResendLoginOtpAsync(string challengeId, CancellationToken cancellationToken = default);
    Task SendForgotPasswordAsync(string email, CancellationToken cancellationToken = default);
    Task ResendAccountConfirmationAsync(string email, CancellationToken cancellationToken = default);
    Task VerifyResetCodeAsync(string email, string code, CancellationToken cancellationToken = default);
    Task<string> ConfirmEmailFromLinkAsync(string email, string code, CancellationToken cancellationToken = default);
    Task ResetPasswordAsync(string email, string code, string newPassword, string confirmPassword, CancellationToken cancellationToken = default);
}

public record LoginChallengeResult(
    string ChallengeId,
    string? EmailHint,
    string? PhoneHint,
    int ExpiresInSeconds);
