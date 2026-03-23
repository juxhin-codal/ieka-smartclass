using IekaSmartClass.Api.Services.Interface;
using IekaSmartClass.Api.Utilities.Context;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;

namespace IekaSmartClass.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class StazhController(IStazhService stazhService) : ControllerBase
{
    private readonly IStazhService _stazhService = stazhService;

    [HttpGet]
    [Authorize(Roles = "Admin,Mentor")]
    public async Task<IActionResult> GetAll()
    {
        var stazhet = await _stazhService.GetAllStazhetAsync();
        return Ok(stazhet);
    }

    [HttpGet("{id:guid}")]
    [Authorize]
    public async Task<IActionResult> GetById(Guid id)
    {
        var stazh = await _stazhService.GetStazhByIdAsync(id);
        return stazh is null ? NotFound() : Ok(stazh);
    }

    [HttpGet("mentor/{mentorId:guid}")]
    [Authorize(Roles = "Admin,Mentor")]
    public async Task<IActionResult> GetByMentor(Guid mentorId, [FromServices] IRequestContext context)
    {
        if (context.UserId is null || string.IsNullOrWhiteSpace(context.UserRole))
            return Unauthorized();

        if (string.Equals(context.UserRole, "Mentor", StringComparison.OrdinalIgnoreCase) && context.UserId.Value != mentorId)
            return Forbid();

        var stazhet = await _stazhService.GetStazhetByMentorAsync(mentorId);
        return Ok(stazhet);
    }

    [HttpGet("student/{studentId:guid}")]
    [Authorize]
    public async Task<IActionResult> GetByStudent(Guid studentId, [FromServices] IRequestContext context)
    {
        if (context.UserId is null || string.IsNullOrWhiteSpace(context.UserRole))
            return Unauthorized();

        if (!string.Equals(context.UserRole, "Admin", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(context.UserRole, "Mentor", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(context.UserRole, "Student", StringComparison.OrdinalIgnoreCase))
            return Forbid();

        if (string.Equals(context.UserRole, "Student", StringComparison.OrdinalIgnoreCase) && context.UserId.Value != studentId)
            return Forbid();

        var stazhet = await _stazhService.GetStazhetByStudentAsync(studentId);

        if (string.Equals(context.UserRole, "Mentor", StringComparison.OrdinalIgnoreCase))
        {
            stazhet = stazhet.Where(x => x.MentorId == context.UserId.Value).ToList();
        }

        return Ok(stazhet);
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Mentor")]
    public async Task<IActionResult> Create([FromBody] CreateStazhRequest request)
    {
        var dates = request.Dates?.Select(d => (DateTime.Parse(d.Date), d.Time, d.Notes)).ToList();
        var id = await _stazhService.CreateStazhAsync(
            request.MentorId, request.StudentId, request.Title,
            DateTime.Parse(request.StartDate), DateTime.Parse(request.EndDate),
            dates);
        return CreatedAtAction(nameof(GetById), new { id }, id);
    }

    [HttpPost("{id:guid}/documents")]
    [Authorize(Roles = "Admin,Mentor")]
    public async Task<IActionResult> AddDocument(Guid id, [FromBody] AddDocumentRequest request)
    {
        await _stazhService.AddDocumentAsync(id, request.FileName, request.FileUrl, request.Description);
        return NoContent();
    }

    [HttpPost("{id:guid}/documents/upload")]
    [Authorize(Roles = "Admin,Mentor,Student")]
    public async Task<IActionResult> UploadDocument(
        Guid id,
        [FromForm] UploadStazhDocumentRequest request,
        [FromServices] IRequestContext context,
        CancellationToken cancellationToken)
    {
        if (context.UserId is null || string.IsNullOrWhiteSpace(context.UserRole))
            return Unauthorized();

        if (request.File is null || request.File.Length == 0)
            return BadRequest(new { message = "File is required." });

        if (!IsPdfFile(request.File, request.FileName))
            return BadRequest(new { message = "Lejohet vetëm skedar PDF." });

        var stazh = await _stazhService.GetStazhByIdAsync(id);
        if (stazh is null)
            return NotFound();

        if (string.Equals(context.UserRole, "Mentor", StringComparison.OrdinalIgnoreCase) && stazh.MentorId != context.UserId.Value)
            return Forbid();

        if (string.Equals(context.UserRole, "Student", StringComparison.OrdinalIgnoreCase) && stazh.StudentId != context.UserId.Value)
            return Forbid();

        await _stazhService.AddDocumentFileAsync(id, request.File, request.FileName, request.Description, cancellationToken);
        return NoContent();
    }

    [HttpDelete("{id:guid}/documents/{documentId:guid}")]
    [Authorize(Roles = "Admin,Mentor,Student")]
    public async Task<IActionResult> DeleteDocument(
        Guid id,
        Guid documentId,
        [FromServices] IRequestContext context,
        CancellationToken cancellationToken)
    {
        if (context.UserId is null || string.IsNullOrWhiteSpace(context.UserRole))
            return Unauthorized();

        var deleted = await _stazhService.DeleteDocumentAsync(
            id,
            documentId,
            context.UserId.Value,
            context.UserRole,
            cancellationToken);

        return deleted ? NoContent() : NotFound();
    }

    [HttpPost("{id:guid}/complete")]
    [Authorize(Roles = "Admin,Mentor")]
    public async Task<IActionResult> Complete(Guid id, [FromBody] CompleteStazhRequest request)
    {
        await _stazhService.CompleteStazhAsync(id, request.Feedback);
        return NoContent();
    }

    [HttpPost("{id:guid}/cancel")]
    [Authorize(Roles = "Admin,Mentor")]
    public async Task<IActionResult> Cancel(Guid id)
    {
        await _stazhService.CancelStazhAsync(id);
        return NoContent();
    }

    [HttpPut("{id:guid}/feedback")]
    [Authorize(Roles = "Admin,Mentor")]
    public async Task<IActionResult> SetFeedback(Guid id, [FromBody] SetFeedbackRequest request)
    {
        await _stazhService.SetFeedbackAsync(id, request.Feedback);
        return NoContent();
    }

    private static bool IsPdfFile(IFormFile file, string? preferredFileName)
    {
        var preferredExtension = Path.GetExtension(preferredFileName ?? string.Empty);
        if (string.Equals(preferredExtension, ".pdf", StringComparison.OrdinalIgnoreCase))
            return true;

        var uploadedExtension = Path.GetExtension(file.FileName ?? string.Empty);
        if (string.Equals(uploadedExtension, ".pdf", StringComparison.OrdinalIgnoreCase))
            return true;

        return string.Equals(file.ContentType, "application/pdf", StringComparison.OrdinalIgnoreCase);
    }
}

public record CreateStazhRequest(
    Guid MentorId, Guid StudentId, string Title,
    string StartDate, string EndDate,
    List<CreateStazhDateRequest>? Dates);
public record CreateStazhDateRequest(string Date, string Time, string? Notes);
public record AddDocumentRequest(string FileName, string FileUrl, string? Description);
public record UploadStazhDocumentRequest(IFormFile File, string? FileName, string? Description);
public record CompleteStazhRequest(string? Feedback);
public record SetFeedbackRequest(string Feedback);
