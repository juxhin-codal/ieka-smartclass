using IekaSmartClass.Api.Services.Interface;
using IekaSmartClass.Api.Utilities.Context;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IekaSmartClass.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class StudentTrainingController(IStudentTrainingService studentTrainingService) : ControllerBase
{
    private readonly IStudentTrainingService _studentTrainingService = studentTrainingService;

    [HttpGet("students")]
    [Authorize(Roles = "Admin,Mentor")]
    public async Task<IActionResult> GetStudents(
        [FromQuery] Guid? mentorId,
        [FromServices] IRequestContext context,
        CancellationToken cancellationToken)
    {
        if (context.UserId is null || string.IsNullOrWhiteSpace(context.UserRole))
            return Unauthorized();

        try
        {
            var students = await _studentTrainingService.GetManageableStudentsAsync(
                context.UserId.Value,
                context.UserRole,
                mentorId,
                cancellationToken);

            return Ok(students.Select(s => new StudentSummaryResponse(
                s.Student.Id,
                s.Student.FirstName,
                s.Student.LastName,
                s.Student.Email ?? string.Empty,
                s.Student.MemberRegistryNumber,
                s.Student.StudentTrackingNumber,
                s.Student.StudentNumber,
                s.Student.MentorId,
                s.Student.IsEffectivelyActive(),
                s.Student.IsActive,
                s.Student.IsStudentLoginExpired(),
                s.Student.StudentValidUntilUtc?.ToString("yyyy-MM"),
                s.AttendedSessions,
                s.TotalSessions,
                s.Student.StudentStartYear,
                s.Student.StudentYear2StartYear,
                s.Student.StudentYear3StartYear)));
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

    [HttpGet("students/{studentId:guid}/schedule")]
    [Authorize]
    public async Task<IActionResult> GetStudentSchedule(
        Guid studentId,
        [FromServices] IRequestContext context,
        CancellationToken cancellationToken)
    {
        if (context.UserId is null || string.IsNullOrWhiteSpace(context.UserRole))
            return Unauthorized();

        try
        {
            var sessions = await _studentTrainingService.GetStudentScheduleAsync(
                studentId,
                context.UserId.Value,
                context.UserRole,
                cancellationToken);

            return Ok(ToCalendarResponse(sessions));
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
    [HttpGet("my-calendar")]
    [Authorize]
    public async Task<IActionResult> GetMyCalendar(
        [FromServices] IRequestContext context,
        CancellationToken cancellationToken)
    {
        if (context.UserId is null || string.IsNullOrWhiteSpace(context.UserRole))
            return Unauthorized();

        try
        {
            var sessions = await _studentTrainingService.GetStudentScheduleAsync(
                context.UserId.Value,
                context.UserId.Value,
                context.UserRole,
                cancellationToken);

            return Ok(ToCalendarResponse(sessions));
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

    [HttpPut("students/{studentId:guid}/schedule")]
    [Authorize(Roles = "Admin,Mentor")]
    public async Task<IActionResult> UpsertStudentSchedule(
        Guid studentId,
        [FromBody] UpdateStudentScheduleRequest request,
        [FromServices] IRequestContext context,
        CancellationToken cancellationToken)
    {
        if (context.UserId is null || string.IsNullOrWhiteSpace(context.UserRole))
            return Unauthorized();

        if (request.Sessions is null)
            return BadRequest(new { message = "Sessions are required." });

        var parsedSessions = new List<TrainingScheduleInput>();
        foreach (var session in request.Sessions)
        {
            if (!DateTime.TryParse(session.Date, out var parsedDate))
            {
                return BadRequest(new { message = $"Invalid date format: {session.Date}" });
            }

            parsedSessions.Add(new TrainingScheduleInput(
                parsedDate.Date,
                session.StartTime ?? string.Empty,
                session.EndTime ?? string.Empty,
                session.Notes));
        }

        try
        {
            var sessions = await _studentTrainingService.UpsertStudentScheduleAsync(
                studentId,
                context.UserId.Value,
                context.UserRole,
                request.MentorId,
                parsedSessions,
                cancellationToken);

            return Ok(ToCalendarResponse(sessions));
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

    [HttpGet("attendance")]
    [Authorize(Roles = "Admin,Mentor")]
    public async Task<IActionResult> GetAttendanceByDate(
        [FromQuery] DateTime? date,
        [FromQuery] Guid? mentorId,
        [FromServices] IRequestContext context,
        CancellationToken cancellationToken)
    {
        if (context.UserId is null || string.IsNullOrWhiteSpace(context.UserRole))
            return Unauthorized();

        var selectedDate = (date ?? DateTime.UtcNow).Date;
        try
        {
            var result = await _studentTrainingService.GetAttendanceForDateAsync(
                selectedDate,
                context.UserId.Value,
                context.UserRole,
                mentorId,
                cancellationToken);

            return Ok(new StudentAttendanceDayResponse(
                result.SelectedDate.ToString("yyyy-MM-dd"),
                result.EnabledDates.Select(x => x.ToString("yyyy-MM-dd")).ToList(),
                result.Sessions.Select(ToSessionResponse).ToList()));
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

    [HttpPut("sessions/{sessionId:guid}/attendance")]
    [Authorize(Roles = "Admin,Mentor")]
    public async Task<IActionResult> MarkAttendance(
        Guid sessionId,
        [FromBody] MarkStudentAttendanceRequest request,
        [FromServices] IRequestContext context,
        CancellationToken cancellationToken)
    {
        if (context.UserId is null || string.IsNullOrWhiteSpace(context.UserRole))
            return Unauthorized();

        try
        {
            await _studentTrainingService.MarkAttendanceAsync(
                sessionId,
                request.Status,
                request.Reason,
                context.UserId.Value,
                context.UserRole,
                cancellationToken);

            return NoContent();
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

    [HttpGet("sessions/{sessionId:guid}/qr")]
    [Authorize]
    public async Task<IActionResult> GetSessionQr(
        Guid sessionId,
        [FromServices] IRequestContext context,
        CancellationToken cancellationToken)
    {
        if (context.UserId is null || string.IsNullOrWhiteSpace(context.UserRole))
            return Unauthorized();

        try
        {
            var result = await _studentTrainingService.GetSessionQrAsync(
                sessionId,
                context.UserId.Value,
                context.UserRole,
                cancellationToken);

            return Ok(new StudentTrainingQrResponse(
                result.SessionId,
                result.Token,
                result.ExpiresAt.ToString("yyyy-MM-ddTHH:mm:ssZ")));
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

    [HttpPost("attendance/scan")]
    [Authorize(Roles = "Admin,Mentor")]
    public async Task<IActionResult> ScanAttendanceQr(
        [FromBody] ScanStudentAttendanceRequest request,
        [FromServices] IRequestContext context,
        CancellationToken cancellationToken)
    {
        if (context.UserId is null || string.IsNullOrWhiteSpace(context.UserRole))
            return Unauthorized();

        try
        {
            var session = await _studentTrainingService.MarkAttendanceByQrAsync(
                request.QrToken,
                context.UserId.Value,
                context.UserRole,
                cancellationToken);

            return Ok(new StudentAttendanceScanResponse(
                "Prezenca u konfirmua nga QR.",
                ToSessionResponse(session)));
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

    [HttpPost("stazh/end")]
    [Authorize(Roles = "Admin,Mentor")]
    public async Task<IActionResult> EndStazh(
        [FromBody] EndStudentStazhRequest request,
        [FromServices] IRequestContext context,
        CancellationToken cancellationToken)
    {
        if (context.UserId is null || string.IsNullOrWhiteSpace(context.UserRole))
            return Unauthorized();

        try
        {
            var stazh = await _studentTrainingService.EndStazhAsync(
                request.StudentId,
                request.MentorFeedbackRating,
                request.MentorFeedbackComment,
                context.UserId.Value,
                context.UserRole,
                request.MentorId,
                cancellationToken);

            return Ok(ToStazhResponse(stazh, includeToken: false));
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

    [HttpGet("stazh-feedback/{token}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetStazhFeedbackByToken(
        string token,
        CancellationToken cancellationToken)
    {
        try
        {
            var stazh = await _studentTrainingService.GetStazhFeedbackByTokenAsync(
                token,
                cancellationToken);

            return Ok(ToStazhResponse(stazh, includeToken: false));
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

    [HttpPost("stazh-feedback/{token}")]
    [AllowAnonymous]
    public async Task<IActionResult> SubmitStazhFeedback(
        string token,
        [FromBody] SubmitStudentStazhFeedbackRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var stazh = await _studentTrainingService.SubmitStudentFeedbackAsync(
                token,
                request.StudentFeedbackRating,
                request.StudentFeedbackComment,
                cancellationToken);

            return Ok(ToStazhResponse(stazh, includeToken: false));
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

    [HttpGet("my-feedback")]
    [Authorize(Roles = "Student")]
    public async Task<IActionResult> GetMyFeedbackHistory(
        [FromServices] IRequestContext context,
        CancellationToken cancellationToken)
    {
        if (context.UserId is null || string.IsNullOrWhiteSpace(context.UserRole))
            return Unauthorized();

        try
        {
            var stazhet = await _studentTrainingService.GetStudentFeedbackHistoryAsync(
                context.UserId.Value,
                context.UserId.Value,
                context.UserRole,
                cancellationToken);

            return Ok(stazhet.Select(x => ToStazhResponse(x, includeToken: true)).ToList());
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

    [HttpGet("students/{studentId:guid}/feedback")]
    [Authorize(Roles = "Admin,Mentor")]
    public async Task<IActionResult> GetStudentFeedbackHistory(
        Guid studentId,
        [FromServices] IRequestContext context,
        CancellationToken cancellationToken)
    {
        if (context.UserId is null || string.IsNullOrWhiteSpace(context.UserRole))
            return Unauthorized();

        try
        {
            var stazhet = await _studentTrainingService.GetStudentFeedbackHistoryAsync(
                studentId,
                context.UserId.Value,
                context.UserRole,
                cancellationToken);

            return Ok(stazhet.Select(x => ToStazhResponse(x, includeToken: false)).ToList());
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

    private static StudentTrainingCalendarResponse ToCalendarResponse(IReadOnlyList<IekaSmartClass.Api.Data.Entities.StudentTrainingSession> sessions)
    {
        var enabledDates = sessions
            .Select(x => x.ScheduledDate.Date)
            .Distinct()
            .OrderBy(x => x)
            .Select(x => x.ToString("yyyy-MM-dd"))
            .ToList();

        return new StudentTrainingCalendarResponse(
            enabledDates,
            sessions.Select(ToSessionResponse).ToList());
    }

    public static StudentTrainingSessionResponse ToSessionResponse(IekaSmartClass.Api.Data.Entities.StudentTrainingSession session)
        => new(
            session.Id,
            session.StudentId,
            session.StudentFirstName,
            session.StudentLastName,
            session.StudentEmail,
            session.StudentMemberRegistryNumber,
            session.MentorId,
            session.MentorFirstName,
            session.MentorLastName,
            session.MentorEmail,
            session.ScheduledDate.ToString("yyyy-MM-dd"),
            session.StartTime,
            session.EndTime,
            session.AttendanceStatus,
            session.Notes,
            session.RejectionReason);

    private static StudentTrainingStazhResponse ToStazhResponse(IekaSmartClass.Api.Data.Entities.StudentTrainingStazh stazh, bool includeToken)
        => new(
            stazh.Id,
            stazh.StudentId,
            stazh.StudentFirstName,
            stazh.StudentLastName,
            stazh.StudentEmail,
            stazh.StudentMemberRegistryNumber,
            stazh.MentorId,
            stazh.MentorFirstName,
            stazh.MentorLastName,
            stazh.MentorEmail,
            stazh.Status,
            stazh.StartedAt.ToString("yyyy-MM-dd"),
            stazh.EndedAt?.ToString("yyyy-MM-dd"),
            stazh.MentorFeedbackRating,
            stazh.MentorFeedbackComment,
            stazh.MentorFeedbackSubmittedAt?.ToString("yyyy-MM-ddTHH:mm:ssZ"),
            stazh.StudentFeedbackRating,
            stazh.StudentFeedbackComment,
            stazh.StudentFeedbackSubmittedAt?.ToString("yyyy-MM-ddTHH:mm:ssZ"),
            stazh.StudentFeedbackTokenExpiresAt?.ToString("yyyy-MM-ddTHH:mm:ssZ"),
            includeToken ? stazh.StudentFeedbackToken : null);
}

public record StudentSummaryResponse(
    Guid Id,
    string FirstName,
    string LastName,
    string Email,
    string MemberRegistryNumber,
    int? StudentTrackingNumber,
    string? StudentNumber,
    Guid? MentorId,
    bool IsActive,
    bool AccountIsActive,
    bool IsExpired,
    string? ValidUntilMonth,
    int AttendedSessions,
    int TotalSessions,
    int? StudentStartYear = null,
    int? StudentYear2StartYear = null,
    int? StudentYear3StartYear = null);

public record UpdateStudentScheduleRequest(Guid? MentorId, List<ScheduleSessionRequest> Sessions);
public record ScheduleSessionRequest(string Date, string StartTime, string EndTime, string? Notes);
public record MarkStudentAttendanceRequest(string Status, string? Reason);
public record ScanStudentAttendanceRequest(string QrToken);
public record EndStudentStazhRequest(Guid StudentId, Guid? MentorId, int MentorFeedbackRating, string? MentorFeedbackComment);
public record SubmitStudentStazhFeedbackRequest(int StudentFeedbackRating, string? StudentFeedbackComment);

public record StudentTrainingCalendarResponse(
    IReadOnlyList<string> EnabledDates,
    IReadOnlyList<StudentTrainingSessionResponse> Sessions);

public record StudentAttendanceDayResponse(
    string SelectedDate,
    IReadOnlyList<string> EnabledDates,
    IReadOnlyList<StudentTrainingSessionResponse> Sessions);

public record StudentTrainingSessionResponse(
    Guid Id,
    Guid StudentId,
    string StudentFirstName,
    string StudentLastName,
    string StudentEmail,
    string StudentMemberRegistryNumber,
    Guid MentorId,
    string MentorFirstName,
    string MentorLastName,
    string MentorEmail,
    string Date,
    string StartTime,
    string EndTime,
    string AttendanceStatus,
    string? Notes,
    string? RejectionReason);

public record StudentTrainingQrResponse(
    Guid SessionId,
    string QrToken,
    string ExpiresAt);

public record MentorAttendanceQrResponse(
    Guid MentorId,
    string Date,
    string QrToken,
    string ExpiresAt);

public record StudentAttendanceScanResponse(
    string Message,
    StudentTrainingSessionResponse Session);

public record StudentTrainingStazhResponse(
    Guid Id,
    Guid StudentId,
    string StudentFirstName,
    string StudentLastName,
    string StudentEmail,
    string StudentMemberRegistryNumber,
    Guid MentorId,
    string MentorFirstName,
    string MentorLastName,
    string MentorEmail,
    string Status,
    string StartedAt,
    string? EndedAt,
    int? MentorFeedbackRating,
    string? MentorFeedbackComment,
    string? MentorFeedbackSubmittedAt,
    int? StudentFeedbackRating,
    string? StudentFeedbackComment,
    string? StudentFeedbackSubmittedAt,
    string? StudentFeedbackTokenExpiresAt,
    string? StudentFeedbackToken);
