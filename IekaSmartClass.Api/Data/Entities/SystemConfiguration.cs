namespace IekaSmartClass.Api.Data.Entities;

public class SystemConfiguration
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public string Key { get; private set; }
    public string Value { get; private set; }
    public string? Description { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    public SystemConfiguration(string key, string value, string? description = null)
    {
        Key = key;
        Value = value;
        Description = description;
        UpdatedAt = DateTime.UtcNow;
    }

    public void UpdateValue(string value)
    {
        Value = value;
        UpdatedAt = DateTime.UtcNow;
    }

    private SystemConfiguration() { }
}
