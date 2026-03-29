namespace IekaSmartClass.Api.Data.Entities;

public class StudentModule
{
    public Guid Id { get; private set; }
    public int YearGrade { get; private set; } // 1, 2, or 3
    public string Title { get; private set; } = string.Empty;
    public string? Location { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public Guid CreatedByUserId { get; private set; }

    public AppUser CreatedByUser { get; private set; } = null!;
    public ICollection<StudentModuleTopic> Topics { get; private set; } = new List<StudentModuleTopic>();
    public ICollection<StudentModuleAssignment> Assignments { get; private set; } = new List<StudentModuleAssignment>();

    private StudentModule() { }

    public StudentModule(int yearGrade, string title, Guid createdByUserId, string? location = null)
    {
        if (yearGrade < 1 || yearGrade > 3)
            throw new ArgumentException("Year grade must be 1, 2, or 3.", nameof(yearGrade));
        if (string.IsNullOrWhiteSpace(title))
            throw new ArgumentException("Title is required.", nameof(title));

        Id = Guid.NewGuid();
        YearGrade = yearGrade;
        Title = title.Trim();
        Location = string.IsNullOrWhiteSpace(location) ? null : location.Trim();
        CreatedByUserId = createdByUserId;
        CreatedAt = DateTime.UtcNow;
    }
}

public class StudentModuleTopic
{
    public Guid Id { get; private set; }
    public Guid StudentModuleId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string Lecturer { get; private set; } = string.Empty;
    public DateTime? ScheduledDate { get; private set; }
    public string? Location { get; private set; }
    public DateTime CreatedAt { get; private set; }

    public StudentModule StudentModule { get; private set; } = null!;
    public ICollection<StudentModuleDocument> Documents { get; private set; } = new List<StudentModuleDocument>();
    public ICollection<StudentModuleTopicAttendance> Attendances { get; private set; } = new List<StudentModuleTopicAttendance>();
    public ICollection<TopicQuestionnaire> Questionnaires { get; private set; } = new List<TopicQuestionnaire>();

    private StudentModuleTopic() { }

    public StudentModuleTopic(Guid studentModuleId, string name, string lecturer, DateTime? scheduledDate = null, string? location = null)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Name is required.", nameof(name));
        if (string.IsNullOrWhiteSpace(lecturer))
            throw new ArgumentException("Lecturer is required.", nameof(lecturer));

        Id = Guid.NewGuid();
        StudentModuleId = studentModuleId;
        Name = name.Trim();
        Lecturer = lecturer.Trim();
        ScheduledDate = scheduledDate;
        Location = string.IsNullOrWhiteSpace(location) ? null : location.Trim();
        CreatedAt = DateTime.UtcNow;
    }

    public void Update(string name, string lecturer, DateTime? scheduledDate, string? location)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Name is required.", nameof(name));
        if (string.IsNullOrWhiteSpace(lecturer))
            throw new ArgumentException("Lecturer is required.", nameof(lecturer));

        Name = name.Trim();
        Lecturer = lecturer.Trim();
        ScheduledDate = scheduledDate;
        Location = string.IsNullOrWhiteSpace(location) ? null : location.Trim();
    }
}

public class StudentModuleDocument
{
    public Guid Id { get; private set; }
    public Guid StudentModuleTopicId { get; private set; }
    public string FileName { get; private set; } = string.Empty;
    public string FileUrl { get; private set; } = string.Empty;
    public string RelativePath { get; private set; } = string.Empty;
    public long SizeBytes { get; private set; }
    public DateTime UploadedAt { get; private set; }

    public StudentModuleTopic StudentModuleTopic { get; private set; } = null!;

    private StudentModuleDocument() { }

    public StudentModuleDocument(Guid studentModuleTopicId, string fileName, string fileUrl, string relativePath, long sizeBytes)
    {
        Id = Guid.NewGuid();
        StudentModuleTopicId = studentModuleTopicId;
        FileName = fileName;
        FileUrl = fileUrl;
        RelativePath = relativePath;
        SizeBytes = sizeBytes;
        UploadedAt = DateTime.UtcNow;
    }
}

public class StudentModuleTopicAttendance
{
    public Guid Id { get; private set; }
    public Guid TopicId { get; private set; }
    public Guid StudentId { get; private set; }
    public DateTime AttendedAt { get; private set; }

    public StudentModuleTopic Topic { get; private set; } = null!;
    public AppUser Student { get; private set; } = null!;

    private StudentModuleTopicAttendance() { }

    public StudentModuleTopicAttendance(Guid topicId, Guid studentId)
    {
        Id = Guid.NewGuid();
        TopicId = topicId;
        StudentId = studentId;
        AttendedAt = DateTime.UtcNow;
    }
}

public class StudentModuleAssignment
{
    public Guid Id { get; private set; }
    public Guid StudentModuleId { get; private set; }
    public Guid StudentId { get; private set; }
    public DateTime AssignedAt { get; private set; }
    public string? Result { get; private set; }      // e.g. "Kaluar", "Ngelur", or a grade
    public string? ResultNote { get; private set; }
    public DateTime? ResultSetAt { get; private set; }

    public StudentModule StudentModule { get; private set; } = null!;
    public AppUser Student { get; private set; } = null!;

    private StudentModuleAssignment() { }

    public StudentModuleAssignment(Guid studentModuleId, Guid studentId)
    {
        Id = Guid.NewGuid();
        StudentModuleId = studentModuleId;
        StudentId = studentId;
        AssignedAt = DateTime.UtcNow;
    }

    public void SetResult(string result, string? note)
    {
        if (string.IsNullOrWhiteSpace(result))
            throw new ArgumentException("Result is required.", nameof(result));
        Result = result.Trim();
        ResultNote = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
        ResultSetAt = DateTime.UtcNow;
    }
}

// ── Questionnaire entities ──────────────────────────────────────────────

public class TopicQuestionnaire
{
    public Guid Id { get; private set; }
    public Guid TopicId { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public DateTime CreatedAt { get; private set; }

    public StudentModuleTopic Topic { get; private set; } = null!;
    public ICollection<TopicQuestionnaireQuestion> Questions { get; private set; } = new List<TopicQuestionnaireQuestion>();
    public ICollection<TopicQuestionnaireResponse> Responses { get; private set; } = new List<TopicQuestionnaireResponse>();

    private TopicQuestionnaire() { }

    public TopicQuestionnaire(Guid topicId, string title)
    {
        if (string.IsNullOrWhiteSpace(title))
            throw new ArgumentException("Title is required.", nameof(title));

        Id = Guid.NewGuid();
        TopicId = topicId;
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

public enum QuestionType
{
    Options = 0,
    FreeText = 1,
    Stars = 2
}

public class TopicQuestionnaireQuestion
{
    public Guid Id { get; private set; }
    public Guid QuestionnaireId { get; private set; }
    public string Text { get; private set; } = string.Empty;
    public QuestionType Type { get; private set; }
    public int Order { get; private set; }
    public string? OptionsJson { get; private set; } // JSON array of option strings for Options type

    public TopicQuestionnaire Questionnaire { get; private set; } = null!;
    public ICollection<TopicQuestionnaireAnswer> Answers { get; private set; } = new List<TopicQuestionnaireAnswer>();

    private TopicQuestionnaireQuestion() { }

    public TopicQuestionnaireQuestion(Guid questionnaireId, string text, QuestionType type, int order, string? optionsJson = null)
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

public class TopicQuestionnaireResponse
{
    public Guid Id { get; private set; }
    public Guid QuestionnaireId { get; private set; }
    public Guid StudentId { get; private set; }
    public DateTime SubmittedAt { get; private set; }

    public TopicQuestionnaire Questionnaire { get; private set; } = null!;
    public AppUser Student { get; private set; } = null!;
    public ICollection<TopicQuestionnaireAnswer> Answers { get; private set; } = new List<TopicQuestionnaireAnswer>();

    private TopicQuestionnaireResponse() { }

    public TopicQuestionnaireResponse(Guid questionnaireId, Guid studentId)
    {
        Id = Guid.NewGuid();
        QuestionnaireId = questionnaireId;
        StudentId = studentId;
        SubmittedAt = DateTime.UtcNow;
    }
}

public class TopicQuestionnaireAnswer
{
    public Guid Id { get; private set; }
    public Guid ResponseId { get; private set; }
    public Guid QuestionId { get; private set; }
    public string AnswerText { get; private set; } = string.Empty; // text, selected option, or star count

    public TopicQuestionnaireResponse Response { get; private set; } = null!;
    public TopicQuestionnaireQuestion Question { get; private set; } = null!;

    private TopicQuestionnaireAnswer() { }

    public TopicQuestionnaireAnswer(Guid responseId, Guid questionId, string answerText)
    {
        Id = Guid.NewGuid();
        ResponseId = responseId;
        QuestionId = questionId;
        AnswerText = answerText;
    }
}
