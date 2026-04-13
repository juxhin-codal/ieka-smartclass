export interface EventDate {
  id: string
  date: string
  time: string
  maxParticipants: number
  currentParticipants: number
  location?: string
  isEnded?: boolean
  requireLocation?: boolean
  latitude?: number | null
  longitude?: number | null
  documents?: EventDateDocument[]
}

export interface EventDateDocument {
  id: string
  eventDateId: string
  fileName: string
  fileUrl: string
  relativePath?: string
  sizeBytes: number
  uploadedAt: string
  uploadedById: string
}

export interface EventDocument {
  id: string
  eventItemId: string
  fileName: string
  fileUrl: string
  uploadedAt: string
  uploadedById: string
}


export interface FeedbackQuestion {
  id: string
  question: string
  type: "text" | "rating" | "multiple-choice"
  options?: string[]
}

export interface FeedbackQuestionnaire {
  id: string
  title: string
  questions: FeedbackQuestion[]
}

// In-class quiz questions (Section 6)
export interface QuizQuestion {
  id: string
  round: number              // Round grouping e.g. 1, 2, 3
  question: string
  options: string[]          // always 4 choices
  correctIndex: number       // 0-based index of correct answer
  timeLimitSec: number       // countdown timer in seconds
}

export interface QuizAnswer {
  participantRegistryNumber: string
  questionId: string
  chosenIndex: number
  answeredAt: number         // timestamp
}

export interface Participant {
  id: string
  userId: string
  firstName: string
  lastName: string
  email: string
  memberRegistryNumber: string
  dateId: string
  seatNumber: number
  registeredAt: string
  status: "registered" | "waitlisted"
  attendance: "attended" | "absent" | "pending"
  answers?: QuestionAnswer[]
}

export interface QuestionAnswer {
  questionId: string
  answer: string
}

export type UserRole = "Admin" | "Member" | "Lecturer" | "Mentor" | "Student"
export type NotificationType = "booking" | "reminder" | "survey" | "cpd-deadline" | "profile-change"

export interface AppUser {
  id: string
  firstName: string
  lastName: string
  email: string
  email2?: string | null
  memberRegistryNumber: string
  role: UserRole
  phonePrefix?: string
  phoneNumber?: string
  phone?: string
  mentorId?: string | null
  studentTrackingNumber?: number | null
  studentNumber?: string | null
  studentStartYear?: number | null
  studentEndYear?: number | null
  studentYear2StartYear?: number | null
  studentYear3StartYear?: number | null
  company?: string | null
  district?: string | null
  cpdHoursCompleted: number
  cpdHoursRequired: number
  isActive?: boolean
  accountIsActive?: boolean
  isExpired?: boolean
  validUntilMonth?: string | null
  yearlyPaymentPaidYear?: number | null
  emailConfirmed?: boolean
  isPendingConfirmation?: boolean
}

export interface NotificationPreferences {
  notifyByEmail: boolean
  notifyBySms: boolean
  notifyBookingOpen: boolean
  notifySessionReminder: boolean
  notifySurveyReminder: boolean
  notifyCpdDeadline: boolean
}

export interface UserNotification {
  id: string
  type: NotificationType
  title: string
  body: string
  link?: string | null
  isRead: boolean
  createdAtUtc: string
}

export interface StudentTrainingSession {
  id: string
  studentId: string
  studentFirstName: string
  studentLastName: string
  studentEmail: string
  studentMemberRegistryNumber: string
  mentorId: string
  mentorFirstName: string
  mentorLastName: string
  mentorEmail: string
  date: string
  startTime: string
  endTime: string
  attendanceStatus: "pending" | "attended" | "rejected"
  notes?: string | null
  rejectionReason?: string | null
}

export interface StudentTrainingCalendarResponse {
  enabledDates: string[]
  sessions: StudentTrainingSession[]
}

export interface StudentAttendanceDayResponse {
  selectedDate: string
  enabledDates: string[]
  sessions: StudentTrainingSession[]
}

export interface StudentTrainingQrResponse {
  sessionId: string
  qrToken: string
  expiresAt: string
}

export interface MentorAttendanceQrResponse {
  mentorId: string
  date: string
  qrToken: string
  expiresAt: string
}

export interface StudentAttendanceScanResponse {
  message: string
  session: StudentTrainingSession
}

export interface StudentTrainingStazh {
  id: string
  studentId: string
  studentFirstName: string
  studentLastName: string
  studentEmail: string
  studentMemberRegistryNumber: string
  mentorId: string
  mentorFirstName: string
  mentorLastName: string
  mentorEmail: string
  status: "active" | "ended"
  startedAt: string
  endedAt?: string | null
  mentorFeedbackRating?: number | null
  mentorFeedbackComment?: string | null
  mentorFeedbackSubmittedAt?: string | null
  studentFeedbackRating?: number | null
  studentFeedbackComment?: string | null
  studentFeedbackSubmittedAt?: string | null
  studentFeedbackTokenExpiresAt?: string | null
  studentFeedbackToken?: string | null
}

export interface EventQuestionnaireInfo {
  id: string
  title: string
  questionCount: number
  responseCount: number
}

export interface EventItem {
  id: string
  name: string
  place: string
  topics: string[]
  sessionCapacity: number      // capacity per session e.g. 45
  totalSessions: number        // total repeated sessions e.g. 5
  maxParticipants: number      // sessionCapacity × totalSessions
  currentParticipants: number
  dates: EventDate[]
  feedbackQuestions: FeedbackQuestion[]
  feedbackQuestionnaires?: FeedbackQuestionnaire[]
  quizQuestions: QuizQuestion[]  // in-class live quiz (Section 6)
  documents?: EventDocument[]
  participants: Participant[]
  status: "upcoming" | "past"
  createdAt: string
  cpdHours: number
  lecturerName?: string          // for Lecturer Evaluation reports
  lecturerIds?: string[]         // mapped to assigned lecturers
  webinarLink?: string           // For Online webinar integration
  price?: number                 // For payment per module
  isNotified?: boolean
  eventQuestionnaires?: EventQuestionnaireInfo[]
}

// ─── Stazh (Internship) types ──────────────────────────────────────────────
export interface StazhItem {
  id: string
  mentorId: string
  studentId: string
  mentor?: AppUser
  student?: AppUser
  title: string
  startDate: string
  endDate: string
  status: "active" | "completed" | "cancelled"
  feedback?: string
  createdAt: string
  dates: StazhDate[]
  documents: StazhDocument[]
}

export interface StazhDate {
  id: string
  stazhId: string
  date: string
  time: string
  notes?: string
}

export interface StazhDocument {
  id: string
  stazhId: string
  fileName: string
  fileUrl: string
  description?: string
  uploadedAt: string
}

// ─── Student Module types ──────────────────────────────────────────────────
export interface StudentModuleDocument {
  id: string
  fileName: string
  fileUrl: string
  relativePath: string
  sizeBytes: number
  uploadedAt: string
}

export interface StudentModuleTopicResponse {
  id: string
  name: string
  lecturer: string
  scheduledDate?: string | null
  location?: string | null
  requireLocation?: boolean
  latitude?: number | null
  longitude?: number | null
  createdAt: string
  documents: StudentModuleDocument[]
  attendanceCount: number
  questionnaires?: QuestionnaireInfo[]
}

export interface QuestionnaireInfo {
  id: string
  title: string
  questionCount: number
  responseCount: number
}

export interface QuestionnaireDetail {
  id: string
  topicId: string
  title: string
  createdAt: string
  questions: QuestionnaireQuestion[]
  responseCount: number
}

export interface QuestionnaireQuestion {
  id: string
  text: string
  type: "Options" | "FreeText" | "Stars"
  order: number
  options?: string[] | null
  correctAnswer?: string | null
}

export interface QuestionnaireByTokenResponse {
  id: string
  title: string
  alreadyAnswered: boolean
  questions: QuestionnaireQuestion[]
}

export interface QuestionnaireResponseItem {
  responseId: string
  studentId: string
  firstName: string
  lastName: string
  submittedAt: string
  answers: QuestionnaireAnswer[]
}

export interface QuestionnaireAnswer {
  questionId: string
  questionText: string
  questionType: string
  answer: string
  options?: string[] | null
  correctAnswer?: string | null
  isCorrect?: boolean | null
}

export interface SubmitQuestionnaireResponse {
  responseId: string
  submittedAt: string
  answers: QuestionnaireAnswer[]
}

export interface MyQuestionnaireResponseItem {
  responseId: string
  questionnaireId: string
  questionnaireTitle: string
  topicName: string
  moduleName: string
  yearGrade: number
  submittedAt: string
  answers: QuestionnaireAnswer[]
}

export interface TopicAttendanceInfo {
  topicId: string
  topicName: string
  attendedAt: string
}

export interface StudentModuleAssignment {
  studentId: string
  firstName: string
  lastName: string
  email: string
  assignedAt: string
  topicAttendances: TopicAttendanceInfo[]
  result?: string | null
  resultNote?: string | null
  resultSetAt?: string | null
}

export interface StudentModuleResponse {
  id: string
  yearGrade: number
  title: string
  location?: string | null
  createdAt: string
  createdByName?: string | null
  topics: StudentModuleTopicResponse[]
  assignmentCount: number
}

export interface StudentModuleDetailResponse {
  id: string
  yearGrade: number
  title: string
  location?: string | null
  createdAt: string
  createdByName?: string | null
  topics: StudentModuleTopicResponse[]
  assignments: StudentModuleAssignment[]
}

export interface StudentModuleStudentItem {
  studentId: string
  firstName: string
  lastName: string
  email: string
}

export interface StudentModuleQrResponse {
  topicId: string
  token: string
}

export interface StudentMyModuleResponse {
  id: string
  yearGrade: number
  title: string
  location?: string | null
  createdAt: string
  topics: StudentMyTopicResponse[]
  assignedAt?: string | null
  result?: string | null
  resultNote?: string | null
  resultSetAt?: string | null
}

export interface StudentMyTopicResponse {
  id: string
  name: string
  lecturer: string
  scheduledDate?: string | null
  location?: string | null
  documentCount: number
  attended: boolean
  attendedAt?: string | null
  documents?: StudentModuleDocument[] | null
}

export interface ScanModuleAttendanceResponse {
  topicId: string
  studentId: string
  attendedAt: string
}

// ─── Albanian-style name pools ─────────────────────────────────────────────
const firstNames = ["Artan", "Sonila", "Blerina", "Gentian", "Mirela", "Alban", "Erjona", "Dritan", "Klaudia", "Shpend", "Anila", "Besnik", "Dorina", "Fatos", "Gerta", "Ilir", "Jonida", "Klejdi", "Lindita", "Majlinda"]
const lastNames = ["Hoxha", "Gashi", "Krasniqi", "Berisha", "Shehi", "Deda", "Qosja", "Malaj", "Prendi", "Tafa", "Leka", "Muka", "Nushi", "Osmani", "Prifti", "Rama", "Sefa", "Topi", "Veli", "Zeqiri"]

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function generateParticipants(
  eventId: string,
  dates: EventDate[],
  count: number
): Participant[] {
  const participants: Participant[] = []
  let remaining = count
  for (const d of dates) {
    const forDate = Math.min(d.currentParticipants, remaining)
    for (let i = 0; i < forDate; i++) {
      const fn = rand(firstNames)
      const ln = rand(lastNames)
      const regNum = `IEKA-${String(2000 + Math.floor(Math.random() * 270)).padStart(4, "0")}`
      participants.push({
        id: `p-${eventId}-${d.id}-${i}`,
        userId: `u-${eventId}-${d.id}-${i}`,
        firstName: fn,
        lastName: ln,
        email: `${fn.toLowerCase()}.${ln.toLowerCase()}${i}@ieka.al`,
        memberRegistryNumber: regNum,
        dateId: d.id,
        seatNumber: i + 1,
        registeredAt: "2026-01-15",
        status: "registered",
        attendance: Math.random() > 0.12 ? "attended" : "absent",
      })
    }
    remaining -= forDate
    if (remaining <= 0) break
  }
  return participants
}

function generateAnswers(questions: FeedbackQuestion[]): QuestionAnswer[] {
  return questions.map((q) => {
    let answer = ""
    if (q.type === "rating") {
      answer = String(Math.floor(Math.random() * 2) + 4) // 4 or 5 — mostly positive
    } else if (q.type === "multiple-choice" && q.options && q.options.length > 0) {
      answer = q.options[Math.floor(Math.random() * q.options.length)]
    } else {
      const texts = [
        "Trajnimi ishte shumë informues dhe i organizuar mirë.",
        "Lektori shpjegoi konceptet me qartësi të lartë.",
        "Materialet ishin aktuale dhe praktike.",
        "Do ta rekomandoja tek kolegët e mi.",
        "Shumë i dobishëm për qëllime të CPD-së.",
      ]
      answer = texts[Math.floor(Math.random() * texts.length)]
    }
    return { questionId: q.id, answer }
  })
}

// Standard post-training survey used across modules
const STANDARD_SURVEY: FeedbackQuestion[] = [
  { id: "sq1", question: "Cilësia e përmbajtjes (1–5)", type: "rating" },
  { id: "sq2", question: "Qartësia e ligjëratës (1–5)", type: "rating" },
  { id: "sq3", question: "Relevanca praktike e modulit", type: "multiple-choice", options: ["Shumë e lartë", "E lartë", "Mesatare", "E ulët"] },
  { id: "sq4", question: "A do ta rekomandoni këtë modul?", type: "multiple-choice", options: ["Po, definitivisht", "Ndoshta", "Jo"] },
  { id: "sq5", question: "Komente dhe sugjerime", type: "text" },
]

// ─── Raw CPD Modules (each has 5 session-dates of 45 seats) ───────────────
const SESSION_CAPACITY = 45
const TOTAL_SESSIONS = 5

const QUIZ_IFRS: QuizQuestion[] = [
  { id: "q1", round: 1, question: "IFRS 9 klasifikon instrumentet financiarë në sa kategori?", options: ["2", "3", "4", "5"], correctIndex: 1, timeLimitSec: 30 },
  { id: "q2", round: 1, question: "Sipas IFRS 16, cila detyrim regjistrohet me fillimin e qirasë?", options: ["Aktivi i drejtës", "Detyrimi i qirasë", "Të dyja", "Asnjë"], correctIndex: 2, timeLimitSec: 30 },
  { id: "q3", round: 2, question: "IFRS 17 zëvendëson standardin:", options: ["IFRS 4", "IFRS 9", "IAS 39", "IAS 18"], correctIndex: 0, timeLimitSec: 25 },
]
const QUIZ_TAX: QuizQuestion[] = [
  { id: "qt1", round: 1, question: "Norma standarde e TVSH-së në Shqipëri është:", options: ["15%", "18%", "20%", "10%"], correctIndex: 2, timeLimitSec: 20 },
  { id: "qt2", round: 2, question: "Çfarë qëndron pas shkurtimit BEPS?", options: ["Base Erosion and Profit Shifting", "Budget Expense Planning System", "Business Enterprise Profit Sharing", "Asnjë nga këto"], correctIndex: 0, timeLimitSec: 30 },
  { id: "qt3", round: 3, question: "Transfer çmimi rregullohet nga parimi:", options: ["Pavarësia", "Arm's Length", "Reciprociteti", "Integriteti"], correctIndex: 1, timeLimitSec: 30 },
]
const QUIZ_AUDIT: QuizQuestion[] = [
  { id: "qa1", round: 1, question: "Standardet IIA qëndrojnë për:", options: ["Institute of Internal Auditors", "International Internal Accounting", "Internal Inspection Authority", "Asnjë"], correctIndex: 0, timeLimitSec: 25 },
  { id: "qa2", round: 2, question: "'Rreziku i mbetur' pas kontrolleve quhet:", options: ["Rreziku inherent", "Rreziku rezidual", "Rreziku i kontrollit", "Rreziku operacional"], correctIndex: 1, timeLimitSec: 30 },
  { id: "qa3", round: 3, question: "Auditimi i brendshëm raportoj tek:", options: ["Aksionarët", "Bordi i Drejtorëve / Komiteti i Auditit", "Taksapaguesit", "Ministria"], correctIndex: 1, timeLimitSec: 30 },
]
const QUIZ_ETHICS: QuizQuestion[] = [
  { id: "qe1", round: 1, question: "Parimi i parë i Kodit Etik të IEKA është:", options: ["Pavarësia", "Integriteti", "Kompetenca", "Konfidencialiteti"], correctIndex: 1, timeLimitSec: 25 },
  { id: "qe2", round: 2, question: "Kur ekziston konflikt interesi, eksperti duhet:", options: ["Të vazhdojë punën", "Të refuzojë mandatin", "Të njoftojë klientin dhe të veprojë me transparencë", "Asgjë"], correctIndex: 2, timeLimitSec: 30 },
  { id: "qe3", round: 3, question: "Konfidencialiteti zbatohet edhe pas:", options: ["Mbarimit të mandatit", "Pagesës", "Publikimit", "Asnjëherë"], correctIndex: 0, timeLimitSec: 25 },
]

const rawEvents: Omit<EventItem, "participants">[] = [
  {
    id: "m1",
    name: "Azhurnimet IFRS 2026",
    place: "Salla e Trajnimeve IEKA, Tiranë",
    topics: ["IFRS 9", "IFRS 16", "IFRS 17", "Ndryshimet 2025-2026"],
    sessionCapacity: SESSION_CAPACITY,
    totalSessions: TOTAL_SESSIONS,
    maxParticipants: SESSION_CAPACITY * TOTAL_SESSIONS,
    currentParticipants: 198,
    dates: [
      { id: "m1-s1", date: "2026-03-05", time: "09:00 – 13:00", maxParticipants: 45, currentParticipants: 45 },
      { id: "m1-s2", date: "2026-03-12", time: "09:00 – 13:00", maxParticipants: 45, currentParticipants: 45 },
      { id: "m1-s3", date: "2026-03-19", time: "09:00 – 13:00", maxParticipants: 45, currentParticipants: 41 },
      { id: "m1-s4", date: "2026-03-26", time: "09:00 – 13:00", maxParticipants: 45, currentParticipants: 37 },
      { id: "m1-s5", date: "2026-04-02", time: "09:00 – 13:00", maxParticipants: 45, currentParticipants: 30 },
    ],
    feedbackQuestions: STANDARD_SURVEY,
    quizQuestions: QUIZ_IFRS,
    status: "upcoming",
    createdAt: "2026-01-10",
    cpdHours: 4,
    lecturerName: "Prof. Gerta Osmani",
  },
  {
    id: "m2",
    name: "Tatimi mbi të Ardhurat dhe Praktikat e Reja",
    place: "Salla e Trajnimeve IEKA, Tiranë",
    topics: ["Tatimi mbi fitimin", "Transferimi i çmimit", "BEPS", "Rregullore 2026"],
    sessionCapacity: SESSION_CAPACITY,
    totalSessions: TOTAL_SESSIONS,
    maxParticipants: SESSION_CAPACITY * TOTAL_SESSIONS,
    currentParticipants: 157,
    dates: [
      { id: "m2-s1", date: "2026-04-07", time: "14:00 – 18:00", maxParticipants: 45, currentParticipants: 45 },
      { id: "m2-s2", date: "2026-04-14", time: "14:00 – 18:00", maxParticipants: 45, currentParticipants: 45 },
      { id: "m2-s3", date: "2026-04-21", time: "14:00 – 18:00", maxParticipants: 45, currentParticipants: 38 },
      { id: "m2-s4", date: "2026-04-28", time: "14:00 – 18:00", maxParticipants: 45, currentParticipants: 29 },
      { id: "m2-s5", date: "2026-05-05", time: "14:00 – 18:00", maxParticipants: 45, currentParticipants: 0 },
    ],
    feedbackQuestions: STANDARD_SURVEY,
    quizQuestions: QUIZ_TAX,
    status: "upcoming",
    createdAt: "2026-01-18",
    cpdHours: 4,
    lecturerName: "Prof. Artan Hoxha",
  },
  {
    id: "m3",
    name: "Auditimi i Brendshëm – Standarde dhe Praktikat",
    place: "Salla e Trajnimeve IEKA, Tiranë",
    topics: ["IIA Standards", "Rreziku i Auditimit", "Kontrollet e Brendshme", "Raportimi"],
    sessionCapacity: SESSION_CAPACITY,
    totalSessions: TOTAL_SESSIONS,
    maxParticipants: SESSION_CAPACITY * TOTAL_SESSIONS,
    currentParticipants: 89,
    dates: [
      { id: "m3-s1", date: "2026-05-11", time: "09:00 – 13:00", maxParticipants: 45, currentParticipants: 45 },
      { id: "m3-s2", date: "2026-05-18", time: "09:00 – 13:00", maxParticipants: 45, currentParticipants: 44 },
      { id: "m3-s3", date: "2026-05-25", time: "09:00 – 13:00", maxParticipants: 45, currentParticipants: 0 },
      { id: "m3-s4", date: "2026-06-01", time: "09:00 – 13:00", maxParticipants: 45, currentParticipants: 0 },
      { id: "m3-s5", date: "2026-06-08", time: "09:00 – 13:00", maxParticipants: 45, currentParticipants: 0 },
    ],
    feedbackQuestions: STANDARD_SURVEY,
    quizQuestions: QUIZ_AUDIT,
    status: "upcoming",
    createdAt: "2026-02-01",
    cpdHours: 4,
    lecturerName: "Prof. Blerina Krasniqi",
  },
  {
    id: "m4",
    name: "Etika Profesionale dhe Kodi i Sjelljes IEKA",
    place: "Salla e Trajnimeve IEKA, Tiranë",
    topics: ["Kodi Etik", "Pavarësia", "Konfidencialiteti", "Interesat e konfliktit"],
    sessionCapacity: SESSION_CAPACITY,
    totalSessions: TOTAL_SESSIONS,
    maxParticipants: SESSION_CAPACITY * TOTAL_SESSIONS,
    currentParticipants: 225,
    dates: [
      { id: "m4-s1", date: "2025-10-06", time: "09:00 – 13:00", maxParticipants: 45, currentParticipants: 45 },
      { id: "m4-s2", date: "2025-10-13", time: "09:00 – 13:00", maxParticipants: 45, currentParticipants: 45 },
      { id: "m4-s3", date: "2025-10-20", time: "09:00 – 13:00", maxParticipants: 45, currentParticipants: 45 },
      { id: "m4-s4", date: "2025-10-27", time: "09:00 – 13:00", maxParticipants: 45, currentParticipants: 45 },
      { id: "m4-s5", date: "2025-11-03", time: "09:00 – 13:00", maxParticipants: 45, currentParticipants: 45 },
    ],
    feedbackQuestions: STANDARD_SURVEY,
    quizQuestions: QUIZ_ETHICS,
    status: "past",
    createdAt: "2025-08-15",
    cpdHours: 4,
    lecturerName: "Prof. Mirela Shehi",
  },
  {
    id: "m5",
    name: "Kontabiliteti i Sektorit Publik (IPSAS)",
    place: "Salla e Trajnimeve IEKA, Tiranë",
    topics: ["IPSAS Bazat", "Aktive Afatgjata", "Borxhi Publik", "Raportimi Financiar"],
    sessionCapacity: SESSION_CAPACITY,
    totalSessions: TOTAL_SESSIONS,
    maxParticipants: SESSION_CAPACITY * TOTAL_SESSIONS,
    currentParticipants: 185,
    dates: [
      { id: "m5-s1", date: "2025-11-10", time: "14:00 – 18:00", maxParticipants: 45, currentParticipants: 45 },
      { id: "m5-s2", date: "2025-11-17", time: "14:00 – 18:00", maxParticipants: 45, currentParticipants: 45 },
      { id: "m5-s3", date: "2025-11-24", time: "14:00 – 18:00", maxParticipants: 45, currentParticipants: 43 },
      { id: "m5-s4", date: "2025-12-01", time: "14:00 – 18:00", maxParticipants: 45, currentParticipants: 36 },
      { id: "m5-s5", date: "2025-12-08", time: "14:00 – 18:00", maxParticipants: 45, currentParticipants: 16 },
    ],
    feedbackQuestions: STANDARD_SURVEY,
    quizQuestions: QUIZ_ETHICS,
    status: "past",
    createdAt: "2025-09-01",
    cpdHours: 4,
    lecturerName: "Prof. Dritan Deda",
  },
]

// Evaluation Questionnaire types
export interface EvaluationQuestion {
  id: string
  text: string
  type: number // 0=Options, 1=FreeText, 2=Stars
  order: number
  options?: string[] | null
}

export interface EvaluationSendLog {
  id: string
  sentToMembers: boolean
  sentToStudents: boolean
  recipientCount: number
  sentAt: string
}

export interface EvaluationListItem {
  id: string
  title: string
  description?: string | null
  targetMembers: boolean
  targetStudents: boolean
  createdAt: string
  updatedAt: string
  questionCount: number
  responseCount: number
  sendLogs: EvaluationSendLog[]
}

export interface EvaluationDetail {
  id: string
  title: string
  description?: string | null
  emailSubject: string
  emailBody: string
  targetMembers: boolean
  targetStudents: boolean
  createdAt: string
  updatedAt: string
  questions: EvaluationQuestion[]
  responses?: { id: string; userId: string; submittedAt: string }[]
  sendLogs?: EvaluationSendLog[]
}

export interface EvaluationFillResponse {
  id: string
  title: string
  description?: string | null
  alreadyAnswered: boolean
  questions: EvaluationQuestion[]
}

export interface EvaluationResponseAnswer {
  id: string
  questionId: string
  questionText?: string
  questionType?: number
  answerText: string
}

export interface EvaluationResponseItem {
  id: string
  questionnaireId: string
  userId: string
  userName?: string | null
  userEmail?: string | null
  userRole?: string | null
  submittedAt: string
  answers: EvaluationResponseAnswer[]
}

// Module Feedback Template types
export interface ModuleFeedbackQuestion {
  id: string
  text: string
  type: number // 1=FreeText, 2=Stars
  order: number
}

export interface ModuleFeedbackSection {
  id: string
  title: string
  order: number
  repeatsPerTopic: boolean
  ratingLabelLow?: string | null
  ratingLabelHigh?: string | null
  questions: ModuleFeedbackQuestion[]
}

export interface ModuleFeedbackTemplateResponse {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  sections: ModuleFeedbackSection[]
}

export interface ModuleFeedbackTopicInfo {
  id: string
  name: string
  lecturer?: string | null
}

export interface ModuleFeedbackFillResponse {
  template: ModuleFeedbackTemplateResponse
  topics: ModuleFeedbackTopicInfo[]
  alreadyAnswered: boolean
}

export const MOCK_EVENTS: EventItem[] = rawEvents.map((e) => {
  const participants = generateParticipants(e.id, e.dates, e.currentParticipants)
  if (e.status === "past") {
    participants.forEach((p) => {
      if (p.attendance === "attended") {
        p.answers = generateAnswers(e.feedbackQuestions)
      }
    })
  }
  return { ...e, participants }
})

export const MOCK_USERS: AppUser[] = Array.from({ length: 30 }, (_, i) => ({
  id: `usr-${i + 1}`,
  firstName: rand(firstNames),
  lastName: rand(lastNames),
  email: `member${i + 1}@ieka.al`,
  memberRegistryNumber: `IEKA-${String(2001 + i).padStart(4, "0")}`,
  role: i === 0 ? "Admin" : i === 1 ? "Lecturer" : "Member",
  phone: `+355 6${Math.floor(Math.random() * 10)} ${String(Math.floor(Math.random() * 9000000) + 1000000)}`,
  cpdHoursCompleted: Math.floor(Math.random() * 20),
  cpdHoursRequired: 20,
}))

export const MONTHLY_CPD_DATA = [
  { month: "Jan", modules: 0, participants: 0 },
  { month: "Feb", modules: 0, participants: 0 },
  { month: "Mar", modules: 1, participants: 198 },
  { month: "Apr", modules: 1, participants: 157 },
  { month: "Mai", modules: 1, participants: 89 },
  { month: "Qer", modules: 0, participants: 0 },
  { month: "Kor", modules: 0, participants: 0 },
  { month: "Gus", modules: 0, participants: 0 },
  { month: "Sht", modules: 0, participants: 0 },
  { month: "Tet", modules: 1, participants: 225 },
  { month: "Nën", modules: 1, participants: 185 },
  { month: "Dhj", modules: 0, participants: 16 },
]
