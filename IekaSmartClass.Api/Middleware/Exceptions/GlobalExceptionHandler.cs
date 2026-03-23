using System.Net;
using IekaSmartClass.Api.Middleware.Common;
using IekaSmartClass.Api.Middleware.Exceptions;
using Microsoft.AspNetCore.Diagnostics;

namespace IekaSmartClass.Api.Middleware;

public class GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger) : IExceptionHandler
{
    private readonly ILogger<GlobalExceptionHandler> _logger = logger;

    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        _logger.LogError(exception, "Exception occurred: {Message}", exception.Message);

        var (statusCode, title, detail, errors) = exception switch
        {
            CustomValidationException validationException => 
                (StatusCodes.Status400BadRequest, "Validation Error", exception.Message, validationException.Errors),
            UnauthorizedAccessException =>
                (StatusCodes.Status401Unauthorized, "Unauthorized", "You are not authorized to perform this action.", null),
            InvalidOperationException =>
                (StatusCodes.Status400BadRequest, "Invalid Operation", exception.Message, null),
            _ => (StatusCodes.Status500InternalServerError, "Server Error", "An error occurred while processing your request.", null)
        };

        var response = new ErrorResponse(
            type: $"https://httpstatuses.com/{statusCode}",
            title: title,
            status: statusCode,
            detail: detail,
            instance: httpContext.Request.Path
        )
        {
            Errors = errors as IDictionary<string, string[]>
        };

        httpContext.Response.StatusCode = statusCode;
        await httpContext.Response.WriteAsJsonAsync(response, cancellationToken);
        
        return true;
    }
}
