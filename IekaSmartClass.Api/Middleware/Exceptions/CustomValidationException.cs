namespace IekaSmartClass.Api.Middleware.Exceptions;

public class CustomValidationException(IDictionary<string, string[]> errors) 
    : Exception("One or more validation failures have occurred.")
{
    public IDictionary<string, string[]> Errors { get; } = errors;
}
