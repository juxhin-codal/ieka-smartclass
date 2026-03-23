namespace IekaSmartClass.Api.Utilities.Settings;

public class WhatsAppSettings
{
    public const string SectionName = "WhatsApp";

    public bool Enabled { get; set; } = false;
    public string Provider { get; set; } = "Twilio";
    public TwilioWhatsAppSettings Twilio { get; set; } = new();
}

public class TwilioWhatsAppSettings
{
    public string AccountSid { get; set; } = string.Empty;
    public string AuthToken { get; set; } = string.Empty;
    public string FromNumber { get; set; } = string.Empty;
}
