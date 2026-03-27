using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using IekaSmartClass.Api.Data;
using IekaSmartClass.Api.Data.Entities;
using IekaSmartClass.Api.Data.Repositories.Interface;
using IekaSmartClass.Api.Services.Interface;
using IekaSmartClass.Api.Utilities.Settings;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace IekaSmartClass.Api.Services;

public class StudentTrainingService(
    IRepository<StudentTrainingSession> sessionRepository,
    IRepository<AppUser> userRepository,
    IRepository<StudentTrainingStazh> stazhRepository,
    IApplicationDbContext dbContext,
    IEmailService emailService,
    IOptions<JwtSettings> jwtOptions,
    IOptions<EmailSettings> emailOptions,
    ILogger<StudentTrainingService> logger) : IStudentTrainingService
{
    private static readonly TimeZoneInfo AppTimeZone = ResolveAppTimeZone();
    private readonly IRepository<StudentTrainingSession> _sessionRepository = sessionRepository;
    private readonly IRepository<AppUser> _userRepository = userRepository;
    private readonly IRepository<StudentTrainingStazh> _stazhRepository = stazhRepository;
    private readonly IApplicationDbContext _dbContext = dbContext;
    private readonly IEmailService _emailService = emailService;
    private readonly ILogger<StudentTrainingService> _logger = logger;
    private readonly byte[] _qrSigningKey = Encoding.UTF8.GetBytes(string.IsNullOrWhiteSpace(jwtOptions.Value.Secret)
        ? "ieka-default-training-qr-signing-secret"
        : jwtOptions.Value.Secret);
    private readonly string _frontendBaseUrl = string.IsNullOrWhiteSpace(emailOptions.Value.FrontendBaseUrl)
        ? "http://localhost:3000"
        : emailOptions.Value.FrontendBaseUrl.TrimEnd('/');

    public async Task<IReadOnlyList<ManageableStudentSummary>> GetManageableStudentsAsync(Guid actorUserId, string actorRole, Guid? requestedMentorId, CancellationToken cancellationToken = default)
    {
        IQueryable<AppUser> studentsQuery;

        if (IsAdmin(actorRole))
        {
            studentsQuery = _userRepository.Query().AsNoTracking().Where(x => x.Role == "Student");
            if (requestedMentorId.HasValue)
            {
                studentsQuery = studentsQuery.Where(x => x.MentorId == requestedMentorId.Value);
            }
        }
        else if (IsMentor(actorRole))
        {
            studentsQuery = _userRepository.Query()
                .Where(x => x.Role == "Student" && x.MentorId == actorUserId);
        }
        else
        {
            throw new UnauthorizedAccessException("Only admin or mentor can access student list.");
        }

        var students = await studentsQuery
            .OrderBy(x => x.FirstName)
            .ThenBy(x => x.LastName)
            .ToListAsync(cancellationToken);

        if (students.Count == 0)
        {
            return [];
        }

        var studentIds = students.Select(x => x.Id).ToList();
        var sessionsQuery = _sessionRepository.Query()
            .Where(x => studentIds.Contains(x.StudentId));

        if (IsMentor(actorRole))
        {
            sessionsQuery = sessionsQuery.Where(x => x.MentorId == actorUserId);
        }
        else if (requestedMentorId.HasValue)
        {
            sessionsQuery = sessionsQuery.Where(x => x.MentorId == requestedMentorId.Value);
        }

        var statsByStudentId = await sessionsQuery
            .GroupBy(x => x.StudentId)
            .Select(g => new
            {
                StudentId = g.Key,
                TotalSessions = g.Count(),
                AttendedSessions = g.Count(x => x.AttendanceStatus == "attended")
            })
            .ToDictionaryAsync(
                x => x.StudentId,
                x => (x.AttendedSessions, x.TotalSessions),
                cancellationToken);

        return students
            .Select(student =>
            {
                var stat = statsByStudentId.TryGetValue(student.Id, out var found)
                    ? found
                    : (AttendedSessions: 0, TotalSessions: 0);

                return new ManageableStudentSummary(student, stat.AttendedSessions, stat.TotalSessions);
            })
            .ToList();
    }

    public async Task<IReadOnlyList<StudentTrainingSession>> GetStudentScheduleAsync(Guid studentId, Guid actorUserId, string actorRole, CancellationToken cancellationToken = default)
    {
        var student = await GetStudentOrThrowAsync(studentId, cancellationToken);
        EnsureCanReadStudentSchedule(student, actorUserId, actorRole);

        var query = _sessionRepository.Query()
            .AsNoTracking()
            .Include(x => x.Student)
            .Include(x => x.Mentor)
            .Where(x => x.StudentId == studentId);

        if (IsMentor(actorRole))
        {
            query = query.Where(x => x.MentorId == actorUserId);
        }

        return await query
            .OrderBy(x => x.ScheduledDate)
            .ThenBy(x => x.StartTime)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<StudentTrainingSession>> UpsertStudentScheduleAsync(
        Guid studentId,
        Guid actorUserId,
        string actorRole,
        Guid? requestedMentorId,
        IReadOnlyList<TrainingScheduleInput> sessions,
        CancellationToken cancellationToken = default)
    {
        if (!IsAdmin(actorRole) && !IsMentor(actorRole))
        {
            throw new UnauthorizedAccessException("Only admin or mentor can update student schedule.");
        }

        var student = await GetStudentOrThrowAsync(studentId, cancellationToken);
        if (!student.IsEffectivelyActive())
        {
            throw new InvalidOperationException("Studenti është jo aktiv. Nuk mund të shtoni datë/orar.");
        }
        var mentor = await ResolveMentorOrThrowAsync(student, actorUserId, actorRole, requestedMentorId, cancellationToken);
        var normalizedSessions = NormalizeSessions(sessions);
        var duplicateDateGroup = normalizedSessions
            .GroupBy(x => x.Date)
            .FirstOrDefault(g => g.Count() > 1);
        if (duplicateDateGroup is not null)
        {
            throw new InvalidOperationException($"Data {duplicateDateGroup.Key:yyyy-MM-dd} është zgjedhur më shumë se një herë.");
        }
        var editableSessionsQuery = _sessionRepository.Query()
            .Where(x => x.StudentId == student.Id
                        && x.AttendanceStatus != "attended"
                        && x.AttendanceStatus != "rejected");

        if (IsMentor(actorRole))
        {
            editableSessionsQuery = editableSessionsQuery.Where(x => x.MentorId == mentor.Id);
        }

        var existingEditableSessions = await editableSessionsQuery.ToListAsync(cancellationToken);

        if (existingEditableSessions.Count > 0)
        {
            _dbContext.StudentTrainingSessions.RemoveRange(existingEditableSessions);
        }

        foreach (var session in normalizedSessions)
        {
            await _sessionRepository.AddAsync(new StudentTrainingSession(
                student.Id,
                mentor.Id,
                session.Date,
                session.StartTime,
                session.EndTime,
                session.Notes));
        }

        if (normalizedSessions.Count > 0)
        {
            await EnsureActiveStazhAsync(student.Id, mentor.Id, cancellationToken);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        var today = DateTime.UtcNow.Date;
        var upcomingForEmail = await _sessionRepository.Query()
            .Where(x => x.StudentId == student.Id
                        && x.MentorId == mentor.Id
                        && x.ScheduledDate >= today)
            .OrderBy(x => x.ScheduledDate)
            .ThenBy(x => x.StartTime)
            .Select(x => new TrainingScheduleEmailItem(x.ScheduledDate, x.StartTime, x.EndTime, x.Notes))
            .ToListAsync(cancellationToken);

        if (!string.IsNullOrWhiteSpace(student.Email))
        {
            try
            {
                await _emailService.SendStudentTrainingScheduleAsync(student, mentor, upcomingForEmail, CancellationToken.None);
                _logger.LogInformation("Training schedule email sent to student {StudentId}", student.Id);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to send training schedule email to student {StudentId}", student.Id);
            }
        }

        return await GetStudentScheduleAsync(student.Id, actorUserId, actorRole, cancellationToken);
    }

    public async Task<StudentAttendanceDayResult> GetAttendanceForDateAsync(
        DateTime selectedDate,
        Guid actorUserId,
        string actorRole,
        Guid? requestedMentorId,
        CancellationToken cancellationToken = default)
    {
        if (!IsAdmin(actorRole) && !IsMentor(actorRole))
        {
            throw new UnauthorizedAccessException("Only admin or mentor can access attendance.");
        }

        var mentorScope = ResolveAttendanceMentorScope(actorUserId, actorRole, requestedMentorId);
        var day = selectedDate.Date;
        var nowUtc = DateTime.UtcNow;

        var baseQuery = _sessionRepository.Query()
            .AsNoTracking()
            .Include(x => x.Student)
            .Include(x => x.Mentor)
            .Where(x => x.Student.IsActive
                        && (!x.Student.StudentValidUntilUtc.HasValue || x.Student.StudentValidUntilUtc.Value >= nowUtc))
            .AsQueryable();

        if (mentorScope.HasValue)
        {
            baseQuery = baseQuery.Where(x => x.MentorId == mentorScope.Value);
        }

        var enabledDates = await baseQuery
            .Select(x => x.ScheduledDate.Date)
            .Distinct()
            .OrderBy(x => x)
            .ToListAsync(cancellationToken);

        var sessions = await baseQuery
            .Where(x => x.ScheduledDate == day)
            .OrderBy(x => x.StartTime)
            .ThenBy(x => x.Student.FirstName)
            .ThenBy(x => x.Student.LastName)
            .ToListAsync(cancellationToken);

        return new StudentAttendanceDayResult(day, enabledDates, sessions);
    }

    public async Task MarkAttendanceAsync(
        Guid sessionId,
        string status,
        string? reason,
        Guid actorUserId,
        string actorRole,
        CancellationToken cancellationToken = default)
    {
        if (!IsAdmin(actorRole) && !IsMentor(actorRole))
        {
            throw new UnauthorizedAccessException("Only admin or mentor can mark attendance.");
        }

        var session = await _sessionRepository.Query()
            .Include(x => x.Student)
            .Include(x => x.Mentor)
            .FirstOrDefaultAsync(x => x.Id == sessionId, cancellationToken)
            ?? throw new KeyNotFoundException("Session not found.");

        if (IsMentor(actorRole) && session.MentorId != actorUserId)
        {
            throw new UnauthorizedAccessException("Mentor cannot mark attendance for other mentor sessions.");
        }
        if (!session.Student.IsEffectivelyActive())
        {
            throw new InvalidOperationException("Studenti është jo aktiv.");
        }
        if (!IsSessionScheduledForToday(session.ScheduledDate))
        {
            throw new InvalidOperationException("Prezenca mund të konfirmohet vetëm në datën e sotme.");
        }

        var normalizedStatus = (status ?? string.Empty).Trim().ToLowerInvariant();
        if (session.AttendanceStatus == "attended" && normalizedStatus is "rejected" or "reject" or "absent")
        {
            throw new InvalidOperationException("Prezenca është konfirmuar tashmë.");
        }
        if (session.AttendanceStatus == "rejected" && normalizedStatus is "attended" or "accepted" or "approve" or "approved")
        {
            throw new InvalidOperationException("Prezenca është refuzuar tashmë.");
        }
        if (normalizedStatus is "attended" or "accepted" or "approve" or "approved")
        {
            session.MarkAttended();
        }
        else if (normalizedStatus is "rejected" or "reject" or "absent")
        {
            session.MarkRejected(reason);

            if (!string.IsNullOrWhiteSpace(session.Student.Email))
            {
                _ = Task.Run(async () =>
                {
                    try
                    {
                        await _emailService.SendStudentTrainingAttendanceRejectedAsync(
                            session.Student,
                            session.Mentor,
                            new TrainingScheduleEmailItem(session.ScheduledDate, session.StartTime, session.EndTime, session.Notes),
                            session.RejectionReason,
                            CancellationToken.None);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to send rejection email to student {StudentId}", session.StudentId);
                    }
                });
            }
        }
        else
        {
            throw new ArgumentException("Invalid attendance status.");
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task<StudentTrainingQrResult> GetSessionQrAsync(Guid sessionId, Guid actorUserId, string actorRole, CancellationToken cancellationToken = default)
    {
        if (!IsAdmin(actorRole) && !IsMentor(actorRole) && !IsStudent(actorRole))
        {
            throw new UnauthorizedAccessException("Only admin, mentor or student can generate QR.");
        }

        var session = await _sessionRepository.Query()
            .Include(x => x.Student)
            .Include(x => x.Mentor)
            .FirstOrDefaultAsync(x => x.Id == sessionId, cancellationToken)
            ?? throw new KeyNotFoundException("Session not found.");

        if (IsStudent(actorRole) && session.StudentId != actorUserId)
        {
            throw new UnauthorizedAccessException("Student can generate QR only for own sessions.");
        }

        if (IsMentor(actorRole) && session.MentorId != actorUserId)
        {
            throw new UnauthorizedAccessException("Mentor can generate QR only for own student sessions.");
        }
        if (!session.Student.IsEffectivelyActive())
        {
            throw new InvalidOperationException("Studenti është jo aktiv.");
        }

        var expiresAt = DateTime.UtcNow.AddHours(8);
        var token = CreateQrToken(session.Id, session.StudentId, expiresAt);
        return new StudentTrainingQrResult(session.Id, token, expiresAt);
    }

    public async Task<MentorAttendanceQrResult> GetMentorAttendanceQrAsync(DateTime selectedDate, Guid actorUserId, string actorRole, CancellationToken cancellationToken = default)
    {
        if (!IsMentor(actorRole))
        {
            throw new UnauthorizedAccessException("Only mentor can generate mentor QR.");
        }

        var day = selectedDate.Date;
        if (!IsToday(day))
        {
            throw new InvalidOperationException("QR i mentorit mund të gjenerohet vetëm për datën e sotme.");
        }

        var nowUtc = DateTime.UtcNow;
        var hasSessionsToday = await _sessionRepository.Query()
            .Where(x => x.MentorId == actorUserId
                        && x.ScheduledDate == day
                        && x.Student.IsActive
                        && (!x.Student.StudentValidUntilUtc.HasValue || x.Student.StudentValidUntilUtc.Value >= nowUtc))
            .AnyAsync(cancellationToken);

        if (!hasSessionsToday)
        {
            throw new InvalidOperationException("Nuk ka studentë të planifikuar për sot.");
        }

        var expiresAt = DateTime.UtcNow.AddHours(8);
        var token = CreateMentorQrToken(actorUserId, day, expiresAt);
        return new MentorAttendanceQrResult(actorUserId, day, token, expiresAt);
    }

    public async Task<StudentTrainingSession> MarkAttendanceByQrAsync(string qrToken, Guid actorUserId, string actorRole, CancellationToken cancellationToken = default)
    {
        if (!IsAdmin(actorRole) && !IsMentor(actorRole))
        {
            throw new UnauthorizedAccessException("Only admin or mentor can scan student QR.");
        }

        var payload = ParseQrToken(NormalizeQrTokenInput(qrToken));
        if (DateTimeOffset.UtcNow.ToUnixTimeSeconds() > payload.ExpiresAtUnix)
        {
            throw new InvalidOperationException("Kodi QR ka skaduar.");
        }

        var session = await _sessionRepository.Query()
            .Include(x => x.Student)
            .Include(x => x.Mentor)
            .FirstOrDefaultAsync(x => x.Id == payload.SessionId, cancellationToken)
            ?? throw new KeyNotFoundException("Session not found.");

        if (session.StudentId != payload.StudentId)
        {
            throw new InvalidOperationException("Kodi QR është i pavlefshëm për këtë sesion.");
        }

        if (IsMentor(actorRole) && session.MentorId != actorUserId)
        {
            throw new UnauthorizedAccessException("Mentor cannot scan attendance for other mentor sessions.");
        }
        if (!session.Student.IsEffectivelyActive())
        {
            throw new InvalidOperationException("Studenti është jo aktiv.");
        }

        if (!IsSessionScheduledForToday(session.ScheduledDate))
        {
            throw new InvalidOperationException("Kodi QR mund të përdoret vetëm në ditën e sesionit.");
        }
        if (session.AttendanceStatus == "rejected")
        {
            throw new InvalidOperationException("Prezenca është refuzuar tashmë.");
        }

        session.MarkAttended();
        await _dbContext.SaveChangesAsync(cancellationToken);
        return session;
    }

    public async Task<StudentTrainingSession> MarkAttendanceByMentorQrAsync(string qrToken, Guid actorUserId, string actorRole, CancellationToken cancellationToken = default)
    {
        if (!IsStudent(actorRole))
        {
            throw new UnauthorizedAccessException("Only student can scan mentor QR.");
        }

        var payload = ParseMentorQrToken(NormalizeQrTokenInput(qrToken));
        if (DateTimeOffset.UtcNow.ToUnixTimeSeconds() > payload.ExpiresAtUnix)
        {
            throw new InvalidOperationException("Kodi QR ka skaduar.");
        }

        var scheduledDate = DateTime.ParseExact(payload.ScheduledDate, "yyyy-MM-dd", null).Date;
        if (!IsToday(scheduledDate))
        {
            throw new InvalidOperationException("Kodi QR i mentorit mund të përdoret vetëm në datën e sotme.");
        }

        var student = await GetStudentOrThrowAsync(actorUserId, cancellationToken);
        if (!student.IsEffectivelyActive())
        {
            throw new InvalidOperationException("Studenti është jo aktiv.");
        }

        var candidateSessions = await _sessionRepository.Query()
            .Include(x => x.Student)
            .Include(x => x.Mentor)
            .Where(x => x.StudentId == actorUserId
                        && x.MentorId == payload.MentorId
                        && x.ScheduledDate == scheduledDate)
            .OrderBy(x => x.StartTime)
            .ToListAsync(cancellationToken);

        if (candidateSessions.Count == 0)
        {
            throw new KeyNotFoundException("Nuk ka seancë të planifikuar për këtë QR.");
        }

        var session = candidateSessions.FirstOrDefault(x => x.AttendanceStatus == "pending")
            ?? candidateSessions.FirstOrDefault(x => x.AttendanceStatus == "attended")
            ?? candidateSessions.FirstOrDefault();

        if (session is null)
        {
            throw new KeyNotFoundException("Session not found.");
        }

        if (session.AttendanceStatus == "rejected")
        {
            throw new InvalidOperationException("Prezenca është refuzuar tashmë.");
        }

        if (session.AttendanceStatus != "attended")
        {
            session.MarkAttended();
            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        return session;
    }

    public async Task<StudentTrainingStazh> EndStazhAsync(
        Guid studentId,
        int mentorFeedbackRating,
        string? mentorFeedbackComment,
        Guid actorUserId,
        string actorRole,
        Guid? requestedMentorId = null,
        CancellationToken cancellationToken = default)
    {
        if (!IsAdmin(actorRole) && !IsMentor(actorRole))
        {
            throw new UnauthorizedAccessException("Only admin or mentor can end stazh.");
        }

        var student = await GetStudentOrThrowAsync(studentId, cancellationToken);
        var mentor = await ResolveMentorOrThrowAsync(student, actorUserId, actorRole, requestedMentorId, cancellationToken);

        var activeStazh = await _stazhRepository.Query()
            .OrderByDescending(x => x.StartedAt)
            .FirstOrDefaultAsync(x => x.StudentId == student.Id && x.MentorId == mentor.Id && x.Status == "active", cancellationToken);

        if (activeStazh is null)
        {
            var earliestSessionDate = await _sessionRepository.Query()
                .Where(x => x.StudentId == student.Id && x.MentorId == mentor.Id)
                .OrderBy(x => x.ScheduledDate)
                .Select(x => (DateTime?)x.ScheduledDate)
                .FirstOrDefaultAsync(cancellationToken);

            activeStazh = new StudentTrainingStazh(student.Id, mentor.Id, earliestSessionDate);
            await _stazhRepository.AddAsync(activeStazh);
        }

        var feedbackToken = GenerateFeedbackToken();
        var tokenExpiresAt = DateTime.UtcNow.AddDays(14);
        activeStazh.End(actorUserId, mentorFeedbackRating, mentorFeedbackComment, feedbackToken, tokenExpiresAt);
        student.Deactivate();

        await _dbContext.SaveChangesAsync(cancellationToken);

        var stazh = await _stazhRepository.Query()
            .Include(x => x.Student)
            .Include(x => x.Mentor)
            .FirstOrDefaultAsync(x => x.Id == activeStazh.Id, cancellationToken)
            ?? activeStazh;

        if (!string.IsNullOrWhiteSpace(student.Email))
        {
            var actionLink = BuildFrontendUri("/stazh-feedback", new Dictionary<string, string>
            {
                ["token"] = feedbackToken
            });

            _ = Task.Run(async () =>
            {
                try
                {
                    await _emailService.SendStudentTrainingFeedbackRequestAsync(
                        student,
                        mentor,
                        new StudentTrainingStazhEmailItem(stazh.StartedAt, stazh.EndedAt, mentorFeedbackRating, mentorFeedbackComment),
                        actionLink,
                        CancellationToken.None);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to send feedback request email to student {StudentId}", student.Id);
                }
            });
        }

        return stazh;
    }

    public async Task<StudentTrainingStazh> GetStazhFeedbackByTokenAsync(string token, CancellationToken cancellationToken = default)
    {
        var normalizedToken = (token ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(normalizedToken))
        {
            throw new InvalidOperationException("Token-i i feedback-ut është i detyrueshëm.");
        }

        var stazh = await _stazhRepository.Query()
            .Include(x => x.Student)
            .Include(x => x.Mentor)
            .FirstOrDefaultAsync(x => x.StudentFeedbackToken == normalizedToken, cancellationToken)
            ?? throw new KeyNotFoundException("Feedback request not found.");

        if (!stazh.IsFeedbackTokenValid(normalizedToken))
        {
            throw new InvalidOperationException("Lidhja e feedback-ut ka skaduar ose është e pavlefshme.");
        }

        return stazh;
    }

    public async Task<StudentTrainingStazh> SubmitStudentFeedbackAsync(
        string token,
        int studentFeedbackRating,
        string? studentFeedbackComment,
        CancellationToken cancellationToken = default)
    {
        var stazh = await GetStazhFeedbackByTokenAsync(token, cancellationToken);
        stazh.SubmitStudentFeedback(studentFeedbackRating, studentFeedbackComment);

        await _dbContext.SaveChangesAsync(cancellationToken);
        return stazh;
    }

    public async Task<IReadOnlyList<StudentTrainingStazh>> GetStudentFeedbackHistoryAsync(Guid studentId, Guid actorUserId, string actorRole, CancellationToken cancellationToken = default)
    {
        if (IsStudent(actorRole) && studentId != actorUserId)
        {
            throw new UnauthorizedAccessException("Student can access only own feedback history.");
        }

        if (!IsAdmin(actorRole) && !IsMentor(actorRole) && !IsStudent(actorRole))
        {
            throw new UnauthorizedAccessException("Role is not allowed to access stazh feedback history.");
        }

        var query = _stazhRepository.Query()
            .Include(x => x.Student)
            .Include(x => x.Mentor)
            .Where(x => x.StudentId == studentId && x.Status == "ended");

        if (IsMentor(actorRole))
        {
            query = query.Where(x => x.MentorId == actorUserId);
        }

        return await query
            .OrderByDescending(x => x.EndedAt ?? x.UpdatedAt)
            .ToListAsync(cancellationToken);
    }

    private async Task<AppUser> GetStudentOrThrowAsync(Guid studentId, CancellationToken cancellationToken)
    {
        var student = await _userRepository.Query()
            .FirstOrDefaultAsync(x => x.Id == studentId, cancellationToken)
            ?? throw new KeyNotFoundException("Student not found.");

        if (!string.Equals(student.Role, "Student", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Target user is not a student.");
        }

        return student;
    }

    private async Task<AppUser> ResolveMentorOrThrowAsync(AppUser student, Guid actorUserId, string actorRole, Guid? requestedMentorId, CancellationToken cancellationToken)
    {
        Guid mentorId;

        if (IsMentor(actorRole))
        {
            mentorId = actorUserId;
            if (student.MentorId != actorUserId)
            {
                throw new UnauthorizedAccessException("Mentor can manage only assigned students.");
            }
        }
        else if (IsAdmin(actorRole))
        {
            mentorId = requestedMentorId ?? student.MentorId ?? throw new InvalidOperationException("Student has no assigned mentor.");
            if (student.MentorId.HasValue && student.MentorId.Value != mentorId)
            {
                throw new InvalidOperationException("Mentor mismatch. Update student's mentor assignment first.");
            }
        }
        else
        {
            throw new UnauthorizedAccessException("Only admin or mentor can manage student training.");
        }

        var mentor = await _userRepository.Query()
            .FirstOrDefaultAsync(x => x.Id == mentorId, cancellationToken)
            ?? throw new KeyNotFoundException("Mentor not found.");

        if (!CanBeAssignedMentor(mentor.Role))
        {
            throw new InvalidOperationException("Selected user cannot act as mentor.");
        }

        return mentor;
    }

    private static IReadOnlyList<TrainingScheduleInput> NormalizeSessions(IReadOnlyList<TrainingScheduleInput> sessions)
    {
        return sessions
            .Where(x => x.Date != default
                        && !string.IsNullOrWhiteSpace(x.StartTime)
                        && !string.IsNullOrWhiteSpace(x.EndTime))
            .Select(x => new TrainingScheduleInput(
                x.Date.Date,
                x.StartTime.Trim(),
                x.EndTime.Trim(),
                string.IsNullOrWhiteSpace(x.Notes) ? null : x.Notes.Trim()))
            .DistinctBy(x => $"{x.Date:yyyy-MM-dd}|{x.StartTime}|{x.EndTime}")
            .OrderBy(x => x.Date)
            .ThenBy(x => x.StartTime)
            .ToList();
    }

    private Guid? ResolveAttendanceMentorScope(Guid actorUserId, string actorRole, Guid? requestedMentorId)
    {
        if (IsMentor(actorRole))
        {
            return actorUserId;
        }

        if (!IsAdmin(actorRole))
        {
            throw new UnauthorizedAccessException("Only admin or mentor can access attendance.");
        }

        if (!requestedMentorId.HasValue)
        {
            return null;
        }

        // For admin attendance filters we allow direct scoping by mentor/admin id.
        // This avoids hard failures for historical IDs or records not present in AspNetUsers.
        return requestedMentorId.Value;
    }

    private static void EnsureCanReadStudentSchedule(AppUser student, Guid actorUserId, string actorRole)
    {
        if (IsAdmin(actorRole))
        {
            return;
        }

        if (IsMentor(actorRole))
        {
            if (student.MentorId != actorUserId)
            {
                throw new UnauthorizedAccessException("Mentor can access only assigned students.");
            }

            return;
        }

        if (IsStudent(actorRole) && student.Id == actorUserId)
        {
            return;
        }

        throw new UnauthorizedAccessException("Not allowed to access this student schedule.");
    }

    private async Task EnsureActiveStazhAsync(Guid studentId, Guid mentorId, CancellationToken cancellationToken)
    {
        var hasActive = await _stazhRepository.Query()
            .AnyAsync(x => x.StudentId == studentId && x.MentorId == mentorId && x.Status == "active", cancellationToken);

        if (hasActive)
        {
            return;
        }

        var earliestSessionDate = await _sessionRepository.Query()
            .Where(x => x.StudentId == studentId && x.MentorId == mentorId)
            .OrderBy(x => x.ScheduledDate)
            .Select(x => (DateTime?)x.ScheduledDate)
            .FirstOrDefaultAsync(cancellationToken);

        await _stazhRepository.AddAsync(new StudentTrainingStazh(studentId, mentorId, earliestSessionDate));
    }

    private string CreateQrToken(Guid sessionId, Guid studentId, DateTime expiresAt)
    {
        var payload = new QrPayload(sessionId, studentId, new DateTimeOffset(expiresAt).ToUnixTimeSeconds());
        var payloadJson = JsonSerializer.Serialize(payload);
        var payloadSegment = Base64UrlEncode(Encoding.UTF8.GetBytes(payloadJson));

        using var hmac = new HMACSHA256(_qrSigningKey);
        var signatureBytes = hmac.ComputeHash(Encoding.UTF8.GetBytes(payloadSegment));
        var signatureSegment = Base64UrlEncode(signatureBytes);

        return $"{payloadSegment}.{signatureSegment}";
    }

    private string CreateMentorQrToken(Guid mentorId, DateTime scheduledDate, DateTime expiresAt)
    {
        var payload = new MentorQrPayload(
            mentorId,
            scheduledDate.ToString("yyyy-MM-dd"),
            new DateTimeOffset(expiresAt).ToUnixTimeSeconds());
        var payloadJson = JsonSerializer.Serialize(payload);
        var payloadSegment = Base64UrlEncode(Encoding.UTF8.GetBytes(payloadJson));

        using var hmac = new HMACSHA256(_qrSigningKey);
        var signatureBytes = hmac.ComputeHash(Encoding.UTF8.GetBytes(payloadSegment));
        var signatureSegment = Base64UrlEncode(signatureBytes);

        return $"{payloadSegment}.{signatureSegment}";
    }

    private QrPayload ParseQrToken(string token)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            throw new InvalidOperationException("Kodi QR është i pavlefshëm.");
        }

        try
        {
            var parts = token.Trim().Split('.', StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length != 2)
            {
                throw new InvalidOperationException("Kodi QR është i pavlefshëm.");
            }

            var payloadSegment = parts[0];
            var signatureSegment = parts[1];

            var providedSignature = Base64UrlDecode(signatureSegment);

            using var hmac = new HMACSHA256(_qrSigningKey);
            var expectedSignature = hmac.ComputeHash(Encoding.UTF8.GetBytes(payloadSegment));

            if (providedSignature.Length != expectedSignature.Length ||
                !CryptographicOperations.FixedTimeEquals(providedSignature, expectedSignature))
            {
                throw new InvalidOperationException("Kodi QR është i pavlefshëm.");
            }

            var payloadJson = Encoding.UTF8.GetString(Base64UrlDecode(payloadSegment));
            var payload = JsonSerializer.Deserialize<QrPayload>(payloadJson)
                ?? throw new InvalidOperationException("Kodi QR është i pavlefshëm.");

            if (payload.SessionId == Guid.Empty || payload.StudentId == Guid.Empty || payload.ExpiresAtUnix <= 0)
            {
                throw new InvalidOperationException("Kodi QR është i pavlefshëm.");
            }

            return payload;
        }
        catch (InvalidOperationException)
        {
            throw;
        }
        catch
        {
            throw new InvalidOperationException("Kodi QR është i pavlefshëm.");
        }
    }

    private MentorQrPayload ParseMentorQrToken(string token)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            throw new InvalidOperationException("Kodi QR i mentorit është i pavlefshëm.");
        }

        try
        {
            var parts = token.Trim().Split('.', StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length != 2)
            {
                throw new InvalidOperationException("Kodi QR i mentorit është i pavlefshëm.");
            }

            var payloadSegment = parts[0];
            var signatureSegment = parts[1];

            var providedSignature = Base64UrlDecode(signatureSegment);

            using var hmac = new HMACSHA256(_qrSigningKey);
            var expectedSignature = hmac.ComputeHash(Encoding.UTF8.GetBytes(payloadSegment));

            if (providedSignature.Length != expectedSignature.Length ||
                !CryptographicOperations.FixedTimeEquals(providedSignature, expectedSignature))
            {
                throw new InvalidOperationException("Kodi QR i mentorit është i pavlefshëm.");
            }

            var payloadJson = Encoding.UTF8.GetString(Base64UrlDecode(payloadSegment));
            var payload = JsonSerializer.Deserialize<MentorQrPayload>(payloadJson)
                ?? throw new InvalidOperationException("Kodi QR i mentorit është i pavlefshëm.");

            if (payload.MentorId == Guid.Empty ||
                string.IsNullOrWhiteSpace(payload.ScheduledDate) ||
                payload.ExpiresAtUnix <= 0)
            {
                throw new InvalidOperationException("Kodi QR i mentorit është i pavlefshëm.");
            }

            return payload;
        }
        catch (InvalidOperationException)
        {
            throw;
        }
        catch
        {
            throw new InvalidOperationException("Kodi QR i mentorit është i pavlefshëm.");
        }
    }

    private static string NormalizeQrTokenInput(string rawInput)
    {
        var value = (rawInput ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new InvalidOperationException("Kodi QR është i pavlefshëm.");
        }

        foreach (var prefix in new[] { "IEKA-ST:", "IEKA-MT:" })
        {
            if (value.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            {
                value = value[prefix.Length..].Trim();
                break;
            }
        }

        if (LooksLikeJson(value) && TryExtractTokenFromJson(value, out var tokenFromJson))
        {
            return tokenFromJson;
        }

        if (Uri.TryCreate(value, UriKind.Absolute, out var uri))
        {
            var fromQuery = GetQueryParameter(uri.Query, "token")
                ?? GetQueryParameter(uri.Query, "qrToken")
                ?? GetQueryParameter(uri.Query, "code");

            if (!string.IsNullOrWhiteSpace(fromQuery))
            {
                return fromQuery.Trim();
            }

            var lastSegment = uri.Segments.LastOrDefault()?.Trim('/');
            if (!string.IsNullOrWhiteSpace(lastSegment) && lastSegment.Contains('.'))
            {
                return lastSegment;
            }
        }

        return value;
    }

    private static bool LooksLikeJson(string value)
        => value.Length >= 2 && value[0] == '{' && value[^1] == '}';

    private static bool TryExtractTokenFromJson(string json, out string token)
    {
        token = string.Empty;
        try
        {
            using var document = JsonDocument.Parse(json);
            if (document.RootElement.ValueKind != JsonValueKind.Object)
            {
                return false;
            }

            foreach (var propertyName in new[] { "qrToken", "token", "value", "data" })
            {
                if (!document.RootElement.TryGetProperty(propertyName, out var property))
                {
                    continue;
                }

                if (property.ValueKind == JsonValueKind.String)
                {
                    var candidate = property.GetString()?.Trim();
                    if (!string.IsNullOrWhiteSpace(candidate))
                    {
                        token = candidate;
                        return true;
                    }
                }
            }

            return false;
        }
        catch
        {
            return false;
        }
    }

    private static string? GetQueryParameter(string query, string key)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            return null;
        }

        var normalized = query.StartsWith('?') ? query[1..] : query;
        var parts = normalized.Split('&', StringSplitOptions.RemoveEmptyEntries);
        foreach (var part in parts)
        {
            var kvp = part.Split('=', 2);
            if (kvp.Length == 0)
            {
                continue;
            }

            var name = Uri.UnescapeDataString(kvp[0]);
            if (!string.Equals(name, key, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            return kvp.Length > 1 ? Uri.UnescapeDataString(kvp[1]) : string.Empty;
        }

        return null;
    }

    private static string Base64UrlEncode(byte[] bytes)
    {
        return Convert.ToBase64String(bytes)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }

    private static byte[] Base64UrlDecode(string input)
    {
        var normalized = input.Replace('-', '+').Replace('_', '/');
        var padding = 4 - (normalized.Length % 4);
        if (padding is > 0 and < 4)
        {
            normalized = normalized.PadRight(normalized.Length + padding, '=');
        }

        return Convert.FromBase64String(normalized);
    }

    private string GenerateFeedbackToken()
    {
        var bytes = new byte[32];
        RandomNumberGenerator.Fill(bytes);
        return Base64UrlEncode(bytes);
    }

    private string BuildFrontendUri(string path, IDictionary<string, string> queryParams)
    {
        var normalizedPath = path.StartsWith('/') ? path : $"/{path}";
        var query = string.Join(
            "&",
            queryParams.Select(pair => $"{Uri.EscapeDataString(pair.Key)}={Uri.EscapeDataString(pair.Value)}"));

        return string.IsNullOrWhiteSpace(query)
            ? $"{_frontendBaseUrl}{normalizedPath}"
            : $"{_frontendBaseUrl}{normalizedPath}?{query}";
    }

    private static bool IsSessionScheduledForToday(DateTime scheduledDate)
    {
        var localToday = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, AppTimeZone).Date;
        return scheduledDate.Date == localToday;
    }

    private static bool IsToday(DateTime date)
    {
        var localToday = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, AppTimeZone).Date;
        return date.Date == localToday;
    }

    private static TimeZoneInfo ResolveAppTimeZone()
    {
        foreach (var candidate in new[] { "Europe/Tirane", "Central Europe Standard Time" })
        {
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById(candidate);
            }
            catch
            {
                // Try the next candidate.
            }
        }

        return TimeZoneInfo.Utc;
    }

    private static bool IsAdmin(string role) =>
        string.Equals(role?.Trim(), "Admin", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(role?.Trim(), "Administrator", StringComparison.OrdinalIgnoreCase);
    private static bool IsMentor(string role) => string.Equals(role?.Trim(), "Mentor", StringComparison.OrdinalIgnoreCase);
    private static bool CanBeAssignedMentor(string role) => IsMentor(role) || IsAdmin(role);
    private static bool IsStudent(string role) => string.Equals(role?.Trim(), "Student", StringComparison.OrdinalIgnoreCase);

    private sealed record QrPayload(Guid SessionId, Guid StudentId, long ExpiresAtUnix);
    private sealed record MentorQrPayload(Guid MentorId, string ScheduledDate, long ExpiresAtUnix);
}
