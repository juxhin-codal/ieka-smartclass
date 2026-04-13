using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using IekaSmartClass.Api.Data.Entities;

namespace IekaSmartClass.Api.Data;

public interface IApplicationDbContext
{
    DbSet<AppUser> Users { get; }
    DbSet<EventItem> Events { get; }
    DbSet<EventDate> EventDates { get; }
    DbSet<Participant> Participants { get; }
    DbSet<StudentTrainingSession> StudentTrainingSessions { get; }
    DbSet<StudentTrainingStazh> StudentTrainingStazhet { get; }
    DbSet<Stazh> Stazhet { get; }
    DbSet<StazhDocument> StazhDocuments { get; }
    DbSet<EventDocument> EventDocuments { get; }
    DbSet<EventFeedback> EventFeedbacks { get; }
    DbSet<UserNotification> UserNotifications { get; }
    DbSet<StudentModule> StudentModules { get; }
    DbSet<StudentModuleTopic> StudentModuleTopics { get; }
    DbSet<StudentModuleDocument> StudentModuleDocuments { get; }
    DbSet<StudentModuleAssignment> StudentModuleAssignments { get; }
    DbSet<StudentModuleTopicAttendance> StudentModuleTopicAttendances { get; }
    DbSet<StudentModuleTopicFeedback> StudentModuleTopicFeedbacks { get; }
    DbSet<TopicQuestionnaire> TopicQuestionnaires { get; }
    DbSet<TopicQuestionnaireQuestion> TopicQuestionnaireQuestions { get; }
    DbSet<TopicQuestionnaireResponse> TopicQuestionnaireResponses { get; }
    DbSet<TopicQuestionnaireAnswer> TopicQuestionnaireAnswers { get; }
    DbSet<SystemConfiguration> SystemConfigurations { get; }
    DbSet<EvaluationQuestionnaire> EvaluationQuestionnaires { get; }
    DbSet<EvaluationQuestion> EvaluationQuestions { get; }
    DbSet<EvaluationResponse> EvaluationResponses { get; }
    DbSet<EvaluationAnswer> EvaluationAnswers { get; }
    DbSet<EvaluationSendLog> EvaluationSendLogs { get; }
    DbSet<EventDateDocument> EventDateDocuments { get; }
    DbSet<EventQuestionnaire> EventQuestionnaires { get; }
    DbSet<EventQuestionnaireQuestion> EventQuestionnaireQuestions { get; }
    DbSet<EventQuestionnaireResponse> EventQuestionnaireResponses { get; }
    DbSet<EventQuestionnaireAnswer> EventQuestionnaireAnswers { get; }
    DbSet<ModuleFeedbackTemplate> ModuleFeedbackTemplates { get; }
    DbSet<ModuleFeedbackSection> ModuleFeedbackSections { get; }
    DbSet<ModuleFeedbackQuestion> ModuleFeedbackQuestions { get; }
    DbSet<ModuleFeedbackResponse> ModuleFeedbackResponses { get; }
    DbSet<ModuleFeedbackAnswer> ModuleFeedbackAnswers { get; }
    DbSet<ModuleFeedbackSendLog> ModuleFeedbackSendLogs { get; }
    DbSet<ModuleFeedbackStudentEmailLog> ModuleFeedbackStudentEmailLogs { get; }
    DatabaseFacade Database { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
