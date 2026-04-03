namespace IekaSmartClass.Api.Data.Entities;

public class EvaluationQuestionnaire
{
    public Guid Id { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public string EmailSubject { get; private set; } = string.Empty;
    public string EmailBody { get; private set; } = string.Empty;
    public bool TargetMembers { get; private set; }
    public bool TargetStudents { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    public ICollection<EvaluationQuestion> Questions { get; private set; } = new List<EvaluationQuestion>();
    public ICollection<EvaluationResponse> Responses { get; private set; } = new List<EvaluationResponse>();
    public ICollection<EvaluationSendLog> SendLogs { get; private set; } = new List<EvaluationSendLog>();

    private EvaluationQuestionnaire() { }

    public EvaluationQuestionnaire(string title, string? description, string emailSubject, string emailBody, bool targetMembers, bool targetStudents)
    {
        if (string.IsNullOrWhiteSpace(title))
            throw new ArgumentException("Title is required.", nameof(title));
        if (string.IsNullOrWhiteSpace(emailSubject))
            throw new ArgumentException("Email subject is required.", nameof(emailSubject));

        Id = Guid.NewGuid();
        Title = title.Trim();
        Description = description?.Trim();
        EmailSubject = emailSubject.Trim();
        EmailBody = emailBody?.Trim() ?? string.Empty;
        TargetMembers = targetMembers;
        TargetStudents = targetStudents;
        CreatedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Update(string title, string? description, string emailSubject, string emailBody, bool targetMembers, bool targetStudents)
    {
        if (string.IsNullOrWhiteSpace(title))
            throw new ArgumentException("Title is required.", nameof(title));

        Title = title.Trim();
        Description = description?.Trim();
        EmailSubject = emailSubject.Trim();
        EmailBody = emailBody?.Trim() ?? string.Empty;
        TargetMembers = targetMembers;
        TargetStudents = targetStudents;
        UpdatedAt = DateTime.UtcNow;
    }
}

public class EvaluationQuestion
{
    public Guid Id { get; private set; }
    public Guid QuestionnaireId { get; private set; }
    public string Text { get; private set; } = string.Empty;
    public QuestionType Type { get; private set; }
    public int Order { get; private set; }
    public string? OptionsJson { get; private set; }

    public EvaluationQuestionnaire Questionnaire { get; private set; } = null!;
    public ICollection<EvaluationAnswer> Answers { get; private set; } = new List<EvaluationAnswer>();

    private EvaluationQuestion() { }

    public EvaluationQuestion(Guid questionnaireId, string text, QuestionType type, int order, string? optionsJson = null)
    {
        if (string.IsNullOrWhiteSpace(text))
            throw new ArgumentException("Question text is required.", nameof(text));

        Id = Guid.NewGuid();
        QuestionnaireId = questionnaireId;
        Text = text.Trim();
        Type = type;
        Order = order;
        OptionsJson = optionsJson;
    }
}

public class EvaluationResponse
{
    public Guid Id { get; private set; }
    public Guid QuestionnaireId { get; private set; }
    public Guid UserId { get; private set; }
    public DateTime SubmittedAt { get; private set; }

    public EvaluationQuestionnaire Questionnaire { get; private set; } = null!;
    public AppUser User { get; private set; } = null!;
    public ICollection<EvaluationAnswer> Answers { get; private set; } = new List<EvaluationAnswer>();

    private EvaluationResponse() { }

    public EvaluationResponse(Guid questionnaireId, Guid userId)
    {
        Id = Guid.NewGuid();
        QuestionnaireId = questionnaireId;
        UserId = userId;
        SubmittedAt = DateTime.UtcNow;
    }
}

public class EvaluationAnswer
{
    public Guid Id { get; private set; }
    public Guid ResponseId { get; private set; }
    public Guid QuestionId { get; private set; }
    public string AnswerText { get; private set; } = string.Empty;

    public EvaluationResponse Response { get; private set; } = null!;
    public EvaluationQuestion Question { get; private set; } = null!;

    private EvaluationAnswer() { }

    public EvaluationAnswer(Guid responseId, Guid questionId, string answerText)
    {
        Id = Guid.NewGuid();
        ResponseId = responseId;
        QuestionId = questionId;
        AnswerText = answerText;
    }
}

public class EvaluationSendLog
{
    public Guid Id { get; private set; }
    public Guid QuestionnaireId { get; private set; }
    public DateTime SentAt { get; private set; }
    public bool SentToMembers { get; private set; }
    public bool SentToStudents { get; private set; }
    public int RecipientCount { get; private set; }

    public EvaluationQuestionnaire Questionnaire { get; private set; } = null!;

    private EvaluationSendLog() { }

    public EvaluationSendLog(Guid questionnaireId, bool sentToMembers, bool sentToStudents, int recipientCount)
    {
        Id = Guid.NewGuid();
        QuestionnaireId = questionnaireId;
        SentAt = DateTime.UtcNow;
        SentToMembers = sentToMembers;
        SentToStudents = sentToStudents;
        RecipientCount = recipientCount;
    }
}
