using IekaSmartClass.Api.Services.Interface;
using IekaSmartClass.Api.Utilities.Context;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace IekaSmartClass.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class StudentModulesController(
    IStudentModuleService studentModuleService,
    IFileStorageService fileStorageService) : ControllerBase
{
    private readonly IStudentModuleService _studentModuleService = studentModuleService;
    private readonly IFileStorageService _fileStorageService = fileStorageService;

    [HttpGet]
    [Authorize(Roles = "Admin,Mentor")]
    public async Task<IActionResult> GetModules(CancellationToken cancellationToken)
    {
        var modules = await _studentModuleService.GetModulesAsync(cancellationToken);
        return Ok(modules.Select(m => new StudentModuleResponse(
            m.Id,
            m.YearGrade,
            m.Topic,
            m.Lecturer,
            m.ScheduledDate?.ToString("o"),
            m.Location,
            m.CreatedAt.ToString("o"),
            m.CreatedByUser != null ? $"{m.CreatedByUser.FirstName} {m.CreatedByUser.LastName}" : null,
            m.Documents.Select(d => new StudentModuleDocumentResponse(
                d.Id, d.FileName, d.FileUrl, d.RelativePath, d.SizeBytes, d.UploadedAt.ToString("o"))).ToList(),
            m.Assignments.Count)));
    }

    [HttpGet("{moduleId:guid}")]
    [Authorize(Roles = "Admin,Mentor")]
    public async Task<IActionResult> GetModule(Guid moduleId, CancellationToken cancellationToken)
    {
        var module = await _studentModuleService.GetModuleByIdAsync(moduleId, cancellationToken);
        if (module is null) return NotFound();

        return Ok(new StudentModuleDetailResponse(
            module.Id,
            module.YearGrade,
            module.Topic,
            module.Lecturer,
            module.ScheduledDate?.ToString("o"),
            module.Location,
            module.CreatedAt.ToString("o"),
            module.CreatedByUser != null ? $"{module.CreatedByUser.FirstName} {module.CreatedByUser.LastName}" : null,
            module.Documents.Select(d => new StudentModuleDocumentResponse(
                d.Id, d.FileName, d.FileUrl, d.RelativePath, d.SizeBytes, d.UploadedAt.ToString("o"))).ToList(),
            module.Assignments.Select(a => new StudentModuleAssignmentResponse(
                a.StudentId,
                a.Student != null ? a.Student.FirstName : "",
                a.Student != null ? a.Student.LastName : "",
                a.Student != null ? (a.Student.Email ?? "") : "",
                a.AssignedAt.ToString("o"),
                a.AttendedAt?.ToString("o"))).ToList()));
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> CreateModule(
        [FromBody] CreateStudentModuleRequest request,
        [FromServices] IRequestContext context,
        CancellationToken cancellationToken)
    {
        if (context.UserId is null) return Unauthorized();

        if (request.YearGrade < 1 || request.YearGrade > 3)
            return BadRequest(new { message = "Viti duhet të jetë 1, 2 ose 3." });

        if (string.IsNullOrWhiteSpace(request.Topic))
            return BadRequest(new { message = "Tema është e detyrueshme." });

        if (string.IsNullOrWhiteSpace(request.Lecturer))
            return BadRequest(new { message = "Lektori është i detyrueshëm." });

        try
        {
            var module = await _studentModuleService.CreateModuleAsync(
                new CreateStudentModuleInput(request.YearGrade, request.Topic, request.Lecturer, request.ScheduledDate, request.Location),
                context.UserId.Value,
                cancellationToken);

            return Ok(new { id = module.Id });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{moduleId:guid}/documents")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UploadDocument(
        Guid moduleId,
        [FromForm] IFormFile file,
        CancellationToken cancellationToken)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { message = "File is required." });

        var storedFile = await _fileStorageService.SaveAsync(
            file,
            "student-modules",
            moduleId,
            file.FileName,
            cancellationToken: cancellationToken);

        try
        {
            var document = await _studentModuleService.AddDocumentAsync(
                moduleId,
                storedFile.FileName,
                storedFile.PublicUrl,
                storedFile.RelativePath,
                storedFile.SizeBytes,
                cancellationToken);

            return Ok(new StudentModuleDocumentResponse(
                document.Id,
                document.FileName,
                document.FileUrl,
                document.RelativePath,
                document.SizeBytes,
                document.UploadedAt.ToString("o")));
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpDelete("{moduleId:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteModule(
        Guid moduleId,
        [FromServices] IRequestContext context,
        CancellationToken cancellationToken)
    {
        if (context.UserId is null) return Unauthorized();

        try
        {
            await _studentModuleService.DeleteModuleAsync(moduleId, context.UserId.Value, cancellationToken);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpPut("{moduleId:guid}/schedule")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateModuleSchedule(
        Guid moduleId,
        [FromBody] UpdateModuleScheduleRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            await _studentModuleService.UpdateModuleScheduleAsync(moduleId, request.ScheduledDate, cancellationToken);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpDelete("{moduleId:guid}/documents/{documentId:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> RemoveDocument(
        Guid moduleId,
        Guid documentId,
        CancellationToken cancellationToken)
    {
        try
        {
            await _studentModuleService.RemoveDocumentAsync(moduleId, documentId, cancellationToken);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpPost("{moduleId:guid}/notify")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> NotifyStudents(
        Guid moduleId,
        CancellationToken cancellationToken)
    {
        try
        {
            await _studentModuleService.NotifyStudentsAsync(moduleId, cancellationToken);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpGet("students-by-year/{yearGrade:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetStudentsByYearGrade(int yearGrade, CancellationToken cancellationToken)
    {
        if (yearGrade < 1 || yearGrade > 3)
            return BadRequest(new { message = "Viti duhet të jetë 1, 2 ose 3." });

        var students = await _studentModuleService.GetStudentsByYearGradeAsync(yearGrade, cancellationToken);
        return Ok(students);
    }

    [HttpGet("{moduleId:guid}/qr")]
    [Authorize(Roles = "Admin,Mentor")]
    public async Task<IActionResult> GenerateQr(Guid moduleId, CancellationToken cancellationToken)
    {
        try
        {
            var token = await _studentModuleService.GenerateModuleQrTokenAsync(moduleId, cancellationToken);
            return Ok(new StudentModuleQrResponse(moduleId, token));
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

    [HttpPost("scan")]
    [Authorize(Roles = "Student")]
    public async Task<IActionResult> ScanModuleQr(
        [FromBody] ScanModuleAttendanceRequest request,
        [FromServices] IRequestContext context,
        CancellationToken cancellationToken)
    {
        if (context.UserId is null) return Unauthorized();

        if (string.IsNullOrWhiteSpace(request.QrToken))
            return BadRequest(new { message = "Kodi QR është i detyrueshëm." });

        try
        {
            var assignment = await _studentModuleService.ScanModuleQrAsync(
                request.QrToken, context.UserId.Value, cancellationToken);

            return Ok(new ScanModuleAttendanceResponse(
                assignment.StudentModuleId,
                assignment.StudentId,
                assignment.AttendedAt?.ToString("o") ?? DateTime.UtcNow.ToString("o")));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("my-modules")]
    [Authorize(Roles = "Student")]
    public async Task<IActionResult> GetMyModules(
        [FromServices] IRequestContext context,
        CancellationToken cancellationToken)
    {
        if (context.UserId is null) return Unauthorized();

        var modules = await _studentModuleService.GetMyModulesAsync(context.UserId.Value, cancellationToken);
        return Ok(modules.Select(m =>
        {
            var myAssignment = m.Assignments.FirstOrDefault(a => a.StudentId == context.UserId.Value);
            return new StudentMyModuleResponse(
                m.Id,
                m.YearGrade,
                m.Topic,
                m.Lecturer,
                m.ScheduledDate?.ToString("o"),
                m.Location,
                m.CreatedAt.ToString("o"),
                m.Documents.Count,
                myAssignment?.AttendedAt != null,
                myAssignment?.AttendedAt?.ToString("o"));
        }));
    }
}

public record CreateStudentModuleRequest(int YearGrade, string Topic, string Lecturer, DateTime? ScheduledDate = null, string? Location = null);

public record StudentModuleResponse(
    Guid Id,
    int YearGrade,
    string Topic,
    string Lecturer,
    string? ScheduledDate,
    string? Location,
    string CreatedAt,
    string? CreatedByName,
    List<StudentModuleDocumentResponse> Documents,
    int AssignmentCount);

public record StudentModuleDetailResponse(
    Guid Id,
    int YearGrade,
    string Topic,
    string Lecturer,
    string? ScheduledDate,
    string? Location,
    string CreatedAt,
    string? CreatedByName,
    List<StudentModuleDocumentResponse> Documents,
    List<StudentModuleAssignmentResponse> Assignments);

public record StudentModuleDocumentResponse(
    Guid Id,
    string FileName,
    string FileUrl,
    string RelativePath,
    long SizeBytes,
    string UploadedAt);

public record StudentModuleAssignmentResponse(
    Guid StudentId,
    string FirstName,
    string LastName,
    string Email,
    string AssignedAt,
    string? AttendedAt);

public record StudentModuleQrResponse(
    Guid ModuleId,
    string Token);

public record ScanModuleAttendanceRequest(string QrToken);

public record ScanModuleAttendanceResponse(
    Guid ModuleId,
    Guid StudentId,
    string AttendedAt);

public record StudentMyModuleResponse(
    Guid Id,
    int YearGrade,
    string Topic,
    string Lecturer,
    string? ScheduledDate,
    string? Location,
    string CreatedAt,
    int DocumentCount,
    bool Attended,
    string? AttendedAt);

public record UpdateModuleScheduleRequest(DateTime? ScheduledDate);
