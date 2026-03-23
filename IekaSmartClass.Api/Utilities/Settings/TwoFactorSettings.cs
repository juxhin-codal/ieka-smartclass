namespace IekaSmartClass.Api.Utilities.Settings;

public class TwoFactorSettings
{
    public const string SectionName = "TwoFactor";

    public bool Enabled { get; set; } = true;
    public int OtpTtlMinutes { get; set; } = 10;
}
