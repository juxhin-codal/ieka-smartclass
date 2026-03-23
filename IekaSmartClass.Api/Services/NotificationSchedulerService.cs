using IekaSmartClass.Api.Services.Interface;

namespace IekaSmartClass.Api.Services;

public class NotificationSchedulerService(
    IServiceScopeFactory scopeFactory,
    ILogger<NotificationSchedulerService> logger) : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory = scopeFactory;
    private readonly ILogger<NotificationSchedulerService> _logger = logger;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var notificationService = scope.ServiceProvider.GetRequiredService<INotificationService>();
                await notificationService.ProcessScheduledNotificationsAsync(DateTime.UtcNow, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Scheduled notification processing failed.");
            }

            await Task.Delay(TimeSpan.FromMinutes(30), stoppingToken);
        }
    }
}
