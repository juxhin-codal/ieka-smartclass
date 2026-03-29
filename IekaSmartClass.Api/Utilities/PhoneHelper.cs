namespace IekaSmartClass.Api.Utilities;

public static class PhoneHelper
{
    public const string DefaultPrefix = "+355";

    public static (string Prefix, string Number) Split(string? fullPhone)
    {
        if (string.IsNullOrWhiteSpace(fullPhone))
            return (DefaultPrefix, "");

        var trimmed = fullPhone.Trim();

        if (trimmed.StartsWith("+355"))
            return ("+355", trimmed[4..].TrimStart());

        if (trimmed.StartsWith("+") && trimmed.Length > 4)
            return (trimmed[..4], trimmed[4..].TrimStart());

        if (trimmed.StartsWith("+"))
            return (trimmed, "");

        return (DefaultPrefix, trimmed);
    }

    public static string? Combine(string? prefix, string? number)
    {
        var n = number?.Trim().Replace(" ", "");
        if (string.IsNullOrWhiteSpace(n))
            return null;

        var p = prefix?.Trim();
        if (string.IsNullOrWhiteSpace(p))
            p = DefaultPrefix;

        return p + n;
    }
}
