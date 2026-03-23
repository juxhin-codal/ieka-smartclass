using IekaSmartClass.Api.Services.Interface;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IekaSmartClass.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin")]
public class ConfigurationsController(IConfigurationService configurationService) : ControllerBase
{
    private readonly IConfigurationService _configurationService = configurationService;

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var result = await _configurationService.GetAllConfigurationsAsync();
        return Ok(result);
    }

    [HttpGet("{key}")]
    public async Task<IActionResult> GetConfig(string key)
    {
        var value = await _configurationService.GetConfigValueAsync(key);
        return value is null ? NotFound() : Ok(new { Key = key, Value = value });
    }

    [HttpPost]
    public async Task<IActionResult> SetConfig([FromBody] SetConfigRequest request)
    {
        await _configurationService.SetConfigValueAsync(request.Key, request.Value, request.Description);
        return Ok();
    }
}

public record SetConfigRequest(string Key, string Value, string? Description);
