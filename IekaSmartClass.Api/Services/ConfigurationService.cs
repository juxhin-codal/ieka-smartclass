using IekaSmartClass.Api.Data;
using IekaSmartClass.Api.Data.Entities;
using IekaSmartClass.Api.Data.Repositories.Interface;
using IekaSmartClass.Api.Services.Interface;
using Microsoft.EntityFrameworkCore;

namespace IekaSmartClass.Api.Services;

public class ConfigurationService(
    IRepository<SystemConfiguration> configRepository,
    IApplicationDbContext dbContext) : IConfigurationService
{
    private readonly IRepository<SystemConfiguration> _configRepository = configRepository;
    private readonly IApplicationDbContext _dbContext = dbContext;

    public async Task<string?> GetConfigValueAsync(string key)
    {
        var config = await _configRepository.Query().FirstOrDefaultAsync(c => c.Key == key);
        return config?.Value;
    }

    public async Task SetConfigValueAsync(string key, string value, string? description = null)
    {
        var config = await _configRepository.Query().FirstOrDefaultAsync(c => c.Key == key);
        if (config == null)
        {
            config = new SystemConfiguration(key, value, description);
            await _configRepository.AddAsync(config);
        }
        else
        {
            config.UpdateValue(value);
        }

        await _dbContext.SaveChangesAsync();
    }

    public async Task<IReadOnlyList<ConfigDto>> GetAllConfigurationsAsync()
    {
        return await _configRepository.Query()
            .Select(c => new ConfigDto(c.Key, c.Value, c.Description))
            .ToListAsync();
    }
}
