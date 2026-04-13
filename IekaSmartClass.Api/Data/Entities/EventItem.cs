using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json;

namespace IekaSmartClass.Api.Data.Entities;

public class EventItem
{
    private static readonly JsonSerializerOptions FeedbackJsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public Guid Id { get; private set; } = Guid.NewGuid();
    public string Name { get; private set; }
    public string Place { get; private set; }
    public int SessionCapacity { get; private set; }
    public int TotalSessions { get; private set; }
    public int MaxParticipants { get; private set; }
    public int CurrentParticipants { get; private set; }
    public string Status { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public int CpdHours { get; private set; }
    public string? LecturerName { get; private set; }
    public string? WebinarLink { get; private set; }
    public decimal Price { get; private set; }
    [System.Text.Json.Serialization.JsonIgnore]
    public string? TopicsCsv { get; private set; }
    
    [System.Text.Json.Serialization.JsonIgnore]
    public string? LecturerIdsCsv { get; private set; }

    [System.Text.Json.Serialization.JsonIgnore]
    public string? FeedbackQuestionsJson { get; private set; }

    [NotMapped]
    public List<FeedbackQuestionDefinition> FeedbackQuestions => FeedbackQuestionnaires
        .SelectMany(q => q.Questions)
        .ToList();

    [NotMapped]
    public List<FeedbackQuestionnaireDefinition> FeedbackQuestionnaires => ParseFeedbackQuestionnaires();

    public bool IsNotified { get; private set; }

    // Computed: expose topics as a proper list
    public List<string> Topics => string.IsNullOrEmpty(TopicsCsv)
        ? new List<string>()
        : TopicsCsv.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList();

    public List<string> LecturerIds => string.IsNullOrEmpty(LecturerIdsCsv)
        ? new List<string>()
        : LecturerIdsCsv.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList();

    private readonly List<EventDate> _dates = new();
    public IReadOnlyCollection<EventDate> Dates => _dates.AsReadOnly();

    private readonly List<EventDocument> _documents = new();
    public IReadOnlyCollection<EventDocument> Documents => _documents.AsReadOnly();

    private readonly List<EventFeedback> _feedbacks = new();
    public IReadOnlyCollection<EventFeedback> Feedbacks => _feedbacks.AsReadOnly();

    private readonly List<Participant> _participants = new();
    public IReadOnlyCollection<Participant> Participants => _participants.AsReadOnly();

    private readonly List<EventQuestionnaire> _questionnaires = new();
    public IReadOnlyCollection<EventQuestionnaire> EventQuestionnaires => _questionnaires.AsReadOnly();

    public EventItem(string name, string place, int sessionCapacity, int totalSessions, int cpdHours, decimal price = 0, string? lecturerName = null, string? webinarLink = null, IEnumerable<string>? lecturerIds = null)
    {
        Name = name;
        Place = place;
        SessionCapacity = sessionCapacity;
        TotalSessions = totalSessions;
        MaxParticipants = sessionCapacity * totalSessions;
        CurrentParticipants = 0;
        Status = "upcoming";
        CreatedAt = DateTime.UtcNow;
        CpdHours = cpdHours;
        Price = price;
        LecturerName = lecturerName;
        WebinarLink = webinarLink;
        IsNotified = false;
        if (lecturerIds != null) SetLecturerIds(lecturerIds);
    }

    public void MarkAsNotified()
    {
        IsNotified = true;
    }

    public void AddDate(EventDate date)
    {
        _dates.Add(date);
    }

    public void SetTopics(IEnumerable<string> topics)
    {
        TopicsCsv = string.Join(',', topics.Select(t => t.Trim()).Where(t => !string.IsNullOrEmpty(t)));
    }

    public void SetLecturerIds(IEnumerable<string> ids)
    {
        LecturerIdsCsv = string.Join(',', ids.Select(i => i.Trim()).Where(i => !string.IsNullOrEmpty(i)));
    }

    public void SetFeedbackConfiguration(string? feedbackQuestionsJson)
    {
        FeedbackQuestionsJson = string.IsNullOrWhiteSpace(feedbackQuestionsJson) ? null : feedbackQuestionsJson;
    }

    public void UpdateDetails(string name, string place, int sessionCapacity, int totalSessions, int cpdHours, decimal price, string? lecturerName, string? webinarLink, IEnumerable<string> topics, IEnumerable<string>? lecturerIds, string? feedbackQuestionsJson = null)
    {
        Name = name;
        Place = place;
        SessionCapacity = sessionCapacity;
        TotalSessions = totalSessions;
        MaxParticipants = sessionCapacity * totalSessions;
        CpdHours = cpdHours;
        Price = price;
        LecturerName = lecturerName;
        WebinarLink = webinarLink;
        SetTopics(topics);
        if (lecturerIds != null) SetLecturerIds(lecturerIds);
        if (feedbackQuestionsJson != null) SetFeedbackConfiguration(feedbackQuestionsJson);
    }

    public void IncrementParticipant()
    {
        if (CurrentParticipants >= MaxParticipants)
            throw new InvalidOperationException("Event is fully booked.");
        
        CurrentParticipants++;
    }

    public bool RefreshStatusFromDates()
    {
        var shouldBePast = _dates.Count > 0 && _dates.All(d => d.IsEnded);
        var nextStatus = shouldBePast ? "past" : "upcoming";
        if (string.Equals(Status, nextStatus, StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        Status = nextStatus;
        return true;
    }

    private List<FeedbackQuestionnaireDefinition> ParseFeedbackQuestionnaires()
    {
        if (string.IsNullOrWhiteSpace(FeedbackQuestionsJson))
        {
            return [];
        }

        try
        {
            var payload = JsonSerializer.Deserialize<FeedbackQuestionnairePayloadContainer>(FeedbackQuestionsJson, FeedbackJsonOptions);
            if (payload?.Questionnaires is { Count: > 0 })
            {
                return payload.Questionnaires
                    .Select((questionnaire, index) => NormalizeQuestionnaire(questionnaire, index))
                    .Where(q => q.Questions.Count > 0)
                    .ToList();
            }
        }
        catch
        {
            // Fall back to legacy format below.
        }

        try
        {
            var legacyQuestions = JsonSerializer.Deserialize<List<FeedbackQuestionDefinition>>(FeedbackQuestionsJson, FeedbackJsonOptions)
                ?? [];

            if (legacyQuestions.Count == 0)
            {
                return [];
            }

            return
            [
                new FeedbackQuestionnaireDefinition
                {
                    Id = "legacy-default",
                    Title = "Pyetësori i Feedback-ut",
                    Questions = legacyQuestions
                        .Select((question, index) => NormalizeQuestion(question, index))
                        .ToList()
                }
            ];
        }
        catch
        {
            return [];
        }
    }

    private static FeedbackQuestionnaireDefinition NormalizeQuestionnaire(FeedbackQuestionnaireDefinition questionnaire, int index)
    {
        var normalizedQuestions = questionnaire.Questions
            .Select((question, questionIndex) => NormalizeQuestion(question, questionIndex))
            .Where(question => !string.IsNullOrWhiteSpace(question.Question))
            .ToList();

        return new FeedbackQuestionnaireDefinition
        {
            Id = string.IsNullOrWhiteSpace(questionnaire.Id) ? $"questionnaire-{index + 1}" : questionnaire.Id.Trim(),
            Title = string.IsNullOrWhiteSpace(questionnaire.Title) ? $"Pyetësori {index + 1}" : questionnaire.Title.Trim(),
            Questions = normalizedQuestions
        };
    }

    private static FeedbackQuestionDefinition NormalizeQuestion(FeedbackQuestionDefinition question, int index)
    {
        var normalizedType = (question.Type ?? "text").Trim().ToLowerInvariant();
        if (normalizedType != "text" && normalizedType != "rating" && normalizedType != "multiple-choice")
        {
            normalizedType = "text";
        }

        return new FeedbackQuestionDefinition
        {
            Id = string.IsNullOrWhiteSpace(question.Id) ? $"question-{index + 1}" : question.Id.Trim(),
            Question = question.Question?.Trim() ?? string.Empty,
            Type = normalizedType,
            Options = normalizedType == "multiple-choice"
                ? (question.Options ?? []).Select(option => option.Trim()).Where(option => !string.IsNullOrWhiteSpace(option)).ToList()
                : null
        };
    }

    private EventItem() { }
}

public sealed class FeedbackQuestionnairePayloadContainer
{
    public List<FeedbackQuestionnaireDefinition> Questionnaires { get; init; } = [];
}

public sealed class FeedbackQuestionnaireDefinition
{
    public string Id { get; init; } = string.Empty;
    public string Title { get; init; } = string.Empty;
    public List<FeedbackQuestionDefinition> Questions { get; init; } = [];
}

public sealed class FeedbackQuestionDefinition
{
    public string Id { get; init; } = string.Empty;
    public string Question { get; init; } = string.Empty;
    public string Type { get; init; } = "text";
    public List<string>? Options { get; init; }
}
