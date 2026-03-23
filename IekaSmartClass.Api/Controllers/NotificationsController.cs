using IekaSmartClass.Api.Services.Interface;
using IekaSmartClass.Api.Utilities.Context;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IekaSmartClass.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class NotificationsController(
    INotificationService notificationService,
    IRequestContext requestContext) : ControllerBase
{
    private readonly INotificationService _notificationService = notificationService;
    private readonly IRequestContext _requestContext = requestContext;

    [HttpGet]
    public async Task<IActionResult> GetNotifications([FromQuery] int take = 20, CancellationToken cancellationToken = default)
    {
        if (_requestContext.UserId is null) return Unauthorized();
        var result = await _notificationService.GetUserNotificationsAsync(_requestContext.UserId.Value, take, cancellationToken);
        return Ok(result);
    }

    [HttpGet("preferences")]
    public async Task<IActionResult> GetPreferences(CancellationToken cancellationToken = default)
    {
        if (_requestContext.UserId is null) return Unauthorized();
        var result = await _notificationService.GetNotificationPreferencesAsync(_requestContext.UserId.Value, cancellationToken);
        return Ok(result);
    }

    [HttpPut("preferences")]
    public async Task<IActionResult> UpdatePreferences([FromBody] UpdateNotificationPreferencesRequest request, CancellationToken cancellationToken = default)
    {
        if (_requestContext.UserId is null) return Unauthorized();
        await _notificationService.UpdateNotificationPreferencesAsync(
            _requestContext.UserId.Value,
            new UpdateNotificationPreferencesDto(
                request.NotifyByEmail,
                request.NotifyBySms,
                request.NotifyBookingOpen,
                request.NotifySessionReminder,
                request.NotifySurveyReminder,
                request.NotifyCpdDeadline),
            cancellationToken);
        return NoContent();
    }

    [HttpPost("{id:guid}/read")]
    public async Task<IActionResult> MarkAsRead(Guid id, CancellationToken cancellationToken = default)
    {
        if (_requestContext.UserId is null) return Unauthorized();
        await _notificationService.MarkAsReadAsync(_requestContext.UserId.Value, id, cancellationToken);
        return NoContent();
    }

    [HttpPost("read-all")]
    public async Task<IActionResult> MarkAllAsRead(CancellationToken cancellationToken = default)
    {
        if (_requestContext.UserId is null) return Unauthorized();
        await _notificationService.MarkAllAsReadAsync(_requestContext.UserId.Value, cancellationToken);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken = default)
    {
        if (_requestContext.UserId is null) return Unauthorized();
        await _notificationService.DeleteNotificationAsync(_requestContext.UserId.Value, id, cancellationToken);
        return NoContent();
    }
}

public record UpdateNotificationPreferencesRequest(
    bool NotifyByEmail,
    bool NotifyBySms,
    bool NotifyBookingOpen,
    bool NotifySessionReminder,
    bool NotifySurveyReminder,
    bool NotifyCpdDeadline);
