using System.Diagnostics;

namespace IekaSmartClass.Api.Middleware;

public class RequestResponseLoggingMiddleware(RequestDelegate next, ILogger<RequestResponseLoggingMiddleware> logger)
{
    private readonly RequestDelegate _next = next;
    private readonly ILogger<RequestResponseLoggingMiddleware> _logger = logger;

    public async Task InvokeAsync(HttpContext context)
    {
        var sw = Stopwatch.StartNew();
        _logger.LogInformation("HTTP {RequestMethod} {RequestPath} started", context.Request.Method, context.Request.Path);

        await _next(context);

        sw.Stop();
        _logger.LogInformation("HTTP {RequestMethod} {RequestPath} responded {StatusCode} in {ElapsedMilliseconds} ms", 
            context.Request.Method, context.Request.Path, context.Response.StatusCode, sw.ElapsedMilliseconds);
    }
}
