namespace IekaSmartClass.Api.Data.Entities;

public class EventQuestionnaire
{
    public Guid Id { get; private set; }
    public Guid EventItemId { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public DateTime CreatedAt { get; private set; }

    public EventItem EventItem { get; private set; } = null!;
    public ICollection<EventQuestionnaireQuestion> Questions { get; private set; } = new List<EventQuestionnaireQuestion>();
    public ICollection<EventQuestionnaireResponse> Responses { get; private set; } = new List<EventQuestionnaireResponse>();

    private EventQuestionnaire() { }

    public EventQuestionnaire(Guid eventItemId, string title)
    {
        if (string.IsNullOrWhiteSpace(title))
            throw new ArgumentException("Title is required.", nameof(title));

        Id = Guid.NewGuid();
        EventItemId = eventItemId;
        Title = title.Trim();
        CreatedAt = DateTime.UtcNow;
    }

    public void UpdateTitle(string title)
    {
        if (string.IsNullOrWhiteSpace(title))
            throw new ArgumentException("Title is required.", nameof(title));
        Title = title.Trim();
    }
}

public class EventQuestionnaireQuestion
{
    public Guid Id { get; private set; }
    public Guid QuestionnaireId { get; private set; }
    public string Text { get; private set; } = string.Empty;
    public QuestionType Type { get; private set; }
    public int Order { get; private set; }
    public string? OptionsJson { get; private set; }
    public string? CorrectAnswer { get; private set; }

    public EventQuestionnaire Questionnaire { get; private set; } = null!;
    public ICollection<EventQuestionnaireAnswer> Answers { get; private set; } = new List<EventQuestionnaireAnswer>();

    private EventQuestionnaireQuestion() { }

    public EventQuestionnaireQuestion(Guid questionnaireId, string text, QuestionType type, int order, string? optionsJson = null, string? correctAnswer = null)
    {
        if (string.IsNullOrWhiteSpace(text))
            throw new ArgumentException("Question text is required.", nameof(text));

        Id = Guid.NewGuid();
        QuestionnaireId = questionnaireId;
        Apply(text, type, order, optionsJson, correctAnswer);
    }

    public void Update(string text, QuestionType type, int order, string? optionsJson = null, string? correctAnswer = null)
    {
        if (string.IsNullOrWhiteSpace(text))
            throw new ArgumentException("Question text is required.", nameof(text));

        Apply(text, type, order, optionsJson, correctAnswer);
    }

    private void Apply(string text, QuestionType type, int order, string? optionsJson, string? correctAnswer)
    {
        var normalizedText = text.Trim();
        var normalizedCorrectAnswer = string.IsNullOrWhiteSpace(correctAnswer) ? null : correctAnswer.Trim();
        var normalizedOptionsJson = string.IsNullOrWhiteSpace(optionsJson) ? null : optionsJson;

        if (type == QuestionType.Options)
        {
            var options = string.IsNullOrWhiteSpace(normalizedOptionsJson)
                ? null
                : System.Text.Json.JsonSerializer.Deserialize<List<string>>(normalizedOptionsJson);

            if (options is null || options.Count < 2)
                throw new ArgumentException("Questions with options must contain at least two options.", nameof(optionsJson));

            var normalizedOptions = options
                .Select(option => option.Trim())
                .Where(option => !string.IsNullOrWhiteSpace(option))
                .ToList();

            if (normalizedOptions.Count < 2)
                throw new ArgumentException("Questions with options must contain at least two options.", nameof(optionsJson));

            if (normalizedCorrectAnswer is not null && !normalizedOptions.Contains(normalizedCorrectAnswer, StringComparer.Ordinal))
                throw new ArgumentException("Correct answer must match one of the available options.", nameof(correctAnswer));

            normalizedOptionsJson = System.Text.Json.JsonSerializer.Serialize(normalizedOptions);
        }
        else
        {
            normalizedOptionsJson = null;
            normalizedCorrectAnswer = null;
        }

        Text = normalizedText;
        Type = type;
        Order = order;
        OptionsJson = normalizedOptionsJson;
        CorrectAnswer = normalizedCorrectAnswer;
    }
}

public class EventQuestionnaireResponse
{
    public Guid Id { get; private set; }
    public Guid QuestionnaireId { get; private set; }
    public Guid UserId { get; private set; }
    public DateTime SubmittedAt { get; private set; }

    public EventQuestionnaire Questionnaire { get; private set; } = null!;
    public AppUser User { get; private set; } = null!;
    public ICollection<EventQuestionnaireAnswer> Answers { get; private set; } = new List<EventQuestionnaireAnswer>();

    private EventQuestionnaireResponse() { }

    public EventQuestionnaireResponse(Guid questionnaireId, Guid userId)
    {
        Id = Guid.NewGuid();
        QuestionnaireId = questionnaireId;
        UserId = userId;
        SubmittedAt = DateTime.UtcNow;
    }
}

public class EventQuestionnaireAnswer
{
    public Guid Id { get; private set; }
    public Guid ResponseId { get; private set; }
    public Guid QuestionId { get; private set; }
    public string AnswerText { get; private set; } = string.Empty;

    public EventQuestionnaireResponse Response { get; private set; } = null!;
    public EventQuestionnaireQuestion Question { get; private set; } = null!;

    private EventQuestionnaireAnswer() { }

    public EventQuestionnaireAnswer(Guid responseId, Guid questionId, string answerText)
    {
        Id = Guid.NewGuid();
        ResponseId = responseId;
        QuestionId = questionId;
        AnswerText = answerText;
    }
}
