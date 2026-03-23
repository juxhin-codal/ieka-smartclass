using IekaSmartClass.Api.Services.Interface;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace IekaSmartClass.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class LearningStorageController(IFileStorageService fileStorageService) : ControllerBase
{
    private readonly IFileStorageService _fileStorageService = fileStorageService;

    [HttpGet("download/{**relativePath}")]
    public async Task<IActionResult> DownloadFile(string relativePath, CancellationToken cancellationToken)
    {
        var resolved = await _fileStorageService.ResolveAsync(relativePath, cancellationToken);
        if (resolved is null)
            return NotFound();

        return File(
            resolved.ContentStream,
            resolved.ContentType,
            fileDownloadName: resolved.FileName,
            enableRangeProcessing: true);
    }

    [HttpGet("{ownerType}/{ownerId:guid}/files")]
    public async Task<IActionResult> ListFiles(string ownerType, Guid ownerId, CancellationToken cancellationToken)
    {
        var files = await _fileStorageService.ListAsync(ownerType, ownerId, cancellationToken: cancellationToken);
        return Ok(files);
    }

    [HttpPost("{ownerType}/{ownerId:guid}/files")]
    [Authorize(Roles = "Admin,Mentor,Lecturer,Student")]
    public async Task<IActionResult> UploadFile(
        string ownerType,
        Guid ownerId,
        [FromForm] UploadLearningFileRequest request,
        CancellationToken cancellationToken)
    {
        if (request.File is null || request.File.Length == 0)
            return BadRequest(new { message = "File is required." });

        var result = await _fileStorageService.SaveAsync(
            request.File,
            ownerType,
            ownerId,
            request.FileName,
            cancellationToken: cancellationToken);

        return Ok(result);
    }

    [HttpDelete("{ownerType}/{ownerId:guid}/files")]
    [Authorize(Roles = "Admin,Mentor,Lecturer")]
    public async Task<IActionResult> DeleteFile(string ownerType, Guid ownerId, [FromQuery] string relativePath, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(relativePath))
            return BadRequest(new { message = "relativePath is required." });

        var deleted = await _fileStorageService.DeleteForOwnerAsync(ownerType, ownerId, relativePath, cancellationToken: cancellationToken);
        if (!deleted)
            return NotFound();

        return NoContent();
    }
}

public record UploadLearningFileRequest(IFormFile File, string? FileName);
