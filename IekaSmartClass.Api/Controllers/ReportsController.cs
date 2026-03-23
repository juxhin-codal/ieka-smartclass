using IekaSmartClass.Api.Services.Interface;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IekaSmartClass.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin")]
public class ReportsController(IReportsService reportsService) : ControllerBase
{
    private readonly IReportsService _reportsService = reportsService;

    [HttpGet("dashboard")]
    public async Task<IActionResult> GetDashboardStats()
    {
        var stats = await _reportsService.GetDashboardStatsAsync();
        return Ok(stats);
    }
}
