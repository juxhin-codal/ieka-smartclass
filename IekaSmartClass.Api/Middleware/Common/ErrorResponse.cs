namespace IekaSmartClass.Api.Middleware.Common;

public class ErrorResponse(string type, string title, int status, string detail, string? instance = null)
{
    public string Type { get; } = type;
    public string Title { get; } = title;
    public int Status { get; } = status;
    public string Detail { get; } = detail;
    public string? Instance { get; } = instance;
    public IDictionary<string, string[]>? Errors { get; set; }
}
