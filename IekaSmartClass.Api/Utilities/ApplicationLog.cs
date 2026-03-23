using System.Xml.Linq;
using NLog;

namespace IekaSmartClass.Api.Utilities.Settings;

public static class ApplicationLog
{
    private static readonly Logger Logger = LogManager.GetCurrentClassLogger();

    public static void Info(string message) => Logger.Info(message);
    public static void Error(Exception ex, string message) => Logger.Error(ex, message);
    public static void Warn(string message) => Logger.Warn(message);
    public static void Debug(string message) => Logger.Debug(message);
}
