using IekaSmartClass.Api.Services.Interface;

namespace IekaSmartClass.Api.Services;

public class NotificationSchedulerService(
    IServiceScopeFactory scopeFactory,
    ILogger<NotificationSchedulerService> logger) : BackgroundService
{
    private static readonly TimeZoneInfo AppTimeZone = ResolveAppTimeZone();

    // Daily run times in local (Europe/Tirane) time
    private static readonly (int Hour, int Minute)[] RunTimes = [(19, 0)];

    private readonly IServiceScopeFactory _scopeFactory = scopeFactory;
    private readonly ILogger<NotificationSchedulerService> _logger = logger;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var delay = GetDelayUntilNextRun();
            _logger.LogInformation("Next scheduled notification run in {Hours}h {Minutes}m.", (int)delay.TotalHours, delay.Minutes);

            try
            {
                await Task.Delay(delay, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }

            try
            {
                using var scope = _scopeFactory.CreateScope();
                var notificationService = scope.ServiceProvider.GetRequiredService<INotificationService>();
                await notificationService.ProcessScheduledNotificationsAsync(DateTime.UtcNow, stoppingToken);
                _logger.LogInformation("Scheduled notification processing completed.");
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Scheduled notification processing failed.");
            }

            // Wait 1 minute to avoid re-triggering within the same minute
            await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
        }
    }

    private static TimeSpan GetDelayUntilNextRun()
    {
        var utcNow = DateTime.UtcNow;
        var localNow = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utcNow, DateTimeKind.Utc), AppTimeZone);

        var nextRun = RunTimes
            .SelectMany(t => new[]
            {
                new DateTime(localNow.Year, localNow.Month, localNow.Day, t.Hour, t.Minute, 0),
                new DateTime(localNow.Year, localNow.Month, localNow.Day, t.Hour, t.Minute, 0).AddDays(1)
            })
            .Where(t => t > localNow)
            .OrderBy(t => t)
            .First();

        var nextRunUtc = TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(nextRun, DateTimeKind.Unspecified), AppTimeZone);
        var delay = nextRunUtc - utcNow;

        return delay > TimeSpan.Zero ? delay : TimeSpan.FromMinutes(1);
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
}
