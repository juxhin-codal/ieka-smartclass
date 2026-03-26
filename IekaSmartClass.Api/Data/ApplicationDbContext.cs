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
    public DbSet<StudentModuleDocument> StudentModuleDocuments => Set<StudentModuleDocument>();
    public DbSet<StudentModuleAssignment> StudentModuleAssignments => Set<StudentModuleAssignment>();

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
            entity.Property(x => x.Topic).HasMaxLength(500);
            entity.Property(x => x.Lecturer).HasMaxLength(200);
            entity.HasIndex(x => x.YearGrade);
            entity.HasIndex(x => x.CreatedAt);

            entity.HasOne(x => x.CreatedByUser)
                .WithMany()
                .HasForeignKey(x => x.CreatedByUserId)
                .OnDelete(DeleteBehavior.NoAction);
        });

        builder.Entity<StudentModuleDocument>(entity =>
        {
            entity.Property(x => x.FileName).HasMaxLength(300);
            entity.Property(x => x.FileUrl).HasMaxLength(1000);
            entity.Property(x => x.RelativePath).HasMaxLength(1000);
            entity.HasIndex(x => x.StudentModuleId);

            entity.HasOne(x => x.StudentModule)
                .WithMany(m => m.Documents)
                .HasForeignKey(x => x.StudentModuleId)
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
                FirstName = "Admin",
                LastName = "System",
                Email = "admin@ieka.al",
                NormalizedEmail = "ADMIN@IEKA.AL",
                UserName = "admin@ieka.al",
                NormalizedUserName = "ADMIN@IEKA.AL",
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
                Id = Guid.Parse("22222222-2222-2222-2222-222222222222"),
                FirstName = "Blerina",
                LastName = "Gashi",
                Email = "blerina.gashi@ieka.al",
                NormalizedEmail = "BLERINA.GASHI@IEKA.AL",
                UserName = "blerina.gashi@ieka.al",
                NormalizedUserName = "BLERINA.GASHI@IEKA.AL",
                PhoneNumber = (string?)"+355691234567",
                MemberRegistryNumber = "LEKT01",
                Role = "Lecturer",
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
                SecurityStamp = "dc22936a-9e96-4706-b657-6ca2545480ef",
                ConcurrencyStamp = "7d12a8c6-1605-4d2d-86bc-4e082b5d9917",
                PhoneNumberConfirmed = false,
                TwoFactorEnabled = false,
                LockoutEnd = (DateTimeOffset?)null,
                LockoutEnabled = false,
                AccessFailedCount = 0
            },
            new
            {
                Id = Guid.Parse("33333333-3333-3333-3333-333333333333"),
                FirstName = "Artan",
                LastName = "Hoxha",
                Email = "artan.hoxha@ieka.al",
                NormalizedEmail = "ARTAN.HOXHA@IEKA.AL",
                UserName = "artan.hoxha@ieka.al",
                NormalizedUserName = "ARTAN.HOXHA@IEKA.AL",
                PhoneNumber = (string?)"+355692345678",
                MemberRegistryNumber = "IEKA-2045",
                Role = "Member",
                CpdHoursRequired = 20,
                CpdHoursCompleted = 4,
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
                SecurityStamp = "d8b377ab-b0e1-4dd1-95a5-05ac76ede2f0",
                ConcurrencyStamp = "eae76cc9-f949-4028-9dc6-4164ac4d35bc",
                PhoneNumberConfirmed = false,
                TwoFactorEnabled = false,
                LockoutEnd = (DateTimeOffset?)null,
                LockoutEnabled = false,
                AccessFailedCount = 0
            },
            new
            {
                Id = Guid.Parse("44444444-4444-4444-4444-444444444444"),
                FirstName = "Dritan",
                LastName = "Shehi",
                Email = "dritan.shehi@ieka.al",
                NormalizedEmail = "DRITAN.SHEHI@IEKA.AL",
                UserName = "dritan.shehi@ieka.al",
                NormalizedUserName = "DRITAN.SHEHI@IEKA.AL",
                PhoneNumber = (string?)"+355693456789",
                MemberRegistryNumber = "MENT01",
                Role = "Mentor",
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
                SecurityStamp = "602efbc1-b231-445b-9394-a1944652f4b9",
                ConcurrencyStamp = "50c578ef-d1ad-4e21-b00c-211fd4a48c20",
                PhoneNumberConfirmed = false,
                TwoFactorEnabled = false,
                LockoutEnd = (DateTimeOffset?)null,
                LockoutEnabled = false,
                AccessFailedCount = 0
            },
            new
            {
                Id = Guid.Parse("55555555-5555-5555-5555-555555555555"),
                FirstName = "Sonila",
                LastName = "Krasniqi",
                Email = "sonila.krasniqi@ieka.al",
                NormalizedEmail = "SONILA.KRASNIQI@IEKA.AL",
                UserName = "sonila.krasniqi@ieka.al",
                NormalizedUserName = "SONILA.KRASNIQI@IEKA.AL",
                PhoneNumber = (string?)"+355694567890",
                MentorId = (Guid?)Guid.Parse("44444444-4444-4444-4444-444444444444"),
                MemberRegistryNumber = "STU001",
                Role = "Student",
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
                SecurityStamp = "d4cfb051-5fe4-471b-b163-c6c18d5bc206",
                ConcurrencyStamp = "8a15781b-f818-4fc3-88f7-e74ec87966d8",
                PhoneNumberConfirmed = false,
                TwoFactorEnabled = false,
                LockoutEnd = (DateTimeOffset?)null,
                LockoutEnabled = false,
                AccessFailedCount = 0
            }
        );
    }
}
