using System.Reflection;
using IekaSmartClass.Api.Data.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace IekaSmartClass.Api.Data;

public class ApplicationDbContext : IdentityUserContext<AppUser, Guid>, IApplicationDbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) { }

    public new DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<EventItem> Events => Set<EventItem>();
    public DbSet<EventDate> EventDates => Set<EventDate>();
    public DbSet<Participant> Participants => Set<Participant>();
    public DbSet<StudentTrainingSession> StudentTrainingSessions => Set<StudentTrainingSession>();
    public DbSet<StudentTrainingStazh> StudentTrainingStazhet => Set<StudentTrainingStazh>();
    public DbSet<EventDocument> EventDocuments => Set<EventDocument>();
    public DbSet<EventFeedback> EventFeedbacks => Set<EventFeedback>();
    public DbSet<SystemConfiguration> SystemConfigurations => Set<SystemConfiguration>();
    public DbSet<Stazh> Stazhet { get; set; } = null!;
    public DbSet<StazhDate> StazhDates => Set<StazhDate>();
    public DbSet<StazhDocument> StazhDocuments => Set<StazhDocument>();
    public DbSet<UserNotification> UserNotifications => Set<UserNotification>();
    public DbSet<StudentModule> StudentModules => Set<StudentModule>();
    public DbSet<StudentModuleTopic> StudentModuleTopics => Set<StudentModuleTopic>();
    public DbSet<StudentModuleDocument> StudentModuleDocuments => Set<StudentModuleDocument>();
    public DbSet<StudentModuleAssignment> StudentModuleAssignments => Set<StudentModuleAssignment>();
    public DbSet<StudentModuleTopicAttendance> StudentModuleTopicAttendances => Set<StudentModuleTopicAttendance>();
    public DbSet<TopicQuestionnaire> TopicQuestionnaires => Set<TopicQuestionnaire>();
    public DbSet<TopicQuestionnaireQuestion> TopicQuestionnaireQuestions => Set<TopicQuestionnaireQuestion>();
    public DbSet<TopicQuestionnaireResponse> TopicQuestionnaireResponses => Set<TopicQuestionnaireResponse>();
    public DbSet<TopicQuestionnaireAnswer> TopicQuestionnaireAnswers => Set<TopicQuestionnaireAnswer>();
    public DbSet<EvaluationQuestionnaire> EvaluationQuestionnaires => Set<EvaluationQuestionnaire>();
    public DbSet<EvaluationQuestion> EvaluationQuestions => Set<EvaluationQuestion>();
    public DbSet<EvaluationResponse> EvaluationResponses => Set<EvaluationResponse>();
    public DbSet<EvaluationAnswer> EvaluationAnswers => Set<EvaluationAnswer>();
    public DbSet<EvaluationSendLog> EvaluationSendLogs => Set<EvaluationSendLog>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.ApplyConfigurationsFromAssembly(Assembly.GetExecutingAssembly());

        builder.Entity<AppUser>(entity =>
        {
            entity.ToTable("AspNetUsers");
            entity.Property(u => u.PhoneNumber).HasColumnName("Phone");
            entity.Property(u => u.PasswordHash).HasColumnName("PasscodeHash");
            entity.Property(u => u.Email2).HasMaxLength(256);
            entity.Property(u => u.MemberRegistryNumber).HasMaxLength(50);
            entity.Property(u => u.Role).HasMaxLength(50);
            entity.Property(u => u.FirstName).HasMaxLength(100);
            entity.Property(u => u.LastName).HasMaxLength(100);
            entity.Property(u => u.StudentTrackingNumber);
            entity.Property(u => u.StudentNumber).HasMaxLength(50);
            entity.Property(u => u.Company).HasMaxLength(200);
            entity.Property(u => u.District).HasMaxLength(100);
            entity.Property(u => u.NotifyByEmail).HasDefaultValue(true);
            entity.Property(u => u.NotifyBySms).HasDefaultValue(false);
            entity.Property(u => u.NotifyBookingOpen).HasDefaultValue(true);
            entity.Property(u => u.NotifySessionReminder).HasDefaultValue(true);
            entity.Property(u => u.NotifySurveyReminder).HasDefaultValue(true);
            entity.Property(u => u.NotifyCpdDeadline).HasDefaultValue(true);
            entity.HasIndex(u => u.MemberRegistryNumber).IsUnique();
            entity.HasIndex(u => u.MentorId);
            entity.HasIndex(u => u.StudentTrackingNumber);
            entity.HasIndex(u => new { u.Role, u.IsActive });
            entity.HasIndex(u => new { u.Role, u.IsActive, u.StudentStartYear });

            entity.HasOne<AppUser>()
                .WithMany()
                .HasForeignKey(u => u.MentorId)
                .OnDelete(DeleteBehavior.NoAction);
        });

        builder.Entity<UserNotification>(entity =>
        {
            entity.Property(x => x.Type).HasMaxLength(50);
            entity.Property(x => x.Title).HasMaxLength(200);
            entity.Property(x => x.Body).HasMaxLength(1000);
            entity.Property(x => x.Link).HasMaxLength(500);
            entity.Property(x => x.DeduplicationKey).HasMaxLength(200);
            entity.HasIndex(x => x.UserId);
            entity.HasIndex(x => x.CreatedAtUtc);
            entity.HasIndex(x => x.DeduplicationKey).IsUnique();

            entity.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<IdentityUserClaim<Guid>>().ToTable("AspNetUserClaims");
        builder.Entity<IdentityUserLogin<Guid>>().ToTable("AspNetUserLogins");
        builder.Entity<IdentityUserToken<Guid>>().ToTable("AspNetUserTokens");

        // SQL Server does not allow multiple cascade paths on the same table.
        // Participants has FKs to both Events (EventItemId) and EventDates (DateId→Events),
        // creating a cycle. Disable cascade on the direct Participants→Events FK.
        builder.Entity<Participant>()
            .HasOne(p => p.EventItem)
            .WithMany(e => e.Participants)
            .HasForeignKey(p => p.EventItemId)
            .OnDelete(DeleteBehavior.NoAction);

        // Map DateId (the domain name) to the EventDate navigation property
        // to avoid EF generating a duplicate shadow FK column "EventDateId".
        builder.Entity<Participant>()
            .HasOne(p => p.EventDate)
            .WithMany()
            .HasForeignKey(p => p.DateId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<Participant>()
            .HasIndex(p => p.FeedbackToken)
            .IsUnique()
            .HasFilter("[FeedbackToken] IS NOT NULL");

        builder.Entity<StudentTrainingSession>(entity =>
        {
            entity.Property(x => x.StartTime).HasMaxLength(20);
            entity.Property(x => x.EndTime).HasMaxLength(20);
            entity.Property(x => x.AttendanceStatus).HasMaxLength(20);
            entity.Property(x => x.RejectionReason).HasMaxLength(500);
            entity.Property(x => x.Notes).HasMaxLength(1000);
            entity.HasIndex(x => x.StudentId);
            entity.HasIndex(x => x.MentorId);
            entity.HasIndex(x => x.ScheduledDate);
            entity.HasIndex(x => new { x.StudentId, x.MentorId, x.ScheduledDate });

            entity.HasOne(x => x.Student)
                .WithMany()
                .HasForeignKey(x => x.StudentId)
                .OnDelete(DeleteBehavior.NoAction);

            entity.HasOne(x => x.Mentor)
                .WithMany()
                .HasForeignKey(x => x.MentorId)
                .OnDelete(DeleteBehavior.NoAction);
        });

        builder.Entity<StudentTrainingStazh>(entity =>
        {
            entity.Property(x => x.Status).HasMaxLength(20);
            entity.Property(x => x.MentorFeedbackComment).HasMaxLength(3000);
            entity.Property(x => x.StudentFeedbackComment).HasMaxLength(3000);
            entity.Property(x => x.StudentFeedbackToken).HasMaxLength(200);
            entity.HasIndex(x => x.StudentId);
            entity.HasIndex(x => x.MentorId);
            entity.HasIndex(x => x.Status);
            entity.HasIndex(x => x.StudentFeedbackToken).IsUnique();
            entity.HasIndex(x => new { x.StudentId, x.MentorId, x.Status });

            entity.HasOne(x => x.Student)
                .WithMany()
                .HasForeignKey(x => x.StudentId)
                .OnDelete(DeleteBehavior.NoAction);

            entity.HasOne(x => x.Mentor)
                .WithMany()
                .HasForeignKey(x => x.MentorId)
                .OnDelete(DeleteBehavior.NoAction);

            entity.HasOne(x => x.EndedByUser)
                .WithMany()
                .HasForeignKey(x => x.EndedByUserId)
                .OnDelete(DeleteBehavior.NoAction);
        });

        // Stazh relationships
        builder.Entity<Stazh>()
            .HasOne(s => s.Mentor)
            .WithMany()
            .HasForeignKey(s => s.MentorId)
            .OnDelete(DeleteBehavior.NoAction);

        builder.Entity<Stazh>()
            .HasOne(s => s.Student)
            .WithMany()
            .HasForeignKey(s => s.StudentId)
            .OnDelete(DeleteBehavior.NoAction);

        builder.Entity<StazhDate>()
            .HasOne(d => d.Stazh)
            .WithMany(s => s.Dates)
            .HasForeignKey(d => d.StazhId)
            .OnDelete(DeleteBehavior.Cascade);

        // StudentModule relationships
        builder.Entity<StudentModule>(entity =>
        {
            entity.Property(x => x.Title).HasMaxLength(500);
            entity.Property(x => x.Location).HasMaxLength(500);
            entity.HasIndex(x => x.YearGrade);
            entity.HasIndex(x => x.CreatedAt);

            entity.HasOne(x => x.CreatedByUser)
                .WithMany()
                .HasForeignKey(x => x.CreatedByUserId)
                .OnDelete(DeleteBehavior.NoAction);
        });

        builder.Entity<StudentModuleTopic>(entity =>
        {
            entity.Property(x => x.Name).HasMaxLength(500);
            entity.Property(x => x.Lecturer).HasMaxLength(200);
            entity.Property(x => x.Location).HasMaxLength(500);
            entity.Property(x => x.RequireLocation).HasDefaultValue(true);
            entity.HasIndex(x => x.StudentModuleId);
            entity.HasIndex(x => x.ScheduledDate);

            entity.HasOne(x => x.StudentModule)
                .WithMany(m => m.Topics)
                .HasForeignKey(x => x.StudentModuleId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<StudentModuleDocument>(entity =>
        {
            entity.Property(x => x.FileName).HasMaxLength(300);
            entity.Property(x => x.FileUrl).HasMaxLength(1000);
            entity.Property(x => x.RelativePath).HasMaxLength(1000);
            entity.HasIndex(x => x.StudentModuleTopicId);

            entity.HasOne(x => x.StudentModuleTopic)
                .WithMany(t => t.Documents)
                .HasForeignKey(x => x.StudentModuleTopicId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<StudentModuleAssignment>(entity =>
        {
            entity.HasIndex(x => x.StudentModuleId);
            entity.HasIndex(x => x.StudentId);
            entity.HasIndex(x => new { x.StudentModuleId, x.StudentId }).IsUnique();

            entity.HasOne(x => x.StudentModule)
                .WithMany(m => m.Assignments)
                .HasForeignKey(x => x.StudentModuleId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.Student)
                .WithMany()
                .HasForeignKey(x => x.StudentId)
                .OnDelete(DeleteBehavior.NoAction);
        });

        builder.Entity<StudentModuleTopicAttendance>(entity =>
        {
            entity.HasIndex(x => new { x.TopicId, x.StudentId }).IsUnique();
            entity.HasIndex(x => x.StudentId);

            entity.HasOne(x => x.Topic)
                .WithMany(t => t.Attendances)
                .HasForeignKey(x => x.TopicId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.Student)
                .WithMany()
                .HasForeignKey(x => x.StudentId)
                .OnDelete(DeleteBehavior.NoAction);
        });

        // TopicQuestionnaire
        builder.Entity<TopicQuestionnaire>(entity =>
        {
            entity.Property(x => x.Title).HasMaxLength(500);
            entity.HasIndex(x => x.TopicId);

            entity.HasOne(x => x.Topic)
                .WithMany(t => t.Questionnaires)
                .HasForeignKey(x => x.TopicId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<TopicQuestionnaireQuestion>(entity =>
        {
            entity.Property(x => x.Text).HasMaxLength(1000);
            entity.Property(x => x.OptionsJson).HasMaxLength(4000);
            entity.Property(x => x.Type).HasConversion<string>().HasMaxLength(20);
            entity.HasIndex(x => x.QuestionnaireId);

            entity.HasOne(x => x.Questionnaire)
                .WithMany(q => q.Questions)
                .HasForeignKey(x => x.QuestionnaireId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<TopicQuestionnaireResponse>(entity =>
        {
            entity.HasIndex(x => new { x.QuestionnaireId, x.StudentId }).IsUnique();
            entity.HasIndex(x => x.StudentId);

            entity.HasOne(x => x.Questionnaire)
                .WithMany(q => q.Responses)
                .HasForeignKey(x => x.QuestionnaireId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.Student)
                .WithMany()
                .HasForeignKey(x => x.StudentId)
                .OnDelete(DeleteBehavior.NoAction);
        });

        builder.Entity<TopicQuestionnaireAnswer>(entity =>
        {
            entity.Property(x => x.AnswerText).HasMaxLength(4000);
            entity.HasIndex(x => new { x.ResponseId, x.QuestionId }).IsUnique();

            entity.HasOne(x => x.Response)
                .WithMany(r => r.Answers)
                .HasForeignKey(x => x.ResponseId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.Question)
                .WithMany(q => q.Answers)
                .HasForeignKey(x => x.QuestionId)
                .OnDelete(DeleteBehavior.NoAction);
        });

        // Evaluation Questionnaire entities
        builder.Entity<EvaluationQuestionnaire>(entity =>
        {
            entity.Property(x => x.Title).HasMaxLength(500);
            entity.Property(x => x.Description).HasMaxLength(2000);
            entity.Property(x => x.EmailSubject).HasMaxLength(500);
            entity.Property(x => x.EmailBody).HasMaxLength(4000);
            entity.HasIndex(x => x.CreatedAt);
        });

        builder.Entity<EvaluationQuestion>(entity =>
        {
            entity.Property(x => x.Text).HasMaxLength(1000);
            entity.Property(x => x.OptionsJson).HasMaxLength(4000);
            entity.Property(x => x.Type).HasConversion<string>().HasMaxLength(20);
            entity.HasIndex(x => x.QuestionnaireId);

            entity.HasOne(x => x.Questionnaire)
                .WithMany(q => q.Questions)
                .HasForeignKey(x => x.QuestionnaireId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<EvaluationResponse>(entity =>
        {
            entity.HasIndex(x => new { x.QuestionnaireId, x.UserId }).IsUnique();
            entity.HasIndex(x => x.UserId);

            entity.HasOne(x => x.Questionnaire)
                .WithMany(q => q.Responses)
                .HasForeignKey(x => x.QuestionnaireId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.NoAction);
        });

        builder.Entity<EvaluationAnswer>(entity =>
        {
            entity.Property(x => x.AnswerText).HasMaxLength(4000);
            entity.HasIndex(x => new { x.ResponseId, x.QuestionId }).IsUnique();

            entity.HasOne(x => x.Response)
                .WithMany(r => r.Answers)
                .HasForeignKey(x => x.ResponseId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.Question)
                .WithMany(q => q.Answers)
                .HasForeignKey(x => x.QuestionId)
                .OnDelete(DeleteBehavior.NoAction);
        });

        builder.Entity<EvaluationSendLog>(entity =>
        {
            entity.HasIndex(x => x.QuestionnaireId);

            entity.HasOne(x => x.Questionnaire)
                .WithMany(q => q.SendLogs)
                .HasForeignKey(x => x.QuestionnaireId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<StazhDocument>()
            .HasOne(d => d.Stazh)
            .WithMany(s => s.Documents)
            .HasForeignKey(d => d.StazhId)
            .OnDelete(DeleteBehavior.Cascade);

        // Event relations
        builder.Entity<EventItem>()
            .HasMany(e => e.Dates)
            .WithOne(d => d.EventItem)
            .HasForeignKey(d => d.EventItemId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<EventItem>()
            .HasMany(e => e.Documents)
            .WithOne(d => d.EventItem)
            .HasForeignKey(d => d.EventItemId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<EventItem>()
            .HasMany(e => e.Feedbacks)
            .WithOne(f => f.EventItem)
            .HasForeignKey(f => f.EventItemId)
            .OnDelete(DeleteBehavior.Cascade);

        // Seed users
        var sharedHash = "AQAAAAIAAYagAAAAED6a5t1RPIxnU0U+Jv7wZVV4GLlHAOtc+p0g0I75+Lfym7OOEZijLRgrubjefapC7g==";

        builder.Entity<AppUser>().HasData(
            new
            {
                Id = Guid.Parse("11111111-1111-1111-1111-111111111111"),
                FirstName = "Artan",
                LastName = "Xhiani",
                Email = "artan.xhiani@ieka.al",
                NormalizedEmail = "ARTAN.XHIANI@IEKA.AL",
                UserName = "artan.xhiani@ieka.al",
                NormalizedUserName = "ARTAN.XHIANI@IEKA.AL",
                PhoneNumber = (string?)null,
                MemberRegistryNumber = "admin001",
                Role = "Admin",
                CpdHoursRequired = 0,
                CpdHoursCompleted = 0,
                IsActive = true,
                NotifyByEmail = true,
                NotifyBySms = false,
                NotifyBookingOpen = true,
                NotifySessionReminder = true,
                NotifySurveyReminder = true,
                NotifyCpdDeadline = true,
                IsPendingConfirmation = false,
                EmailConfirmed = true,
                PasswordHash = sharedHash,
                SecurityStamp = "40f80465-f307-489e-91c1-5f770887ce37",
                ConcurrencyStamp = "4d9988dc-5fb0-4a7d-bba8-22358f345c14",
                PhoneNumberConfirmed = false,
                TwoFactorEnabled = false,
                LockoutEnd = (DateTimeOffset?)null,
                LockoutEnabled = false,
                AccessFailedCount = 0
            },
            new
            {
                Id = Guid.Parse("f4a7e2c1-9b3d-4e8f-a6d5-7c2b1e0f3a9d"),
                FirstName = "Juxhin",
                LastName = "Codalhub",
                Email = "juxhin@codalhub.com",
                NormalizedEmail = "JUXHIN@CODALHUB.COM",
                UserName = "juxhin@codalhub.com",
                NormalizedUserName = "JUXHIN@CODALHUB.COM",
                PhoneNumber = (string?)null,
                MemberRegistryNumber = "admin002",
                Role = "Admin",
                CpdHoursRequired = 0,
                CpdHoursCompleted = 0,
                IsActive = true,
                NotifyByEmail = true,
                NotifyBySms = false,
                NotifyBookingOpen = true,
                NotifySessionReminder = true,
                NotifySurveyReminder = true,
                NotifyCpdDeadline = true,
                IsPendingConfirmation = false,
                EmailConfirmed = true,
                PasswordHash = sharedHash,
                SecurityStamp = "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
                ConcurrencyStamp = "b2c3d4e5-f6a7-8901-bcde-f12345678901",
                PhoneNumberConfirmed = false,
                TwoFactorEnabled = false,
                LockoutEnd = (DateTimeOffset?)null,
                LockoutEnabled = false,
                AccessFailedCount = 0
            }
        );
    }
}
