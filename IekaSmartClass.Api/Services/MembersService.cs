using System.Security.Cryptography;
using System.Data;
using IekaSmartClass.Api.Data;
using IekaSmartClass.Api.Data.Entities;
using IekaSmartClass.Api.Data.Repositories.Interface;
using IekaSmartClass.Api.Services.Interface;
using IekaSmartClass.Api.Utilities.Pagination;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace IekaSmartClass.Api.Services;

public class MembersService(
    IRepository<AppUser> userRepository,
    IApplicationDbContext dbContext,
    UserManager<AppUser> userManager,
    IEmailService emailService,
    INotificationService notificationService,
    IStudentModuleService studentModuleService,
    ILogger<MembersService> logger) : IMembersService
{
    private readonly IRepository<AppUser> _userRepository = userRepository;
    private readonly IApplicationDbContext _dbContext = dbContext;

    public async Task<StudentTrackingPreview> GetNextStudentTrackingPreviewAsync(CancellationToken cancellationToken = default)
    {
        var nextTrackingNumber = await GetNextStudentTrackingNumberAsync(cancellationToken);
        return new StudentTrackingPreview(nextTrackingNumber, FormatStudentTrackingCode(nextTrackingNumber));
    }

    public async Task<PaginatedList<AppUser>> GetMembersAsync(string? search, int pageNumber, int pageSize)
    {
        var query = _userRepository.Query();

        if (!string.IsNullOrWhiteSpace(search))
        {
            search = search.ToLower();
            query = query.Where(u =>
                u.FirstName.ToLower().Contains(search) ||
                u.LastName.ToLower().Contains(search) ||
                (u.Email ?? string.Empty).ToLower().Contains(search) ||
                (u.Email2 ?? string.Empty).ToLower().Contains(search) ||
                (u.StudentNumber ?? string.Empty).ToLower().Contains(search) ||
                (u.Company ?? string.Empty).ToLower().Contains(search) ||
                (u.District ?? string.Empty).ToLower().Contains(search) ||
                u.MemberRegistryNumber.ToLower().Contains(search));
        }

        return await PaginatedList<AppUser>.CreateAsync(query.OrderBy(u => u.FirstName), pageNumber, pageSize);
    }

    public async Task<AppUser?> GetMemberByIdAsync(Guid id)
    {
        return await _userRepository.GetByIdAsync(id);
    }

    public async Task<Guid> AddMemberAsync(
        string firstName,
        string lastName,
        string email,
        string? email2,
        string registryNumber,
        string role,
        int cpdHoursRequired,
        string? phone,
        bool isActive = true,
        Guid? mentorId = null,
        string? validUntilMonth = null,
        int? studentTrackingNumber = null,
        string? studentNumber = null,
        int? studentStartYear = null,
        int? studentEndYear = null,
        string? company = null,
        string? district = null,
        int? studentYear2StartYear = null,
        int? studentYear3StartYear = null)
    {
        var trimmedEmail = email.Trim();
        var trimmedEmail2 = NormalizeOptionalEmail(email2);
        mentorId = await ValidateMentorAssignmentAsync(role, mentorId);
        var studentValidUntilUtc = ParseStudentValidUntilUtc(role, validUntilMonth);
        var isMember = string.Equals(role, "Member", StringComparison.OrdinalIgnoreCase);
        var isStudent = string.Equals(role, "Student", StringComparison.OrdinalIgnoreCase);
        var effectiveIsActive = isMember ? isActive : true;

        using var transaction = isStudent
            ? await _dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable)
            : null;

        var resolvedStudentTrackingNumber = await ResolveStudentTrackingNumberForCreateAsync(
            role,
            studentTrackingNumber,
            studentNumber,
            CancellationToken.None);
        var studentProfile = NormalizeStudentProfile(
            role,
            resolvedStudentTrackingNumber,
            studentStartYear,
            studentEndYear,
            firstName,
            company,
            district,
            studentYear2StartYear,
            studentYear3StartYear);
        var normalizedRegistry = isStudent
            ? studentProfile.MemberRegistryNumber!
            : registryNumber.Trim().ToUpperInvariant();

        var existingRegistry = await _userRepository.Query()
            .AnyAsync(u => u.MemberRegistryNumber.ToUpper() == normalizedRegistry);
        if (existingRegistry)
        {
            throw new InvalidOperationException("Member already exists with this registry number.");
        }

        await EnsureEmailAvailabilityAsync(null, trimmedEmail, trimmedEmail2);
        await EnsureStudentTrackingAvailabilityAsync(null, studentProfile.StudentTrackingNumber);
        await EnsureStudentNumberAvailabilityAsync(null, studentProfile.StudentNumber);

        var user = new AppUser(
            firstName,
            lastName,
            trimmedEmail,
            normalizedRegistry,
            role,
            cpdHoursRequired,
            phone,
            isActive: effectiveIsActive,
            mentorId: mentorId,
            studentValidUntilUtc: studentValidUntilUtc,
            studentTrackingNumber: studentProfile.StudentTrackingNumber,
            email2: trimmedEmail2,
            studentNumber: studentProfile.StudentNumber,
            studentStartYear: studentProfile.StudentStartYear,
            studentEndYear: studentProfile.StudentEndYear,
            company: studentProfile.Company,
            district: studentProfile.District);
        user.MarkPendingConfirmation();
        user.EmailConfirmed = false;
        user.EmailConfirmationCode = GenerateSixDigitCode();
        user.EmailConfirmationExpiresAt = DateTime.UtcNow.AddMinutes(30);

        var createResult = await userManager.CreateAsync(user);
        if (!createResult.Succeeded)
        {
            var errors = string.Join(", ", createResult.Errors.Select(e => e.Description));
            throw new InvalidOperationException(errors);
        }

        if (transaction is not null)
        {
            await transaction.CommitAsync();
        }

        try
        {
            await emailService.SendAccountConfirmationLinkAsync(user, user.EmailConfirmationCode!, CancellationToken.None);
        }
        catch
        {
            await userManager.DeleteAsync(user);
            throw new InvalidOperationException("Failed to send confirmation email.");
        }

        // Auto-assign new student to existing modules matching their year grade
        if (isStudent)
        {
            try
            {
                await studentModuleService.AutoAssignStudentToModulesAsync(user.Id, CancellationToken.None);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Failed to auto-assign modules for new student {StudentId}", user.Id);
            }
        }

        return user.Id;
    }

    public async Task AddMembersBulkAsync(IEnumerable<AppUser> members)
    {
        foreach (var member in members)
        {
            var memberRegistry = member.MemberRegistryNumber.Trim().ToUpperInvariant();
            var exists = await _userRepository.Query().AnyAsync(u => u.MemberRegistryNumber.ToUpper() == memberRegistry);
            if (exists)
            {
                continue;
            }

            await AddMemberAsync(
                member.FirstName,
                member.LastName,
                member.Email ?? string.Empty,
                member.Email2,
                member.MemberRegistryNumber,
                member.Role,
                member.CpdHoursRequired,
                member.Phone,
                member.IsActive,
                member.MentorId,
                member.StudentValidUntilUtc?.ToString("yyyy-MM"),
                member.StudentTrackingNumber,
                member.StudentNumber,
                member.StudentStartYear,
                member.StudentEndYear,
                member.Company,
                member.District);
        }

        await _dbContext.SaveChangesAsync();
    }

    public async Task UpdateMemberAsync(
        Guid id,
        string firstName,
        string lastName,
        string email,
        string? email2,
        string registryNumber,
        string? phone,
        string role,
        int cpdHoursRequired,
        bool isActive,
        Guid? mentorId = null,
        string? validUntilMonth = null,
        int? studentTrackingNumber = null,
        string? studentNumber = null,
        int? studentStartYear = null,
        int? studentEndYear = null,
        string? company = null,
        string? district = null,
        int? studentYear2StartYear = null,
        int? studentYear3StartYear = null)
    {
        var trimmedEmail = email.Trim();
        var trimmedEmail2 = NormalizeOptionalEmail(email2);
        var user = await _userRepository.GetByIdAsync(id) ?? throw new KeyNotFoundException("Member not found.");

        // Capture old values for student notification
        var oldRegistryNumber = user.MemberRegistryNumber;
        var oldStudentNumber = user.StudentNumber;
        var oldStudentStartYear = user.StudentStartYear;
        var oldStudentEndYear = user.StudentEndYear;
        var oldYear2StartYear = user.StudentYear2StartYear;
        var oldYear3StartYear = user.StudentYear3StartYear;
        var oldCompany = user.Company;
        var oldDistrict = user.District;
        var oldMentorId = user.MentorId;
        var oldIsActive = user.IsActive;

        var previousStudentTrackingNumber = GetKnownStudentTrackingNumber(
            user.StudentTrackingNumber,
            user.StudentNumber,
            user.MemberRegistryNumber);
        mentorId = await ValidateMentorAssignmentAsync(role, mentorId);
        var studentValidUntilUtc = ParseStudentValidUntilUtc(role, validUntilMonth);
        var resolvedStudentTrackingNumber = await ResolveStudentTrackingNumberForUpdateAsync(
            user,
            role,
            studentTrackingNumber,
            studentNumber,
            CancellationToken.None);
        var studentProfile = NormalizeStudentProfile(
            role,
            resolvedStudentTrackingNumber,
            studentStartYear,
            studentEndYear,
            firstName,
            company,
            district,
            studentYear2StartYear,
            studentYear3StartYear);
        var normalizedRegistry = string.Equals(role, "Student", StringComparison.OrdinalIgnoreCase)
            ? studentProfile.MemberRegistryNumber!
            : registryNumber.Trim().ToUpperInvariant();

        var existingRegistry = await _userRepository.Query()
            .AnyAsync(u => u.Id != id && u.MemberRegistryNumber.ToUpper() == normalizedRegistry);
        if (existingRegistry)
        {
            throw new InvalidOperationException("Member already exists with this registry number.");
        }

        await EnsureEmailAvailabilityAsync(id, trimmedEmail, trimmedEmail2);
        if (studentProfile.StudentTrackingNumber != previousStudentTrackingNumber)
        {
            await EnsureStudentTrackingAvailabilityAsync(id, studentProfile.StudentTrackingNumber);
        }
        await EnsureStudentNumberAvailabilityAsync(id, studentProfile.StudentNumber);
        var previousEmail = user.Email?.Trim();
        var emailChanged = !string.Equals(previousEmail, trimmedEmail, StringComparison.OrdinalIgnoreCase);

        user.AdminUpdateProfile(
            firstName,
            lastName,
            trimmedEmail,
            trimmedEmail2,
            normalizedRegistry,
            phone,
            role,
            cpdHoursRequired,
            isActive,
            mentorId,
            studentValidUntilUtc,
            studentProfile.StudentTrackingNumber,
            studentProfile.StudentNumber,
            studentProfile.StudentStartYear,
            studentProfile.StudentEndYear,
            studentProfile.Company,
            studentProfile.District,
            studentProfile.StudentYear2StartYear,
            studentProfile.StudentYear3StartYear);
        var result = await userManager.UpdateAsync(user);
        if (!result.Succeeded)
        {
            var errors = string.Join(", ", result.Errors.Select(e => e.Description));
            throw new InvalidOperationException(errors);
        }

        if (emailChanged)
        {
            try
            {
                await emailService.SendAccountEmailChangedAsync(user, previousEmail, CancellationToken.None);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Member {MemberId} email was updated to {Email}, but the notification email could not be sent.", user.Id, user.Email);
            }
        }

        // Notify student about profile changes
        if (string.Equals(role, "Student", StringComparison.OrdinalIgnoreCase))
        {
            var changes = new List<string>();
            if (!string.Equals(oldRegistryNumber, user.MemberRegistryNumber, StringComparison.Ordinal))
                changes.Add($"Numri i regjistrit: {oldRegistryNumber} → {user.MemberRegistryNumber}");
            if (!string.Equals(oldStudentNumber, user.StudentNumber, StringComparison.Ordinal))
                changes.Add($"Numri i studentit: {oldStudentNumber ?? "—"} → {user.StudentNumber ?? "—"}");
            if (oldStudentStartYear != user.StudentStartYear)
                changes.Add($"Viti i fillimit: {oldStudentStartYear?.ToString() ?? "—"} → {user.StudentStartYear?.ToString() ?? "—"}");
            if (oldYear2StartYear != user.StudentYear2StartYear)
                changes.Add($"Viti 2 i fillimit: {oldYear2StartYear?.ToString() ?? "—"} → {user.StudentYear2StartYear?.ToString() ?? "—"}");
            if (oldYear3StartYear != user.StudentYear3StartYear)
                changes.Add($"Viti 3 i fillimit: {oldYear3StartYear?.ToString() ?? "—"} → {user.StudentYear3StartYear?.ToString() ?? "—"}");
            if (oldStudentEndYear != user.StudentEndYear)
                changes.Add($"Viti i përfundimit: {oldStudentEndYear?.ToString() ?? "—"} → {user.StudentEndYear?.ToString() ?? "—"}");
            if (!string.Equals(oldCompany ?? "", user.Company ?? "", StringComparison.OrdinalIgnoreCase))
                changes.Add($"Kompania: {oldCompany ?? "—"} → {user.Company ?? "—"}");
            if (!string.Equals(oldDistrict ?? "", user.District ?? "", StringComparison.OrdinalIgnoreCase))
                changes.Add($"Qarku: {oldDistrict ?? "—"} → {user.District ?? "—"}");
            if (oldMentorId != user.MentorId)
                changes.Add("Mentori u ndryshua");
            if (oldIsActive != user.IsActive)
                changes.Add(user.IsActive ? "Llogaria u aktivizua" : "Llogaria u çaktivizua");

            if (changes.Count > 0)
            {
                try
                {
                    await notificationService.NotifyStudentProfileChangedAsync(id, changes, CancellationToken.None);
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Could not send profile-change notification for student {StudentId}.", id);
                }
            }
        }
    }

    public async Task SendPasswordResetEmailAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var user = await _userRepository.GetByIdAsync(id) ?? throw new KeyNotFoundException("Member not found.");

        if (string.IsNullOrWhiteSpace(user.Email))
        {
            throw new InvalidOperationException("Përdoruesi nuk ka email të regjistruar.");
        }

        var resetCode = GenerateSixDigitCode();
        user.PasswordResetCode = resetCode;
        user.PasswordResetExpiresAt = DateTime.UtcNow.AddMinutes(30);
        user.LoginOtpCode = null;
        user.LoginOtpExpiresAt = null;
        user.LoginOtpChallengeId = null;

        var updateResult = await userManager.UpdateAsync(user);
        if (!updateResult.Succeeded)
        {
            var errors = string.Join(", ", updateResult.Errors.Select(e => e.Description));
            throw new InvalidOperationException(errors);
        }

        try
        {
            await emailService.SendPasswordResetLinkAsync(user, resetCode, CancellationToken.None);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Password reset email could not be sent to member {MemberId}. Reset code was saved — email will work once SMTP is reachable.", user.Id);
            // Don't throw — the reset code is already saved in the database.
            // Email delivery failure should not block the API response.
        }
    }

    public async Task UpdateMemberCpdAsync(Guid id, int addHours)
    {
        var user = await _userRepository.GetByIdAsync(id) ?? throw new KeyNotFoundException("Member not found.");
        user.AddCpdHours(addHours);
        await _dbContext.SaveChangesAsync();
    }

    public async Task DeactivateMemberAsync(Guid id)
    {
        var user = await _userRepository.GetByIdAsync(id) ?? throw new KeyNotFoundException("Member not found.");
        user.Deactivate();
        await _dbContext.SaveChangesAsync();
    }

    public async Task DeleteMemberAsync(Guid id, Guid? actorUserId = null)
    {
        var user = await _userRepository.GetByIdAsync(id) ?? throw new KeyNotFoundException("Member not found.");

        if (actorUserId.HasValue && actorUserId.Value == id)
        {
            throw new InvalidOperationException("Nuk mund të fshini përdoruesin aktual.");
        }

        if (string.Equals(user.Role, "Admin", StringComparison.OrdinalIgnoreCase))
        {
            var otherAdmins = await _userRepository.Query()
                .CountAsync(u => u.Id != id && u.Role == "Admin");
            if (otherAdmins == 0)
            {
                throw new InvalidOperationException("Sistemi duhet të ketë të paktën një administrator.");
            }
        }

        await RemoveUserEventReservationsAsync(id);
        await RemoveUserTrainingDataAsync(id);
        await RemoveUserFeedbackAsync(id);
        await RemoveUserModuleDataAsync(id);
        await RemoveUserNotificationsAsync(id);
        await ClearMentorLinksAsync(id);

        await _dbContext.SaveChangesAsync();

        var deleteResult = await userManager.DeleteAsync(user);
        if (!deleteResult.Succeeded)
        {
            var errors = string.Join(", ", deleteResult.Errors.Select(e => e.Description));
            throw new InvalidOperationException(errors);
        }
    }

    public async Task SetYearlyPaymentStatusAsync(Guid id, bool isPaid, int year)
    {
        var user = await _userRepository.GetByIdAsync(id) ?? throw new KeyNotFoundException("Member not found.");
        user.SetYearlyPaymentStatus(isPaid, year);
        await _dbContext.SaveChangesAsync();
    }

    private static string GenerateSixDigitCode()
    {
        var bytes = new byte[4];
        RandomNumberGenerator.Fill(bytes);
        var value = BitConverter.ToUInt32(bytes, 0) % 1_000_000;
        return value.ToString("D6");
    }

    private async Task EnsureEmailAvailabilityAsync(Guid? excludeUserId, string primaryEmail, string? email2)
    {
        var normalizedPrimaryEmail = primaryEmail.Trim().ToUpperInvariant();
        var normalizedSecondaryEmail = email2?.Trim().ToUpperInvariant();

        if (!string.IsNullOrWhiteSpace(normalizedSecondaryEmail) &&
            string.Equals(normalizedPrimaryEmail, normalizedSecondaryEmail, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Email 2 duhet të jetë ndryshe nga email-i kryesor.");
        }

        var query = _userRepository.Query();
        if (excludeUserId.HasValue)
        {
            query = query.Where(u => u.Id != excludeUserId.Value);
        }

        var primaryExists = await query.AnyAsync(u =>
            u.NormalizedEmail == normalizedPrimaryEmail ||
            (!string.IsNullOrWhiteSpace(u.Email2) && u.Email2.ToUpper() == normalizedPrimaryEmail));
        if (primaryExists)
        {
            throw new InvalidOperationException("Member already exists with this email.");
        }

        if (string.IsNullOrWhiteSpace(normalizedSecondaryEmail))
        {
            return;
        }

        var secondaryExists = await query.AnyAsync(u =>
            u.NormalizedEmail == normalizedSecondaryEmail ||
            (!string.IsNullOrWhiteSpace(u.Email2) && u.Email2.ToUpper() == normalizedSecondaryEmail));
        if (secondaryExists)
        {
            throw new InvalidOperationException("Member already exists with this secondary email.");
        }
    }

    private async Task EnsureStudentNumberAvailabilityAsync(Guid? excludeUserId, string? studentNumber)
    {
        if (string.IsNullOrWhiteSpace(studentNumber))
        {
            return;
        }

        var query = _userRepository.Query();
        if (excludeUserId.HasValue)
        {
            query = query.Where(u => u.Id != excludeUserId.Value);
        }

        var normalizedStudentNumber = studentNumber.Trim().ToUpperInvariant();
        var exists = await query.AnyAsync(u =>
            !string.IsNullOrWhiteSpace(u.StudentNumber) &&
            u.StudentNumber.ToUpper() == normalizedStudentNumber);

        if (exists)
        {
            throw new InvalidOperationException("Member already exists with this student number.");
        }
    }

    private async Task EnsureStudentTrackingAvailabilityAsync(Guid? excludeUserId, int? studentTrackingNumber)
    {
        if (!studentTrackingNumber.HasValue)
        {
            return;
        }

        var exists = await StudentTrackingExistsAsync(excludeUserId, studentTrackingNumber.Value, CancellationToken.None);

        if (exists)
        {
            throw new InvalidOperationException("Member already exists with this tracking number.");
        }
    }

    private async Task<int?> ResolveStudentTrackingNumberForCreateAsync(
        string role,
        int? requestedStudentTrackingNumber,
        string? studentNumber,
        CancellationToken cancellationToken)
    {
        if (!string.Equals(role, "Student", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        var explicitTrackingNumber = requestedStudentTrackingNumber ?? ExtractStudentTrackingNumber(studentNumber);
        if (explicitTrackingNumber.HasValue)
        {
            if (explicitTrackingNumber.Value < 1)
            {
                throw new InvalidOperationException("Tracking number duhet të jetë më i madh se zero.");
            }

            var requestedTrackingInUse = await StudentTrackingExistsAsync(null, explicitTrackingNumber.Value, cancellationToken);
            if (!requestedTrackingInUse)
            {
                return explicitTrackingNumber.Value;
            }
        }

        return await GetNextStudentTrackingNumberAsync(cancellationToken);
    }

    private async Task<int?> ResolveStudentTrackingNumberForUpdateAsync(
        AppUser existingUser,
        string role,
        int? requestedStudentTrackingNumber,
        string? studentNumber,
        CancellationToken cancellationToken)
    {
        if (!string.Equals(role, "Student", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        var existingTrackingNumber = GetKnownStudentTrackingNumber(
            existingUser.StudentTrackingNumber,
            existingUser.StudentNumber,
            existingUser.MemberRegistryNumber);

        var explicitTrackingNumber = requestedStudentTrackingNumber ?? ExtractStudentTrackingNumber(studentNumber);
        var resolvedTrackingNumber = existingTrackingNumber ?? explicitTrackingNumber;

        if (resolvedTrackingNumber.HasValue)
        {
            if (resolvedTrackingNumber.Value < 1)
            {
                throw new InvalidOperationException("Tracking number duhet të jetë më i madh se zero.");
            }

            return resolvedTrackingNumber.Value;
        }

        return await GetNextStudentTrackingNumberAsync(cancellationToken);
    }

    private async Task<int> GetNextStudentTrackingNumberAsync(CancellationToken cancellationToken)
    {
        var students = await _userRepository.Query()
            .Where(u => u.Role == "Student")
            .Select(u => new { u.StudentTrackingNumber, u.StudentNumber, u.MemberRegistryNumber })
            .ToListAsync(cancellationToken);

        var maxTrackingNumber = students
            .Select(student => GetKnownStudentTrackingNumber(
                student.StudentTrackingNumber,
                student.StudentNumber,
                student.MemberRegistryNumber))
            .Where(number => number.HasValue)
            .Select(number => number!.Value)
            .DefaultIfEmpty(0)
            .Max();

        return maxTrackingNumber + 1;
    }

    private async Task<bool> StudentTrackingExistsAsync(Guid? excludeUserId, int trackingNumber, CancellationToken cancellationToken)
    {
        var query = _userRepository.Query();
        if (excludeUserId.HasValue)
        {
            query = query.Where(u => u.Id != excludeUserId.Value);
        }

        var students = await query
            .Where(u => u.Role == "Student")
            .Select(u => new { u.StudentTrackingNumber, u.StudentNumber, u.MemberRegistryNumber })
            .ToListAsync(cancellationToken);

        return students.Any(student => GetKnownStudentTrackingNumber(
            student.StudentTrackingNumber,
            student.StudentNumber,
            student.MemberRegistryNumber) == trackingNumber);
    }

    private async Task<Guid?> ValidateMentorAssignmentAsync(string role, Guid? mentorId)
    {
        var isStudent = string.Equals(role, "Student", StringComparison.OrdinalIgnoreCase);

        if (!isStudent)
        {
            return null;
        }

        if (!mentorId.HasValue)
        {
            return null;
        }

        var mentor = await _dbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == mentorId.Value);

        var normalizedMentorRole = mentor?.Role?.Trim();
        var isAllowedMentorRole =
            string.Equals(normalizedMentorRole, "Mentor", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(normalizedMentorRole, "Admin", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(normalizedMentorRole, "Administrator", StringComparison.OrdinalIgnoreCase);

        // If lookup unexpectedly returns null (environment/data inconsistency), do not hard-fail here.
        // The database FK remains the final guard for truly invalid IDs.
        if (mentor is null)
        {
            return mentorId;
        }

        if (!isAllowedMentorRole)
        {
            throw new InvalidOperationException("Mentori i zgjedhur nuk ekziston.");
        }

        return mentorId;
    }

    private static DateTime? ParseStudentValidUntilUtc(string role, string? validUntilMonth)
    {
        if (!string.Equals(role, "Student", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        if (string.IsNullOrWhiteSpace(validUntilMonth))
        {
            throw new InvalidOperationException("Për studentin duhet të zgjidhni fushën 'Valid deri në'.");
        }

        if (!DateTime.TryParseExact(validUntilMonth.Trim(), "yyyy-MM", CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsedMonth))
        {
            throw new InvalidOperationException("Formati i 'Valid deri në' duhet të jetë YYYY-MM.");
        }

        return new DateTime(parsedMonth.Year, parsedMonth.Month, 1, 0, 0, 0, DateTimeKind.Utc)
            .AddMonths(1)
            .AddTicks(-1);
    }

    private static StudentProfileData NormalizeStudentProfile(
        string role,
        int? studentTrackingNumber,
        int? studentStartYear,
        int? studentEndYear,
        string firstName,
        string? company,
        string? district,
        int? studentYear2StartYear = null,
        int? studentYear3StartYear = null)
    {
        if (!string.Equals(role, "Student", StringComparison.OrdinalIgnoreCase))
        {
            return StudentProfileData.Empty;
        }

        if (!studentTrackingNumber.HasValue)
        {
            throw new InvalidOperationException("Për studentin duhet të plotësohet tracking number.");
        }
        if (studentTrackingNumber.Value < 1)
        {
            throw new InvalidOperationException("Tracking number duhet të jetë më i madh se zero.");
        }

        if (!studentStartYear.HasValue)
        {
            throw new InvalidOperationException("Për studentin duhet të plotësohet Viti Fillimit.");
        }

        if (studentStartYear.Value < 2000 || studentStartYear.Value > 2100)
        {
            throw new InvalidOperationException("Viti Fillimit nuk është i vlefshëm.");
        }

        // Validate per-year overrides if provided
        var y2Start = studentYear2StartYear;
        var y3Start = studentYear3StartYear;
        if (y2Start.HasValue && y2Start.Value <= studentStartYear.Value)
        {
            throw new InvalidOperationException("Viti i Dytë duhet të fillojë pas Vitit të Parë.");
        }
        if (y3Start.HasValue && y2Start.HasValue && y3Start.Value <= y2Start.Value)
        {
            throw new InvalidOperationException("Viti i Tretë duhet të fillojë pas Vitit të Dytë.");
        }
        if (y3Start.HasValue && !y2Start.HasValue && y3Start.Value <= studentStartYear.Value + 1)
        {
            throw new InvalidOperationException("Viti i Tretë duhet të fillojë pas Vitit të Dytë.");
        }

        // End year = year 3 start + 1 (when year 3 finishes)
        var y3Effective = y3Start ?? (y2Start.HasValue ? y2Start.Value + 1 : studentStartYear.Value + 2);
        var computedEndYear = y3Effective + 1;

        var normalizedCompany = NormalizeOptionalValue(company);
        var normalizedDistrict = NormalizeOptionalValue(district);
        var normalizedStudentNumber = FormatStudentTrackingCode(studentTrackingNumber.Value);
        var generatedMemberRegistryNumber = BuildStudentMemberRegistryNumber(
            normalizedStudentNumber,
            firstName,
            studentStartYear.Value,
            computedEndYear);

        return new StudentProfileData(
            studentTrackingNumber.Value,
            normalizedStudentNumber,
            studentStartYear.Value,
            computedEndYear,
            normalizedCompany,
            normalizedDistrict,
            generatedMemberRegistryNumber,
            y2Start,
            y3Start);
    }

    private static int? GetKnownStudentTrackingNumber(int? storedTrackingNumber, string? studentNumber, string? memberRegistryNumber)
    {
        return storedTrackingNumber
            ?? ExtractStudentTrackingNumber(studentNumber)
            ?? ExtractStudentTrackingNumber(memberRegistryNumber);
    }

    private static int? ExtractStudentTrackingNumber(string? value)
    {
        var normalized = value?.Trim().ToUpperInvariant();
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return null;
        }

        var match = Regex.Match(normalized, "^ST(?<number>\\d{3,4})(?:-|$)");
        if (!match.Success)
        {
            return null;
        }

        return int.TryParse(match.Groups["number"].Value, out var parsed) && parsed >= 1
            ? parsed
            : null;
    }

    private static string FormatStudentTrackingCode(int trackingNumber)
    {
        return $"ST{trackingNumber:D3}";
    }

    private static string BuildStudentMemberRegistryNumber(string studentNumber, string firstName, int studentStartYear, int studentEndYear)
    {
        var initials = NormalizeStudentInitials(firstName, 3);
        var startYearSuffix = studentStartYear.ToString(CultureInfo.InvariantCulture)[^2..];
        var endYearSuffix = studentEndYear.ToString(CultureInfo.InvariantCulture)[^2..];
        return $"{studentNumber}-{initials}{startYearSuffix}{endYearSuffix}";
    }

    private static string NormalizeStudentInitials(string firstName, int length)
    {
        var normalized = string.Concat((firstName ?? string.Empty)
            .Trim()
            .Normalize(NormalizationForm.FormD)
            .Where(ch => CharUnicodeInfo.GetUnicodeCategory(ch) != UnicodeCategory.NonSpacingMark))
            .ToUpperInvariant();

        var lettersOnly = new string(normalized.Where(ch => ch is >= 'A' and <= 'Z').ToArray());
        var sliced = lettersOnly.Length >= length ? lettersOnly[..length] : lettersOnly;
        return sliced.PadRight(length, 'X');
    }

    private static string? NormalizeOptionalEmail(string? email)
    {
        var trimmed = email?.Trim();
        return string.IsNullOrWhiteSpace(trimmed) ? null : trimmed;
    }

    private static string? NormalizeOptionalValue(string? value)
    {
        var trimmed = value?.Trim();
        return string.IsNullOrWhiteSpace(trimmed) ? null : trimmed;
    }

    private async Task RemoveUserEventReservationsAsync(Guid userId)
    {
        var participants = await _dbContext.Participants
            .Where(x => x.UserId == userId)
            .OrderBy(x => x.RegisteredAt)
            .ToListAsync();

        if (participants.Count == 0)
        {
            return;
        }

        foreach (var participant in participants.Where(x => x.Status == "registered"))
        {
            var date = await _dbContext.EventDates.FirstOrDefaultAsync(x => x.Id == participant.DateId);
            date?.DecrementParticipant();

            if (date is null)
            {
                continue;
            }

            var nextInLine = await _dbContext.Participants
                .Where(x =>
                    x.EventItemId == participant.EventItemId &&
                    x.DateId == participant.DateId &&
                    x.Status == "waitlisted" &&
                    x.UserId != userId)
                .OrderBy(x => x.RegisteredAt)
                .FirstOrDefaultAsync();

            if (nextInLine is not null)
            {
                date.IncrementParticipant();
                nextInLine.Promote(date.CurrentParticipants);
            }
        }

        _dbContext.Participants.RemoveRange(participants);
    }

    private async Task RemoveUserTrainingDataAsync(Guid userId)
    {
        var sessions = await _dbContext.StudentTrainingSessions
            .Where(x => x.StudentId == userId || x.MentorId == userId)
            .ToListAsync();
        if (sessions.Count > 0)
        {
            _dbContext.StudentTrainingSessions.RemoveRange(sessions);
        }

        var stazhet = await _dbContext.StudentTrainingStazhet
            .Where(x => x.StudentId == userId || x.MentorId == userId || x.EndedByUserId == userId)
            .ToListAsync();
        if (stazhet.Count > 0)
        {
            _dbContext.StudentTrainingStazhet.RemoveRange(stazhet);
        }

        var legacyStazhet = await _dbContext.Stazhet
            .Where(x => x.StudentId == userId || x.MentorId == userId)
            .ToListAsync();
        if (legacyStazhet.Count > 0)
        {
            _dbContext.Stazhet.RemoveRange(legacyStazhet);
        }
    }

    private async Task RemoveUserFeedbackAsync(Guid userId)
    {
        var feedbacks = await _dbContext.EventFeedbacks
            .Where(x => x.UserId == userId)
            .ToListAsync();
        if (feedbacks.Count > 0)
        {
            _dbContext.EventFeedbacks.RemoveRange(feedbacks);
        }
    }

    private async Task RemoveUserModuleDataAsync(Guid userId)
    {
        var answers = await _dbContext.TopicQuestionnaireAnswers
            .Where(a => _dbContext.TopicQuestionnaireResponses
                .Where(r => r.StudentId == userId)
                .Select(r => r.Id)
                .Contains(a.ResponseId))
            .ToListAsync();
        if (answers.Count > 0) _dbContext.TopicQuestionnaireAnswers.RemoveRange(answers);

        var responses = await _dbContext.TopicQuestionnaireResponses
            .Where(x => x.StudentId == userId).ToListAsync();
        if (responses.Count > 0) _dbContext.TopicQuestionnaireResponses.RemoveRange(responses);

        var attendances = await _dbContext.StudentModuleTopicAttendances
            .Where(x => x.StudentId == userId).ToListAsync();
        if (attendances.Count > 0) _dbContext.StudentModuleTopicAttendances.RemoveRange(attendances);

        var assignments = await _dbContext.StudentModuleAssignments
            .Where(x => x.StudentId == userId).ToListAsync();
        if (assignments.Count > 0) _dbContext.StudentModuleAssignments.RemoveRange(assignments);
    }

    private async Task RemoveUserNotificationsAsync(Guid userId)
    {
        var notifications = await _dbContext.UserNotifications
            .Where(x => x.UserId == userId).ToListAsync();
        if (notifications.Count > 0) _dbContext.UserNotifications.RemoveRange(notifications);
    }

    private async Task ClearMentorLinksAsync(Guid mentorId)
    {
        var assignedStudents = await _userRepository.Query()
            .Where(x => x.MentorId == mentorId)
            .ToListAsync();
        foreach (var student in assignedStudents)
        {
            student.SetMentor(null);
        }
    }

    private sealed record StudentProfileData(
        int? StudentTrackingNumber,
        string? StudentNumber,
        int? StudentStartYear,
        int? StudentEndYear,
        string? Company,
        string? District,
        string? MemberRegistryNumber,
        int? StudentYear2StartYear = null,
        int? StudentYear3StartYear = null)
    {
        public static StudentProfileData Empty { get; } = new(null, null, null, null, null, null, null);
    }
}
