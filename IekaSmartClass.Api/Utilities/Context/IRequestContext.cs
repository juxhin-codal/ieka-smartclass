namespace IekaSmartClass.Api.Utilities.Context;

public interface IRequestContext
{
    Guid? UserId { get; }
    string? UserRole { get; }
    string? RegistryNumber { get; }
}
