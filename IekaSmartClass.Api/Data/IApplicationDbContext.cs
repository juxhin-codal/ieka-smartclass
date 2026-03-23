using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using IekaSmartClass.Api.Data.Entities;

namespace IekaSmartClass.Api.Data;

public interface IApplicationDbContext
{
    DbSet<AppUser> Users { get; }
    DbSet<EventItem> Events { get; }
    DbSet<EventDate> EventDates { get; }
    DbSet<Participant> Participants { get; }
    DbSet<StudentTrainingSession> StudentTrainingSessions { get; }
    DbSet<StudentTrainingStazh> StudentTrainingStazhet { get; }
    DbSet<Stazh> Stazhet { get; }
    DbSet<StazhDocument> StazhDocuments { get; }
    DbSet<EventDocument> EventDocuments { get; }
    DbSet<EventFeedback> EventFeedbacks { get; }
    DbSet<UserNotification> UserNotifications { get; }
    DbSet<SystemConfiguration> SystemConfigurations { get; }
    DatabaseFacade Database { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
