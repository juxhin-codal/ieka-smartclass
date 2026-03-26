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
            module.CreatedAt.ToString("o"),
            module.CreatedByUser != null ? $"{module.CreatedByUser.FirstName} {module.CreatedByUser.LastName}" : null,
            module.Documents.Select(d => new StudentModuleDocumentResponse(
                d.Id, d.FileName, d.FileUrl, d.RelativePath, d.SizeBytes, d.UploadedAt.ToString("o"))).ToList(),
            module.Assignments.Select(a => new StudentModuleAssignmentResponse(
                a.StudentId,
                a.Student != null ? a.Student.FirstName : "",
                a.Student != null ? a.Student.LastName : "",
                a.Student != null ? (a.Student.Email ?? "") : "",
                a.AssignedAt.ToString("o"))).ToList()));
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
                new CreateStudentModuleInput(request.YearGrade, request.Topic, request.Lecturer),
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

    [HttpGet("students-by-year/{yearGrade:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetStudentsByYearGrade(int yearGrade, CancellationToken cancellationToken)
    {
        if (yearGrade < 1 || yearGrade > 3)
            return BadRequest(new { message = "Viti duhet të jetë 1, 2 ose 3." });

        var students = await _studentModuleService.GetStudentsByYearGradeAsync(yearGrade, cancellationToken);
        return Ok(students);
    }
}

public record CreateStudentModuleRequest(int YearGrade, string Topic, string Lecturer);

public record StudentModuleResponse(
    Guid Id,
    int YearGrade,
    string Topic,
    string Lecturer,
    string CreatedAt,
    string? CreatedByName,
    List<StudentModuleDocumentResponse> Documents,
    int AssignmentCount);

public record StudentModuleDetailResponse(
    Guid Id,
    int YearGrade,
    string Topic,
    string Lecturer,
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
    string AssignedAt);
