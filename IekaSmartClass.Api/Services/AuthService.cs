using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using IekaSmartClass.Api.Data.Entities;
using IekaSmartClass.Api.Services.Interface;
using IekaSmartClass.Api.Utilities.Settings;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace IekaSmartClass.Api.Services;

public class AuthService(
    UserManager<AppUser> userManager,
    SignInManager<AppUser> signInManager,
    IEmailService emailService,
    IWhatsAppService whatsAppService,
    IOptions<TwoFactorSettings> twoFactorOptions,
    IOptions<JwtSettings> jwtOptions) : IAuthService
{
    private readonly JwtSettings _jwtSettings = jwtOptions.Value;
    private readonly TwoFactorSettings _twoFactorSettings = twoFactorOptions.Value;

    public async Task<LoginChallengeResult> StartLoginAsync(string identifier, string password, CancellationToken cancellationToken = default)
    {
        var user = await FindUserByIdentifierAsync(identifier, cancellationToken);

        if (user is null)
        {
            throw new UnauthorizedAccessException("Email ose fjalëkalim i pasaktë.");
        }

        if (user.IsPendingConfirmation || !user.EmailConfirmed)
        {
            throw new UnauthorizedAccessException("Llogaria është në pritje të konfirmimit të email-it.");
        }

        EnsureUserCanLogin(user);

        var signInResult = await signInManager.CheckPasswordSignInAsync(user, password, lockoutOnFailure: false);
        if (!signInResult.Succeeded)
        {
            throw new UnauthorizedAccessException("Email ose fjalëkalim i pasaktë.");
        }

        return await GenerateAndSendLoginOtpAsync(user, rotateChallengeId: true, cancellationToken);
    }

    public async Task<(string Token, AppUser User)> VerifyLoginOtpAsync(string challengeId, string otpCode, CancellationToken cancellationToken = default)
    {
        var normalizedChallengeId = challengeId.Trim();
        var normalizedOtpCode = otpCode.Trim();

        var user = await userManager.Users.FirstOrDefaultAsync(
            u => u.LoginOtpChallengeId == normalizedChallengeId,
            cancellationToken);

        if (user is null ||
            string.IsNullOrWhiteSpace(user.LoginOtpCode) ||
            user.LoginOtpExpiresAt is null)
        {
            throw new UnauthorizedAccessException("Kodi OTP është i pavlefshëm ose ka skaduar.");
        }

        EnsureUserCanLogin(user);

        if (DateTime.UtcNow > user.LoginOtpExpiresAt.Value)
        {
            throw new UnauthorizedAccessException("Kodi OTP ka skaduar.");
        }

        if (!string.Equals(user.LoginOtpCode, normalizedOtpCode, StringComparison.Ordinal))
        {
            throw new UnauthorizedAccessException("Kodi OTP është i pasaktë.");
        }

        user.LoginOtpCode = null;
        user.LoginOtpExpiresAt = null;
        user.LoginOtpChallengeId = null;

        var updateResult = await userManager.UpdateAsync(user);
        if (!updateResult.Succeeded)
        {
            var errors = string.Join(", ", updateResult.Errors.Select(e => e.Description));
            throw new InvalidOperationException(errors);
        }

        var token = await CreateTokenAsync(user);
        return (token, user);
    }

    public async Task ResendLoginOtpAsync(string challengeId, CancellationToken cancellationToken = default)
    {
        var normalizedChallengeId = challengeId.Trim();
        var user = await userManager.Users.FirstOrDefaultAsync(
            u => u.LoginOtpChallengeId == normalizedChallengeId,
            cancellationToken);

        if (user is null)
        {
            throw new InvalidOperationException("Sesioni i OTP nuk u gjet. Rihyni përsëri.");
        }

        EnsureUserCanLogin(user);

        await GenerateAndSendLoginOtpAsync(user, rotateChallengeId: false, cancellationToken);
    }

    public async Task SendForgotPasswordAsync(string email, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            throw new InvalidOperationException("Email-i është i detyrueshëm.");
        }

        var user = await FindUserByIdentifierAsync(email, cancellationToken);

        if (user is null)
        {
            throw new InvalidOperationException("Përdoruesi nuk u gjet.");
        }

        if (user.IsPendingConfirmation || !user.EmailConfirmed)
        {
            throw new InvalidOperationException("Llogaria nuk është konfirmuar ende.");
        }

        var resetCode = GenerateEmailCode();
        user.PasswordResetCode = resetCode;
        user.PasswordResetExpiresAt = DateTime.UtcNow.AddMinutes(30);

        var updateResult = await userManager.UpdateAsync(user);
        if (!updateResult.Succeeded)
        {
            var errors = string.Join(", ", updateResult.Errors.Select(e => e.Description));
            throw new InvalidOperationException(errors);
        }

        try
        {
            await emailService.SendPasswordResetCodeAsync(user, resetCode, cancellationToken);
        }
        catch (Exception)
        {
            throw new InvalidOperationException("Nuk u dërgua email-i i rivendosjes. Kontrollo konfigurimin SMTP.");
        }
    }

    public async Task ResendAccountConfirmationAsync(string email, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            throw new InvalidOperationException("Email-i është i detyrueshëm.");
        }

        var user = await FindUserByIdentifierAsync(email, cancellationToken);

        if (user is null)
        {
            throw new InvalidOperationException("Përdoruesi nuk u gjet.");
        }

        if (user.EmailConfirmed && !user.IsPendingConfirmation)
        {
            throw new InvalidOperationException("Llogaria është konfirmuar tashmë.");
        }

        var confirmationCode = GenerateEmailCode();
        user.EmailConfirmationCode = confirmationCode;
        user.EmailConfirmationExpiresAt = DateTime.UtcNow.AddMinutes(30);

        var updateResult = await userManager.UpdateAsync(user);
        if (!updateResult.Succeeded)
        {
            var errors = string.Join(", ", updateResult.Errors.Select(e => e.Description));
            throw new InvalidOperationException(errors);
        }

        try
        {
            await emailService.SendAccountConfirmationLinkAsync(user, confirmationCode, cancellationToken);
        }
        catch (Exception)
        {
            throw new InvalidOperationException("Nuk u dërgua email-i i konfirmimit. Kontrollo konfigurimin SMTP.");
        }
    }

    public async Task VerifyResetCodeAsync(string email, string code, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            throw new InvalidOperationException("Email-i është i detyrueshëm.");
        }

        if (string.IsNullOrWhiteSpace(code))
        {
            throw new InvalidOperationException("Kodi sekret është i detyrueshëm.");
        }

        var user = await FindUserByIdentifierAsync(email, cancellationToken);
        if (user is null)
        {
            throw new InvalidOperationException("Përdoruesi nuk u gjet.");
        }

        if (string.IsNullOrWhiteSpace(user.PasswordResetCode) || user.PasswordResetExpiresAt is null)
        {
            throw new InvalidOperationException("Kodi i resetimit ka skaduar.");
        }

        if (DateTime.UtcNow > user.PasswordResetExpiresAt.Value)
        {
            throw new InvalidOperationException("Kodi i resetimit ka skaduar.");
        }

        if (!string.Equals(user.PasswordResetCode, code.Trim(), StringComparison.Ordinal))
        {
            throw new InvalidOperationException("Kodi i resetimit është i pavlefshëm.");
        }
    }

    public async Task<string> ConfirmEmailFromLinkAsync(string email, string code, CancellationToken cancellationToken = default)
    {
        var user = await FindUserByIdentifierAsync(email, cancellationToken);

        if (user is null)
        {
            throw new InvalidOperationException("Lidhja e konfirmimit është e pavlefshme.");
        }

        if (string.IsNullOrWhiteSpace(user.EmailConfirmationCode) || user.EmailConfirmationExpiresAt is null)
        {
            throw new InvalidOperationException("Lidhja e konfirmimit ka skaduar.");
        }

        if (DateTime.UtcNow > user.EmailConfirmationExpiresAt.Value)
        {
            throw new InvalidOperationException("Lidhja e konfirmimit ka skaduar.");
        }

        if (!string.Equals(user.EmailConfirmationCode, code.Trim(), StringComparison.Ordinal))
        {
            throw new InvalidOperationException("Kodi i konfirmimit është i pavlefshëm.");
        }

        user.EmailConfirmed = true;
        if (string.Equals(user.Role, "Member", StringComparison.OrdinalIgnoreCase))
        {
            user.ConfirmEmail();
        }
        else
        {
            user.Activate();
        }
        user.EmailConfirmationCode = null;
        user.EmailConfirmationExpiresAt = null;

        var resetCode = GenerateEmailCode();
        user.PasswordResetCode = resetCode;
        user.PasswordResetExpiresAt = DateTime.UtcNow.AddMinutes(30);

        var updateResult = await userManager.UpdateAsync(user);
        if (!updateResult.Succeeded)
        {
            var errors = string.Join(", ", updateResult.Errors.Select(e => e.Description));
            throw new InvalidOperationException(errors);
        }

        return resetCode;
    }

    public async Task ResetPasswordAsync(string email, string code, string newPassword, string confirmPassword, CancellationToken cancellationToken = default)
    {
        if (!string.Equals(newPassword, confirmPassword, StringComparison.Ordinal))
        {
            throw new InvalidOperationException("Fjalëkalimi dhe konfirmimi nuk përputhen.");
        }

        var user = await FindUserByIdentifierAsync(email, cancellationToken);
        if (user is null)
        {
            throw new InvalidOperationException("Përdoruesi nuk u gjet.");
        }

        if (string.IsNullOrWhiteSpace(user.PasswordResetCode) || user.PasswordResetExpiresAt is null)
        {
            throw new InvalidOperationException("Kodi i resetimit ka skaduar.");
        }

        if (DateTime.UtcNow > user.PasswordResetExpiresAt.Value)
        {
            throw new InvalidOperationException("Kodi i resetimit ka skaduar.");
        }

        if (!string.Equals(user.PasswordResetCode, code.Trim(), StringComparison.Ordinal))
        {
            throw new InvalidOperationException("Kodi i resetimit është i pavlefshëm.");
        }

        if (!string.IsNullOrWhiteSpace(user.PasswordHash))
        {
            var removeResult = await userManager.RemovePasswordAsync(user);
            if (!removeResult.Succeeded)
            {
                var removeErrors = string.Join(", ", removeResult.Errors.Select(e => e.Description));
                throw new InvalidOperationException(removeErrors);
            }
        }

        var addResult = await userManager.AddPasswordAsync(user, newPassword);
        if (!addResult.Succeeded)
        {
            var addErrors = string.Join(", ", addResult.Errors.Select(e => e.Description));
            throw new InvalidOperationException(addErrors);
        }

        user.PasswordResetCode = null;
        user.PasswordResetExpiresAt = null;
        if (user.EmailConfirmed)
        {
            if (string.Equals(user.Role, "Member", StringComparison.OrdinalIgnoreCase))
            {
                user.ConfirmEmail();
            }
            else
            {
                user.Activate();
            }
        }

        var updateResult = await userManager.UpdateAsync(user);
        if (!updateResult.Succeeded)
        {
            var errors = string.Join(", ", updateResult.Errors.Select(e => e.Description));
            throw new InvalidOperationException(errors);
        }
    }

    private Task<string> CreateTokenAsync(AppUser user)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, $"{user.FirstName} {user.LastName}".Trim()),
            new(ClaimTypes.Email, user.Email ?? string.Empty),
            new(ClaimTypes.Role, user.Role),
            new("nameid", user.Id.ToString()),
            new("name", $"{user.FirstName} {user.LastName}".Trim()),
            new("email", user.Email ?? string.Empty),
            new("role", user.Role),
            new("RegistryNumber", user.MemberRegistryNumber),
            new("IsActive", user.IsEffectivelyActive() ? "true" : "false")
        };

        if (user.YearlyPaymentPaidYear.HasValue)
        {
            claims.Add(new Claim("YearlyPaymentPaidYear", user.YearlyPaymentPaidYear.Value.ToString()));
        }

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtSettings.Secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = DateTime.UtcNow.AddMinutes(_jwtSettings.ExpiryMinutes),
            Issuer = _jwtSettings.Issuer,
            Audience = _jwtSettings.Audience,
            SigningCredentials = creds
        };

        var tokenHandler = new JwtSecurityTokenHandler();
        var token = tokenHandler.CreateToken(tokenDescriptor);
        return Task.FromResult(tokenHandler.WriteToken(token));
    }

    private static string GenerateEmailCode()
    {
        var bytes = new byte[4];
        RandomNumberGenerator.Fill(bytes);
        var value = BitConverter.ToUInt32(bytes, 0) % 1_000_000;
        return value.ToString("D6");
    }

    private Task<AppUser?> FindUserByIdentifierAsync(string identifier, CancellationToken cancellationToken)
    {
        var trimmedIdentifier = identifier.Trim();
        var normalizedIdentifier = identifier.Trim().ToUpperInvariant();
        return userManager.Users.FirstOrDefaultAsync(
            u =>
                u.NormalizedEmail == normalizedIdentifier ||
                (u.Email2 != null && u.Email2.ToUpper() == normalizedIdentifier) ||
                u.MemberRegistryNumber == trimmedIdentifier ||
                u.MemberRegistryNumber.ToUpper() == normalizedIdentifier ||
                (u.Email != null && u.Email.ToUpper() == normalizedIdentifier) ||
                (u.UserName != null && u.UserName.ToUpper() == normalizedIdentifier),
            cancellationToken);
    }

    private async Task<LoginChallengeResult> GenerateAndSendLoginOtpAsync(AppUser user, bool rotateChallengeId, CancellationToken cancellationToken)
    {
        var otpTtlMinutes = Math.Clamp(_twoFactorSettings.OtpTtlMinutes, 1, 30);
        var code = GenerateEmailCode();
        user.LoginOtpCode = code;
        user.LoginOtpExpiresAt = DateTime.UtcNow.AddMinutes(otpTtlMinutes);
        if (rotateChallengeId || string.IsNullOrWhiteSpace(user.LoginOtpChallengeId))
        {
            user.LoginOtpChallengeId = Guid.NewGuid().ToString("N");
        }

        var updateResult = await userManager.UpdateAsync(user);
        if (!updateResult.Succeeded)
        {
            var errors = string.Join(", ", updateResult.Errors.Select(e => e.Description));
            throw new InvalidOperationException(errors);
        }

        await emailService.SendLoginOtpCodeAsync(user, code, cancellationToken);
        try
        {
            await whatsAppService.SendLoginOtpAsync(user, code, cancellationToken);
        }
        catch
        {
            // Keep login available even if WhatsApp provider fails; email delivery remains mandatory.
        }

        return new LoginChallengeResult(
            user.LoginOtpChallengeId!,
            MaskEmail(user.Email),
            MaskPhone(user.PhoneNumber),
            otpTtlMinutes * 60);
    }

    private static void EnsureUserCanLogin(AppUser user)
    {
        if (!user.IsActive && !string.Equals(user.Role, "Member", StringComparison.OrdinalIgnoreCase))
        {
            throw new UnauthorizedAccessException("Llogaria është jo aktive.");
        }

        if (user.IsStudentLoginExpired())
        {
            throw new UnauthorizedAccessException("Afati i vlefshmërisë së studentit ka përfunduar.");
        }
    }

    private static string? MaskEmail(string? email)
    {
        if (string.IsNullOrWhiteSpace(email)) return null;
        var trimmed = email.Trim();
        var atIndex = trimmed.IndexOf('@');
        if (atIndex <= 1) return trimmed;

        var local = trimmed[..atIndex];
        var domain = trimmed[(atIndex + 1)..];
        var maskedLocal = $"{local[0]}***{local[^1]}";
        return $"{maskedLocal}@{domain}";
    }

    private static string? MaskPhone(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone)) return null;
        var trimmed = phone.Trim();
        if (trimmed.Length <= 4) return trimmed;
        return $"{new string('*', Math.Max(0, trimmed.Length - 4))}{trimmed[^4..]}";
    }
}
