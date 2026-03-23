using IekaSmartClass.Api.Data.Entities;

namespace IekaSmartClass.Api.Services.Interface;

public interface IWhatsAppService
{
    Task SendLoginOtpAsync(AppUser user, string otpCode, CancellationToken cancellationToken = default);
}
