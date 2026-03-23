using IekaSmartClass.Api.Services.Interface;
using IekaSmartClass.Api.Utilities.Context;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IekaSmartClass.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MentorQrController(IStudentTrainingService studentTrainingService) : ControllerBase
{
    private readonly IStudentTrainingService _studentTrainingService = studentTrainingService;

    [HttpGet("today")]
    [Authorize(Roles = "Mentor")]
    public async Task<IActionResult> GetTodayQr(
        [FromQuery] DateTime? date,
        [FromServices] IRequestContext context,
        CancellationToken cancellationToken)
    {
        if (context.UserId is null || string.IsNullOrWhiteSpace(context.UserRole))
            return Unauthorized();

        var selectedDate = (date ?? DateTime.UtcNow).Date;
        try
        {
            var result = await _studentTrainingService.GetMentorAttendanceQrAsync(
                selectedDate,
                context.UserId.Value,
                context.UserRole,
                cancellationToken);

            return Ok(new MentorAttendanceQrResponse(
                result.MentorId,
                result.Date.ToString("yyyy-MM-dd"),
                result.Token,
                result.ExpiresAt.ToString("yyyy-MM-ddTHH:mm:ssZ")));
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("confirm")]
    [Authorize(Roles = "Student")]
    public async Task<IActionResult> ConfirmAttendance(
        [FromBody] ScanStudentAttendanceRequest request,
        [FromServices] IRequestContext context,
        CancellationToken cancellationToken)
    {
        if (context.UserId is null || string.IsNullOrWhiteSpace(context.UserRole))
            return Unauthorized();

        try
        {
            var session = await _studentTrainingService.MarkAttendanceByMentorQrAsync(
                request.QrToken,
                context.UserId.Value,
                context.UserRole,
                cancellationToken);

            return Ok(new StudentAttendanceScanResponse(
                "Prezenca u konfirmua nga QR i mentorit.",
                StudentTrainingController.ToSessionResponse(session)));
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
