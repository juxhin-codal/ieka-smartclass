namespace IekaSmartClass.Api.Services.Interface;

public interface IConfigurationService
{
    Task<string?> GetConfigValueAsync(string key);
    Task SetConfigValueAsync(string key, string value, string? description = null);
    Task<IReadOnlyList<ConfigDto>> GetAllConfigurationsAsync();
}

public record ConfigDto(string Key, string Value, string? Description);
