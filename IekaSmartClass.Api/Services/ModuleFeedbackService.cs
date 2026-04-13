using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using IekaSmartClass.Api.Data;
using IekaSmartClass.Api.Data.Entities;
using IekaSmartClass.Api.Services.Interface;
using IekaSmartClass.Api.Utilities.Settings;

namespace IekaSmartClass.Api.Services;

public class ModuleFeedbackService(
    IApplicationDbContext db,
    IEmailService emailService,
    IOptions<EmailSettings> emailOptions,
    ILogger<ModuleFeedbackService> logger) : IModuleFeedbackService
{
    private readonly string _frontendBaseUrl = (emailOptions.Value.FrontendBaseUrl ?? "http://localhost:3000").TrimEnd('/');

    public async Task<ModuleFeedbackTemplate?> GetTemplateAsync(CancellationToken ct = default)
    {
        return await db.ModuleFeedbackTemplates
            .Include(t => t.Sections.OrderBy(s => s.Order))
                .ThenInclude(s => s.Questions.OrderBy(q => q.Order))
            .FirstOrDefaultAsync(ct);
    }

    public async Task UpdateTemplateAsync(UpdateModuleFeedbackTemplateInput input, CancellationToken ct = default)
    {
        var template = await db.ModuleFeedbackTemplates
            .Include(t => t.Sections)
                .ThenInclude(s => s.Questions)
            .FirstOrDefaultAsync(ct)
            ?? throw new InvalidOperationException("Template not found.");

        template.Update(input.Title);

        // Delete-and-recreate sections + questions
        foreach (var section in template.Sections.ToList())
        {
            db.ModuleFeedbackQuestions.RemoveRange(section.Questions);
            db.ModuleFeedbackSections.Remove(section);
        }

        foreach (var sectionInput in input.Sections)
        {
            var section = new ModuleFeedbackSection(
                template.Id, sectionInput.Title, sectionInput.Order,
                sectionInput.RepeatsPerTopic, sectionInput.RatingLabelLow, sectionInput.RatingLabelHigh);
            db.ModuleFeedbackSections.Add(section);

            foreach (var questionInput in sectionInput.Questions)
            {
                db.ModuleFeedbackQuestions.Add(new ModuleFeedbackQuestion(
                    section.Id, questionInput.Text, questionInput.Type, questionInput.Order));
            }
        }

        await db.SaveChangesAsync(ct);
    }

    public async Task PatchSectionAutoSendAsync(Guid sectionId, bool repeatsPerTopic, CancellationToken ct = default)
    {
        var section = await db.ModuleFeedbackSections
            .FirstOrDefaultAsync(s => s.Id == sectionId, ct)
            ?? throw new KeyNotFoundException("Section not found.");

        section.SetRepeatsPerTopic(repeatsPerTopic);
        await db.SaveChangesAsync(ct);
    }

    public async Task<ModuleFeedbackFillResult> GetForFillingAsync(Guid moduleId, Guid studentId, List<Guid>? sectionIds = null, CancellationToken ct = default)
    {
        var template = await db.ModuleFeedbackTemplates
            .Include(t => t.Sections.OrderBy(s => s.Order))
                .ThenInclude(s => s.Questions.OrderBy(q => q.Order))
            .FirstOrDefaultAsync(ct)
            ?? throw new InvalidOperationException("Template not found.");

        // Filter sections if specific IDs requested
        if (sectionIds is { Count: > 0 })
        {
            var sectionIdSet = sectionIds.ToHashSet();
            var filteredSections = template.Sections
                .Where(s => sectionIdSet.Contains(s.Id))
                .ToList();
            template.Sections.Clear();
            foreach (var s in filteredSections)
                ((ICollection<ModuleFeedbackSection>)template.Sections).Add(s);
        }

        var module = await db.StudentModules
            .Include(m => m.Topics.OrderBy(t => t.ScheduledDate))
            .FirstOrDefaultAsync(m => m.Id == moduleId, ct)
            ?? throw new InvalidOperationException("Module not found.");

        var alreadyAnswered = await db.ModuleFeedbackResponses
            .AnyAsync(r => r.StudentModuleId == moduleId && r.StudentId == studentId, ct);

        var topics = module.Topics
            .Select(t => new ModuleFeedbackTopicInfo(t.Id, t.Name, t.Lecturer))
            .ToList();

        return new ModuleFeedbackFillResult(template, topics, alreadyAnswered);
    }

    public async Task SubmitAsync(Guid moduleId, Guid studentId, List<ModuleFeedbackAnswerInput> answers, string sectionScope = "all", bool isAnonymous = false, CancellationToken ct = default)
    {
        var exists = await db.ModuleFeedbackResponses
            .AnyAsync(r => r.StudentModuleId == moduleId && r.StudentId == studentId && r.SectionScope == sectionScope, ct);
        if (exists)
            throw new InvalidOperationException("Ju keni plotësuar tashmë vlerësimin për këtë modul.");

        var template = await db.ModuleFeedbackTemplates.FirstOrDefaultAsync(ct)
            ?? throw new InvalidOperationException("Template not found.");

        var response = new ModuleFeedbackResponse(template.Id, moduleId, studentId, sectionScope, isAnonymous);
        foreach (var a in answers)
            response.Answers.Add(new ModuleFeedbackAnswer(response.Id, a.QuestionId, a.TopicId, a.Answer));

        db.ModuleFeedbackResponses.Add(response);
        await db.SaveChangesAsync(ct);
    }

    public async Task<ModuleFeedbackSendResult> SendFeedbackEmailsAsync(Guid moduleId, CancellationToken ct = default)
    {
        var template = await db.ModuleFeedbackTemplates.FirstOrDefaultAsync(ct)
            ?? throw new InvalidOperationException("Template not found.");

        var module = await db.StudentModules
            .Include(m => m.Assignments)
            .FirstOrDefaultAsync(m => m.Id == moduleId, ct)
            ?? throw new InvalidOperationException("Module not found.");

        // Get students who are assigned but haven't submitted
        var assignedStudentIds = module.Assignments.Select(a => a.StudentId).ToList();
        var submittedStudentIds = await db.ModuleFeedbackResponses
            .Where(r => r.StudentModuleId == moduleId)
            .Select(r => r.StudentId)
            .ToListAsync(ct);

        var pendingStudentIds = assignedStudentIds.Except(submittedStudentIds).ToHashSet();
        if (pendingStudentIds.Count == 0)
            return new ModuleFeedbackSendResult(0, DateTime.UtcNow);

        var students = await db.Users
            .Where(u => pendingStudentIds.Contains(u.Id) && u.IsActive && u.Email != null)
            .ToListAsync(ct);

        var actionLink = $"/module-feedback/{moduleId}";
        var emailItem = new ModuleFeedbackEmailItem(
            module.Title,
            module.Title,
            "—",
            "—",
            "—",
            "—",
            actionLink);

        var sentCount = 0;
        foreach (var student in students)
        {
            try
            {
                await emailService.SendModuleFeedbackRequestAsync(student, emailItem, ct);
                sentCount++;
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Failed to send module feedback email to user {UserId}", student.Id);
            }
        }

        var sendLog = new ModuleFeedbackSendLog(template.Id, moduleId, sentCount);
        db.ModuleFeedbackSendLogs.Add(sendLog);
        await db.SaveChangesAsync(ct);

        return new ModuleFeedbackSendResult(sentCount, sendLog.SentAt);
    }

    public async Task<IReadOnlyList<ModuleFeedbackResponse>> GetResponsesAsync(Guid moduleId, CancellationToken ct = default)
    {
        return await db.ModuleFeedbackResponses
            .Include(r => r.Student)
            .Include(r => r.Answers).ThenInclude(a => a.Question)
            .Include(r => r.Answers).ThenInclude(a => a.Topic)
            .Where(r => r.StudentModuleId == moduleId)
            .OrderByDescending(r => r.SubmittedAt)
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<ModuleFeedbackResponse>> GetAllResponsesAsync(CancellationToken ct = default)
    {
        return await db.ModuleFeedbackResponses
            .Include(r => r.Student)
            .Include(r => r.StudentModule)
            .Include(r => r.Answers).ThenInclude(a => a.Question).ThenInclude(q => q.Section)
            .Include(r => r.Answers).ThenInclude(a => a.Topic)
            .OrderByDescending(r => r.SubmittedAt)
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<ModuleFeedbackResponse>> GetMyResponsesAsync(Guid studentId, CancellationToken ct = default)
    {
        return await db.ModuleFeedbackResponses
            .Include(r => r.StudentModule)
            .Include(r => r.Answers).ThenInclude(a => a.Question).ThenInclude(q => q.Section)
            .Include(r => r.Answers).ThenInclude(a => a.Topic)
            .Where(r => r.StudentId == studentId)
            .OrderByDescending(r => r.SubmittedAt)
            .ToListAsync(ct);
    }

    public async Task<ModuleFeedbackSendResult> SendManualFeedbackEmailsAsync(
        Guid moduleId, List<Guid> sectionIds, string targetRole, List<int>? yearGrades, CancellationToken ct = default)
    {
        var template = await db.ModuleFeedbackTemplates
            .Include(t => t.Sections)
            .FirstOrDefaultAsync(ct)
            ?? throw new InvalidOperationException("Template not found.");

        var validSectionIds = template.Sections.Select(s => s.Id).ToHashSet();
        if (sectionIds.Any(id => !validSectionIds.Contains(id)))
            throw new InvalidOperationException("Invalid section IDs.");

        var module = await db.StudentModules
            .Include(m => m.Assignments)
            .FirstOrDefaultAsync(m => m.Id == moduleId, ct)
            ?? throw new InvalidOperationException("Module not found.");

        var sectionsParam = string.Join(",", sectionIds);
        var roleParam = string.Equals(targetRole, "Member", StringComparison.OrdinalIgnoreCase) ? "Member" : "Student";
        var actionLink = $"/module-feedback/{moduleId}?sections={sectionsParam}&scope=manual&role={roleParam}";

        // Unique key for this section combination — sorted so order doesn't matter
        var sectionKey = string.Join(",", sectionIds.Select(x => x.ToString()).OrderBy(x => x));

        List<AppUser> recipients;
        if (string.Equals(targetRole, "Member", StringComparison.OrdinalIgnoreCase))
        {
            recipients = await db.Users
                .Where(u => u.Role == "Member" && u.IsActive && !u.IsPendingConfirmation && u.Email != null)
                .ToListAsync(ct);
        }
        else
        {
            // Students assigned to this module, filtered by year grades if provided
            var assignedStudentIds = module.Assignments.Select(a => a.StudentId).ToHashSet();

            if (yearGrades is { Count: > 0 })
            {
                // Also include students from other modules with matching year grades
                var modulesByYear = await db.StudentModules
                    .Where(m => yearGrades.Contains(m.YearGrade))
                    .Include(m => m.Assignments)
                    .ToListAsync(ct);

                var yearStudentIds = modulesByYear
                    .SelectMany(m => m.Assignments)
                    .Select(a => a.StudentId)
                    .ToHashSet();

                assignedStudentIds.IntersectWith(yearStudentIds);
            }

            recipients = await db.Users
                .Where(u => assignedStudentIds.Contains(u.Id) && u.IsActive && u.Email != null)
                .ToListAsync(ct);
        }

        // Exclude students who were already emailed for this exact module + section combination
        var alreadyEmailedIds = await db.ModuleFeedbackStudentEmailLogs
            .Where(l => l.StudentModuleId == moduleId && l.SectionKey == sectionKey)
            .Select(l => l.StudentId)
            .ToHashSetAsync(ct);
        recipients = recipients.Where(u => !alreadyEmailedIds.Contains(u.Id)).ToList();

        if (recipients.Count == 0)
            return new ModuleFeedbackSendResult(0, DateTime.UtcNow);

        // Build ordered section titles for the selected sections
        var selectedSectionTitles = template.Sections
            .Where(s => sectionIds.Contains(s.Id))
            .OrderBy(s => s.Order)
            .Select(s => s.Title)
            .ToList();

        var emailItem = new ManualModuleFeedbackEmailItem(
            module.Title,
            selectedSectionTitles,
            actionLink);

        var sentCount = 0;
        var emailedStudentIds = new List<Guid>();
        foreach (var recipient in recipients)
        {
            try
            {
                await emailService.SendManualModuleFeedbackRequestAsync(recipient, emailItem, ct);
                sentCount++;
                emailedStudentIds.Add(recipient.Id);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Failed to send manual feedback email to user {UserId}", recipient.Id);
            }
        }

        // Record per-student send log so they won't receive duplicate emails
        foreach (var studentId in emailedStudentIds)
        {
            db.ModuleFeedbackStudentEmailLogs.Add(
                new ModuleFeedbackStudentEmailLog(studentId, moduleId, sectionKey));
        }

        var sendLog = new ModuleFeedbackSendLog(template.Id, moduleId, sentCount);
        db.ModuleFeedbackSendLogs.Add(sendLog);
        await db.SaveChangesAsync(ct);

        return new ModuleFeedbackSendResult(sentCount, sendLog.SentAt);
    }

    public async Task<LecturerFeedbackManualSendResult> SendLecturerFeedbackManuallyAsync(
        string targetRole, List<int>? yearGrades, List<Guid>? additionalSectionIds, Guid? targetModuleId = null, CancellationToken ct = default)
    {
        var feedbackTemplate = await db.ModuleFeedbackTemplates
            .Include(t => t.Sections)
            .FirstOrDefaultAsync(ct)
            ?? throw new InvalidOperationException("Template not found.");

        if (additionalSectionIds is not { Count: > 0 })
            throw new InvalidOperationException("Zgjidhni te pakten nje seksion.");

        // Build section param from only the explicitly selected (non-lecturer) sections
        var validIds = feedbackTemplate.Sections
            .Where(s => !s.RepeatsPerTopic)
            .Select(s => s.Id)
            .ToHashSet();
        var sectionIds = additionalSectionIds
            .Where(id => validIds.Contains(id))
            .ToList();
        if (sectionIds.Count == 0)
            throw new InvalidOperationException("Seksionet e zgjedhura nuk jane valide.");

        var lecturerRoleParam = string.Equals(targetRole, "Member", StringComparison.OrdinalIgnoreCase) ? "Member" : "Student";
        var sectionParam = $"?sections={string.Join(",", sectionIds)}&scope=manual&role={lecturerRoleParam}";

        var sectionTitles = feedbackTemplate.Sections
            .Where(s => sectionIds.Contains(s.Id))
            .OrderBy(s => s.Order)
            .Select(s => s.Title)
            .ToList();

        var sentEmails = 0;
        var recipientSet = new HashSet<Guid>();
        var now = DateTime.UtcNow;

        if (string.Equals(targetRole, "Member", StringComparison.OrdinalIgnoreCase))
        {
            // Members: find event session participants that attended but never got feedback email
            var pendingParticipants = await db.Participants
                .Include(p => p.User)
                .Include(p => p.EventDate)
                    .ThenInclude(d => d.EventItem)
                .Where(p =>
                    p.Attendance == "attended" &&
                    p.FeedbackToken == null &&
                    p.User.Role == "Member" &&
                    p.User.IsActive &&
                    p.User.Email != null &&
                    (targetModuleId == null || p.EventDate.EventItemId == targetModuleId))
                .ToListAsync(ct);

            foreach (var p in pendingParticipants)
            {
                p.SetFeedbackToken(Guid.NewGuid().ToString("N"));
            }

            if (pendingParticipants.Count > 0)
                await db.SaveChangesAsync(ct);

            foreach (var p in pendingParticipants)
            {
                try
                {
                    await emailService.SendManualModuleFeedbackRequestAsync(
                        p.User,
                        new ManualModuleFeedbackEmailItem(
                            p.EventDate.EventItem.Name,
                            sectionTitles,
                            $"/module-feedback/{p.EventDate.EventItem.Id}{sectionParam}"),
                        ct);
                    sentEmails++;
                    recipientSet.Add(p.UserId);
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Manual lecturer feedback failed for participant {ParticipantId}", p.Id);
                }
            }
        }
        else
        {
            // Students: find topic attendances that never got feedback email
            var attendancesQuery = db.StudentModuleTopicAttendances
                .Include(a => a.Student)
                .Include(a => a.Topic)
                    .ThenInclude(t => t.StudentModule)
                .Where(a =>
                    a.FeedbackToken == null &&
                    a.Student.IsActive &&
                    a.Student.Email != null &&
                    a.Student.Role == "Student");

            if (targetModuleId.HasValue)
            {
                attendancesQuery = attendancesQuery
                    .Where(a => a.Topic.StudentModuleId == targetModuleId.Value);
            }
            else if (yearGrades is { Count: > 0 })
            {
                attendancesQuery = attendancesQuery
                    .Where(a => yearGrades.Contains(a.Topic.StudentModule.YearGrade));
            }

            var pendingAttendances = await attendancesQuery.ToListAsync(ct);

            foreach (var att in pendingAttendances)
            {
                att.SetFeedbackToken(Guid.NewGuid().ToString("N"));
            }

            if (pendingAttendances.Count > 0)
                await db.SaveChangesAsync(ct);

            foreach (var att in pendingAttendances)
            {
                try
                {
                    await emailService.SendManualModuleFeedbackRequestAsync(
                        att.Student,
                        new ManualModuleFeedbackEmailItem(
                            att.Topic.StudentModule.Title,
                            sectionTitles,
                            $"/module-feedback/{att.Topic.StudentModuleId}{sectionParam}"),
                        ct);
                    sentEmails++;
                    recipientSet.Add(att.StudentId);
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Manual lecturer feedback failed for attendance {AttendanceId}", att.Id);
                }
            }
        }

        return new LecturerFeedbackManualSendResult(sentEmails, recipientSet.Count, now);
    }
}
