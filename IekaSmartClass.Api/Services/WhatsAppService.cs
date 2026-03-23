using System.Net.Http.Headers;
using System.Text;
using IekaSmartClass.Api.Data.Entities;
using IekaSmartClass.Api.Services.Interface;
using IekaSmartClass.Api.Utilities.Settings;
using Microsoft.Extensions.Options;

namespace IekaSmartClass.Api.Services;

public class WhatsAppService(
    IHttpClientFactory httpClientFactory,
    IOptions<WhatsAppSettings> options,
    ILogger<WhatsAppService> logger) : IWhatsAppService
{
    private readonly WhatsAppSettings _settings = options.Value;
    private readonly ILogger<WhatsAppService> _logger = logger;

    public async Task SendLoginOtpAsync(AppUser user, string otpCode, CancellationToken cancellationToken = default)
    {
        if (!_settings.Enabled)
        {
            return;
        }

        if (string.IsNullOrWhiteSpace(user.PhoneNumber))
        {
            _logger.LogWarning("Skipping WhatsApp OTP for user {UserId}: phone number missing.", user.Id);
            return;
        }

        if (!string.Equals(_settings.Provider, "Twilio", StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning("Unsupported WhatsApp provider '{Provider}'.", _settings.Provider);
            return;
        }

        var twilio = _settings.Twilio;
        if (string.IsNullOrWhiteSpace(twilio.AccountSid) ||
            string.IsNullOrWhiteSpace(twilio.AuthToken) ||
            string.IsNullOrWhiteSpace(twilio.FromNumber))
        {
            _logger.LogWarning("WhatsApp is enabled but Twilio settings are incomplete. Skipping message send.");
            return;
        }

        var to = EnsureWhatsAppPrefix(user.PhoneNumber);
        var from = EnsureWhatsAppPrefix(twilio.FromNumber);
        var body = $"Kodi juaj i hyrjes IEKA SmartClass është: {otpCode}. Kodi skadon pas pak minutash.";

        var client = httpClientFactory.CreateClient(nameof(WhatsAppService));
        var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"https://api.twilio.com/2010-04-01/Accounts/{twilio.AccountSid}/Messages.json");

        var authBytes = Encoding.ASCII.GetBytes($"{twilio.AccountSid}:{twilio.AuthToken}");
        request.Headers.Authorization = new AuthenticationHeaderValue("Basic", Convert.ToBase64String(authBytes));
        request.Content = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["To"] = to,
            ["From"] = from,
            ["Body"] = body
        });

        var response = await client.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
            _logger.LogError(
                "Failed to send WhatsApp OTP to {Phone}. Status: {Status}. Response: {Body}",
                user.PhoneNumber,
                response.StatusCode,
                responseBody);
            throw new InvalidOperationException("Failed to send WhatsApp OTP.");
        }

        _logger.LogInformation("WhatsApp OTP sent for user {UserId}", user.Id);
    }

    private static string EnsureWhatsAppPrefix(string phone)
    {
        var trimmed = phone.Trim();
        return trimmed.StartsWith("whatsapp:", StringComparison.OrdinalIgnoreCase)
            ? trimmed
            : $"whatsapp:{trimmed}";
    }
}
