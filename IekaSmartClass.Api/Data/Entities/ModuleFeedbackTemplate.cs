namespace IekaSmartClass.Api.Data.Entities;

public class ModuleFeedbackTemplate
{
    public Guid Id { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    public ICollection<ModuleFeedbackSection> Sections { get; private set; } = new List<ModuleFeedbackSection>();

    private ModuleFeedbackTemplate() { }

    public ModuleFeedbackTemplate(string title)
    {
        if (string.IsNullOrWhiteSpace(title))
            throw new ArgumentException("Title is required.", nameof(title));

        Id = Guid.NewGuid();
        Title = title.Trim();
        CreatedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Update(string title)
    {
        if (string.IsNullOrWhiteSpace(title))
            throw new ArgumentException("Title is required.", nameof(title));
        Title = title.Trim();
        UpdatedAt = DateTime.UtcNow;
    }
}

public class ModuleFeedbackSection
{
    public Guid Id { get; private set; }
    public Guid TemplateId { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public int Order { get; private set; }
    public bool RepeatsPerTopic { get; private set; }
    public string? RatingLabelLow { get; private set; }
    public string? RatingLabelHigh { get; private set; }

    public ModuleFeedbackTemplate Template { get; private set; } = null!;
    public ICollection<ModuleFeedbackQuestion> Questions { get; private set; } = new List<ModuleFeedbackQuestion>();

    private ModuleFeedbackSection() { }

    public ModuleFeedbackSection(Guid templateId, string title, int order, bool repeatsPerTopic, string? ratingLabelLow = null, string? ratingLabelHigh = null)
    {
        if (string.IsNullOrWhiteSpace(title))
            throw new ArgumentException("Title is required.", nameof(title));

        Id = Guid.NewGuid();
        TemplateId = templateId;
        Title = title.Trim();
        Order = order;
        RepeatsPerTopic = repeatsPerTopic;
        RatingLabelLow = ratingLabelLow?.Trim();
        RatingLabelHigh = ratingLabelHigh?.Trim();
    }

    public void SetRepeatsPerTopic(bool value)
    {
        RepeatsPerTopic = value;
    }
}

public class ModuleFeedbackQuestion
{
    public Guid Id { get; private set; }
    public Guid SectionId { get; private set; }
    public string Text { get; private set; } = string.Empty;
    public QuestionType Type { get; private set; }
    public int Order { get; private set; }

    public ModuleFeedbackSection Section { get; private set; } = null!;

    private ModuleFeedbackQuestion() { }

    public ModuleFeedbackQuestion(Guid sectionId, string text, QuestionType type, int order)
    {
        if (string.IsNullOrWhiteSpace(text))
            throw new ArgumentException("Question text is required.", nameof(text));

        Id = Guid.NewGuid();
        SectionId = sectionId;
        Text = text.Trim();
        Type = type;
        Order = order;
    }
}

public class ModuleFeedbackResponse
{
    public Guid Id { get; private set; }
    public Guid TemplateId { get; private set; }
    public Guid StudentModuleId { get; private set; }
    public Guid StudentId { get; private set; }
    public DateTime SubmittedAt { get; private set; }
    public string SectionScope { get; private set; } = "all";
    public bool IsAnonymous { get; private set; }

    public ModuleFeedbackTemplate Template { get; private set; } = null!;
    public StudentModule StudentModule { get; private set; } = null!;
    public AppUser Student { get; private set; } = null!;
    public ICollection<ModuleFeedbackAnswer> Answers { get; private set; } = new List<ModuleFeedbackAnswer>();

    private ModuleFeedbackResponse() { }

    public ModuleFeedbackResponse(Guid templateId, Guid studentModuleId, Guid studentId, string sectionScope = "all", bool isAnonymous = false)
    {
        Id = Guid.NewGuid();
        TemplateId = templateId;
        StudentModuleId = studentModuleId;
        StudentId = studentId;
        SubmittedAt = DateTime.UtcNow;
        SectionScope = sectionScope;
        IsAnonymous = isAnonymous;
    }
}

public class ModuleFeedbackAnswer
{
    public Guid Id { get; private set; }
    public Guid ResponseId { get; private set; }
    public Guid QuestionId { get; private set; }
    public Guid? TopicId { get; private set; }
    public string AnswerText { get; private set; } = string.Empty;

    public ModuleFeedbackResponse Response { get; private set; } = null!;
    public ModuleFeedbackQuestion Question { get; private set; } = null!;
    public StudentModuleTopic? Topic { get; private set; }

    private ModuleFeedbackAnswer() { }

    public ModuleFeedbackAnswer(Guid responseId, Guid questionId, Guid? topicId, string answerText)
    {
        Id = Guid.NewGuid();
        ResponseId = responseId;
        QuestionId = questionId;
        TopicId = topicId;
        AnswerText = answerText;
    }
}

public class ModuleFeedbackSendLog
{
    public Guid Id { get; private set; }
    public Guid TemplateId { get; private set; }
    public Guid StudentModuleId { get; private set; }
    public DateTime SentAt { get; private set; }
    public int RecipientCount { get; private set; }

    public ModuleFeedbackTemplate Template { get; private set; } = null!;
    public StudentModule StudentModule { get; private set; } = null!;

    private ModuleFeedbackSendLog() { }

    public ModuleFeedbackSendLog(Guid templateId, Guid studentModuleId, int recipientCount)
    {
        Id = Guid.NewGuid();
        TemplateId = templateId;
        StudentModuleId = studentModuleId;
        SentAt = DateTime.UtcNow;
        RecipientCount = recipientCount;
    }
}

/// <summary>
/// Tracks which students have been sent a manual feedback email for a specific
/// module + section combination. Prevents duplicate emails on repeated sends.
/// </summary>
public class ModuleFeedbackStudentEmailLog
{
    public Guid Id { get; private set; }
    public Guid StudentId { get; private set; }
    public Guid StudentModuleId { get; private set; }
    /// <summary>
    /// Sorted, comma-joined section IDs that were included in this email.
    /// e.g. "3f2a...,7c1b...,a9dd..."
    /// </summary>
    public string SectionKey { get; private set; } = string.Empty;
    public DateTime SentAt { get; private set; }

    public AppUser Student { get; private set; } = null!;
    public StudentModule StudentModule { get; private set; } = null!;

    private ModuleFeedbackStudentEmailLog() { }

    public ModuleFeedbackStudentEmailLog(Guid studentId, Guid studentModuleId, string sectionKey)
    {
        Id = Guid.NewGuid();
        StudentId = studentId;
        StudentModuleId = studentModuleId;
        SectionKey = sectionKey;
        SentAt = DateTime.UtcNow;
    }
}
