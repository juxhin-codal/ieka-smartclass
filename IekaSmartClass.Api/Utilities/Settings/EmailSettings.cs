namespace IekaSmartClass.Api.Utilities.Settings;

public class EmailSettings
{
    public const string SectionName = "Email";

    public string AppName { get; set; } = "IEKA SmartClass";
    public string FrontendBaseUrl { get; set; } = "https://iekaclass.vercel.app";
    public SmtpSettings Smtp { get; set; } = new();
}

public class SmtpSettings
{
    public string Host { get; set; } = string.Empty;
    public int Port { get; set; } = 587;
    public bool UseSsl { get; set; } = true;
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string? FromAddress { get; set; }
    public string FromName { get; set; } = "IEKA SmartClass";
}
