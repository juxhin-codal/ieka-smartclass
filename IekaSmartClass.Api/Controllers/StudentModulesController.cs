using IekaSmartClass.Api.Services.Interface;
using IekaSmartClass.Api.Data.Entities;
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
            m.Title,
            m.Location,
            m.CreatedAt.ToString("o"),
            m.CreatedByUser != null ? $"{m.CreatedByUser.FirstName} {m.CreatedByUser.LastName}" : null,
            m.Topics.Select(MapTopicResponse).ToList(),
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
            module.Title,
            module.Location,
            module.CreatedAt.ToString("o"),
            module.CreatedByUser != null ? $"{module.CreatedByUser.FirstName} {module.CreatedByUser.LastName}" : null,
            module.Topics.Select(MapTopicResponse).ToList(),
            module.Assignments.Select(a =>
            {
                var topicAttendances = module.Topics
                    .SelectMany(t => t.Attendances.Where(att => att.StudentId == a.StudentId)
                        .Select(att => new TopicAttendanceInfo(t.Id, t.Name, att.AttendedAt.ToString("o"))))
                    .ToList();
                return new StudentModuleAssignmentResponse(
                    a.StudentId,
                    a.Student != null ? a.Student.FirstName : "",
                    a.Student != null ? a.Student.LastName : "",
                    a.Student != null ? (a.Student.Email ?? "") : "",
                    a.AssignedAt.ToString("o"),
                    topicAttendances,
                    a.Result,
                    a.ResultNote,
                    a.ResultSetAt?.ToString("o"));
            }).ToList()));
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

        if (string.IsNullOrWhiteSpace(request.Title))
            return BadRequest(new { message = "Titulli është i detyrueshëm." });

        try
        {
            var module = await _studentModuleService.CreateModuleAsync(
                new CreateStudentModuleInput(request.YearGrade, request.Title, request.Location, request.ExcludedStudentIds, request.AdditionalStudentIds),
                context.UserId.Value,
                cancellationToken);

            return Ok(new { id = module.Id });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
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

    // ── Topic endpoints ─────────────────────────────────────────────────────

    [HttpPost("{moduleId:guid}/topics")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> AddTopic(
        Guid moduleId,
        [FromBody] AddTopicRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { message = "Emri i temës është i detyrueshëm." });
        if (string.IsNullOrWhiteSpace(request.Lecturer))
            return BadRequest(new { message = "Lektori është i detyrueshëm." });

        try
        {
            var topic = await _studentModuleService.AddTopicAsync(
                moduleId, request.Name, request.Lecturer, request.ScheduledDate, request.Location, cancellationToken);
            return Ok(new { id = topic.Id });
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("topics/{topicId:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateTopic(
        Guid topicId,
        [FromBody] UpdateTopicRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { message = "Emri i temës është i detyrueshëm." });
        if (string.IsNullOrWhiteSpace(request.Lecturer))
            return BadRequest(new { message = "Lektori është i detyrueshëm." });

        try
        {
            await _studentModuleService.UpdateTopicAsync(
                topicId, request.Name, request.Lecturer, request.ScheduledDate, request.Location, cancellationToken);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("topics/{topicId:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteTopic(
        Guid topicId,
        CancellationToken cancellationToken)
    {
        try
        {
            await _studentModuleService.DeleteTopicAsync(topicId, cancellationToken);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    // ── Document endpoints (per topic) ──────────────────────────────────────

    [HttpPost("topics/{topicId:guid}/documents")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UploadDocument(
        Guid topicId,
        IFormFile file,
        CancellationToken cancellationToken)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { message = "File is required." });

        var storedFile = await _fileStorageService.SaveAsync(
            file,
            "student-modules",
            topicId,
            file.FileName,
            cancellationToken: cancellationToken);

        try
        {
            var document = await _studentModuleService.AddDocumentAsync(
                topicId,
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

    [HttpDelete("topics/{topicId:guid}/documents/{documentId:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> RemoveDocument(
        Guid topicId,
        Guid documentId,
        CancellationToken cancellationToken)
    {
        try
        {
            await _studentModuleService.RemoveDocumentAsync(topicId, documentId, cancellationToken);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    // ── QR & Attendance (per topic) ─────────────────────────────────────────

    [HttpGet("topics/{topicId:guid}/qr")]
    [Authorize(Roles = "Admin,Mentor")]
    public async Task<IActionResult> GenerateQr(Guid topicId, CancellationToken cancellationToken)
    {
        try
        {
            var token = await _studentModuleService.GenerateTopicQrTokenAsync(topicId, cancellationToken);
            return Ok(new StudentModuleQrResponse(topicId, token));
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
    public async Task<IActionResult> ScanTopicQr(
        [FromBody] ScanModuleAttendanceRequest request,
        [FromServices] IRequestContext context,
        CancellationToken cancellationToken)
    {
        if (context.UserId is null) return Unauthorized();

        if (string.IsNullOrWhiteSpace(request.QrToken))
            return BadRequest(new { message = "Kodi QR është i detyrueshëm." });

        try
        {
            var attendance = await _studentModuleService.ScanTopicQrAsync(
                request.QrToken, context.UserId.Value, cancellationToken);

            return Ok(new ScanModuleAttendanceResponse(
                attendance.TopicId,
                attendance.StudentId,
                attendance.AttendedAt.ToString("o")));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // ── Manual Topic Attendance ──────────────────────────────────────────────

    [HttpPost("topics/{topicId:guid}/attendance/{studentId:guid}")]
    [Authorize(Roles = "Admin,Mentor")]
    public async Task<IActionResult> MarkTopicAttendance(Guid topicId, Guid studentId, CancellationToken cancellationToken)
    {
        try
        {
            var attendance = await _studentModuleService.MarkTopicAttendanceAsync(topicId, studentId, cancellationToken);
            return Ok(new ScanModuleAttendanceResponse(attendance.TopicId, attendance.StudentId, attendance.AttendedAt.ToString("o")));
        }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpDelete("topics/{topicId:guid}/attendance/{studentId:guid}")]
    [Authorize(Roles = "Admin,Mentor")]
    public async Task<IActionResult> RemoveTopicAttendance(Guid topicId, Guid studentId, CancellationToken cancellationToken)
    {
        try
        {
            await _studentModuleService.RemoveTopicAttendanceAsync(topicId, studentId, cancellationToken);
            return NoContent();
        }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
    }

    // ── Notify ──────────────────────────────────────────────────────────────

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

    // ── Student management (add/remove from existing modules) ────────────

    [HttpPost("{moduleId:guid}/students")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> AddStudentsToModule(
        Guid moduleId,
        [FromBody] AddStudentsToModuleRequest request,
        CancellationToken cancellationToken)
    {
        if (request.StudentIds is null || request.StudentIds.Count == 0)
            return BadRequest(new { message = "Duhet të zgjidhni të paktën një student." });

        try
        {
            await _studentModuleService.AddStudentsToModuleAsync(moduleId, request.StudentIds, cancellationToken);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpDelete("{moduleId:guid}/students/{studentId:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> RemoveStudentFromModule(
        Guid moduleId,
        Guid studentId,
        CancellationToken cancellationToken)
    {
        try
        {
            await _studentModuleService.RemoveStudentFromModuleAsync(moduleId, studentId, cancellationToken);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    // ── Results ──────────────────────────────────────────────────────────────

    [HttpPost("{moduleId:guid}/results")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> SetBulkResults(
        Guid moduleId,
        [FromBody] SetBulkResultsRequest request,
        CancellationToken cancellationToken)
    {
        if (request.Results is null || request.Results.Count == 0)
            return BadRequest(new { message = "Duhet të jepni të paktën një rezultat." });

        try
        {
            var inputs = request.Results.Select(r =>
                new StudentResultInput(r.StudentId, r.Result, r.Note)).ToList();
            await _studentModuleService.SetBulkResultsAsync(moduleId, inputs, cancellationToken);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpPut("{moduleId:guid}/results/{studentId:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> SetStudentResult(
        Guid moduleId,
        Guid studentId,
        [FromBody] SetStudentResultRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Result))
            return BadRequest(new { message = "Rezultati është i detyrueshëm." });

        try
        {
            await _studentModuleService.SetStudentResultAsync(
                moduleId, studentId, request.Result, request.Note, cancellationToken);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    // ── Student lookups ─────────────────────────────────────────────────────

    [HttpGet("students-by-year/{yearGrade:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetStudentsByYearGrade(int yearGrade, CancellationToken cancellationToken)
    {
        if (yearGrade < 1 || yearGrade > 3)
            return BadRequest(new { message = "Viti duhet të jetë 1, 2 ose 3." });

        var students = await _studentModuleService.GetStudentsByYearGradeAsync(yearGrade, cancellationToken);
        return Ok(students);
    }

    [HttpGet("all-active-students")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetAllActiveStudents(CancellationToken cancellationToken)
    {
        var students = await _studentModuleService.GetAllActiveStudentsAsync(cancellationToken);
        return Ok(students);
    }

    // ── Student self-service ────────────────────────────────────────────────

    [HttpGet("student/{studentId:guid}/modules")]
    [Authorize(Roles = "Admin,Mentor")]
    public async Task<IActionResult> GetStudentModules(Guid studentId, CancellationToken cancellationToken)
    {
        var modules = await _studentModuleService.GetMyModulesAsync(studentId, cancellationToken);
        return Ok(modules.Select(m =>
        {
            var assignment = m.Assignments.FirstOrDefault(a => a.StudentId == studentId);
            return new StudentMyModuleResponse(
            m.Id,
            m.YearGrade,
            m.Title,
            m.Location,
            m.CreatedAt.ToString("o"),
            m.Topics.Select(t => new StudentMyTopicResponse(
                t.Id,
                t.Name,
                t.Lecturer,
                t.ScheduledDate?.ToString("o"),
                t.Location,
                t.Documents.Count,
                t.Attendances.Any(a => a.StudentId == studentId),
                t.Attendances.FirstOrDefault(a => a.StudentId == studentId)?.AttendedAt.ToString("o"),
                t.Documents.Select(d => new StudentModuleDocumentResponse(
                    d.Id, d.FileName, d.FileUrl, d.RelativePath, d.SizeBytes, d.UploadedAt.ToString("o"))).ToList())).ToList(),
            assignment?.AssignedAt.ToString("o"));
        }));
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
            var assignment = m.Assignments.FirstOrDefault(a => a.StudentId == context.UserId.Value);
            return new StudentMyModuleResponse(
                m.Id,
                m.YearGrade,
                m.Title,
                m.Location,
                m.CreatedAt.ToString("o"),
                m.Topics.Select(t => new StudentMyTopicResponse(
                    t.Id,
                    t.Name,
                    t.Lecturer,
                    t.ScheduledDate?.ToString("o"),
                    t.Location,
                    t.Documents.Count,
                    t.Attendances.Any(a => a.StudentId == context.UserId.Value),
                    t.Attendances.FirstOrDefault(a => a.StudentId == context.UserId.Value)?.AttendedAt.ToString("o"),
                    t.Documents.Select(d => new StudentModuleDocumentResponse(
                        d.Id, d.FileName, d.FileUrl, d.RelativePath, d.SizeBytes, d.UploadedAt.ToString("o"))).ToList())).ToList(),
                assignment?.AssignedAt.ToString("o"),
                assignment?.Result,
                assignment?.ResultNote,
                assignment?.ResultSetAt?.ToString("o"));
        }));
    }

    // ── Questionnaire endpoints ──────────────────────────────────────────────

    private static StudentModuleTopicResponse MapTopicResponse(IekaSmartClass.Api.Data.Entities.StudentModuleTopic t) =>
        new(t.Id,
            t.Name,
            t.Lecturer,
            t.ScheduledDate?.ToString("o"),
            t.Location,
            t.CreatedAt.ToString("o"),
            t.Documents.Select(d => new StudentModuleDocumentResponse(
                d.Id, d.FileName, d.FileUrl, d.RelativePath, d.SizeBytes, d.UploadedAt.ToString("o"))).ToList(),
            t.Attendances.Count,
            t.Questionnaires.Select(q => new QuestionnaireInfoResponse(
                q.Id, q.Title, q.Questions.Count, q.Responses.Count)).ToList());

    [HttpPost("topics/{topicId:guid}/questionnaire")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> CreateQuestionnaire(
        Guid topicId,
        [FromBody] CreateQuestionnaireRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
            return BadRequest(new { message = "Titulli i pyetësorit është i detyrueshëm." });
        if (request.Questions is null || request.Questions.Count == 0)
            return BadRequest(new { message = "Duhet të shtoni të paktën një pyetje." });

        try
        {
            var inputs = request.Questions.Select(q =>
                new QuestionnaireQuestionInput(q.Text, q.Type, q.Order, q.Options)).ToList();
            var questionnaire = await _studentModuleService.CreateQuestionnaireAsync(
                topicId, request.Title, inputs, cancellationToken);
            return Ok(new { id = questionnaire.Id });
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("questionnaires/{questionnaireId:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteQuestionnaire(
        Guid questionnaireId,
        CancellationToken cancellationToken)
    {
        try
        {
            await _studentModuleService.DeleteQuestionnaireAsync(questionnaireId, cancellationToken);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpPut("questionnaires/{questionnaireId:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateQuestionnaire(
        Guid questionnaireId,
        [FromBody] CreateQuestionnaireRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
            return BadRequest(new { message = "Titulli i pyetësorit është i detyrueshëm." });
        if (request.Questions is null || request.Questions.Count == 0)
            return BadRequest(new { message = "Duhet të shtoni të paktën një pyetje." });

        try
        {
            var inputs = request.Questions.Select(q =>
                new QuestionnaireQuestionInput(q.Text, q.Type, q.Order, q.Options)).ToList();
            await _studentModuleService.UpdateQuestionnaireAsync(questionnaireId, request.Title, inputs, cancellationToken);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpGet("questionnaires/{questionnaireId:guid}")]
    [Authorize(Roles = "Admin,Mentor")]
    public async Task<IActionResult> GetQuestionnaire(
        Guid questionnaireId,
        CancellationToken cancellationToken)
    {
        var q = await _studentModuleService.GetQuestionnaireAsync(questionnaireId, cancellationToken);
        if (q is null) return NotFound();

        return Ok(new QuestionnaireDetailResponse(
            q.Id,
            q.TopicId,
            q.Title,
            q.CreatedAt.ToString("o"),
            q.Questions.OrderBy(x => x.Order).Select(x => new QuestionnaireQuestionResponse(
                x.Id, x.Text, x.Type.ToString(), x.Order,
                string.IsNullOrEmpty(x.OptionsJson) ? null : System.Text.Json.JsonSerializer.Deserialize<List<string>>(x.OptionsJson))).ToList(),
            q.Responses.Count));
    }

    [HttpGet("questionnaires/{questionnaireId:guid}/qr")]
    [Authorize(Roles = "Admin,Mentor")]
    public async Task<IActionResult> GenerateQuestionnaireQr(
        Guid questionnaireId,
        CancellationToken cancellationToken)
    {
        try
        {
            var token = await _studentModuleService.GenerateQuestionnaireQrTokenAsync(questionnaireId, cancellationToken);
            return Ok(new QuestionnaireQrResponse(questionnaireId, token));
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpGet("questionnaires/{questionnaireId:guid}/responses")]
    [Authorize(Roles = "Admin,Mentor")]
    public async Task<IActionResult> GetQuestionnaireResponses(
        Guid questionnaireId,
        CancellationToken cancellationToken)
    {
        var responses = await _studentModuleService.GetQuestionnaireResponsesAsync(questionnaireId, cancellationToken);
        return Ok(responses.Select(r => new QuestionnaireResponseItem(
            r.Id,
            r.StudentId,
            r.Student != null ? r.Student.FirstName : "",
            r.Student != null ? r.Student.LastName : "",
            r.SubmittedAt.ToString("o"),
            r.Answers.Select(a => new QuestionnaireAnswerItem(
                a.QuestionId,
                a.Question?.Text ?? "",
                a.Question?.Type.ToString() ?? "",
                a.AnswerText)).ToList())));
    }

    [HttpPost("questionnaires/submit")]
    [Authorize(Roles = "Student")]
    public async Task<IActionResult> SubmitQuestionnaire(
        [FromBody] SubmitQuestionnaireRequest request,
        [FromServices] IRequestContext context,
        CancellationToken cancellationToken)
    {
        if (context.UserId is null) return Unauthorized();

        if (string.IsNullOrWhiteSpace(request.QrToken))
            return BadRequest(new { message = "Kodi QR është i detyrueshëm." });
        if (request.Answers is null || request.Answers.Count == 0)
            return BadRequest(new { message = "Duhet të përgjigjeni të paktën një pyetje." });

        try
        {
            var inputs = request.Answers.Select(a => new QuestionnaireAnswerInput(a.QuestionId, a.Answer)).ToList();
            var response = await _studentModuleService.SubmitQuestionnaireAsync(
                request.QrToken, context.UserId.Value, inputs, cancellationToken);
            return Ok(new { responseId = response.Id, submittedAt = response.SubmittedAt.ToString("o") });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("topics/{topicId:guid}/questionnaire")]
    [Authorize(Roles = "Admin,Mentor,Student")]
    public async Task<IActionResult> GetTopicQuestionnaire(
        Guid topicId,
        CancellationToken cancellationToken)
    {
        var q = await _studentModuleService.GetQuestionnaireByTopicAsync(topicId, cancellationToken);
        if (q is null) return Ok((object?)null);

        return Ok(new QuestionnaireDetailResponse(
            q.Id,
            q.TopicId,
            q.Title,
            q.CreatedAt.ToString("o"),
            q.Questions.OrderBy(x => x.Order).Select(x => new QuestionnaireQuestionResponse(
                x.Id, x.Text, x.Type.ToString(), x.Order,
                string.IsNullOrEmpty(x.OptionsJson) ? null : System.Text.Json.JsonSerializer.Deserialize<List<string>>(x.OptionsJson))).ToList(),
            q.Responses.Count));
    }

    [HttpGet("questionnaires/by-token")]
    [Authorize(Roles = "Student")]
    public async Task<IActionResult> GetQuestionnaireByToken(
        [FromQuery] string token,
        [FromServices] IRequestContext context,
        CancellationToken cancellationToken)
    {
        if (context.UserId is null) return Unauthorized();

        if (string.IsNullOrWhiteSpace(token))
            return BadRequest(new { message = "Kodi QR është i detyrueshëm." });

        try
        {
            var (questionnaire, alreadyAnswered) = await _studentModuleService.GetQuestionnaireByQrTokenAsync(
                token, context.UserId.Value, cancellationToken);

            return Ok(new QuestionnaireByTokenResponse(
                questionnaire.Id,
                questionnaire.Title,
                alreadyAnswered,
                questionnaire.Questions.OrderBy(x => x.Order).Select(x => new QuestionnaireQuestionResponse(
                    x.Id, x.Text, x.Type.ToString(), x.Order,
                    string.IsNullOrEmpty(x.OptionsJson) ? null : System.Text.Json.JsonSerializer.Deserialize<List<string>>(x.OptionsJson))).ToList()));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("my-questionnaire-responses")]
    [Authorize(Roles = "Student")]
    public async Task<IActionResult> GetMyQuestionnaireResponses(
        [FromServices] IRequestContext context,
        CancellationToken cancellationToken)
    {
        if (context.UserId is null) return Unauthorized();

        var responses = await _studentModuleService.GetMyQuestionnaireResponsesAsync(context.UserId.Value, cancellationToken);
        return Ok(responses.Select(r => new MyQuestionnaireResponseItem(
            r.Id,
            r.QuestionnaireId,
            r.Questionnaire?.Title ?? "",
            r.Questionnaire?.Topic?.Name ?? "",
            r.Questionnaire?.Topic?.StudentModule?.Title ?? "",
            r.Questionnaire?.Topic?.StudentModule?.YearGrade ?? 0,
            r.SubmittedAt.ToString("o"),
            r.Answers.Select(a => new QuestionnaireAnswerItem(
                a.QuestionId,
                a.Question?.Text ?? "",
                a.Question?.Type.ToString() ?? "",
                a.AnswerText)).ToList())));
    }
}

// ── DTOs ────────────────────────────────────────────────────────────────────

public record CreateStudentModuleRequest(int YearGrade, string Title, string? Location = null, List<Guid>? ExcludedStudentIds = null, List<Guid>? AdditionalStudentIds = null);

public record AddTopicRequest(string Name, string Lecturer, DateTime? ScheduledDate = null, string? Location = null);
public record UpdateTopicRequest(string Name, string Lecturer, DateTime? ScheduledDate = null, string? Location = null);

public record StudentModuleTopicResponse(
    Guid Id,
    string Name,
    string Lecturer,
    string? ScheduledDate,
    string? Location,
    string CreatedAt,
    List<StudentModuleDocumentResponse> Documents,
    int AttendanceCount,
    List<QuestionnaireInfoResponse> Questionnaires);

public record QuestionnaireInfoResponse(
    Guid Id,
    string Title,
    int QuestionCount,
    int ResponseCount);

public record StudentModuleResponse(
    Guid Id,
    int YearGrade,
    string Title,
    string? Location,
    string CreatedAt,
    string? CreatedByName,
    List<StudentModuleTopicResponse> Topics,
    int AssignmentCount);

public record StudentModuleDetailResponse(
    Guid Id,
    int YearGrade,
    string Title,
    string? Location,
    string CreatedAt,
    string? CreatedByName,
    List<StudentModuleTopicResponse> Topics,
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
    List<TopicAttendanceInfo> TopicAttendances,
    string? Result,
    string? ResultNote,
    string? ResultSetAt);

public record TopicAttendanceInfo(
    Guid TopicId,
    string TopicName,
    string AttendedAt);

public record StudentModuleQrResponse(
    Guid TopicId,
    string Token);

public record ScanModuleAttendanceRequest(string QrToken);

public record AddStudentsToModuleRequest(List<Guid> StudentIds);

public record SetStudentResultRequest(string Result, string? Note = null);
public record SetBulkResultsRequest(List<SetBulkResultItem> Results);
public record SetBulkResultItem(Guid StudentId, string Result, string? Note = null);

public record ScanModuleAttendanceResponse(
    Guid TopicId,
    Guid StudentId,
    string AttendedAt);

public record StudentMyModuleResponse(
    Guid Id,
    int YearGrade,
    string Title,
    string? Location,
    string CreatedAt,
    List<StudentMyTopicResponse> Topics,
    string? AssignedAt = null,
    string? Result = null,
    string? ResultNote = null,
    string? ResultSetAt = null);

public record StudentMyTopicResponse(
    Guid Id,
    string Name,
    string Lecturer,
    string? ScheduledDate,
    string? Location,
    int DocumentCount,
    bool Attended,
    string? AttendedAt,
    List<StudentModuleDocumentResponse>? Documents = null);

// ── Questionnaire DTOs ──────────────────────────────────────────────────────

public record CreateQuestionnaireRequest(
    string Title,
    List<CreateQuestionnaireQuestionItem> Questions);

public record CreateQuestionnaireQuestionItem(
    string Text,
    QuestionType Type,
    int Order,
    List<string>? Options = null);

public record QuestionnaireDetailResponse(
    Guid Id,
    Guid TopicId,
    string Title,
    string CreatedAt,
    List<QuestionnaireQuestionResponse> Questions,
    int ResponseCount);

public record QuestionnaireQuestionResponse(
    Guid Id,
    string Text,
    string Type,
    int Order,
    List<string>? Options);

public record QuestionnaireQrResponse(
    Guid QuestionnaireId,
    string Token);

public record QuestionnaireByTokenResponse(
    Guid Id,
    string Title,
    bool AlreadyAnswered,
    List<QuestionnaireQuestionResponse> Questions);

public record SubmitQuestionnaireRequest(
    string QrToken,
    List<SubmitAnswerItem> Answers);

public record SubmitAnswerItem(
    Guid QuestionId,
    string Answer);

public record QuestionnaireResponseItem(
    Guid ResponseId,
    Guid StudentId,
    string FirstName,
    string LastName,
    string SubmittedAt,
    List<QuestionnaireAnswerItem> Answers);

public record QuestionnaireAnswerItem(
    Guid QuestionId,
    string QuestionText,
    string QuestionType,
    string Answer);

public record MyQuestionnaireResponseItem(
    Guid ResponseId,
    Guid QuestionnaireId,
    string QuestionnaireTitle,
    string TopicName,
    string ModuleName,
    int YearGrade,
    string SubmittedAt,
    List<QuestionnaireAnswerItem> Answers);
