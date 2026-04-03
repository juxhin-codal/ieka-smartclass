namespace IekaSmartClass.Api.Utilities.Settings;

public class LocationSettings
{
    public const string SectionName = "Location";

    public string DefaultLocationName { get; set; } = "Zyra IEKA";

    public double DefaultLatitude { get; set; }

    public double DefaultLongitude { get; set; }

    public double MaxDistanceMeters { get; set; } = 200;
}
