"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { format, parseISO } from "date-fns"
import { useAuth } from "@/lib/auth-context"
import { fetchApi, fetchWithAuth } from "@/lib/api-client"
import { useEvents } from "@/lib/events-context"
import { AdminPasswordResetCard } from "@/components/admin/admin-password-reset-card"
import { StudentHistoryModal } from "@/components/students/student-history-modal"
import { formatStudentTrackingCode, generateStudentNumber, parseStudentTrackingNumber } from "@/lib/student-registry"
import { splitPhone } from "@/lib/phone-utils"
import type {
  AppUser,
  MentorAttendanceQrResponse,
  StudentAttendanceDayResponse,
  StudentAttendanceScanResponse,
  StudentModuleDetailResponse,
  StudentModuleQrResponse,
  StudentModuleResponse,
  StudentModuleStudentItem,
  StudentModuleTopicResponse,
  StudentMyModuleResponse,
  StudentMyTopicResponse,
  ScanModuleAttendanceResponse,
  QuestionnaireDetail,
  QuestionnaireResponseItem,
  MyQuestionnaireResponseItem,
  StudentTrainingCalendarResponse,
  StudentTrainingSession,
} from "@/lib/data"
import { Button } from "@/components/ui/button"
import { Calendar as DayCalendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { Scanner } from "@yudiel/react-qr-scanner"
import { QRCodeCanvas } from "qrcode.react"
import {
  Search,
  UserPlus,
  X,
  CheckCircle2,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Pencil,
  GraduationCap,
  BookOpen,
  CalendarDays,
  Clock3,
  ArrowLeft,
  ArrowRight,
  UserCheck,
  QrCode,
  ScanLine,
  StopCircle,
  MessageSquareText,
  Star,
  Trash2,
  Loader2,
  FileText,
  ChevronRight,
  Plus,
  Library,
  MapPin,
  Send,
  Printer,
  Download,
  ClipboardList,
  Eye,
  XCircle,
} from "lucide-react"
import { PaginationBar, usePagination, type PageSize } from "@/components/ui/pagination-bar"

type SortKey = "name" | "attendance" | "mentor"
type SortDir = "asc" | "desc"
type ManagementTab = "modules" | "students" | "attendance"

type ScheduleRow = {
  id: string
  date: string
  startTime: string
  endTime: string
  notes: string
}

type StudentSummaryApi = {
  id: string
  firstName: string
  lastName: string
  email: string
  memberRegistryNumber: string
  studentTrackingNumber?: number | null
  studentNumber?: string | null
  mentorId?: string | null
  isActive?: boolean
  accountIsActive?: boolean
  isExpired?: boolean
  validUntilMonth?: string | null
  attendedSessions?: number
  totalSessions?: number
}

type StudentTrackingPreviewApi = {
  trackingNumber: number
  studentNumber: string
}

const INACTIVE_ATTENDANCE_ACTIONS_TOOLTIP = "Janë aktiv vetëm në ditën e sesionit"

function DisabledAttendanceActions({
  compact = false,
  isAttended = false,
  isRejected = false,
}: {
  compact?: boolean
  isAttended?: boolean
  isRejected?: boolean
}) {
  return (
    <div className={cn("flex", compact ? "items-center gap-1.5" : "mt-4 flex-wrap gap-2")}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn(compact ? "inline-flex" : "min-w-[6rem] flex-1")} tabIndex={0}>
            <Button
              type="button"
              size="sm"
              className={cn(compact ? "h-7 w-full px-2 text-[11px]" : "min-w-[6rem] w-full flex-1")}
              variant={isAttended ? "default" : "outline"}
              disabled
            >
              Prano
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6}>
          {INACTIVE_ATTENDANCE_ACTIONS_TOOLTIP}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn(compact ? "inline-flex" : "min-w-[6rem] flex-1")} tabIndex={0}>
            <Button
              type="button"
              size="sm"
              className={cn(compact ? "h-7 w-full px-2 text-[11px]" : "min-w-[6rem] w-full flex-1")}
              variant={isRejected ? "destructive" : "outline"}
              disabled
            >
              Mungesë
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6}>
          {INACTIVE_ATTENDANCE_ACTIONS_TOOLTIP}
        </TooltipContent>
      </Tooltip>
    </div>
  )
}

function getDefaultStudentStartYear() {
  return String(new Date().getFullYear())
}

function getDefaultStudentEndYear() {
  return String(new Date().getFullYear() + 3)
}

type YearGrade = 1 | 2 | 3

function getYearBreakdown(startYear: number) {
  return [
    { grade: 1 as YearGrade, label: "Viti i Parë", from: startYear, to: startYear + 1, range: `Shtator ${startYear} – Shtator ${startYear + 1}` },
    { grade: 2 as YearGrade, label: "Viti i Dytë", from: startYear + 1, to: startYear + 2, range: `Shtator ${startYear + 1} – Shtator ${startYear + 2}` },
    { grade: 3 as YearGrade, label: "Viti i Tretë", from: startYear + 2, to: startYear + 3, range: `Shtator ${startYear + 2} – Shtator ${startYear + 3}` },
  ]
}

function getYearGradeDates(grade: YearGrade) {
  const now = new Date()
  const thisYear = now.getFullYear()
  switch (grade) {
    case 1:
      return { from: `${thisYear - 1}-09-01`, to: `${thisYear}-09-01`, fromLabel: `Shtator ${thisYear - 1}`, toLabel: `Shtator ${thisYear}` }
    case 2:
      return { from: `${thisYear}-09-01`, to: `${thisYear + 1}-09-01`, fromLabel: `Shtator ${thisYear}`, toLabel: `Shtator ${thisYear + 1}` }
    case 3:
      return { from: `${thisYear + 1}-09-01`, to: `${thisYear + 2}-09-01`, fromLabel: `Shtator ${thisYear + 1}`, toLabel: `Shtator ${thisYear + 2}` }
  }
}

function getYearGradeStartEndYears(grade: YearGrade) {
  const now = new Date()
  const thisYear = now.getFullYear()
  switch (grade) {
    case 1:
      return { startYear: thisYear - 1, endYear: thisYear }
    case 2:
      return { startYear: thisYear - 1, endYear: thisYear + 1 }
    case 3:
      return { startYear: thisYear - 1, endYear: thisYear + 2 }
  }
}

function formatYearGradeLabel(grade: number) {
  switch (grade) {
    case 1: return "Viti i Parë"
    case 2: return "Viti i Dytë"
    case 3: return "Viti i Tretë"
    default: return `Viti ${grade}`
  }
}

function parseStudentYear(value: string) {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : null
}

const STUDENT_YEAR_MIN = 2010
const STUDENT_YEAR_MAX = new Date().getFullYear() + 12
const STUDENT_YEAR_OPTIONS = Array.from(
  { length: STUDENT_YEAR_MAX - STUDENT_YEAR_MIN + 1 },
  (_, index) => String(STUDENT_YEAR_MIN + index)
)

function extractStudentNumberSeed(value: string | null | undefined) {
  const normalized = (value ?? "").trim().toUpperCase()
  if (!normalized) {
    return ""
  }

  const exactMatch = normalized.match(/^ST\d{3,4}$/)
  if (exactMatch) {
    return exactMatch[0]
  }

  const prefixedMatch = normalized.match(/^(ST\d{3,4})(?:-|$)/)
  return prefixedMatch ? prefixedMatch[1] : ""
}

function isValidStudentNumberFormat(value: string) {
  return /^ST\d{3,4}$/.test(value.trim().toUpperCase())
}

function normalizeStudentNumberInput(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return ""
  }

  const digits = trimmed.toUpperCase().replace(/[^0-9]/g, "").slice(0, 4)
  return `ST${digits}`
}

function getPreferredStudentNumber(user: AppUser) {
  return extractStudentNumberSeed(user.studentNumber) || extractStudentNumberSeed(user.memberRegistryNumber)
}

function getStudentTrackingCode(user: AppUser) {
  return formatStudentTrackingCode(
    user.studentTrackingNumber ?? parseStudentTrackingNumber(user.studentNumber ?? user.memberRegistryNumber)
  )
}

function toStudentValidUntilMonth(studentEndYear: number | null) {
  if (!studentEndYear) {
    return null
  }

  // Student validity ends in September of the end year (start + 3)
  return `${studentEndYear}-09`
}

function toDateInputValue(date: Date) {
  return format(date, "yyyy-MM-dd")
}

function isPastSessionDate(value?: string | null) {
  if (!value) return false
  return value < toDateInputValue(new Date())
}

function getAttendanceDisplayStatus(session: StudentTrainingSession) {
  if (session.attendanceStatus === "attended") {
    return {
      label: "Konfirmuar",
      className: "bg-green-500/10 text-green-600",
    }
  }

  if (session.attendanceStatus === "rejected") {
    return {
      label: "Refuzuar",
      className: "bg-red-500/10 text-red-600",
    }
  }

  if (isPastSessionDate(session.date)) {
    return {
      label: "Mungesë",
      className: "bg-amber-500/10 text-amber-700",
    }
  }

  return {
    label: "Në pritje",
    className: "bg-muted text-muted-foreground",
  }
}

function createScheduleRow(seed?: Partial<ScheduleRow>): ScheduleRow {
  return {
    id: seed?.id ?? (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`),
    date: seed?.date ?? toDateInputValue(new Date()),
    startTime: seed?.startTime ?? "09:00",
    endTime: seed?.endTime ?? "16:00",
    notes: seed?.notes ?? "",
  }
}

function getDuplicateScheduleDates(rows: ScheduleRow[]) {
  const counts = new Map<string, number>()
  rows.forEach((row) => {
    const key = row.date.trim()
    if (!key) return
    counts.set(key, (counts.get(key) ?? 0) + 1)
  })

  return new Set(
    Array.from(counts.entries())
      .filter(([, count]) => count > 1)
      .map(([date]) => date)
  )
}

function findNextAvailableDate(usedDates: Set<string>, startDate = new Date()) {
  const cursor = new Date(startDate)
  cursor.setHours(0, 0, 0, 0)

  for (let i = 0; i < 730; i++) {
    const candidate = toDateInputValue(cursor)
    if (!usedDates.has(candidate)) {
      return candidate
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  return toDateInputValue(startDate)
}

function createUniqueScheduleRow(existingRows: ScheduleRow[], seed?: Partial<ScheduleRow>): ScheduleRow {
  const usedDates = new Set(existingRows.map((row) => row.date.trim()).filter(Boolean))
  const requestedDate = seed?.date?.trim()
  const date = requestedDate && !usedDates.has(requestedDate) ? requestedDate : findNextAvailableDate(usedDates)
  return createScheduleRow({ ...seed, date })
}

function toWeekMonday(date: Date) {
  const monday = new Date(date)
  const day = monday.getDay()
  const diff = day === 0 ? -6 : 1 - day
  monday.setDate(monday.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  return monday
}

function mapStudentSummaryToAppUser(summary: StudentSummaryApi): AppUser {
  return {
    id: summary.id,
    firstName: summary.firstName,
    lastName: summary.lastName,
    email: summary.email,
    memberRegistryNumber: summary.memberRegistryNumber,
    role: "Student",
    mentorId: summary.mentorId ?? null,
    studentTrackingNumber: summary.studentTrackingNumber ?? parseStudentTrackingNumber(summary.studentNumber ?? summary.memberRegistryNumber),
    studentNumber: summary.studentNumber ?? extractStudentNumberSeed(summary.memberRegistryNumber),
    cpdHoursCompleted: 0,
    cpdHoursRequired: 0,
    isActive: summary.isActive !== false,
    accountIsActive: summary.accountIsActive !== false,
    isExpired: summary.isExpired === true,
    validUntilMonth: summary.validUntilMonth ?? null,
  }
}

export function StudentsView() {
  const { user } = useAuth()

  if (user?.role === "Student") {
    return <StudentCalendarView />
  }

  if (user?.role === "Mentor") {
    return <MentorAdminStudentsView forcedTab="students" />
  }

  return <MentorAdminStudentsView />
}

export function MentorAttendanceView() {
  return <MentorAdminStudentsView forcedTab="attendance" />
}

function MentorAdminStudentsView({ forcedTab }: { forcedTab?: ManagementTab } = {}) {
  const { user } = useAuth()
  const { users, addUser, updateMember, deleteUser } = useEvents()

  const isAdmin = user?.role === "Admin"
  const isMentor = user?.role === "Mentor"

  const [activeTab, setActiveTab] = useState<ManagementTab>(forcedTab ?? (isMentor ? "attendance" : "modules"))
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("name")
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [showAddForm, setShowAddForm] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState<PageSize>(25)

  const [studentSummaries, setStudentSummaries] = useState<StudentSummaryApi[]>([])
  const [studentsLoading, setStudentsLoading] = useState(false)

  const [newFirstName, setNewFirstName] = useState("")
  const [newLastName, setNewLastName] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [newEmail2, setNewEmail2] = useState("")
  const [newStudentTrackingNumber, setNewStudentTrackingNumber] = useState<number | null>(null)
  const [newRegistry, setNewRegistry] = useState("")
  const [newPhone, setNewPhone] = useState("")
  const [newPhonePrefix, setNewPhonePrefix] = useState("+355")
  const [newStudentStartYear, setNewStudentStartYear] = useState(getDefaultStudentStartYear())
  const [newStudentEndYear, setNewStudentEndYear] = useState(getDefaultStudentEndYear())
  const [newYear2StartYear, setNewYear2StartYear] = useState("")
  const [newYear3StartYear, setNewYear3StartYear] = useState("")
  const [newMentorId, setNewMentorId] = useState("")
  const [newCompany, setNewCompany] = useState("")
  const [newDistrict, setNewDistrict] = useState("")
  const [studentTrackingLoading, setStudentTrackingLoading] = useState(false)
  const [addingStudent, setAddingStudent] = useState(false)
  const [error, setError] = useState("")

  const [editingStudent, setEditingStudent] = useState<AppUser | null>(null)
  const [historyStudent, setHistoryStudent] = useState<AppUser | null>(null)
  const [deletingStudent, setDeletingStudent] = useState<AppUser | null>(null)
  const [editFirstName, setEditFirstName] = useState("")
  const [editLastName, setEditLastName] = useState("")
  const [editEmail, setEditEmail] = useState("")
  const [editEmail2, setEditEmail2] = useState("")
  const [editStudentTrackingNumber, setEditStudentTrackingNumber] = useState<number | null>(null)
  const [editRegistry, setEditRegistry] = useState("")
  const [editPhone, setEditPhone] = useState("")
  const [editPhonePrefix, setEditPhonePrefix] = useState("+355")
  const [editStudentStartYear, setEditStudentStartYear] = useState("")
  const [editStudentEndYear, setEditStudentEndYear] = useState("")
  const [editYear2StartYear, setEditYear2StartYear] = useState("")
  const [editYear3StartYear, setEditYear3StartYear] = useState("")
  const [editMentorId, setEditMentorId] = useState("")
  const [editCompany, setEditCompany] = useState("")
  const [editDistrict, setEditDistrict] = useState("")
  const [editIsActive, setEditIsActive] = useState(true)
  const [editError, setEditError] = useState("")
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [isDeletingStudent, setIsDeletingStudent] = useState(false)
  const [deleteStudentError, setDeleteStudentError] = useState("")

  const [scheduleStudent, setScheduleStudent] = useState<AppUser | null>(null)
  const [scheduleRows, setScheduleRows] = useState<ScheduleRow[]>([])
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [scheduleSaving, setScheduleSaving] = useState(false)
  const [scheduleError, setScheduleError] = useState("")
  const [quickWeekStartDate, setQuickWeekStartDate] = useState(toDateInputValue(new Date()))
  const [quickWeekStartTime, setQuickWeekStartTime] = useState("09:00")
  const [quickWeekEndTime, setQuickWeekEndTime] = useState("16:00")
  const [quickWeekNotes, setQuickWeekNotes] = useState("")

  // Module-topic attendance state
  const [attModules, setAttModules] = useState<StudentModuleResponse[]>([])
  const [attModulesLoading, setAttModulesLoading] = useState(false)
  const [attSelectedModuleId, setAttSelectedModuleId] = useState("")
  const [attModuleDetail, setAttModuleDetail] = useState<StudentModuleDetailResponse | null>(null)
  const [attModuleDetailLoading, setAttModuleDetailLoading] = useState(false)
  const [attSelectedTopicId, setAttSelectedTopicId] = useState("")
  const [attUpdatingKey, setAttUpdatingKey] = useState<string | null>(null)
  const [attError, setAttError] = useState("")
  const [attTopicQrToken, setAttTopicQrToken] = useState("")
  const [attTopicQrLoading, setAttTopicQrLoading] = useState(false)
  const [attShowQrModal, setAttShowQrModal] = useState(false)

  const [endingStazhStudent, setEndingStazhStudent] = useState<AppUser | null>(null)
  const [endingStazhRating, setEndingStazhRating] = useState(5)
  const [endingStazhComment, setEndingStazhComment] = useState("")
  const [endingStazhSaving, setEndingStazhSaving] = useState(false)
  const [endingStazhError, setEndingStazhError] = useState("")

  // Student modules state
  const [studentModules, setStudentModules] = useState<StudentModuleResponse[]>([])
  const [modulesLoading, setModulesLoading] = useState(false)
  const [showAddModuleForm, setShowAddModuleForm] = useState(false)
  const [moduleYearGrade, setModuleYearGrade] = useState<YearGrade>(1)
  const [moduleTitle, setModuleTitle] = useState("")
  const [moduleLocation, setModuleLocation] = useState("")
  const [moduleSaving, setModuleSaving] = useState(false)
  const [moduleError, setModuleError] = useState("")
  const [moduleStudentPreview, setModuleStudentPreview] = useState<StudentModuleStudentItem[]>([])
  const [moduleStudentPreviewLoading, setModuleStudentPreviewLoading] = useState(false)
  const [moduleStudentPreviewExpanded, setModuleStudentPreviewExpanded] = useState(false)
  const [moduleExcludedStudentIds, setModuleExcludedStudentIds] = useState<Set<string>>(new Set())
  const [moduleAdditionalStudents, setModuleAdditionalStudents] = useState<StudentModuleStudentItem[]>([])
  const [allActiveStudents, setAllActiveStudents] = useState<StudentModuleStudentItem[]>([])
  const [allActiveStudentsLoading, setAllActiveStudentsLoading] = useState(false)
  const [addStudentSearch, setAddStudentSearch] = useState("")
  const [showAddStudentDropdown, setShowAddStudentDropdown] = useState(false)
  const addStudentDropdownRef = useRef<HTMLDivElement>(null)
  const [deletingModuleId, setDeletingModuleId] = useState<string | null>(null)
  const [isDeletingModule, setIsDeletingModule] = useState(false)
  const [selectedModuleDetail, setSelectedModuleDetail] = useState<StudentModuleDetailResponse | null>(null)
  const [moduleDetailLoading, setModuleDetailLoading] = useState(false)
  const [moduleDetailStudentsExpanded, setModuleDetailStudentsExpanded] = useState(false)

  // Module list filters
  const [moduleYearFilter, setModuleYearFilter] = useState<number | null>(null)
  const [moduleTimeFilter, setModuleTimeFilter] = useState<"upcoming" | "past" | "all">("upcoming")

  // Module detail: Topic CRUD states
  const [showAddTopicForm, setShowAddTopicForm] = useState(false)
  const [newTopicName, setNewTopicName] = useState("")
  const [newTopicLecturer, setNewTopicLecturer] = useState("")
  const [newTopicScheduledDate, setNewTopicScheduledDate] = useState("")
  const [newTopicScheduledTime, setNewTopicScheduledTime] = useState("09:00")
  const [newTopicLocation, setNewTopicLocation] = useState("")
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null)
  const [editTopicName, setEditTopicName] = useState("")
  const [editTopicLecturer, setEditTopicLecturer] = useState("")
  const [editTopicScheduledDate, setEditTopicScheduledDate] = useState("")
  const [editTopicScheduledTime, setEditTopicScheduledTime] = useState("")
  const [editTopicLocation, setEditTopicLocation] = useState("")
  const [topicSaving, setTopicSaving] = useState(false)
  const [deletingTopicId, setDeletingTopicId] = useState<string | null>(null)
  const [isDeletingTopic, setIsDeletingTopic] = useState(false)

  // Module detail: per-topic document states
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null)
  const [deletingDocTopicId, setDeletingDocTopicId] = useState<string | null>(null)
  const [isDeletingDoc, setIsDeletingDoc] = useState(false)
  const [uploadingDocsTopicId, setUploadingDocsTopicId] = useState<string | null>(null)
  const [uploadingDocs, setUploadingDocs] = useState(false)

  // Module detail: per-topic QR states
  const [topicQrTokens, setTopicQrTokens] = useState<Record<string, string>>({})
  const [topicQrLoading, setTopicQrLoading] = useState<string | null>(null)
  const [topicQrError, setTopicQrError] = useState("")

  // Module detail: notify & misc
  const [notifyingStudents, setNotifyingStudents] = useState(false)
  const [notifySuccess, setNotifySuccess] = useState(false)

  // QR Quick Popup from list (now per-topic)
  const [qrPopupTopicId, setQrPopupTopicId] = useState<string | null>(null)
  const [qrPopupToken, setQrPopupToken] = useState<string | null>(null)
  const [qrPopupLoading, setQrPopupLoading] = useState(false)
  const [qrPopupError, setQrPopupError] = useState("")
  const [qrPopupTopicName, setQrPopupTopicName] = useState("")
  const [qrPopupYear, setQrPopupYear] = useState(0)

  // Questionnaire state
  const [showQuestionnaireModal, setShowQuestionnaireModal] = useState(false)
  const [questionnaireTopicId, setQuestionnaireTopicId] = useState<string | null>(null)
  const [questionnaireTopicName, setQuestionnaireTopicName] = useState("")
  const [questionnaireTitle, setQuestionnaireTitle] = useState("")
  const [questionnaireQuestions, setQuestionnaireQuestions] = useState<Array<{ text: string; type: "Options" | "FreeText" | "Stars"; order: number; options: string[] }>>([])
  const [questionnaireSaving, setQuestionnaireSaving] = useState(false)
  const [questionnaireError, setQuestionnaireError] = useState("")

  // Questionnaire results state
  const [showQuestionnaireResults, setShowQuestionnaireResults] = useState(false)
  const [questionnaireResultsId, setQuestionnaireResultsId] = useState<string | null>(null)
  const [questionnaireResultsDetail, setQuestionnaireResultsDetail] = useState<QuestionnaireDetail | null>(null)
  const [questionnaireResponses, setQuestionnaireResponses] = useState<QuestionnaireResponseItem[]>([])
  const [questionnaireResultsLoading, setQuestionnaireResultsLoading] = useState(false)
  const [selectedResponseId, setSelectedResponseId] = useState<string | null>(null)

  // Questionnaire QR state
  const [questionnaireQrId, setQuestionnaireQrId] = useState<string | null>(null)
  const [questionnaireQrToken, setQuestionnaireQrToken] = useState<string | null>(null)
  const [questionnaireQrLoading, setQuestionnaireQrLoading] = useState(false)

  // Questionnaire delete state
  const [deletingQuestionnaireId, setDeletingQuestionnaireId] = useState<string | null>(null)
  const [isDeletingQuestionnaire, setIsDeletingQuestionnaire] = useState(false)

  // Student result modal state
  const [resultStudentId, setResultStudentId] = useState<string | null>(null)
  const [resultStudentName, setResultStudentName] = useState("")
  const [resultStudentEmail, setResultStudentEmail] = useState("")
  const [resultStudentCurrent, setResultStudentCurrent] = useState<string | null>(null)
  const [resultValue, setResultValue] = useState("")
  const [resultNote, setResultNote] = useState("")
  const [resultSaving, setResultSaving] = useState(false)

  useEffect(() => {
    if (forcedTab && activeTab !== forcedTab) {
      setActiveTab(forcedTab)
    }
  }, [activeTab, forcedTab])

  const mentors = useMemo(
    () => users.filter((u) => u.role === "Mentor"),
    [users]
  )
  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users])
  const students = useMemo(
    () =>
      studentSummaries.map((summary) => {
        const mapped = mapStudentSummaryToAppUser(summary)
        const existing = usersById.get(summary.id)
        return existing
          ? {
            ...existing,
            ...mapped,
            isActive: summary.isActive !== false,
            accountIsActive: summary.accountIsActive !== false,
            isExpired: summary.isExpired === true,
            mentorId: summary.mentorId ?? null,
          }
          : mapped
      }),
    [studentSummaries, usersById]
  )

  const mentorNameById = useMemo(() => {
    const map = new Map<string, string>()
    mentors.forEach((m) => map.set(m.id, `${m.firstName} ${m.lastName}`))
    if (isMentor && user) {
      map.set(user.id, user.name)
    }
    return map
  }, [isMentor, mentors, user])

  async function loadManageableStudents() {
    setStudentsLoading(true)
    try {
      const response = (await fetchApi("/StudentTraining/students")) as StudentSummaryApi[]
      setStudentSummaries(response)
    } catch {
      setStudentSummaries([])
    } finally {
      setStudentsLoading(false)
    }
  }

  useEffect(() => {
    if (!isAdmin && !isMentor) return

    let isCancelled = false
    const run = async () => {
      setStudentsLoading(true)
      try {
        const response = (await fetchApi("/StudentTraining/students")) as StudentSummaryApi[]
        if (!isCancelled) {
          setStudentSummaries(response)
        }
      } catch {
        if (!isCancelled) {
          setStudentSummaries([])
        }
      } finally {
        if (!isCancelled) {
          setStudentsLoading(false)
        }
      }
    }

    void run()
    return () => {
      isCancelled = true
    }
  }, [isAdmin, isMentor])

  // Load student modules
  async function loadStudentModules() {
    setModulesLoading(true)
    try {
      const response = (await fetchApi("/StudentModules")) as StudentModuleResponse[]
      setStudentModules(response)
    } catch {
      setStudentModules([])
    } finally {
      setModulesLoading(false)
    }
  }

  useEffect(() => {
    if (!isAdmin) return
    if (activeTab !== "modules") return

    let isCancelled = false
    const run = async () => {
      setModulesLoading(true)
      try {
        const response = (await fetchApi("/StudentModules")) as StudentModuleResponse[]
        if (!isCancelled) setStudentModules(response)
      } catch {
        if (!isCancelled) setStudentModules([])
      } finally {
        if (!isCancelled) setModulesLoading(false)
      }
    }

    void run()
    return () => { isCancelled = true }
  }, [isAdmin, activeTab])

  // Load student preview when module year grade changes
  useEffect(() => {
    if (!showAddModuleForm) return

    let isCancelled = false
    setModuleStudentPreviewLoading(true)
    setModuleExcludedStudentIds(new Set())
    setModuleAdditionalStudents([])
    setAddStudentSearch("")
    setShowAddStudentDropdown(false)

    const run = async () => {
      try {
        const response = (await fetchApi(`/StudentModules/students-by-year/${moduleYearGrade}`)) as StudentModuleStudentItem[]
        if (!isCancelled) setModuleStudentPreview(response)
      } catch {
        if (!isCancelled) setModuleStudentPreview([])
      } finally {
        if (!isCancelled) setModuleStudentPreviewLoading(false)
      }
    }

    void run()
    return () => { isCancelled = true }
  }, [showAddModuleForm, moduleYearGrade])

  // Load all active students when form opens (for add dropdown)
  useEffect(() => {
    if (!showAddModuleForm) return

    let isCancelled = false
    setAllActiveStudentsLoading(true)

    const run = async () => {
      try {
        const response = (await fetchApi("/StudentModules/all-active-students")) as StudentModuleStudentItem[]
        if (!isCancelled) setAllActiveStudents(response)
      } catch {
        if (!isCancelled) setAllActiveStudents([])
      } finally {
        if (!isCancelled) setAllActiveStudentsLoading(false)
      }
    }

    void run()
    return () => { isCancelled = true }
  }, [showAddModuleForm])

  // Close add-student dropdown on click outside
  useEffect(() => {
    if (!showAddStudentDropdown) return
    const handler = (e: MouseEvent) => {
      if (addStudentDropdownRef.current && !addStudentDropdownRef.current.contains(e.target as Node)) {
        setShowAddStudentDropdown(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [showAddStudentDropdown])

  async function handleCreateModule() {
    if (moduleSaving) return

    if (!moduleTitle.trim()) {
      setModuleError("Titulli është i detyrueshëm.")
      return
    }

    setModuleSaving(true)
    setModuleError("")

    try {
      await fetchApi("/StudentModules", {
        method: "POST",
        body: JSON.stringify({
          yearGrade: moduleYearGrade,
          title: moduleTitle.trim(),
          location: moduleLocation.trim() || null,
          excludedStudentIds: moduleExcludedStudentIds.size > 0 ? Array.from(moduleExcludedStudentIds) : null,
          additionalStudentIds: moduleAdditionalStudents.length > 0 ? moduleAdditionalStudents.map(s => s.studentId) : null,
        }),
      })

      // Reset form
      setModuleTitle("")
      setModuleLocation("")
      setModuleYearGrade(1)
      setModuleError("")
      setModuleExcludedStudentIds(new Set())
      setModuleAdditionalStudents([])
      setAddStudentSearch("")
      setShowAddStudentDropdown(false)
      setShowAddModuleForm(false)
      await loadStudentModules()
    } catch (e: any) {
      setModuleError(e?.message ?? "Gabim gjatë krijimit të modulit")
    } finally {
      setModuleSaving(false)
    }
  }

  async function handleDeleteModule(moduleId: string) {
    setIsDeletingModule(true)
    try {
      await fetchApi(`/StudentModules/${moduleId}`, { method: "DELETE" })
      setDeletingModuleId(null)
      await loadStudentModules()
    } catch {
      // silent
    } finally {
      setIsDeletingModule(false)
    }
  }

  async function openModuleDetail(moduleId: string) {
    setModuleDetailLoading(true)
    setSelectedModuleDetail(null)
    setTopicQrTokens({})
    setTopicQrError("")
    setShowAddTopicForm(false)
    setEditingTopicId(null)
    setDeletingDocId(null)
    setDeletingDocTopicId(null)
    setDeletingTopicId(null)
    setNotifySuccess(false)
    try {
      const detail = (await fetchApi(`/StudentModules/${moduleId}`)) as StudentModuleDetailResponse
      setSelectedModuleDetail(detail)
    } catch {
      // silent
    } finally {
      setModuleDetailLoading(false)
    }
  }

  async function handleGenerateTopicQr(topicId: string) {
    setTopicQrLoading(topicId)
    setTopicQrError("")
    try {
      const result = (await fetchApi(`/StudentModules/topics/${topicId}/qr`)) as StudentModuleQrResponse
      setTopicQrTokens(prev => ({ ...prev, [topicId]: result.token }))
    } catch (e: any) {
      setTopicQrError(e?.message ?? "Gabim gjatë gjenerimit të QR kodit.")
    } finally {
      setTopicQrLoading(null)
    }
  }

  async function handleAddTopic() {
    if (!selectedModuleDetail || topicSaving) return
    if (!newTopicName.trim()) return
    if (!newTopicLecturer.trim()) return

    // Validate no duplicate date
    if (newTopicScheduledDate) {
      const existingDates = selectedModuleDetail.topics
        .filter(t => t.scheduledDate)
        .map(t => t.scheduledDate!.split("T")[0])
      if (existingDates.includes(newTopicScheduledDate)) {
        alert("Nuk lejohet të shtohen dy tema në të njëjtën ditë brenda një moduli.")
        return
      }
    }

    setTopicSaving(true)
    try {
      const scheduledDate = newTopicScheduledDate
        ? (newTopicScheduledTime ? `${newTopicScheduledDate}T${newTopicScheduledTime}` : newTopicScheduledDate)
        : null
      await fetchApi(`/StudentModules/${selectedModuleDetail.id}/topics`, {
        method: "POST",
        body: JSON.stringify({
          name: newTopicName.trim(),
          lecturer: newTopicLecturer.trim(),
          scheduledDate,
          location: newTopicLocation.trim() || null,
        }),
      })
      setShowAddTopicForm(false)
      setNewTopicName("")
      setNewTopicLecturer("")
      setNewTopicScheduledDate("")
      setNewTopicScheduledTime("09:00")
      setNewTopicLocation("")
      openModuleDetail(selectedModuleDetail.id)
      loadStudentModules()
    } catch (e: any) {
      alert(e?.message ?? "Gabim gjatë shtimit të temës.")
    } finally {
      setTopicSaving(false)
    }
  }

  async function handleUpdateTopic(topicId: string) {
    if (topicSaving) return

    // Validate no duplicate date (exclude current topic)
    if (editTopicScheduledDate && selectedModuleDetail) {
      const existingDates = selectedModuleDetail.topics
        .filter(t => t.id !== topicId && t.scheduledDate)
        .map(t => t.scheduledDate!.split("T")[0])
      if (existingDates.includes(editTopicScheduledDate)) {
        alert("Nuk lejohet të shtohen dy tema në të njëjtën ditë brenda një moduli.")
        return
      }
    }

    setTopicSaving(true)
    try {
      const scheduledDate = editTopicScheduledDate
        ? (editTopicScheduledTime ? `${editTopicScheduledDate}T${editTopicScheduledTime}` : editTopicScheduledDate)
        : null
      await fetchApi(`/StudentModules/topics/${topicId}`, {
        method: "PUT",
        body: JSON.stringify({
          name: editTopicName.trim(),
          lecturer: editTopicLecturer.trim(),
          scheduledDate,
          location: editTopicLocation.trim() || null,
        }),
      })
      setEditingTopicId(null)
      if (selectedModuleDetail) {
        openModuleDetail(selectedModuleDetail.id)
        loadStudentModules()
      }
    } catch (e: any) {
      alert(e?.message ?? "Gabim gjatë përditësimit të temës.")
    } finally {
      setTopicSaving(false)
    }
  }

  async function handleDeleteTopic(topicId: string) {
    setIsDeletingTopic(true)
    try {
      await fetchApi(`/StudentModules/topics/${topicId}`, { method: "DELETE" })
      setDeletingTopicId(null)
      if (selectedModuleDetail) {
        openModuleDetail(selectedModuleDetail.id)
        loadStudentModules()
      }
    } catch (e: any) {
      alert(e?.message ?? "Gabim gjatë fshirjes së temës.")
    } finally {
      setIsDeletingTopic(false)
    }
  }

  function startEditTopic(topic: StudentModuleTopicResponse) {
    setEditingTopicId(topic.id)
    setEditTopicName(topic.name)
    setEditTopicLecturer(topic.lecturer)
    if (topic.scheduledDate) {
      const d = parseISO(topic.scheduledDate)
      setEditTopicScheduledDate(format(d, "yyyy-MM-dd"))
      setEditTopicScheduledTime(format(d, "HH:mm"))
    } else {
      setEditTopicScheduledDate("")
      setEditTopicScheduledTime("09:00")
    }
    setEditTopicLocation(topic.location ?? "")
  }

  async function handleNotifyStudents() {
    if (!selectedModuleDetail) return
    setNotifyingStudents(true)
    try {
      await fetchApi(`/StudentModules/${selectedModuleDetail.id}/notify`, { method: "POST" })
      setNotifySuccess(true)
      setTimeout(() => setNotifySuccess(false), 3000)
    } catch (e: any) {
      alert(e?.message ?? "Gabim gjatë njoftimit.")
    } finally {
      setNotifyingStudents(false)
    }
  }

  async function handleRemoveDocument(topicId: string, docId: string) {
    if (!selectedModuleDetail) return
    setIsDeletingDoc(true)
    try {
      await fetchApi(`/StudentModules/topics/${topicId}/documents/${docId}`, { method: "DELETE" })
      setDeletingDocId(null)
      setDeletingDocTopicId(null)
      openModuleDetail(selectedModuleDetail.id)
      loadStudentModules()
    } catch (e: any) {
      alert(e?.message ?? "Gabim gjatë fshirjes së dokumentit.")
    } finally {
      setIsDeletingDoc(false)
    }
  }

  async function handleUploadTopicDocs(topicId: string, files: File[]) {
    if (!selectedModuleDetail || files.length === 0) return
    setUploadingDocsTopicId(topicId)
    setUploadingDocs(true)
    try {
      for (const file of files) {
        const fd = new FormData()
        fd.append("file", file)
        await fetchApi(`/StudentModules/topics/${topicId}/documents`, { method: "POST", body: fd })
      }
      openModuleDetail(selectedModuleDetail.id)
      loadStudentModules()
    } catch (e: any) {
      alert(e?.message ?? "Gabim gjatë ngarkimit të dokumentit.")
    } finally {
      setUploadingDocs(false)
      setUploadingDocsTopicId(null)
    }
  }

  async function handleDownloadModuleDoc(fileUrl: string, fileName: string) {
    try {
      const response = await fetchWithAuth(fileUrl, { method: "GET" })
      if (!response.ok) throw new Error("Nuk u hap dokumenti.")
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = objectUrl
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(objectUrl)
    } catch {
      alert("Gabim gjatë hapjes së dokumentit.")
    }
  }

  async function handleOpenQrPopup(topicId: string, topicName: string, yearGrade: number) {
    setQrPopupTopicId(topicId)
    setQrPopupTopicName(topicName)
    setQrPopupYear(yearGrade)
    setQrPopupToken(null)
    setQrPopupError("")
    setQrPopupLoading(true)
    try {
      const result = (await fetchApi(`/StudentModules/topics/${topicId}/qr`)) as StudentModuleQrResponse
      setQrPopupToken(result.token)
    } catch (e: any) {
      setQrPopupError(e?.message ?? "Gabim gjatë gjenerimit të QR kodit.")
    } finally {
      setQrPopupLoading(false)
    }
  }

  function handlePrintQr(canvasId: string, title: string) {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null
    if (!canvas) return
    const dataUrl = canvas.toDataURL("image/png")
    const win = window.open("", "_blank")
    if (!win) return
    win.document.write(`<html><head><title>${title}</title><style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;font-family:system-ui,sans-serif;}h2{margin-bottom:16px;}@media print{button{display:none!important;}}</style></head><body><h2>${title}</h2><img src="${dataUrl}" width="300" height="300" /><br/><button onclick="window.print()" style="margin-top:20px;padding:8px 24px;font-size:14px;cursor:pointer;">Printo</button></body></html>`)
    win.document.close()
  }

  // ── Questionnaire handlers ──────────────────────────────────────────────

  function openCreateQuestionnaire(topicId: string, topicName: string) {
    setQuestionnaireTopicId(topicId)
    setQuestionnaireTopicName(topicName)
    setQuestionnaireTitle("")
    setQuestionnaireQuestions([{ text: "", type: "Options", order: 1, options: ["", ""] }])
    setQuestionnaireError("")
    setShowQuestionnaireModal(true)
  }

  function addQuestionnaireQuestion() {
    setQuestionnaireQuestions(prev => [...prev, { text: "", type: "Options", order: prev.length + 1, options: ["", ""] }])
  }

  function removeQuestionnaireQuestion(index: number) {
    setQuestionnaireQuestions(prev => prev.filter((_, i) => i !== index).map((q, i) => ({ ...q, order: i + 1 })))
  }

  function updateQuestionnaireQuestion(index: number, field: string, value: any) {
    setQuestionnaireQuestions(prev => prev.map((q, i) => {
      if (i !== index) return q
      if (field === "type") {
        return { ...q, type: value, options: value === "Options" ? ["", ""] : [] }
      }
      return { ...q, [field]: value }
    }))
  }

  function updateQuestionOption(qIndex: number, optIndex: number, value: string) {
    setQuestionnaireQuestions(prev => prev.map((q, i) => {
      if (i !== qIndex) return q
      const newOpts = [...q.options]
      newOpts[optIndex] = value
      return { ...q, options: newOpts }
    }))
  }

  function addQuestionOption(qIndex: number) {
    setQuestionnaireQuestions(prev => prev.map((q, i) => {
      if (i !== qIndex) return q
      return { ...q, options: [...q.options, ""] }
    }))
  }

  function removeQuestionOption(qIndex: number, optIndex: number) {
    setQuestionnaireQuestions(prev => prev.map((q, i) => {
      if (i !== qIndex) return q
      return { ...q, options: q.options.filter((_, j) => j !== optIndex) }
    }))
  }

  async function handleCreateQuestionnaire() {
    if (!questionnaireTopicId || !questionnaireTitle.trim()) return
    const validQuestions = questionnaireQuestions.filter(q => q.text.trim())
    if (validQuestions.length === 0) { setQuestionnaireError("Shtoni të paktën një pyetje."); return }

    setQuestionnaireSaving(true)
    setQuestionnaireError("")
    try {
      await fetchApi(`/StudentModules/topics/${questionnaireTopicId}/questionnaire`, {
        method: "POST",
        body: JSON.stringify({
          title: questionnaireTitle.trim(),
          questions: validQuestions.map(q => ({
            text: q.text.trim(),
            type: q.type === "Options" ? 0 : q.type === "FreeText" ? 1 : 2,
            order: q.order,
            options: q.type === "Options" ? q.options.filter(o => o.trim()) : null
          }))
        })
      })
      setShowQuestionnaireModal(false)
      // Refresh module detail
      if (selectedModuleDetail) {
        const updated = (await fetchApi(`/StudentModules/${selectedModuleDetail.id}`)) as StudentModuleDetailResponse
        setSelectedModuleDetail(updated)
      }
      loadStudentModules()
    } catch (e: any) {
      setQuestionnaireError(e?.message ?? "Gabim gjatë ruajtjes së pyetësorit.")
    } finally {
      setQuestionnaireSaving(false)
    }
  }

  async function handleDeleteQuestionnaire(questionnaireId: string) {
    setIsDeletingQuestionnaire(true)
    try {
      await fetchApi(`/StudentModules/questionnaires/${questionnaireId}`, { method: "DELETE" })
      setDeletingQuestionnaireId(null)
      if (selectedModuleDetail) {
        const updated = (await fetchApi(`/StudentModules/${selectedModuleDetail.id}`)) as StudentModuleDetailResponse
        setSelectedModuleDetail(updated)
      }
      loadStudentModules()
    } catch { /* ignore */ } finally {
      setIsDeletingQuestionnaire(false)
    }
  }

  async function openQuestionnaireResults(questionnaireId: string) {
    setQuestionnaireResultsId(questionnaireId)
    setShowQuestionnaireResults(true)
    setQuestionnaireResultsLoading(true)
    setSelectedResponseId(null)
    try {
      const [detail, responses] = await Promise.all([
        fetchApi(`/StudentModules/questionnaires/${questionnaireId}`) as Promise<QuestionnaireDetail>,
        fetchApi(`/StudentModules/questionnaires/${questionnaireId}/responses`) as Promise<QuestionnaireResponseItem[]>
      ])
      setQuestionnaireResultsDetail(detail)
      setQuestionnaireResponses(responses)
    } catch { /* ignore */ } finally {
      setQuestionnaireResultsLoading(false)
    }
  }

  async function openQuestionnaireQr(questionnaireId: string) {
    setQuestionnaireQrId(questionnaireId)
    setQuestionnaireQrToken(null)
    setQuestionnaireQrLoading(true)
    try {
      const result = (await fetchApi(`/StudentModules/questionnaires/${questionnaireId}/qr`)) as { questionnaireId: string; token: string }
      setQuestionnaireQrToken(result.token)
    } catch { /* ignore */ } finally {
      setQuestionnaireQrLoading(false)
    }
  }

  // ── Student Result Handler ──────────────────────────────────────────────
  async function handleSetStudentResult(moduleId: string, studentId: string) {
    if (!resultValue.trim() || resultSaving) return
    setResultSaving(true)
    try {
      await fetchApi(`/StudentModules/${moduleId}/results/${studentId}`, {
        method: "PUT",
        body: JSON.stringify({ result: resultValue.trim(), note: resultNote.trim() || null }),
      })
      setResultStudentId(null)
      setResultStudentName("")
      setResultStudentEmail("")
      setResultStudentCurrent(null)
      setResultValue("")
      setResultNote("")
      openModuleDetail(moduleId)
    } catch (e: any) {
      alert(e?.message ?? "Gabim gjatë ruajtjes së rezultatit.")
    } finally {
      setResultSaving(false)
    }
  }

  function handleDownloadQr(canvasId: string, fileName: string) {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null
    if (!canvas) return
    const dataUrl = canvas.toDataURL("image/png")
    const link = document.createElement("a")
    link.href = dataUrl
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  const studentStats = useMemo(() => {
    const stats: Record<string, { attended: number; total: number }> = {}
    studentSummaries.forEach((summary) => {
      stats[summary.id] = {
        attended: summary.attendedSessions ?? 0,
        total: summary.totalSessions ?? 0,
      }
    })
    return stats
  }, [studentSummaries])

  const filteredStudents = useMemo(() => {
    let result = students

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (u) =>
          u.firstName.toLowerCase().includes(q) ||
          u.lastName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.email2 ?? "").toLowerCase().includes(q) ||
          (u.studentNumber ?? "").toLowerCase().includes(q) ||
          (u.company ?? "").toLowerCase().includes(q) ||
          (u.district ?? "").toLowerCase().includes(q) ||
          u.memberRegistryNumber.toLowerCase().includes(q)
      )
    }

    result = [...result].sort((a, b) => {
      let cmp = 0
      if (sortKey === "name") {
        cmp = `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
      } else if (sortKey === "attendance") {
        const sa = studentStats[a.id]
        const sb = studentStats[b.id]
        cmp = (sa?.attended ?? 0) - (sb?.attended ?? 0)
      } else if (sortKey === "mentor") {
        const ma = a.mentorId ? mentorNameById.get(a.mentorId) ?? "—" : "—"
        const mb = b.mentorId ? mentorNameById.get(b.mentorId) ?? "—" : "—"
        cmp = ma.localeCompare(mb)
      }
      return sortDir === "asc" ? cmp : -cmp
    })

    return result
  }, [students, search, sortKey, sortDir, studentStats, mentorNameById])

  const filteredModules = useMemo(() => {
    let result = studentModules
    if (moduleYearFilter !== null) result = result.filter((m) => m.yearGrade === moduleYearFilter)
    if (moduleTimeFilter !== "all") {
      const todayStr = new Date().toISOString().slice(0, 10)
      result = result.filter((m) => {
        const topicDates = m.topics
          .map(t => t.scheduledDate)
          .filter((d): d is string => !!d)
        if (topicDates.length === 0) return moduleTimeFilter === "upcoming"
        const latestDateStr = topicDates.reduce((a, b) => (a > b ? a : b)).slice(0, 10)
        return moduleTimeFilter === "upcoming" ? latestDateStr >= todayStr : latestDateStr < todayStr
      })
    }
    return result
  }, [studentModules, moduleYearFilter, moduleTimeFilter])

  const pagedStudents = usePagination(filteredStudents, pageSize, currentPage)
  const scheduleDuplicateDateSet = useMemo(() => getDuplicateScheduleDates(scheduleRows), [scheduleRows])
  const newStudentStartYearNumber = parseStudentYear(newStudentStartYear)
  const newStudentEndYearNumber = newStudentStartYearNumber ? newStudentStartYearNumber + 3 : null
  const editStudentStartYearNumber = parseStudentYear(editStudentStartYear)
  const editYear2StartYearNumber = parseStudentYear(editYear2StartYear)
  const editYear3StartYearNumber = parseStudentYear(editYear3StartYear)
  const editComputedY3Start = editStudentStartYearNumber
    ? (editYear3StartYearNumber || (editYear2StartYearNumber || editStudentStartYearNumber + 1) + 1)
    : null
  const editStudentEndYearNumber = editComputedY3Start ? editComputedY3Start + 1 : parseStudentYear(editStudentEndYear)
  const existingStudentNumbers = useMemo(
    () =>
      users.flatMap((member) => {
        const fromStudentNumber = extractStudentNumberSeed(member.studentNumber)
        const fromRegistry = extractStudentNumberSeed(member.memberRegistryNumber)
        return [fromStudentNumber, fromRegistry].filter(Boolean)
      }),
    [users]
  )
  const generatedNewRegistryNumber = useMemo(
    () => generateStudentNumber(newRegistry, newFirstName, newStudentStartYearNumber, newStudentEndYearNumber),
    [newFirstName, newRegistry, newStudentStartYearNumber, newStudentEndYearNumber]
  )
  const generatedEditRegistryNumber = useMemo(
    () => generateStudentNumber(editRegistry, editFirstName, editStudentStartYearNumber, editStudentEndYearNumber),
    [editFirstName, editRegistry, editStudentStartYearNumber, editStudentEndYearNumber]
  )

  // Module-topic attendance computed values
  const attAllTopics = useMemo(() => {
    if (!attModules.length) return []
    return attModules
      .flatMap(m => m.topics.filter(t => t.scheduledDate).map(t => ({ ...t, moduleId: m.id, moduleTitle: `Viti ${m.yearGrade} - ${m.title}` })))
      .sort((a, b) => (a.scheduledDate ?? "").localeCompare(b.scheduledDate ?? ""))
  }, [attModules])

  const attTopics = useMemo(() => {
    if (attSelectedModuleId && attModuleDetail) {
      return [...attModuleDetail.topics]
        .filter(t => t.scheduledDate)
        .sort((a, b) => (a.scheduledDate ?? "").localeCompare(b.scheduledDate ?? ""))
    }
    return []
  }, [attModuleDetail, attSelectedModuleId])

  const attSelectedTopic = useMemo(() =>
    attTopics.find(t => t.id === attSelectedTopicId) ?? null
  , [attTopics, attSelectedTopicId])

  const attStudentsForTopic = useMemo(() => {
    if (!attModuleDetail || !attSelectedTopicId) return []
    return attModuleDetail.assignments.map(a => ({
      ...a,
      attended: a.topicAttendances.some(ta => ta.topicId === attSelectedTopicId),
      attendedAt: a.topicAttendances.find(ta => ta.topicId === attSelectedTopicId)?.attendedAt ?? null,
    }))
  }, [attModuleDetail, attSelectedTopicId])

  const attIsPastTopic = useMemo(() => {
    if (!attSelectedTopic?.scheduledDate) return false
    return new Date(attSelectedTopic.scheduledDate) < new Date()
  }, [attSelectedTopic])

  useEffect(() => {
    if (!isAdmin || !showAddForm) {
      return
    }

    let isCancelled = false

    const loadNextStudentTrackingPreview = async () => {
      setStudentTrackingLoading(true)
      try {
        const response = (await fetchApi("/Members/student-tracking/next")) as StudentTrackingPreviewApi
        if (isCancelled) {
          return
        }

        const trackingNumber = typeof response.trackingNumber === "number"
          ? response.trackingNumber
          : parseStudentTrackingNumber(response.studentNumber)
        setNewStudentTrackingNumber(trackingNumber)
        setNewRegistry(response.studentNumber ?? formatStudentTrackingCode(trackingNumber))
      } catch {
        if (isCancelled) {
          return
        }

        const fallbackMax = existingStudentNumbers
          .map((value) => parseStudentTrackingNumber(value))
          .filter((value): value is number => value !== null)
          .reduce((max, value) => Math.max(max, value), 0)
        const fallbackTrackingNumber = fallbackMax + 1
        setNewStudentTrackingNumber(fallbackTrackingNumber)
        setNewRegistry(formatStudentTrackingCode(fallbackTrackingNumber))
      } finally {
        if (!isCancelled) {
          setStudentTrackingLoading(false)
        }
      }
    }

    void loadNextStudentTrackingPreview()

    return () => {
      isCancelled = true
    }
  }, [existingStudentNumbers, isAdmin, showAddForm])

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else {
      setSortKey(key)
      setSortDir("asc")
    }
    setCurrentPage(1)
  }

  async function handleAdd() {
    if (!isAdmin || addingStudent) return

    if (!newFirstName.trim() || !newLastName.trim() || !newEmail.trim() || !newRegistry.trim()) {
      setError("Ju lutem plotësoni të gjitha fushat e detyrueshme")
      return
    }
    if (!newStudentTrackingNumber) {
      setError("Numri i studentit po gjenerohet. Prisni një moment dhe provoni përsëri.")
      return
    }
    if (!isValidStudentNumberFormat(newRegistry)) {
      setError("Numri i studentit duhet të jetë në formatin ST + 3 ose 4 shifra (p.sh. ST001 ose ST1001).")
      return
    }
    if (!generatedNewRegistryNumber) {
      setError("Numri i regjistrit nuk mund te gjenerohet pa numrin e studentit, emrin dhe vitet e studimit.")
      return
    }
    if (!newStudentStartYearNumber) {
      setError("Ju lutem zgjidhni vitin e fillimit të studimit.")
      return
    }
    const computedStartYear = newStudentStartYearNumber
    const newY2 = parseStudentYear(newYear2StartYear) || computedStartYear + 1
    const newY3 = parseStudentYear(newYear3StartYear) || newY2 + 1
    const computedEndYear = newY3 + 1
    const validToDate = `${computedEndYear}-09`
    setAddingStudent(true)
    try {
      await addUser({
        firstName: newFirstName.trim(),
        lastName: newLastName.trim(),
        email: newEmail.trim(),
        email2: newEmail2.trim() || null,
        memberRegistryNumber: generatedNewRegistryNumber,
        role: "Student",
        phone: newPhone.trim() || undefined,
        phonePrefix: newPhonePrefix.trim() || "+355",
        phoneNumber: newPhone.trim() || undefined,
        mentorId: newMentorId,
        validUntilMonth: validToDate,
        studentTrackingNumber: newStudentTrackingNumber,
        studentNumber: newRegistry.trim().toUpperCase(),
        studentStartYear: computedStartYear,
        studentEndYear: computedEndYear,
        studentYear2StartYear: parseStudentYear(newYear2StartYear) || null,
        studentYear3StartYear: parseStudentYear(newYear3StartYear) || null,
        company: newCompany.trim() || null,
        district: newDistrict.trim() || null,
        cpdHoursCompleted: 0,
        cpdHoursRequired: 0,
      })
      setNewFirstName("")
      setNewLastName("")
      setNewEmail("")
      setNewEmail2("")
      setNewStudentTrackingNumber(null)
      setNewRegistry("")
      setNewPhone("")
      setNewPhonePrefix("+355")
      setNewStudentStartYear(getDefaultStudentStartYear())
      setNewStudentEndYear(getDefaultStudentEndYear())
      setNewYear2StartYear("")
      setNewYear3StartYear("")
      setNewMentorId("")
      setNewCompany("")
      setNewDistrict("")
      setError("")
      setShowAddForm(false)
      await loadManageableStudents()
    } catch (e: any) {
      setError(e?.message ?? "Gabim gjatë shtimit të studentit")
    } finally {
      setAddingStudent(false)
    }
  }

  function openEdit(student: AppUser) {
    setEditingStudent(student)
    setEditFirstName(student.firstName)
    setEditLastName(student.lastName)
    setEditEmail(student.email)
    setEditEmail2(student.email2 ?? "")
    setEditStudentTrackingNumber(student.studentTrackingNumber ?? parseStudentTrackingNumber(getPreferredStudentNumber(student)))
    setEditRegistry(getPreferredStudentNumber(student))
    const { prefix: parsedPrefix, number: parsedNumber } = splitPhone(student.phone)
    setEditPhonePrefix(parsedPrefix)
    setEditPhone(parsedNumber)
    setEditStudentStartYear(student.studentStartYear ? String(student.studentStartYear) : "")
    const startYr = student.studentStartYear
    setEditStudentEndYear(startYr ? String(startYr + 3) : (student.studentEndYear ? String(student.studentEndYear) : ""))
    setEditYear2StartYear(student.studentYear2StartYear ? String(student.studentYear2StartYear) : "")
    setEditYear3StartYear(student.studentYear3StartYear ? String(student.studentYear3StartYear) : "")
    setEditMentorId(student.mentorId ?? "")
    setEditCompany(student.company ?? "")
    setEditDistrict(student.district ?? "")
    setEditIsActive(student.accountIsActive !== false)
    setEditError("")
  }

  function openHistory(student: AppUser) {
    setHistoryStudent(student)
  }

  function openDeleteStudent(student: AppUser) {
    setDeletingStudent(student)
    setDeleteStudentError("")
  }

  function closeDeleteStudent() {
    if (isDeletingStudent) return
    setDeletingStudent(null)
    setDeleteStudentError("")
  }

  function closeHistory() {
    setHistoryStudent(null)
  }

  function closeEdit() {
    setEditingStudent(null)
    setEditError("")
  }

  async function handleUpdateStudent() {
    if (!isAdmin || !editingStudent) return

    if (!editFirstName.trim() || !editLastName.trim() || !editEmail.trim() || !editRegistry.trim()) {
      setEditError("Ju lutem plotësoni të gjitha fushat e detyrueshme")
      return
    }
    if (!editStudentTrackingNumber) {
      setEditError("Numri i studentit mungon.")
      return
    }
    if (!isValidStudentNumberFormat(editRegistry)) {
      setEditError("Numri i studentit duhet të jetë në formatin ST + 3 ose 4 shifra (p.sh. ST001 ose ST1001).")
      return
    }
    if (!generatedEditRegistryNumber) {
      setEditError("Numri i regjistrit nuk mund te gjenerohet pa numrin e studentit, emrin dhe vitet e studimit.")
      return
    }

    if (!editStudentStartYearNumber) {
      setEditError("Ju lutem zgjidhni vitin e fillimit të studimit.")
      return
    }
    setIsSavingEdit(true)
    setEditError("")
    try {
      await updateMember(editingStudent.id, {
        firstName: editFirstName.trim(),
        lastName: editLastName.trim(),
        email: editEmail.trim(),
        email2: editEmail2.trim() || null,
        memberRegistryNumber: generatedEditRegistryNumber,
        phone: editPhone.trim() || undefined,
        phonePrefix: editPhonePrefix.trim() || "+355",
        phoneNumber: editPhone.trim() || undefined,
        role: "Student",
        mentorId: editMentorId,
        validUntilMonth: toStudentValidUntilMonth(editStudentEndYearNumber),
        studentTrackingNumber: editStudentTrackingNumber,
        studentNumber: editRegistry.trim().toUpperCase(),
        studentStartYear: editStudentStartYearNumber,
        studentEndYear: editStudentEndYearNumber,
        studentYear2StartYear: parseStudentYear(editYear2StartYear) || null,
        studentYear3StartYear: parseStudentYear(editYear3StartYear) || null,
        company: editCompany.trim() || null,
        district: editDistrict.trim() || null,
        cpdHoursRequired: editingStudent.cpdHoursRequired,
        isActive: editIsActive,
      })
      await loadManageableStudents()
      closeEdit()
    } catch (e: any) {
      setEditError(e?.message ?? "Gabim gjatë ruajtjes së studentit")
    } finally {
      setIsSavingEdit(false)
    }
  }

  async function handleDeleteStudent() {
    if (!isAdmin || !deletingStudent) return

    setIsDeletingStudent(true)
    setDeleteStudentError("")

    try {
      await deleteUser(deletingStudent.id)
      await loadManageableStudents()

      if (editingStudent?.id === deletingStudent.id) {
        setEditingStudent(null)
        setEditError("")
      }
      if (historyStudent?.id === deletingStudent.id) {
        setHistoryStudent(null)
      }
      if (scheduleStudent?.id === deletingStudent.id) {
        closeScheduleModal()
      }
      if (endingStazhStudent?.id === deletingStudent.id) {
        closeEndStazhModal()
      }

      setDeletingStudent(null)
    } catch (e: any) {
      setDeleteStudentError(e?.message ?? "Gabim gjatë fshirjes së studentit.")
    } finally {
      setIsDeletingStudent(false)
    }
  }

  async function openScheduleModal(student: AppUser) {
    if (student.isActive === false) {
      return
    }

    setScheduleStudent(student)
    setScheduleRows([createUniqueScheduleRow([])])
    setScheduleError("")
    setQuickWeekStartDate(toDateInputValue(new Date()))
    setQuickWeekStartTime("09:00")
    setQuickWeekEndTime("16:00")
    setQuickWeekNotes("")
    setScheduleLoading(true)

    try {
      const response = (await fetchApi(`/StudentTraining/students/${student.id}/schedule`)) as StudentTrainingCalendarResponse
      const mentorScopedSessions = response.sessions.filter((s) => {
        const isPending = (s.attendanceStatus ?? "").toLowerCase() === "pending"
        if (!isPending) return false
        if (!student.mentorId) return true
        return s.mentorId === student.mentorId
      })

      const dedupedByDate = new Map<string, StudentTrainingSession>()
      for (const session of mentorScopedSessions) {
        if (!dedupedByDate.has(session.date)) {
          dedupedByDate.set(session.date, session)
        }
      }

      const rows = Array.from(dedupedByDate.values())
        .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
        .map((s) =>
          createScheduleRow({
            date: s.date,
            startTime: s.startTime,
            endTime: s.endTime,
            notes: s.notes ?? "",
          })
        )

      const effectiveRows = rows.length > 0 ? rows : [createUniqueScheduleRow([])]
      setScheduleRows(effectiveRows)
      setQuickWeekStartDate(effectiveRows[0]?.date ?? toDateInputValue(new Date()))
    } catch {
      setScheduleRows([createUniqueScheduleRow([])])
    } finally {
      setScheduleLoading(false)
    }
  }

  function closeScheduleModal() {
    setScheduleStudent(null)
    setScheduleRows([])
    setScheduleError("")
    setScheduleLoading(false)
    setScheduleSaving(false)
    setQuickWeekStartDate(toDateInputValue(new Date()))
    setQuickWeekStartTime("09:00")
    setQuickWeekEndTime("16:00")
    setQuickWeekNotes("")
  }

  function updateScheduleRow(rowId: string, field: keyof Omit<ScheduleRow, "id">, value: string) {
    if (field === "date") {
      const normalizedDate = value.trim()
      if (normalizedDate) {
        const exists = scheduleRows.some((row) => row.id !== rowId && row.date.trim() === normalizedDate)
        if (exists) {
          setScheduleError("Nuk mund të zgjidhni të njëjtën datë dy herë.")
          return
        }
      }

      if (scheduleError.includes("të njëjtën datë")) {
        setScheduleError("")
      }
    }

    setScheduleRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, [field]: value } : row)))
  }

  function addScheduleRow() {
    if (scheduleError.includes("të njëjtën datë")) {
      setScheduleError("")
    }
    setScheduleRows((prev) => [...prev, createUniqueScheduleRow(prev)])
  }

  function removeScheduleRow(rowId: string) {
    setScheduleRows((prev) => {
      const next = prev.filter((row) => row.id !== rowId)
      return next.length > 0 ? next : [createUniqueScheduleRow([])]
    })
  }

  function addScheduleWeek() {
    if (!quickWeekStartDate || !quickWeekStartTime.trim() || !quickWeekEndTime.trim()) {
      setScheduleError("Plotësoni datën dhe orarin për javën.")
      return
    }

    const anchor = new Date(`${quickWeekStartDate}T00:00:00`)
    if (Number.isNaN(anchor.getTime())) {
      setScheduleError("Data e javës nuk është e vlefshme.")
      return
    }

    const monday = toWeekMonday(anchor)
    const usedDates = new Set(scheduleRows.map((row) => row.date.trim()).filter(Boolean))
    const rowsToAdd: ScheduleRow[] = []

    for (let i = 0; i < 5; i++) {
      const date = new Date(monday)
      date.setDate(monday.getDate() + i)
      const dateValue = toDateInputValue(date)
      if (usedDates.has(dateValue)) continue

      rowsToAdd.push(
        createScheduleRow({
          date: dateValue,
          startTime: quickWeekStartTime.trim(),
          endTime: quickWeekEndTime.trim(),
          notes: quickWeekNotes.trim(),
        })
      )
      usedDates.add(dateValue)
    }

    if (rowsToAdd.length === 0) {
      setScheduleError("Datat e kësaj jave ekzistojnë tashmë në orar.")
      return
    }

    setScheduleError("")
    setScheduleRows((prev) =>
      [...prev, ...rowsToAdd].sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
    )
  }

  async function saveSchedule() {
    if (!scheduleStudent) return
    if (scheduleStudent.isActive === false) {
      setScheduleError("Studenti është jo aktiv. Nuk lejohet shtimi i datave.")
      return
    }

    const duplicateDate = scheduleDuplicateDateSet.values().next().value as string | undefined
    if (duplicateDate) {
      setScheduleError(`Data ${duplicateDate} është zgjedhur më shumë se një herë.`)
      return
    }

    const payloadSessions = scheduleRows
      .map((row) => ({
        date: row.date.trim(),
        startTime: row.startTime.trim(),
        endTime: row.endTime.trim(),
        notes: row.notes.trim() || null,
      }))
      .filter((row) => row.date && row.startTime && row.endTime)

    const seenDates = new Set<string>()
    for (const session of payloadSessions) {
      if (seenDates.has(session.date)) {
        setScheduleError(`Data ${session.date} është zgjedhur më shumë se një herë.`)
        return
      }
      seenDates.add(session.date)
    }

    setScheduleSaving(true)
    setScheduleError("")
    try {
      await fetchApi(`/StudentTraining/students/${scheduleStudent.id}/schedule`, {
        method: "PUT",
        body: JSON.stringify({
          mentorId: scheduleStudent.mentorId ?? null,
          sessions: payloadSessions,
        }),
      })
      await loadManageableStudents()
      closeScheduleModal()
    } catch (e: any) {
      setScheduleError(e?.message ?? "Gabim gjatë ruajtjes së orarit.")
    } finally {
      setScheduleSaving(false)
    }
  }

  // ── Module-topic attendance handlers ──────────────────────────────────────

  async function loadAttModules() {
    setAttModulesLoading(true)
    try {
      const data = (await fetchApi("/StudentModules")) as StudentModuleResponse[]
      setAttModules(data)
    } catch { /* ignore */ } finally {
      setAttModulesLoading(false)
    }
  }

  async function loadAttModuleDetail(moduleId: string) {
    setAttModuleDetailLoading(true)
    setAttError("")
    try {
      const data = (await fetchApi(`/StudentModules/${moduleId}`)) as StudentModuleDetailResponse
      setAttModuleDetail(data)
      // Auto-select first topic with a date
      const sorted = [...data.topics].filter(t => t.scheduledDate).sort((a, b) => (a.scheduledDate ?? "").localeCompare(b.scheduledDate ?? ""))
      if (sorted.length > 0 && !attSelectedTopicId) {
        setAttSelectedTopicId(sorted[0].id)
      }
    } catch (e: any) {
      setAttError(e?.message ?? "Gabim gjatë ngarkimit.")
    } finally {
      setAttModuleDetailLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab !== "attendance") return
    void loadAttModules()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  useEffect(() => {
    if (!attSelectedModuleId) { setAttModuleDetail(null); setAttSelectedTopicId(""); return }
    // Only reset topic if it doesn't belong to the newly selected module
    const moduleTopicIds = attModules.find(m => m.id === attSelectedModuleId)?.topics.map(t => t.id) ?? []
    if (attSelectedTopicId && !moduleTopicIds.includes(attSelectedTopicId)) {
      setAttSelectedTopicId("")
    }
    void loadAttModuleDetail(attSelectedModuleId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attSelectedModuleId])

  async function handleMarkAttendance(topicId: string, studentId: string) {
    setAttUpdatingKey(`${topicId}-${studentId}-mark`)
    try {
      await fetchApi(`/StudentModules/topics/${topicId}/attendance/${studentId}`, { method: "POST" })
      if (attSelectedModuleId) await loadAttModuleDetail(attSelectedModuleId)
    } catch (e: any) {
      setAttError(e?.message ?? "Gabim gjatë regjistrimit të prezencës.")
    } finally { setAttUpdatingKey(null) }
  }

  async function handleRemoveAttendance(topicId: string, studentId: string) {
    setAttUpdatingKey(`${topicId}-${studentId}-remove`)
    try {
      await fetchApi(`/StudentModules/topics/${topicId}/attendance/${studentId}`, { method: "DELETE" })
      if (attSelectedModuleId) await loadAttModuleDetail(attSelectedModuleId)
    } catch (e: any) {
      setAttError(e?.message ?? "Gabim gjatë heqjes së prezencës.")
    } finally { setAttUpdatingKey(null) }
  }

  async function handleAttTopicQr(topicId: string) {
    setAttTopicQrLoading(true)
    setAttTopicQrToken("")
    setAttShowQrModal(true)
    try {
      const result = (await fetchApi(`/StudentModules/topics/${topicId}/qr`)) as { topicId: string; token: string }
      setAttTopicQrToken(result.token)
    } catch { /* ignore */ } finally { setAttTopicQrLoading(false) }
  }

  function openEndStazhModal(student: AppUser) {
    setEndingStazhStudent(student)
    setEndingStazhRating(5)
    setEndingStazhComment("")
    setEndingStazhError("")
  }

  function closeEndStazhModal() {
    if (endingStazhSaving) return
    setEndingStazhStudent(null)
    setEndingStazhError("")
  }

  async function submitEndStazh() {
    if (!endingStazhStudent) return

    setEndingStazhSaving(true)
    setEndingStazhError("")
    try {
      await fetchApi("/StudentTraining/stazh/end", {
        method: "POST",
        body: JSON.stringify({
          studentId: endingStazhStudent.id,
          mentorFeedbackRating: endingStazhRating,
          mentorFeedbackComment: endingStazhComment.trim() || null,
        }),
      })

      await loadManageableStudents()
      closeEndStazhModal()
    } catch (e: any) {
      setEndingStazhError(e?.message ?? "Gabim gjatë mbylljes së stazhit.")
    } finally {
      setEndingStazhSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            {activeTab === "attendance" ? (
              <UserCheck className="h-5 w-5 text-primary" />
            ) : activeTab === "modules" ? (
              <Library className="h-5 w-5 text-primary" />
            ) : (
              <GraduationCap className="h-5 w-5 text-primary" />
            )}
            {activeTab === "attendance" ? "Prezenca" : activeTab === "modules" ? "Modulet e Studentëve" : "Studentë"}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {activeTab === "attendance"
              ? "Menaxhimi i prezencës dhe skanimit QR për studentët"
              : activeTab === "modules"
                ? "Menaxhimi i moduleve të trajnimit për studentët"
                : "Menaxhimi i studentëve dhe orarit të stazhit"}
          </p>
        </div>
        {isAdmin && activeTab === "students" && (
          <Button size="sm" className="gap-2 shrink-0" onClick={() => setShowAddForm(true)}>
            <UserPlus className="h-4 w-4" /> Shto Student
          </Button>
        )}
        {isAdmin && activeTab === "modules" && (
          <Button size="sm" className="gap-2 shrink-0" onClick={() => setShowAddModuleForm(true)}>
            <Plus className="h-4 w-4" /> Shto Modul
          </Button>
        )}
      </div>

      {!forcedTab && (
        <div className="mb-6 grid w-full grid-cols-3 gap-2 rounded-2xl border border-border bg-card p-1.5 sm:w-fit">
          <button
            onClick={() => setActiveTab("modules")}
            className={cn(
              "rounded-xl px-3 py-2 text-sm font-medium transition-all",
              activeTab === "modules"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            Modulet
          </button>
          <button
            onClick={() => setActiveTab("students")}
            className={cn(
              "rounded-xl px-3 py-2 text-sm font-medium transition-all",
              activeTab === "students"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            Studentët
          </button>
          <button
            onClick={() => setActiveTab("attendance")}
            className={cn(
              "rounded-xl px-3 py-2 text-sm font-medium transition-all",
              activeTab === "attendance"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            Prezenca
          </button>
        </div>
      )}

      {activeTab === "students" && (
        <>
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card px-5 py-3 flex items-center gap-3">
              <GraduationCap className="h-5 w-5 text-blue-400" />
              <div>
                <p className="text-xl font-bold text-foreground">{students.length}</p>
                <p className="text-xs text-muted-foreground">Gjithsej Studentë</p>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card px-5 py-3 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-400" />
              <div>
                <p className="text-xl font-bold text-foreground">
                  {students.filter((s) => s.isActive !== false).length}
                </p>
                <p className="text-xs text-muted-foreground">Aktiv</p>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card px-5 py-3 flex items-center gap-3">
              <BookOpen className="h-5 w-5 text-amber-400" />
              <div>
                <p className="text-xl font-bold text-foreground">
                  {students.reduce((sum, student) => sum + (studentStats[student.id]?.attended ?? 0), 0)}
                </p>
                <p className="text-xs text-muted-foreground">Prezenca Totale</p>
              </div>
            </div>
          </div>

          <div className="mb-5 flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Kërko studentë..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setCurrentPage(1)
                }}
                className="pl-9 h-9"
              />
            </div>
            <span className="w-full text-xs text-muted-foreground sm:ml-auto sm:w-auto">
              {filteredStudents.length} nga {students.length} studentë
            </span>
          </div>

          {isAdmin && showAddForm && (
            <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 px-4 py-8 backdrop-blur-sm">
              <div className="w-full max-w-3xl rounded-xl border border-border bg-card shadow-xl">
                <div className="flex items-center justify-between border-b border-border px-6 py-4">
                  <h3 className="text-base font-semibold text-foreground">Shto Student të Ri</h3>
                  <button
                    onClick={() => { setShowAddForm(false); setError(""); setStudentTrackingLoading(false) }}
                    disabled={addingStudent}
                    className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex flex-col gap-4 p-6">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <Label>Numri i Studentit (Tracking) *</Label>
                      <Input
                        value={newRegistry}
                        readOnly
                        placeholder="ST001"
                        className="font-mono bg-muted/40"
                      />
                      <p className="text-xs text-muted-foreground">
                        {studentTrackingLoading ? "Po gjenerohet automatikisht nga databaza..." : "Numri bazë ST### gjenerohet automatikisht nga databaza."}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Kodi i Regjistrit *</Label>
                      <Input value={generatedNewRegistryNumber} readOnly placeholder="ST001-INV2628" className="font-mono bg-muted/40" />
                      <p className="text-xs text-muted-foreground">Gjenerohet nga numri i studentit, emri dhe vitet e studimit.</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Emri *</Label>
                      <Input value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)} placeholder="Ana" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Mbiemri *</Label>
                      <Input value={newLastName} onChange={(e) => setNewLastName(e.target.value)} placeholder="Krasniqi" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Email *</Label>
                      <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="ana.krasniqi@ieka.al" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Email 2</Label>
                      <Input type="email" value={newEmail2} onChange={(e) => setNewEmail2(e.target.value)} placeholder="ana.personal@example.com" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Telefon</Label>
                      <div className="flex gap-2">
                        <Input value={newPhonePrefix} onChange={(e) => setNewPhonePrefix(e.target.value)} className="w-20" placeholder="+355" />
                        <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="69 123 4567" className="flex-1" />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Mentori</Label>
                      <select
                        value={newMentorId}
                        onChange={(e) => setNewMentorId(e.target.value)}
                        className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">Zgjidh mentorin</option>
                        {mentors.map((mentor) => (
                          <option key={mentor.id} value={mentor.id}>
                            {mentor.firstName} {mentor.lastName} ({mentor.memberRegistryNumber})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Shoqëria</Label>
                      <Input value={newCompany} onChange={(e) => setNewCompany(e.target.value)} placeholder="Shoqëria ku është i angazhuar studenti" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Rrethi</Label>
                      <Input value={newDistrict} onChange={(e) => setNewDistrict(e.target.value)} placeholder="Tiranë" />
                    </div>
                  </div>

                  {/* Year Section */}
                  <div className="mt-5 rounded-lg border border-primary/20 bg-primary/5 p-4">
                    <h4 className="text-sm font-semibold text-foreground mb-3">Vitet e Studimit *</h4>
                    <div className="space-y-1.5">
                      {/* Year 1 - start year selector inline */}
                      <div className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">1</span>
                        <span className="text-xs font-medium text-foreground">Viti i Parë</span>
                        <div className="ml-auto flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">Shtator</span>
                          <select
                            value={newStudentStartYear}
                            onChange={(e) => {
                              setNewStudentStartYear(e.target.value)
                              const parsed = parseStudentYear(e.target.value)
                              if (parsed) {
                                setNewStudentEndYear(String(parsed + 3))
                                const currentY2 = parseStudentYear(newYear2StartYear)
                                if (currentY2 && currentY2 <= parsed) setNewYear2StartYear("")
                                const currentY3 = parseStudentYear(newYear3StartYear)
                                if (currentY3 && currentY3 <= parsed) setNewYear3StartYear("")
                              }
                            }}
                            className="h-7 rounded border border-input bg-transparent px-1.5 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                          >
                            <option value="">Zgjidh</option>
                            {STUDENT_YEAR_OPTIONS.map((year) => (
                              <option key={`new-start-${year}`} value={year}>{year}</option>
                            ))}
                          </select>
                          {newStudentStartYearNumber && (() => {
                            return <span className="text-xs text-muted-foreground">– Shtator {newStudentStartYearNumber + 1}</span>
                          })()}
                        </div>
                      </div>

                      {newStudentStartYearNumber && (() => {
                        const y1 = newStudentStartYearNumber
                        const y2 = parseStudentYear(newYear2StartYear) || y1 + 1
                        const y3 = parseStudentYear(newYear3StartYear) || y2 + 1
                        const y2Options = STUDENT_YEAR_OPTIONS.filter((yr) => Number(yr) > y1 + 1)
                        const y3Options = STUDENT_YEAR_OPTIONS.filter((yr) => Number(yr) > y2 + 1)
                        return (
                          <>
                            {/* Year 2 - editable, must be > Y1 */}
                            <div className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5">
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">2</span>
                              <span className="text-xs font-medium text-foreground">Viti i Dytë</span>
                              <div className="ml-auto flex items-center gap-1">
                                <span className="text-xs text-muted-foreground">Shtator</span>
                                <select
                                  value={newYear2StartYear || ""}
                                  onChange={(e) => {
                                    const newY2 = e.target.value
                                    setNewYear2StartYear(newY2)
                                    const newY2Num = parseStudentYear(newY2) || y1 + 1
                                    const currentY3 = parseStudentYear(newYear3StartYear)
                                    if (currentY3 && currentY3 <= newY2Num) {
                                      setNewYear3StartYear("")
                                    }
                                  }}
                                  className="h-7 rounded border border-input bg-transparent px-1.5 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                                >
                                  <option value="">{y1 + 1}</option>
                                  {y2Options.map((yr) => (
                                    <option key={`new-y2-${yr}`} value={yr}>{yr}</option>
                                  ))}
                                </select>
                                <span className="text-xs text-muted-foreground">– Shtator {y2 + 1}</span>
                              </div>
                            </div>
                            {/* Year 3 - editable, must be > Y2 */}
                            <div className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5">
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">3</span>
                              <span className="text-xs font-medium text-foreground">Viti i Tretë</span>
                              <div className="ml-auto flex items-center gap-1">
                                <span className="text-xs text-muted-foreground">Shtator</span>
                                <select
                                  value={newYear3StartYear || ""}
                                  onChange={(e) => setNewYear3StartYear(e.target.value)}
                                  className="h-7 rounded border border-input bg-transparent px-1.5 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                                >
                                  <option value="">{y2 + 1}</option>
                                  {y3Options.map((yr) => (
                                    <option key={`new-y3-${yr}`} value={yr}>{yr}</option>
                                  ))}
                                </select>
                                <span className="text-xs text-muted-foreground">– Shtator {y3 + 1}</span>
                              </div>
                            </div>
                          </>
                        )
                      })()}
                    </div>

                    {newStudentStartYearNumber && (() => {
                      const noteY2 = parseStudentYear(newYear2StartYear) || newStudentStartYearNumber + 1
                      const noteY3 = parseStudentYear(newYear3StartYear) || noteY2 + 1
                      return (
                        <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-50 dark:bg-amber-500/5 px-3 py-2.5">
                          <p className="text-xs text-amber-800 dark:text-amber-300">
                            <strong>Shënim:</strong> Studenti do të jetë i vlefshëm nga{" "}
                            <strong>Shtator {newStudentStartYearNumber}</strong> deri në{" "}
                            <strong>Shtator {noteY3 + 1}</strong>.
                            Pas kësaj periudhe, llogaria e studentit do të skadojë automatikisht.
                          </p>
                        </div>
                      )
                    })()}
                  </div>

                  {error && <p className="text-sm text-destructive">{error}</p>}
                </div>
                <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
                  <Button
                    variant="ghost"
                    onClick={() => { setShowAddForm(false); setError("") }}
                    disabled={addingStudent}
                  >
                    Anulo
                  </Button>
                  <Button onClick={handleAdd} disabled={addingStudent || studentTrackingLoading}>
                    {addingStudent ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Duke shtuar...
                      </>
                    ) : (
                      "Shto Studentin"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {studentsLoading ? (
            <div className="rounded-xl border border-border bg-card px-5 py-8 text-sm text-muted-foreground">
              Duke ngarkuar studentët...
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
              <GraduationCap className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                {search ? "Asnjë student nuk përputhet me kërkimin" : "Asnjë student akoma"}
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {pagedStudents.map((s) => {
                  const st = studentStats[s.id]
                  const attendanceRate = st && st.total > 0 ? Math.round((st.attended / st.total) * 100) : null
                  const isInactiveStudent = s.isActive === false
                  const mentorName = s.mentorId ? mentorNameById.get(s.mentorId) ?? "—" : "—"

                  return (
                    <div key={s.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-sm font-semibold text-blue-500">
                          {s.firstName[0]}{s.lastName[0]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-foreground">{s.firstName} {s.lastName}</p>
                              <p className="truncate text-xs text-muted-foreground">{s.email}</p>
                            </div>
                            <span className={cn(
                              "rounded-full px-2.5 py-1 text-[11px] font-medium",
                              s.isActive !== false ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"
                            )}>
                              {s.isActive !== false ? "Aktiv" : "Jo aktiv"}
                            </span>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <code className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-mono text-foreground">
                              {s.memberRegistryNumber}
                            </code>
                            {isAdmin && (
                              <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                                Mentori: {mentorName}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                              Prezenca
                            </span>
                            <span className="text-xs font-semibold text-foreground">
                              {attendanceRate !== null ? `${attendanceRate}%` : "—"}
                            </span>
                          </div>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
                            <div
                              className={cn(
                                "h-full rounded-full",
                                attendanceRate === null
                                  ? "bg-border"
                                  : attendanceRate >= 80
                                    ? "bg-green-500"
                                    : attendanceRate >= 50
                                      ? "bg-amber-500"
                                      : "bg-red-500"
                              )}
                              style={{ width: `${attendanceRate ?? 0}%` }}
                            />
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {st ? `${st.attended}/${st.total} seanca` : "Pa seanca"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {/* Orari disabled for now — only modules are active */}
                        {isAdmin && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="min-w-[5.5rem] flex-1 gap-1.5"
                            onClick={() => openHistory(s)}
                          >
                            <BookOpen className="h-3.5 w-3.5" />
                            Historik
                          </Button>
                        )}
                        {isAdmin && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="min-w-[5.5rem] flex-1 gap-1.5"
                            onClick={() => openEdit(s)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Modifiko
                          </Button>
                        )}
                        {(isAdmin || isMentor) && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="min-w-[5.5rem] flex-1 gap-1.5"
                            onClick={() => openEndStazhModal(s)}
                          >
                            <StopCircle className="h-3.5 w-3.5" />
                            Mbyll
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
                <PaginationBar
                  totalItems={filteredStudents.length}
                  pageSize={pageSize}
                  currentPage={currentPage}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1) }}
                  className="rounded-2xl border border-border bg-card px-4 py-4"
                />
              </div>

              <div className="hidden overflow-x-auto rounded-xl border border-border bg-card md:block">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <SortableTh label="Studenti" sortKey="name" current={sortKey} dir={sortDir} onSort={handleSort} />
                      <th className="hidden px-4 py-3 text-xs font-medium text-muted-foreground lg:table-cell">Tracking</th>
                      <th className="hidden px-4 py-3 text-xs font-medium text-muted-foreground md:table-cell">Email</th>
                      {isAdmin && (
                        <SortableTh label="Mentori" sortKey="mentor" current={sortKey} dir={sortDir} onSort={handleSort} />
                      )}
                      <SortableTh label="Prezencë" sortKey="attendance" current={sortKey} dir={sortDir} onSort={handleSort} />
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Statusi</th>
                      <th className="w-[220px] px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedStudents.map((s) => {
                      const st = studentStats[s.id]
                      const attendanceRate = st && st.total > 0 ? Math.round((st.attended / st.total) * 100) : null
                      const isInactiveStudent = s.isActive === false

                      return (
                        <tr key={s.id} className="border-b border-border transition-colors last:border-0 hover:bg-muted/20">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-xs font-semibold text-blue-500">
                                {s.firstName[0]}{s.lastName[0]}
                              </div>
                              <div>
                                <p className="font-medium text-foreground">{s.firstName} {s.lastName}</p>
                                <p className="text-xs text-muted-foreground lg:hidden">
                                  {getStudentTrackingCode(s) || "—"} • {s.memberRegistryNumber}
                                </p>
                                <p className="hidden text-xs text-muted-foreground lg:block">{s.memberRegistryNumber}</p>
                              </div>
                            </div>
                          </td>
                          <td className="hidden px-4 py-3 lg:table-cell">
                            <code className="rounded bg-blue-500/10 px-1.5 py-0.5 text-xs font-mono text-blue-700">
                              {getStudentTrackingCode(s) || "—"}
                            </code>
                          </td>
                          <td className="hidden px-4 py-3 text-xs text-muted-foreground md:table-cell">{s.email}</td>
                          {isAdmin && (
                            <td className="px-4 py-3 text-xs text-muted-foreground">
                              {s.mentorId ? mentorNameById.get(s.mentorId) ?? "—" : "—"}
                            </td>
                          )}
                          <td className="px-4 py-3">
                            {attendanceRate !== null ? (
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 w-14 overflow-hidden rounded-full bg-border">
                                  <div
                                    className={cn(
                                      "h-full rounded-full",
                                      attendanceRate >= 80 ? "bg-green-500" : attendanceRate >= 50 ? "bg-amber-500" : "bg-red-500"
                                    )}
                                    style={{ width: `${attendanceRate}%` }}
                                  />
                                </div>
                                <span className="text-xs text-muted-foreground">{st!.attended}/{st!.total}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn(
                              "rounded px-2 py-0.5 text-xs font-medium",
                              s.isActive !== false ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-600"
                            )}>
                              {s.isActive !== false ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              {/* Orari disabled for now */}
                              {isAdmin && (
                                <button
                                  type="button"
                                  onClick={() => openHistory(s)}
                                  className="inline-flex items-center rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                                  title="Shfaq historikun e studentit"
                                >
                                  <BookOpen className="h-3.5 w-3.5" />
                                </button>
                              )}
                              {isAdmin && (
                                <button
                                  type="button"
                                  onClick={() => openEdit(s)}
                                  className="inline-flex items-center rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                                  title="Modifiko studentin"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                              )}
                              {(isAdmin || isMentor) && (
                                <button
                                  type="button"
                                  onClick={() => openEndStazhModal(s)}
                                  className="inline-flex items-center rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                                  title="Mbyll stazhin"
                                >
                                  <StopCircle className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <PaginationBar
                  totalItems={filteredStudents.length}
                  pageSize={pageSize}
                  currentPage={currentPage}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1) }}
                  className="border-t border-border px-4"
                />
              </div>
            </>
          )}
        </>
      )}

      {activeTab === "modules" && isAdmin && (
        <>
          {showAddModuleForm && (
            <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 px-4 py-8 backdrop-blur-sm">
              <div className="w-full max-w-3xl rounded-xl border border-border bg-card shadow-xl">
                <div className="flex items-center justify-between border-b border-border px-6 py-4">
                  <h3 className="text-base font-semibold text-foreground">Shto Modul të Ri</h3>
                  <button
                    onClick={() => { setShowAddModuleForm(false); setModuleError("") }}
                    disabled={moduleSaving}
                    className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="p-6">

                  {/* Year Grade Selection */}
                  <div className="mb-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-foreground">Modul për vitin e:</span>
                      {([1, 2, 3] as YearGrade[]).map((grade) => {
                        const selected = moduleYearGrade === grade
                        const labels = { 1: "Parë", 2: "Dytë", 3: "Tretë" } as const
                        return (
                          <button
                            key={grade}
                            type="button"
                            onClick={() => setModuleYearGrade(grade)}
                            className={cn(
                              "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-all",
                              selected
                                ? "border-primary bg-primary/10 font-medium text-primary"
                                : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                            )}
                          >
                            <div className={cn(
                              "flex h-4 w-4 items-center justify-center rounded border transition-colors",
                              selected
                                ? "border-primary bg-primary"
                                : "border-muted-foreground/40 bg-transparent"
                            )}>
                              {selected && (
                                <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                              )}
                            </div>
                            {labels[grade]}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Title and Location */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-5">
                    <div className="flex flex-col gap-2">
                      <Label>Titulli *</Label>
                      <Input
                        value={moduleTitle}
                        onChange={(e) => setModuleTitle(e.target.value)}
                        placeholder="Titulli i modulit..."
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Vendndodhja</Label>
                      <Input
                        value={moduleLocation}
                        onChange={(e) => setModuleLocation(e.target.value)}
                        placeholder="p.sh. Salla IEKA, Tiranë"
                      />
                    </div>
                  </div>

                  <p className="mb-5 text-xs text-muted-foreground">Temat, lektorët, datat dhe dokumentet shtohen brenda modulit pas krijimit.</p>

                  {/* Student Preview - Expandable List */}
                  <div className="mb-4 rounded-xl border border-border overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setModuleStudentPreviewExpanded((v) => !v)}
                      className="flex w-full items-center justify-between bg-muted/30 px-4 py-3 text-left"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Studentët e Vitit të {moduleYearGrade === 1 ? "Parë" : moduleYearGrade === 2 ? "Dytë" : "Tretë"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {moduleStudentPreviewLoading
                            ? "Duke ngarkuar..."
                            : `${moduleStudentPreview.filter(s => !moduleExcludedStudentIds.has(s.studentId)).length + moduleAdditionalStudents.length} studentë do të njoftohen`}
                        </p>
                      </div>
                      <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", moduleStudentPreviewExpanded && "rotate-90")} />
                    </button>
                    {moduleStudentPreviewExpanded && (
                      <div className="border-t border-border">
                        {moduleStudentPreviewLoading ? (
                          <div className="px-4 py-3 text-sm text-muted-foreground">Duke ngarkuar studentët...</div>
                        ) : moduleStudentPreview.length === 0 && moduleAdditionalStudents.length === 0 ? (
                          <div className="px-4 py-3 text-sm text-muted-foreground">
                            Nuk ka studentë aktiv për {formatYearGradeLabel(moduleYearGrade)}.
                          </div>
                        ) : (
                          <div className="divide-y divide-border max-h-[250px] overflow-y-auto">
                            {moduleStudentPreview.map((student) => {
                              const isExcluded = moduleExcludedStudentIds.has(student.studentId)
                              return (
                                <div key={student.studentId} className={cn("flex items-center gap-3 px-4 py-2.5", isExcluded && "opacity-40")}>
                                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-[10px] font-semibold text-blue-500">
                                    {student.firstName[0]}{student.lastName[0]}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className={cn("text-sm font-medium text-foreground truncate", isExcluded && "line-through")}>{student.firstName} {student.lastName}</p>
                                    <p className="text-xs text-muted-foreground truncate">{student.email}</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setModuleExcludedStudentIds(prev => {
                                        const next = new Set(prev)
                                        if (next.has(student.studentId)) next.delete(student.studentId)
                                        else next.add(student.studentId)
                                        return next
                                      })
                                    }}
                                    className={cn(
                                      "shrink-0 rounded-md p-1 transition-colors",
                                      isExcluded ? "text-green-500 hover:bg-green-500/10" : "text-red-400 hover:bg-red-500/10"
                                    )}
                                    title={isExcluded ? "Rikthe studentin" : "Hiq studentin"}
                                  >
                                    {isExcluded ? <Plus className="h-4 w-4" /> : <X className="h-4 w-4" />}
                                  </button>
                                </div>
                              )
                            })}
                            {/* Additional students from other years */}
                            {moduleAdditionalStudents.map((student) => (
                              <div key={student.studentId} className="flex items-center gap-3 px-4 py-2.5 bg-green-500/5">
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-500/10 text-[10px] font-semibold text-green-500">
                                  {student.firstName[0]}{student.lastName[0]}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-foreground truncate">{student.firstName} {student.lastName}</p>
                                  <p className="text-xs text-muted-foreground truncate">{student.email}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setModuleAdditionalStudents(prev => prev.filter(s => s.studentId !== student.studentId))}
                                  className="shrink-0 rounded-md p-1 text-red-400 hover:bg-red-500/10 transition-colors"
                                  title="Hiq studentin"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Add student from other years */}
                        <div className="border-t border-border px-4 py-3">
                          <div className="relative" ref={addStudentDropdownRef}>
                            <button
                              type="button"
                              onClick={() => { setShowAddStudentDropdown(v => !v); setAddStudentSearch("") }}
                              className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                            >
                              <UserPlus className="h-3.5 w-3.5" />
                              Shto Student
                            </button>
                            {showAddStudentDropdown && (
                              <div className="absolute left-0 bottom-full mb-1 w-72 rounded-lg border border-border bg-popover shadow-lg z-50">
                                <div className="p-2">
                                  <Input
                                    placeholder="Kërko student..."
                                    value={addStudentSearch}
                                    onChange={e => setAddStudentSearch(e.target.value)}
                                    className="h-8 text-xs"
                                    autoFocus
                                  />
                                </div>
                                <div className="max-h-[200px] overflow-y-auto">
                                  {allActiveStudentsLoading ? (
                                    <div className="px-3 py-2 text-xs text-muted-foreground">Duke ngarkuar...</div>
                                  ) : (() => {
                                    const yearStudentIds = new Set(moduleStudentPreview.map(s => s.studentId))
                                    const additionalIds = new Set(moduleAdditionalStudents.map(s => s.studentId))
                                    const searchLower = addStudentSearch.toLowerCase()
                                    const filtered = allActiveStudents.filter(s =>
                                      !yearStudentIds.has(s.studentId) &&
                                      !additionalIds.has(s.studentId) &&
                                      (searchLower === "" || `${s.firstName} ${s.lastName} ${s.email}`.toLowerCase().includes(searchLower))
                                    )
                                    return filtered.length === 0 ? (
                                      <div className="px-3 py-2 text-xs text-muted-foreground">Nuk u gjet asnjë student.</div>
                                    ) : (
                                      filtered.slice(0, 20).map(student => (
                                        <button
                                          key={student.studentId}
                                          type="button"
                                          onClick={() => {
                                            setModuleAdditionalStudents(prev => [...prev, student])
                                            setAddStudentSearch("")
                                            setShowAddStudentDropdown(false)
                                          }}
                                          className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
                                        >
                                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-[9px] font-semibold text-blue-500">
                                            {student.firstName[0]}{student.lastName[0]}
                                          </div>
                                          <div className="min-w-0">
                                            <p className="text-xs font-medium text-foreground truncate">{student.firstName} {student.lastName}</p>
                                            <p className="text-[10px] text-muted-foreground truncate">{student.email}</p>
                                          </div>
                                        </button>
                                      ))
                                    )
                                  })()}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {moduleError && <p className="text-sm text-destructive mb-3">{moduleError}</p>}
                </div>

                <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
                  <Button
                    variant="ghost"
                    onClick={() => { setShowAddModuleForm(false); setModuleError("") }}
                    disabled={moduleSaving}
                  >
                    Anulo
                  </Button>
                  <Button onClick={handleCreateModule} disabled={moduleSaving}>
                    {moduleSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Duke krijuar...
                      </>
                    ) : (
                      "Krijo Modulin"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Module Filters */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {(["upcoming", "past", "all"] as const).map((value) => {
              const label = value === "upcoming" ? "Të ardhshme" : value === "past" ? "Të kaluara" : "Të gjitha"
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setModuleTimeFilter(value)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    moduleTimeFilter === value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {label}
                </button>
              )
            })}
            <span className="mx-1 h-4 w-px bg-border" />
            {([1, 2, 3] as const).map((grade) => (
              <button
                key={grade}
                type="button"
                onClick={() => setModuleYearFilter(moduleYearFilter === grade ? null : grade)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  moduleYearFilter === grade
                    ? grade === 1 ? "bg-blue-500/20 text-blue-600" : grade === 2 ? "bg-purple-500/20 text-purple-600" : "bg-emerald-500/20 text-emerald-600"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {formatYearGradeLabel(grade)}
              </button>
            ))}
          </div>

          {/* Modules List */}
          {modulesLoading ? (
            <div className="rounded-xl border border-border bg-card px-5 py-8 text-sm text-muted-foreground">
              Duke ngarkuar modulet...
            </div>
          ) : studentModules.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
              <Library className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Asnjë modul akoma</p>
              <p className="mt-1 text-xs text-muted-foreground">Shtoni modulin e parë duke klikuar butonin &ldquo;Shto Modul&rdquo;.</p>
            </div>
          ) : filteredModules.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
              <Library className="mb-3 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Asnjë modul për këtë filtër</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredModules.map((mod) => (
                <div key={mod.id} className="rounded-xl border border-border bg-card p-5 shadow-sm cursor-pointer hover:border-primary/30 transition-colors" onClick={() => openModuleDetail(mod.id)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn(
                          "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                          mod.yearGrade === 1
                            ? "bg-blue-500/10 text-blue-600"
                            : mod.yearGrade === 2
                              ? "bg-purple-500/10 text-purple-600"
                              : "bg-emerald-500/10 text-emerald-600"
                        )}>
                          {formatYearGradeLabel(mod.yearGrade)}
                        </span>
                        <h3 className="text-base font-semibold text-foreground">{mod.title}</h3>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>{mod.topics.length} temë</span>
                        {mod.location && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {mod.location}
                          </span>
                        )}
                        <span>{mod.assignmentCount} studentë</span>
                        {mod.createdByName && (
                          <span>Krijuar nga: {mod.createdByName}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setDeletingModuleId(mod.id) }}
                        className="rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        title="Fshi modulin"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {deletingModuleId && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/40 px-4 backdrop-blur-sm">
              <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl">
                <h3 className="mb-2 text-base font-semibold text-foreground">Fshi modulin?</h3>
                <p className="mb-5 text-sm text-muted-foreground">
                  Ky veprim do të fshijë modulin dhe të gjitha dokumentet e lidhura. Ky veprim nuk mund të zhbëhet.
                </p>
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" onClick={() => setDeletingModuleId(null)} disabled={isDeletingModule}>Anulo</Button>
                  <Button variant="destructive" onClick={() => { if (deletingModuleId) void handleDeleteModule(deletingModuleId) }} disabled={isDeletingModule}>
                    {isDeletingModule ? "Duke fshirë..." : "Po, Fshi"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* QR Quick Popup from list (per-topic) */}
          {qrPopupTopicId && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/40 px-4 backdrop-blur-sm">
              <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-foreground">Kodi QR</h3>
                  <button
                    type="button"
                    onClick={() => { setQrPopupTopicId(null); setQrPopupToken(null); setQrPopupError("") }}
                    className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-sm text-muted-foreground mb-4">{qrPopupTopicName}</p>
                {qrPopupLoading && (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                )}
                {qrPopupError && (
                  <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive mb-3">
                    {qrPopupError}
                  </p>
                )}
                {qrPopupToken && (
                  <div className="flex flex-col items-center gap-3">
                    <div className="rounded-xl border border-border bg-white p-5">
                      <QRCodeCanvas id="module-list-qr" value={`${typeof window !== "undefined" ? window.location.origin : ""}/scan/attendance?token=${encodeURIComponent(qrPopupToken)}`} size={200} fgColor={"#000000"} bgColor={"#ffffff"} level={"M"} />
                    </div>
                    <p className="text-xs text-muted-foreground">Studentët skanojnë këtë kod për prezencën</p>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => handlePrintQr("module-list-qr", qrPopupTopicName)}>
                        <Printer className="mr-1.5 h-3.5 w-3.5" />
                        Printo
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDownloadQr("module-list-qr", `QR-${qrPopupTopicName}-Viti${qrPopupYear}.png`)}>
                        <Download className="mr-1.5 h-3.5 w-3.5" />
                        Shkarko
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Module Detail Modal */}
          {(selectedModuleDetail || moduleDetailLoading) && (
            <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 px-4 py-8 backdrop-blur-sm">
              <div className="w-full max-w-3xl rounded-xl border border-border bg-card shadow-xl">
                {moduleDetailLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : selectedModuleDetail && (() => {
                  const now = new Date()
                  const todayStr = now.toISOString().slice(0, 10)
                  const topicDates = selectedModuleDetail.topics
                    .filter(t => t.scheduledDate)
                    .map(t => new Date(t.scheduledDate!))
                  const isPastModule = topicDates.length > 0 && topicDates.every(d => d.toISOString().slice(0, 10) < todayStr)
                  return (
                  <>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 border-b border-border p-5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={cn(
                            "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                            selectedModuleDetail.yearGrade === 1
                              ? "bg-blue-500/10 text-blue-600"
                              : selectedModuleDetail.yearGrade === 2
                                ? "bg-purple-500/10 text-purple-600"
                                : "bg-emerald-500/10 text-emerald-600"
                          )}>
                            {formatYearGradeLabel(selectedModuleDetail.yearGrade)}
                          </span>
                          <h3 className="text-lg font-semibold text-foreground">{selectedModuleDetail.title}</h3>
                          {isPastModule && (
                            <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold text-amber-600">I përfunduar</span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {selectedModuleDetail.location && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {selectedModuleDetail.location}
                            </span>
                          )}
                          {selectedModuleDetail.createdByName && (
                            <span>Krijuar nga: {selectedModuleDetail.createdByName}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => { setSelectedModuleDetail(null); setTopicQrTokens({}); setTopicQrError("") }}
                          className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    </div>

                    {/* Topics Section */}
                    <div className="px-5 py-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-primary" />
                          <p className="text-sm font-semibold text-foreground">Temat ({selectedModuleDetail.topics.length})</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => { setShowAddTopicForm(true); setNewTopicName(""); setNewTopicLecturer(""); setNewTopicScheduledDate(""); setNewTopicScheduledTime("09:00"); setNewTopicLocation("") }}
                        >
                          <Plus className="mr-1 h-3 w-3" />
                          Shto Temë
                        </Button>
                      </div>

                      {/* Add Topic Form */}
                      {showAddTopicForm && (
                        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="flex flex-col gap-1">
                              <Label className="text-xs">Emri i Temës *</Label>
                              <Input value={newTopicName} onChange={(e) => setNewTopicName(e.target.value)} placeholder="Emri i temës..." className="h-8 text-xs" />
                            </div>
                            <div className="flex flex-col gap-1">
                              <Label className="text-xs">Lektori *</Label>
                              <Input value={newTopicLecturer} onChange={(e) => setNewTopicLecturer(e.target.value)} placeholder="Emri i lektorit..." className="h-8 text-xs" />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <div className="flex flex-col gap-1">
                              <Label className="text-xs">Data</Label>
                              <Input type="date" value={newTopicScheduledDate} onChange={(e) => setNewTopicScheduledDate(e.target.value)} className="h-8 text-xs" />
                            </div>
                            <div className="flex flex-col gap-1">
                              <Label className="text-xs">Ora</Label>
                              <Input type="time" value={newTopicScheduledTime} onChange={(e) => setNewTopicScheduledTime(e.target.value)} className="h-8 text-xs" />
                            </div>
                            <div className="flex flex-col gap-1">
                              <Label className="text-xs">Vendndodhja</Label>
                              <Input value={newTopicLocation} onChange={(e) => setNewTopicLocation(e.target.value)} placeholder="Vendndodhja..." className="h-8 text-xs" />
                            </div>
                          </div>
                          <div className="flex items-center gap-2 justify-end">
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowAddTopicForm(false)} disabled={topicSaving}>Anulo</Button>
                            <Button size="sm" className="h-7 text-xs" onClick={handleAddTopic} disabled={topicSaving || !newTopicName.trim() || !newTopicLecturer.trim()}>
                              {topicSaving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                              {topicSaving ? "Duke ruajtur..." : "Ruaj Temën"}
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Topic List */}
                      {selectedModuleDetail.topics.length === 0 && !showAddTopicForm ? (
                        <div className="rounded-xl border border-dashed border-border py-8 text-center">
                          <p className="text-xs text-muted-foreground">Asnjë temë akoma. Shtoni temën e parë.</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {selectedModuleDetail.topics.map((topic) => (
                            <div key={topic.id} className="rounded-xl border border-border overflow-hidden">
                              {editingTopicId === topic.id ? (
                                /* Edit Topic Inline */
                                <div className="p-4 space-y-3 bg-muted/20">
                                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <div className="flex flex-col gap-1">
                                      <Label className="text-xs">Emri i Temës *</Label>
                                      <Input value={editTopicName} onChange={(e) => setEditTopicName(e.target.value)} className="h-8 text-xs" />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                      <Label className="text-xs">Lektori *</Label>
                                      <Input value={editTopicLecturer} onChange={(e) => setEditTopicLecturer(e.target.value)} className="h-8 text-xs" />
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                    <div className="flex flex-col gap-1">
                                      <Label className="text-xs">Data</Label>
                                      <Input type="date" value={editTopicScheduledDate} onChange={(e) => setEditTopicScheduledDate(e.target.value)} className="h-8 text-xs" />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                      <Label className="text-xs">Ora</Label>
                                      <Input type="time" value={editTopicScheduledTime} onChange={(e) => setEditTopicScheduledTime(e.target.value)} className="h-8 text-xs" />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                      <Label className="text-xs">Vendndodhja</Label>
                                      <Input value={editTopicLocation} onChange={(e) => setEditTopicLocation(e.target.value)} className="h-8 text-xs" />
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 justify-end">
                                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingTopicId(null)} disabled={topicSaving}>Anulo</Button>
                                    <Button size="sm" className="h-7 text-xs" onClick={() => handleUpdateTopic(topic.id)} disabled={topicSaving || !editTopicName.trim() || !editTopicLecturer.trim()}>
                                      {topicSaving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                                      {topicSaving ? "Duke ruajtur..." : "Ruaj"}
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                /* Display Topic */
                                <div className="px-4 py-3">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2">
                                        <p className="text-sm font-semibold text-foreground">{topic.name}</p>
                                        {topic.scheduledDate && (() => {
                                          const topicDate = new Date(topic.scheduledDate!)
                                          const now = new Date()
                                          const isUpcoming = topicDate > now
                                          return isUpcoming ? (
                                            <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-600">Në pritje</span>
                                          ) : topic.attendanceCount > 0 ? (
                                            <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-600">Me prezencë</span>
                                          ) : (
                                            <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-600">Pa prezencë</span>
                                          )
                                        })()}
                                      </div>
                                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                        <span>Lektori: <strong className="text-foreground">{topic.lecturer}</strong></span>
                                        {topic.scheduledDate && (
                                          <span className="inline-flex items-center gap-1">
                                            <CalendarDays className="h-3 w-3" />
                                            {format(parseISO(topic.scheduledDate), "dd MMM yyyy, HH:mm")}
                                          </span>
                                        )}
                                        {topic.location && (
                                          <span className="inline-flex items-center gap-1">
                                            <MapPin className="h-3 w-3" />
                                            {topic.location}
                                          </span>
                                        )}
                                        <span className="inline-flex items-center gap-1">
                                          <UserCheck className="h-3 w-3" />
                                          {topic.attendanceCount} prezencë
                                        </span>
                                      </div>
                                    </div>
                                    {!isPastModule && (
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => handleOpenQrPopup(topic.id, topic.name, selectedModuleDetail.yearGrade)}
                                        className="rounded-md p-1 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                        title="Shfaq QR"
                                      >
                                        <QrCode className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => startEditTopic(topic)}
                                        className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted"
                                        title="Ndrysho"
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setDeletingTopicId(topic.id)}
                                        className="rounded-md p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                        title="Fshi temën"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                    )}
                                  </div>

                                  {/* ── Documents Section ── */}
                                  <div className="mt-3 rounded-lg border border-border/60 bg-muted/10 p-3">
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-1.5">
                                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span className="text-xs font-semibold text-foreground">Dokumente</span>
                                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{topic.documents.length}</span>
                                      </div>
                                      {!isPastModule && (
                                      <div>
                                        <input
                                          type="file"
                                          multiple
                                          id={`topic-file-upload-${topic.id}`}
                                          className="hidden"
                                          onChange={(e) => {
                                            if (e.target.files && e.target.files.length > 0) {
                                              handleUploadTopicDocs(topic.id, Array.from(e.target.files))
                                              e.target.value = ""
                                            }
                                          }}
                                        />
                                        <button
                                          type="button"
                                          onClick={() => document.getElementById(`topic-file-upload-${topic.id}`)?.click()}
                                          disabled={uploadingDocs && uploadingDocsTopicId === topic.id}
                                          className="inline-flex items-center gap-1 rounded-md border border-dashed border-primary/40 px-2 py-1 text-[10px] font-medium text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                                        >
                                          {uploadingDocs && uploadingDocsTopicId === topic.id ? (
                                            <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                          ) : (
                                            <Plus className="h-2.5 w-2.5" />
                                          )}
                                          Ngarko
                                        </button>
                                      </div>
                                      )}
                                    </div>
                                    {topic.documents.length > 0 ? (
                                      <div className="space-y-1">
                                        {topic.documents.map((doc) => (
                                          <div key={doc.id} className="group flex items-center justify-between gap-2 rounded-md border border-border/50 bg-card px-2.5 py-1.5 text-[11px] hover:bg-muted/30 transition-colors">
                                            <button
                                              type="button"
                                              onClick={() => handleDownloadModuleDoc(doc.fileUrl, doc.fileName)}
                                              className="inline-flex items-center gap-1.5 min-w-0 hover:underline text-foreground"
                                            >
                                              <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                                              <span className="truncate">{doc.fileName}</span>
                                            </button>
                                            {!isPastModule && (
                                            <button
                                              type="button"
                                              onClick={() => { setDeletingDocId(doc.id); setDeletingDocTopicId(topic.id) }}
                                              className="rounded p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity shrink-0"
                                            >
                                              <X className="h-3 w-3" />
                                            </button>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-[11px] text-muted-foreground italic">Asnjë dokument i ngarkuar.</p>
                                    )}
                                  </div>

                                  {/* ── Questionnaires Section ── */}
                                  <div className="mt-2 rounded-lg border border-primary/20 bg-primary/[0.02] p-3">
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-1.5">
                                        <ClipboardList className="h-3.5 w-3.5 text-primary" />
                                        <span className="text-xs font-semibold text-foreground">Pyetësorët</span>
                                        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">{(topic.questionnaires ?? []).length}</span>
                                      </div>
                                      {!isPastModule && (
                                      <button
                                        type="button"
                                        onClick={() => openCreateQuestionnaire(topic.id, topic.name)}
                                        className="inline-flex items-center gap-1 rounded-md border border-dashed border-primary/40 px-2 py-1 text-[10px] font-medium text-primary hover:bg-primary/10 transition-colors"
                                      >
                                        <Plus className="h-2.5 w-2.5" />
                                        Shto Pyetësor
                                      </button>
                                      )}
                                    </div>
                                    {(topic.questionnaires ?? []).length > 0 ? (
                                      <div className="space-y-1.5">
                                        {(topic.questionnaires ?? []).map((q) => (
                                          <div key={q.id} className="flex items-center justify-between gap-2 rounded-md border border-primary/20 bg-card px-2.5 py-2 text-[11px] hover:bg-primary/5 transition-colors">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                              <ClipboardList className="h-3 w-3 text-primary shrink-0" />
                                              <span className="font-medium text-foreground truncate">{q.title}</span>
                                              <span className="text-muted-foreground shrink-0">({q.questionCount} pyetje • {q.responseCount} përgjigje)</span>
                                            </div>
                                            <div className="flex items-center gap-0.5 shrink-0">
                                              <button
                                                type="button"
                                                onClick={() => openQuestionnaireQr(q.id)}
                                                className="rounded-md p-1 text-primary hover:bg-primary/10 transition-colors"
                                                title="QR Pyetësor"
                                              >
                                                <QrCode className="h-3 w-3" />
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => openQuestionnaireResults(q.id)}
                                                className="rounded-md p-1 text-primary hover:bg-primary/10 transition-colors"
                                                title="Shiko Rezultatet"
                                              >
                                                <Eye className="h-3 w-3" />
                                              </button>
                                              {!isPastModule && (
                                              <button
                                                type="button"
                                                onClick={() => setDeletingQuestionnaireId(q.id)}
                                                className="rounded-md p-1 text-destructive hover:bg-destructive/10 transition-colors"
                                                title="Fshi Pyetësorin"
                                              >
                                                <Trash2 className="h-3 w-3" />
                                              </button>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-[11px] text-muted-foreground italic">Asnjë pyetësor i shtuar.</p>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Delete Topic Confirmation */}
                    {deletingTopicId && (
                      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/40 px-4 backdrop-blur-sm">
                        <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl">
                          <h3 className="mb-2 text-base font-semibold text-foreground">Fshi temën?</h3>
                          <p className="mb-5 text-sm text-muted-foreground">Ky veprim do të fshijë temën dhe të gjitha dokumentet e lidhura. Ky veprim nuk mund të zhbëhet.</p>
                          <div className="flex gap-2 justify-end">
                            <Button variant="ghost" onClick={() => setDeletingTopicId(null)} disabled={isDeletingTopic}>Anulo</Button>
                            <Button variant="destructive" onClick={() => handleDeleteTopic(deletingTopicId)} disabled={isDeletingTopic}>
                              {isDeletingTopic ? "Duke fshirë..." : "Po, Fshi"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Delete Document Confirmation */}
                    {deletingDocId && deletingDocTopicId && (
                      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/40 px-4 backdrop-blur-sm">
                        <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl">
                          <h3 className="mb-2 text-base font-semibold text-foreground">Fshi dokumentin?</h3>
                          <p className="mb-5 text-sm text-muted-foreground">Ky veprim nuk mund të zhbëhet.</p>
                          <div className="flex gap-2 justify-end">
                            <Button variant="ghost" onClick={() => { setDeletingDocId(null); setDeletingDocTopicId(null) }} disabled={isDeletingDoc}>Anulo</Button>
                            <Button variant="destructive" onClick={() => handleRemoveDocument(deletingDocTopicId, deletingDocId)} disabled={isDeletingDoc}>
                              {isDeletingDoc ? "Duke fshirë..." : "Po, Fshi"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Delete Questionnaire Confirmation */}
                    {deletingQuestionnaireId && (
                      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/40 px-4 backdrop-blur-sm">
                        <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl">
                          <h3 className="mb-2 text-base font-semibold text-foreground">Fshi pyetësorin?</h3>
                          <p className="mb-5 text-sm text-muted-foreground">Ky veprim do të fshijë pyetësorin dhe të gjitha përgjigjet. Nuk mund të zhbëhet.</p>
                          <div className="flex gap-2 justify-end">
                            <Button variant="ghost" onClick={() => setDeletingQuestionnaireId(null)} disabled={isDeletingQuestionnaire}>Anulo</Button>
                            <Button variant="destructive" onClick={() => handleDeleteQuestionnaire(deletingQuestionnaireId)} disabled={isDeletingQuestionnaire}>
                              {isDeletingQuestionnaire ? "Duke fshirë..." : "Po, Fshi"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Create Questionnaire Modal */}
                    {showQuestionnaireModal && (
                      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/40 px-4 backdrop-blur-sm">
                        <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-xl">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-base font-semibold text-foreground">Shto Pyetësor - {questionnaireTopicName}</h3>
                            <button type="button" onClick={() => setShowQuestionnaireModal(false)} className="rounded-md p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
                          </div>

                          <div className="space-y-4">
                            <div className="flex flex-col gap-1">
                              <Label className="text-xs">Titulli i Pyetësorit *</Label>
                              <Input value={questionnaireTitle} onChange={(e) => setQuestionnaireTitle(e.target.value)} placeholder="Titulli..." className="h-8 text-xs" />
                            </div>

                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs font-semibold">Pyetjet ({questionnaireQuestions.length})</Label>
                                <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={addQuestionnaireQuestion}>
                                  <Plus className="mr-1 h-2.5 w-2.5" /> Shto Pyetje
                                </Button>
                              </div>

                              {questionnaireQuestions.map((q, qIdx) => (
                                <div key={qIdx} className="rounded-lg border border-border p-3 space-y-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-[10px] font-medium text-muted-foreground">Pyetja {qIdx + 1}</span>
                                    <div className="flex items-center gap-2">
                                      <select
                                        value={q.type}
                                        onChange={(e) => updateQuestionnaireQuestion(qIdx, "type", e.target.value)}
                                        className="h-6 rounded border border-border bg-card px-1.5 text-[10px]"
                                      >
                                        <option value="Options">Me opsione</option>
                                        <option value="FreeText">Tekst i lirë</option>
                                        <option value="Stars">Yje (1-5)</option>
                                      </select>
                                      {questionnaireQuestions.length > 1 && (
                                        <button type="button" onClick={() => removeQuestionnaireQuestion(qIdx)} className="rounded p-0.5 text-destructive hover:bg-destructive/10">
                                          <Trash2 className="h-3 w-3" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  <Input
                                    value={q.text}
                                    onChange={(e) => updateQuestionnaireQuestion(qIdx, "text", e.target.value)}
                                    placeholder="Teksti i pyetjes..."
                                    className="h-7 text-xs"
                                  />
                                  {q.type === "Options" && (
                                    <div className="space-y-1 pl-2">
                                      {q.options.map((opt, optIdx) => (
                                        <div key={optIdx} className="flex items-center gap-1">
                                          <span className="text-[10px] text-muted-foreground w-4">{optIdx + 1}.</span>
                                          <Input
                                            value={opt}
                                            onChange={(e) => updateQuestionOption(qIdx, optIdx, e.target.value)}
                                            placeholder={`Opsioni ${optIdx + 1}...`}
                                            className="h-6 text-[10px] flex-1"
                                          />
                                          {q.options.length > 2 && (
                                            <button type="button" onClick={() => removeQuestionOption(qIdx, optIdx)} className="rounded p-0.5 text-destructive hover:bg-destructive/10">
                                              <X className="h-2.5 w-2.5" />
                                            </button>
                                          )}
                                        </div>
                                      ))}
                                      <button type="button" onClick={() => addQuestionOption(qIdx)} className="text-[10px] text-primary hover:underline">+ Shto opsion</button>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>

                            {questionnaireError && <p className="text-xs text-destructive">{questionnaireError}</p>}

                            <div className="flex items-center gap-2 justify-end pt-2">
                              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowQuestionnaireModal(false)} disabled={questionnaireSaving}>Anulo</Button>
                              <Button size="sm" className="h-7 text-xs" onClick={handleCreateQuestionnaire} disabled={questionnaireSaving || !questionnaireTitle.trim()}>
                                {questionnaireSaving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                                {questionnaireSaving ? "Duke ruajtur..." : "Ruaj Pyetësorin"}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Questionnaire QR Modal */}
                    {questionnaireQrId && (
                      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/40 px-4 backdrop-blur-sm">
                        <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl text-center">
                          <h3 className="mb-4 text-base font-semibold text-foreground">QR Pyetësor</h3>
                          {questionnaireQrLoading ? (
                            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                          ) : questionnaireQrToken ? (
                            <div className="flex flex-col items-center gap-3">
                              <QRCodeCanvas id="questionnaire-qr-canvas" value={`${typeof window !== "undefined" ? window.location.origin : ""}/scan/questionnaire?token=${encodeURIComponent(questionnaireQrToken)}`} size={220} level="M" />
                              <button type="button" onClick={() => handlePrintQr("questionnaire-qr-canvas", "Pyetësor QR")} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                                <Printer className="h-3 w-3" /> Printo
                              </button>
                            </div>
                          ) : (
                            <p className="text-xs text-destructive">Gabim gjatë gjenerimit të QR.</p>
                          )}
                          <div className="mt-4">
                            <Button size="sm" variant="ghost" onClick={() => { setQuestionnaireQrId(null); setQuestionnaireQrToken(null) }}>Mbyll</Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Questionnaire Results Modal */}
                    {showQuestionnaireResults && (
                      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/40 px-4 backdrop-blur-sm">
                        <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-xl">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-base font-semibold text-foreground">
                              Rezultatet e Pyetësorit
                              {questionnaireResultsDetail && <span className="text-muted-foreground font-normal"> - {questionnaireResultsDetail.title}</span>}
                            </h3>
                            <button type="button" onClick={() => { setShowQuestionnaireResults(false); setSelectedResponseId(null) }} className="rounded-md p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
                          </div>

                          {questionnaireResultsLoading ? (
                            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                          ) : questionnaireResponses.length === 0 ? (
                            <div className="py-8 text-center">
                              <p className="text-sm text-muted-foreground">Asnjë student nuk ka plotësuar ende pyetësorin.</p>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {questionnaireResponses.map((resp) => (
                                <div key={resp.responseId} className="rounded-lg border border-border overflow-hidden">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedResponseId(prev => prev === resp.responseId ? null : resp.responseId)}
                                    className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-muted/30 transition-colors"
                                  >
                                    <div>
                                      <span className="text-sm font-medium text-foreground">{resp.firstName} {resp.lastName}</span>
                                      <span className="ml-2 text-xs text-muted-foreground">{format(parseISO(resp.submittedAt), "dd MMM yyyy, HH:mm")}</span>
                                    </div>
                                    <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", selectedResponseId === resp.responseId && "rotate-90")} />
                                  </button>
                                  {selectedResponseId === resp.responseId && (
                                    <div className="border-t border-border px-4 py-3 space-y-3 bg-muted/10">
                                      {resp.answers.map((ans, aIdx) => (
                                        <div key={aIdx}>
                                          <p className="text-xs font-medium text-muted-foreground mb-1">
                                            {aIdx + 1}. {ans.questionText}
                                            <span className="ml-1 text-[10px]">({ans.questionType === "Options" ? "Opsione" : ans.questionType === "FreeText" ? "Tekst" : "Yje"})</span>
                                          </p>
                                          {ans.questionType === "Stars" ? (
                                            <div className="flex items-center gap-0.5">
                                              {[1, 2, 3, 4, 5].map((s) => (
                                                <Star key={s} className={cn("h-4 w-4", s <= parseInt(ans.answer) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30")} />
                                              ))}
                                              <span className="ml-1 text-xs text-foreground">{ans.answer}/5</span>
                                            </div>
                                          ) : (
                                            <p className="text-sm text-foreground bg-card rounded px-2 py-1 border border-border">{ans.answer}</p>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Student Presence Table with per-topic columns */}
                    <div className="px-5 pb-4">
                      <div className="rounded-xl border border-border overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setModuleDetailStudentsExpanded(v => !v)}
                          className="flex w-full items-center justify-between bg-muted/30 px-4 py-3 text-left"
                        >
                          <div className="flex items-center gap-2">
                            <UserCheck className="h-4 w-4 text-primary" />
                            <p className="text-sm font-semibold text-foreground">
                              Studentët ({selectedModuleDetail.assignments.length})
                            </p>
                          </div>
                          <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", moduleDetailStudentsExpanded && "rotate-90")} />
                        </button>
                        {moduleDetailStudentsExpanded && (
                          <div className="border-t border-border">
                            {selectedModuleDetail.assignments.length === 0 ? (
                              <div className="px-4 py-4 text-center">
                                <p className="text-xs text-muted-foreground">Asnjë student i caktuar në këtë modul.</p>
                              </div>
                            ) : (
                              <div className="overflow-x-auto px-4 py-3">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="border-b border-border text-xs text-muted-foreground">
                                      <th className="py-2 pr-3 text-left font-medium">Emri</th>
                                      <th className="py-2 pr-3 text-left font-medium">Email</th>
                                      {selectedModuleDetail.topics.map((topic) => (
                                        <th key={topic.id} className="py-2 px-2 text-center font-medium whitespace-nowrap" title={topic.name}>
                                          {topic.name.length > 15 ? `${topic.name.slice(0, 15)}...` : topic.name}
                                        </th>
                                      ))}
                                      {isPastModule && (
                                        <th className="py-2 px-2 text-center font-medium whitespace-nowrap">Rezultati</th>
                                      )}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {selectedModuleDetail.assignments.map((a) => (
                                      <tr key={a.studentId} className="border-b border-border/50 last:border-0">
                                        <td className="py-2.5 pr-3 font-medium text-foreground whitespace-nowrap">{a.firstName} {a.lastName}</td>
                                        <td className="py-2.5 pr-3 text-muted-foreground">{a.email}</td>
                                        {selectedModuleDetail.topics.map((topic) => {
                                          const attendance = a.topicAttendances?.find(ta => ta.topicId === topic.id)
                                          return (
                                            <td key={topic.id} className="py-2.5 px-2 text-center">
                                              {attendance ? (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                                                  <CheckCircle2 className="h-2.5 w-2.5" />
                                                </span>
                                              ) : (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                                  --
                                                </span>
                                              )}
                                            </td>
                                          )
                                        })}
                                        {isPastModule && (
                                          <td className="py-2.5 px-2 text-center">
                                            {a.result ? (
                                              <div className="flex flex-col items-center gap-0.5">
                                                <span className={cn(
                                                  "rounded-full px-2.5 py-0.5 text-[10px] font-semibold",
                                                  a.result.toLowerCase() === "kaluar" ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"
                                                )}>
                                                  {a.result}
                                                </span>
                                                {a.resultNote && <span className="text-[10px] text-muted-foreground">{a.resultNote}</span>}
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setResultStudentId(a.studentId)
                                                    setResultStudentName(`${a.firstName} ${a.lastName}`)
                                                    setResultStudentEmail(a.email)
                                                    setResultStudentCurrent(a.result ?? null)
                                                    setResultValue(a.result ?? "")
                                                    setResultNote(a.resultNote ?? "")
                                                  }}
                                                  className="text-[10px] text-primary hover:underline mt-0.5"
                                                >
                                                  Ndrysho
                                                </button>
                                              </div>
                                            ) : (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setResultStudentId(a.studentId)
                                                  setResultStudentName(`${a.firstName} ${a.lastName}`)
                                                  setResultStudentEmail(a.email)
                                                  setResultStudentCurrent(null)
                                                  setResultValue("")
                                                  setResultNote("")
                                                }}
                                                className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2 py-1 text-[10px] font-medium text-primary hover:bg-primary/10 transition-colors"
                                              >
                                                <GraduationCap className="h-3 w-3" />
                                                Jep Rezultat
                                              </button>
                                            )}
                                          </td>
                                        )}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                  )
                  })()}
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === "attendance" && (
        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          {/* Left sidebar */}
          <div className="h-fit rounded-2xl border border-border bg-card p-3 sm:p-4 space-y-4">
            {/* Module filter */}
            <div>
              <Label className="text-xs">Filtro sipas modulit</Label>
              <select
                value={attSelectedModuleId}
                onChange={(e) => setAttSelectedModuleId(e.target.value)}
                className="mt-1 flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Zgjidh modulin...</option>
                {attModules.map((m) => (
                  <option key={m.id} value={m.id}>Viti {m.yearGrade} - {m.title}</option>
                ))}
              </select>
            </div>

            {/* Topic list */}
            {attModulesLoading ? (
              <div className="py-4 text-center text-xs text-muted-foreground">Duke ngarkuar...</div>
            ) : attSelectedModuleId && attModuleDetailLoading ? (
              <div className="py-4 text-center text-xs text-muted-foreground">Duke ngarkuar...</div>
            ) : attSelectedModuleId && attModuleDetail && attTopics.length > 0 ? (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-foreground">Temat ({attTopics.length})</p>
                {attTopics.map((topic) => {
                  const isPast = topic.scheduledDate ? new Date(topic.scheduledDate) < new Date() : false
                  return (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => setAttSelectedTopicId(topic.id)}
                    className={cn(
                      "w-full rounded-lg border px-3 py-2 text-left transition-colors",
                      attSelectedTopicId === topic.id
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                        : "border-border hover:bg-muted/50"
                    )}
                  >
                    <p className="text-xs font-medium text-foreground">{topic.name}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
                      {topic.scheduledDate && (
                        <span className="inline-flex items-center gap-0.5">
                          <CalendarDays className="h-2.5 w-2.5" />
                          {format(parseISO(topic.scheduledDate), "dd MMM yyyy, HH:mm")}
                        </span>
                      )}
                      <span>Lektori: {topic.lecturer}</span>
                      {isPast && <span className="rounded bg-muted px-1 py-0.5 text-[9px] font-medium text-muted-foreground">E kaluar</span>}
                    </div>
                    <div className="mt-1 flex items-center gap-1">
                      <UserCheck className="h-2.5 w-2.5 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">{topic.attendanceCount} prezencë</span>
                    </div>
                  </button>
                  )
                })}
              </div>
            ) : attSelectedModuleId && !attModuleDetailLoading ? (
              <p className="py-4 text-center text-xs text-muted-foreground italic">Asnjë temë me datë në këtë modul.</p>
            ) : !attSelectedModuleId && attAllTopics.length > 0 ? (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-foreground">Të gjitha temat ({attAllTopics.length})</p>
                {attAllTopics.map((topic) => {
                  const isPast = topic.scheduledDate ? new Date(topic.scheduledDate) < new Date() : false
                  return (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => {
                      setAttSelectedModuleId(topic.moduleId)
                      setAttSelectedTopicId(topic.id)
                    }}
                    className={cn(
                      "w-full rounded-lg border px-3 py-2 text-left transition-colors",
                      attSelectedTopicId === topic.id
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                        : "border-border hover:bg-muted/50"
                    )}
                  >
                    <p className="text-xs font-medium text-foreground">{topic.name}</p>
                    <p className="text-[10px] text-primary/70 font-medium">{topic.moduleTitle}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
                      {topic.scheduledDate && (
                        <span className="inline-flex items-center gap-0.5">
                          <CalendarDays className="h-2.5 w-2.5" />
                          {format(parseISO(topic.scheduledDate), "dd MMM yyyy, HH:mm")}
                        </span>
                      )}
                      <span>Lektori: {topic.lecturer}</span>
                      {isPast && <span className="rounded bg-muted px-1 py-0.5 text-[9px] font-medium text-muted-foreground">E kaluar</span>}
                    </div>
                    <div className="mt-1 flex items-center gap-1">
                      <UserCheck className="h-2.5 w-2.5 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">{topic.attendanceCount} prezencë</span>
                    </div>
                  </button>
                  )
                })}
              </div>
            ) : !attSelectedModuleId ? (
              <p className="py-4 text-center text-xs text-muted-foreground">Asnjë temë me datë.</p>
            ) : null}
          </div>

          {/* Right panel */}
          <div>
            {attModuleDetailLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !attSelectedTopic ? (
              <div className="rounded-xl border border-dashed border-border py-16 text-center">
                <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground/40" />
                <p className="mt-2 text-sm text-muted-foreground">Zgjidhni një temë për të parë studentët.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">
                      Prezenca për: {attSelectedTopic.name}
                      {attIsPastTopic && <span className="ml-2 rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground align-middle">E kaluar</span>}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {attSelectedTopic.scheduledDate && format(parseISO(attSelectedTopic.scheduledDate), "dd MMM yyyy, HH:mm")}
                      {attSelectedTopic.location ? ` • ${attSelectedTopic.location}` : ""}
                      {` • Lektori: ${attSelectedTopic.lecturer}`}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {attStudentsForTopic.length} studentë • {attStudentsForTopic.filter(s => s.attended).length} me prezencë
                    </p>
                  </div>
                  {!attIsPastTopic && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => handleAttTopicQr(attSelectedTopic.id)}
                    >
                      <QrCode className="h-3.5 w-3.5" />
                      Shfaq QR
                    </Button>
                  )}
                </div>

                {attError && (
                  <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{attError}</p>
                )}

                {/* Student list */}
                {attStudentsForTopic.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border py-10 text-center">
                    <p className="text-sm text-muted-foreground">Asnjë student i caktuar në këtë modul.</p>
                  </div>
                ) : (
                  <>
                    {/* Mobile cards */}
                    <div className="space-y-2 md:hidden">
                      {attStudentsForTopic.map((s) => {
                        const isUpdating = attUpdatingKey?.startsWith(`${attSelectedTopicId}-${s.studentId}`) ?? false
                        return (
                          <div key={s.studentId} className="rounded-xl border border-border bg-card p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-medium text-foreground">{s.firstName} {s.lastName}</p>
                                <p className="text-[11px] text-muted-foreground">{s.email}</p>
                              </div>
                              {s.attended ? (
                                <span className="rounded-full bg-green-500/10 px-2.5 py-1 text-[10px] font-semibold text-green-600 flex items-center gap-1">
                                  <CheckCircle2 className="h-2.5 w-2.5" />
                                  Prezent
                                </span>
                              ) : (
                                <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
                                  Pa prezencë
                                </span>
                              )}
                            </div>
                            <div className="mt-3 flex gap-2">
                              <Button
                                size="sm"
                                className="h-7 flex-1 text-[11px]"
                                variant={s.attended ? "default" : "outline"}
                                disabled={s.attended || isUpdating || attIsPastTopic}
                                onClick={() => handleMarkAttendance(attSelectedTopicId, s.studentId)}
                              >
                                {isUpdating && attUpdatingKey?.endsWith("-mark") ? <Loader2 className="h-3 w-3 animate-spin" /> : "Prano"}
                              </Button>
                              <Button
                                size="sm"
                                className="h-7 flex-1 text-[11px]"
                                variant={!s.attended ? "destructive" : "outline"}
                                disabled={!s.attended || isUpdating || attIsPastTopic}
                                onClick={() => handleRemoveAttendance(attSelectedTopicId, s.studentId)}
                              >
                                {isUpdating && attUpdatingKey?.endsWith("-remove") ? <Loader2 className="h-3 w-3 animate-spin" /> : "Mungesë"}
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Desktop table */}
                    <div className="hidden md:block rounded-xl border border-border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                            <th className="px-4 py-2.5 text-left font-medium">Studenti</th>
                            <th className="px-4 py-2.5 text-left font-medium">Email</th>
                            <th className="px-4 py-2.5 text-center font-medium">Statusi</th>
                            <th className="px-4 py-2.5 text-center font-medium w-[200px]">Veprime</th>
                          </tr>
                        </thead>
                        <tbody>
                          {attStudentsForTopic.map((s) => {
                            const isUpdating = attUpdatingKey?.startsWith(`${attSelectedTopicId}-${s.studentId}`) ?? false
                            return (
                              <tr key={s.studentId} className="border-b border-border/50 last:border-0">
                                <td className="px-4 py-2.5 font-medium text-foreground whitespace-nowrap">{s.firstName} {s.lastName}</td>
                                <td className="px-4 py-2.5 text-muted-foreground">{s.email}</td>
                                <td className="px-4 py-2.5 text-center">
                                  {s.attended ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2.5 py-1 text-[10px] font-semibold text-green-600">
                                      <CheckCircle2 className="h-2.5 w-2.5" />
                                      Prezent
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
                                      Pa prezencë
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5">
                                  <div className="flex items-center justify-center gap-2">
                                    <Button
                                      size="sm"
                                      className="h-7 min-w-[5rem] text-[11px]"
                                      variant={s.attended ? "default" : "outline"}
                                      disabled={s.attended || isUpdating || attIsPastTopic}
                                      onClick={() => handleMarkAttendance(attSelectedTopicId, s.studentId)}
                                    >
                                      {isUpdating && attUpdatingKey?.endsWith("-mark") ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                                      Prano
                                    </Button>
                                    <Button
                                      size="sm"
                                      className="h-7 min-w-[5rem] text-[11px]"
                                      variant={!s.attended ? "destructive" : "outline"}
                                      disabled={!s.attended || isUpdating || attIsPastTopic}
                                      onClick={() => handleRemoveAttendance(attSelectedTopicId, s.studentId)}
                                    >
                                      {isUpdating && attUpdatingKey?.endsWith("-remove") ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                                      Mungesë
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Topic Attendance QR Modal */}
      {/* Result Modal */}
      {resultStudentId && selectedModuleDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <GraduationCap className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {resultStudentCurrent ? "Ndrysho Rezultatin" : "Jep Rezultatin"}
                  </h3>
                  <p className="text-xs text-muted-foreground">{selectedModuleDetail.title}</p>
                </div>
              </div>
              <button
                onClick={() => { setResultStudentId(null); setResultValue(""); setResultNote("") }}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Student info */}
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-xs font-semibold text-blue-500">
                  {resultStudentName.split(" ").map(n => n[0]).join("").slice(0, 2)}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{resultStudentName}</p>
                  <p className="text-xs text-muted-foreground">{resultStudentEmail}</p>
                </div>
              </div>

              {/* Result selection */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Rezultati *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setResultValue("Kaluar")}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-lg border-2 px-4 py-3 transition-all",
                      resultValue === "Kaluar"
                        ? "border-green-500 bg-green-500/10 text-green-600"
                        : "border-border bg-card text-muted-foreground hover:border-green-500/50 hover:bg-green-500/5"
                    )}
                  >
                    <CheckCircle2 className="h-6 w-6" />
                    <span className="text-sm font-semibold">Kaluar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setResultValue("Ngelur")}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-lg border-2 px-4 py-3 transition-all",
                      resultValue === "Ngelur"
                        ? "border-red-500 bg-red-500/10 text-red-600"
                        : "border-border bg-card text-muted-foreground hover:border-red-500/50 hover:bg-red-500/5"
                    )}
                  >
                    <XCircle className="h-6 w-6" />
                    <span className="text-sm font-semibold">Ngelur</span>
                  </button>
                </div>
              </div>

              {/* Note */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Shënim (opsional)</label>
                <textarea
                  value={resultNote}
                  onChange={(e) => setResultNote(e.target.value)}
                  placeholder="Shkruani një shënim për studentin..."
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setResultStudentId(null); setResultValue(""); setResultNote("") }}
                disabled={resultSaving}
              >
                Anulo
              </Button>
              <Button
                size="sm"
                onClick={() => handleSetStudentResult(selectedModuleDetail.id, resultStudentId)}
                disabled={resultSaving || !resultValue}
                className={cn(
                  resultValue === "Kaluar" && "bg-green-600 hover:bg-green-700",
                  resultValue === "Ngelur" && "bg-red-600 hover:bg-red-700"
                )}
              >
                {resultSaving ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <GraduationCap className="mr-1.5 h-3.5 w-3.5" />
                )}
                {resultSaving ? "Duke ruajtur..." : "Ruaj Rezultatin"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {attShowQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl text-center">
            <h3 className="text-sm font-semibold text-foreground mb-4">QR për Prezencë</h3>
            {attTopicQrLoading ? (
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
            ) : attTopicQrToken ? (
              <div className="flex flex-col items-center gap-3">
                <div className="rounded-xl border border-border bg-white p-5">
                  <QRCodeCanvas id="att-topic-qr" value={`${typeof window !== "undefined" ? window.location.origin : ""}/scan/attendance?token=${encodeURIComponent(attTopicQrToken)}`} size={200} fgColor="#000000" bgColor="#ffffff" level="M" />
                </div>
                <p className="text-xs text-muted-foreground">Studentët skanojnë këtë kod për prezencën</p>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => handlePrintQr("att-topic-qr", attSelectedTopic?.name ?? "Prezencë QR")}>
                    <Printer className="mr-1.5 h-3.5 w-3.5" />
                    Printo
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleDownloadQr("att-topic-qr", `prezence-qr-${attSelectedTopicId}.png`)}>
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    Shkarko
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-destructive">Gabim gjatë gjenerimit të QR.</p>
            )}
            <div className="mt-4">
              <Button size="sm" variant="ghost" onClick={() => { setAttShowQrModal(false); setAttTopicQrToken("") }}>Mbyll</Button>
            </div>
          </div>
        </div>
      )}

      {editingStudent && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-xl border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Modifiko Studentin</h2>
                <p className="mt-0.5 text-xs text-muted-foreground font-mono">
                  {getStudentTrackingCode(editingStudent) || "—"} • {editingStudent.memberRegistryNumber}
                </p>
              </div>
              <button onClick={closeEdit} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-col gap-4 p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label>Numri i Studentit (Tracking) *</Label>
                  <Input
                    value={editRegistry}
                    readOnly
                    className="font-mono bg-muted/40"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Kodi i Regjistrit *</Label>
                  <Input value={generatedEditRegistryNumber} readOnly className="font-mono bg-muted/40" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Emri *</Label>
                  <Input value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Mbiemri *</Label>
                  <Input value={editLastName} onChange={(e) => setEditLastName(e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Email *</Label>
                  <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Email 2</Label>
                  <Input type="email" value={editEmail2} onChange={(e) => setEditEmail2(e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Telefon</Label>
                  <div className="flex gap-2">
                    <Input value={editPhonePrefix} onChange={(e) => setEditPhonePrefix(e.target.value)} className="w-20" placeholder="+355" />
                    <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="69 123 4567" className="flex-1" />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Mentori</Label>
                  <select
                    value={editMentorId}
                    onChange={(e) => setEditMentorId(e.target.value)}
                    className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Zgjidh mentorin</option>
                    {mentors.map((mentor) => (
                      <option key={mentor.id} value={mentor.id}>
                        {mentor.firstName} {mentor.lastName} ({mentor.memberRegistryNumber})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Shoqëria</Label>
                  <Input value={editCompany} onChange={(e) => setEditCompany(e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Rrethi</Label>
                  <Input value={editDistrict} onChange={(e) => setEditDistrict(e.target.value)} />
                </div>
              </div>

              {/* Year Section */}
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                <p className="text-xs font-semibold text-foreground mb-2">Vitet e Studimit</p>
                <div className="space-y-1.5">
                  {/* Year 1 - editable start year */}
                  <div className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">1</span>
                    <span className="text-xs font-medium text-foreground">Viti i Parë</span>
                    <div className="ml-auto flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">Shtator</span>
                      <select
                        value={editStudentStartYear}
                        onChange={(e) => {
                          const nextStartYear = e.target.value
                          const nextStartYearNumber = parseStudentYear(nextStartYear)
                          setEditStudentStartYear(nextStartYear)
                          if (nextStartYearNumber) {
                            setEditStudentEndYear(String(nextStartYearNumber + 3))
                            const currentY2 = parseStudentYear(editYear2StartYear)
                            if (currentY2 && currentY2 <= nextStartYearNumber) setEditYear2StartYear("")
                            const currentY3 = parseStudentYear(editYear3StartYear)
                            if (currentY3 && currentY3 <= nextStartYearNumber) setEditYear3StartYear("")
                          }
                        }}
                        className="h-7 rounded border border-input bg-transparent px-1.5 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="">Zgjidh</option>
                        {STUDENT_YEAR_OPTIONS.map((year) => (
                          <option key={`edit-start-${year}`} value={year}>{year}</option>
                        ))}
                      </select>
                      {editStudentStartYearNumber && (() => {
                        return <span className="text-xs text-muted-foreground">– Shtator {editStudentStartYearNumber + 1}</span>
                      })()}
                    </div>
                  </div>

                  {editStudentStartYearNumber && (() => {
                    const y1 = editStudentStartYearNumber
                    const y2 = parseStudentYear(editYear2StartYear) || y1 + 1
                    const y3 = parseStudentYear(editYear3StartYear) || y2 + 1
                    const y2Options = STUDENT_YEAR_OPTIONS.filter((yr) => Number(yr) > y1 + 1)
                    const y3Options = STUDENT_YEAR_OPTIONS.filter((yr) => Number(yr) > y2 + 1)
                    return (
                      <>
                        {/* Year 2 - editable, must be > Y1 */}
                        <div className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5">
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">2</span>
                          <span className="text-xs font-medium text-foreground">Viti i Dytë</span>
                          <div className="ml-auto flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">Shtator</span>
                            <select
                              value={editYear2StartYear || ""}
                              onChange={(e) => {
                                const newY2 = e.target.value
                                setEditYear2StartYear(newY2)
                                const newY2Num = parseStudentYear(newY2) || y1 + 1
                                const currentY3 = parseStudentYear(editYear3StartYear)
                                if (currentY3 && currentY3 <= newY2Num) {
                                  setEditYear3StartYear("")
                                }
                              }}
                              className="h-7 rounded border border-input bg-transparent px-1.5 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                            >
                              <option value="">{y1 + 1}</option>
                              {y2Options.map((yr) => (
                                <option key={`edit-y2-${yr}`} value={yr}>{yr}</option>
                              ))}
                            </select>
                            <span className="text-xs text-muted-foreground">– Shtator {y2 + 1}</span>
                          </div>
                        </div>
                        {/* Year 3 - editable, must be > Y2 */}
                        <div className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5">
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">3</span>
                          <span className="text-xs font-medium text-foreground">Viti i Tretë</span>
                          <div className="ml-auto flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">Shtator</span>
                            <select
                              value={editYear3StartYear || ""}
                              onChange={(e) => setEditYear3StartYear(e.target.value)}
                              className="h-7 rounded border border-input bg-transparent px-1.5 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                            >
                              <option value="">{y2 + 1}</option>
                              {y3Options.map((yr) => (
                                <option key={`edit-y3-${yr}`} value={yr}>{yr}</option>
                              ))}
                            </select>
                            <span className="text-xs text-muted-foreground">– Shtator {y3 + 1}</span>
                          </div>
                        </div>
                      </>
                    )
                  })()}
                </div>
                {editStudentStartYearNumber && (() => {
                  const y1 = editStudentStartYearNumber
                  const y2 = parseStudentYear(editYear2StartYear) || y1 + 1
                  const y3 = parseStudentYear(editYear3StartYear) || y2 + 1
                  return (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Llogaria vlefshme: Shtator {y1} – Shtator {y3 + 1}
                    </p>
                  )
                })()}
              </div>

              {editError && <p className="text-sm text-destructive font-medium">{editError}</p>}

              <AdminPasswordResetCard
                userId={editingStudent.id}
                userLabel={`${editFirstName.trim()} ${editLastName.trim()}`.trim() || editingStudent.email}
              />

              <div className="flex flex-col gap-3 border-t border-border pt-4 mt-2 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  type="button"
                  variant="outline"
                  className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => openDeleteStudent(editingStudent)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Fshij Studentin
                </Button>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editIsActive}
                    onChange={(e) => setEditIsActive(e.target.checked)}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  <span className={`text-xs font-medium ${editIsActive ? "text-emerald-600" : "text-muted-foreground"}`}>
                    {editIsActive ? "Aktiv" : "Joaktiv"}
                  </span>
                </label>
                <div className="flex flex-col gap-3 sm:flex-row sm:ml-auto">
                  <Button type="button" variant="ghost" onClick={closeEdit}>Anulo</Button>
                  <Button type="button" onClick={handleUpdateStudent} disabled={isSavingEdit}>
                    {isSavingEdit ? "Duke ruajtur..." : "Ruaj Ndryshimet"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isAdmin && (
        <StudentHistoryModal
          student={historyStudent}
          mentorName={historyStudent?.mentorId ? mentorNameById.get(historyStudent.mentorId) ?? "—" : "—"}
          onClose={closeHistory}
        />
      )}

      {deletingStudent && isAdmin && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/40 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl">
            <h3 className="mb-1 text-base font-semibold text-foreground">Fshi studentin?</h3>
            <p className="mb-1 text-sm text-muted-foreground">
              Do të fshihet <strong className="text-foreground">{deletingStudent.firstName} {deletingStudent.lastName}</strong>.
            </p>
            <p className="mb-2 text-xs font-mono text-muted-foreground">{deletingStudent.memberRegistryNumber}</p>
            <p className="mb-5 text-xs text-destructive/80">
              Ky veprim është përfundimtar dhe heq historikun, orarin, dokumentet dhe sesionet e lidhura.
            </p>
            {deleteStudentError && (
              <p className="mb-4 text-sm font-medium text-destructive">{deleteStudentError}</p>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={closeDeleteStudent} disabled={isDeletingStudent}>Anulo</Button>
              <Button variant="destructive" onClick={() => void handleDeleteStudent()} disabled={isDeletingStudent}>
                {isDeletingStudent ? "Duke fshirë..." : "Po, Fshi"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {scheduleStudent && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-xl border border-border bg-card shadow-lg">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Orari i Studentit</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {scheduleStudent.firstName} {scheduleStudent.lastName} • {scheduleStudent.memberRegistryNumber}
                </p>
              </div>
              <button onClick={closeScheduleModal} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="text-xs text-muted-foreground">
                Mentori i caktuar:
                <span className="ml-1 font-medium text-foreground">
                  {scheduleStudent.mentorId ? mentorNameById.get(scheduleStudent.mentorId) ?? "—" : "—"}
                </span>
              </div>

              {scheduleLoading ? (
                <p className="text-sm text-muted-foreground">Duke ngarkuar orarin...</p>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-lg border border-border bg-muted/20 p-3">
                    <p className="text-xs font-medium text-foreground">Shto javën shpejt (Hën - Prem)</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Përdor të njëjtin orar për një javë të plotë, pa i shtuar datat një nga një.
                    </p>
                    <div className="mt-2 grid gap-2 md:grid-cols-[1fr_120px_120px_1fr_auto]">
                      <div className="flex flex-col gap-1">
                        <Label className="text-xs">Java (çdo datë e javës)</Label>
                        <Input type="date" value={quickWeekStartDate} onChange={(e) => setQuickWeekStartDate(e.target.value)} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label className="text-xs">Nga</Label>
                        <Input type="time" value={quickWeekStartTime} onChange={(e) => setQuickWeekStartTime(e.target.value)} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label className="text-xs">Deri</Label>
                        <Input type="time" value={quickWeekEndTime} onChange={(e) => setQuickWeekEndTime(e.target.value)} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label className="text-xs">Shënime</Label>
                        <Input value={quickWeekNotes} onChange={(e) => setQuickWeekNotes(e.target.value)} placeholder="Opsionale" />
                      </div>
                      <div className="flex items-end">
                        <Button type="button" variant="outline" size="sm" className="h-9" onClick={addScheduleWeek}>
                          + Shto javën
                        </Button>
                      </div>
                    </div>
                  </div>

                  {scheduleRows.map((row, idx) => (
                    <div key={row.id} className="grid gap-2 rounded-lg border border-border bg-muted/20 p-3 md:grid-cols-[1fr_120px_120px_1fr_auto]">
                      <div className="flex flex-col gap-1">
                        <Label className="text-xs">Data</Label>
                        <Input
                          type="date"
                          value={row.date}
                          onChange={(e) => updateScheduleRow(row.id, "date", e.target.value)}
                          className={row.date.trim() && scheduleDuplicateDateSet.has(row.date.trim()) ? "border-destructive focus-visible:ring-destructive" : undefined}
                        />
                        {row.date.trim() && scheduleDuplicateDateSet.has(row.date.trim()) && (
                          <p className="text-[11px] text-destructive">Kjo datë është zgjedhur më shumë se një herë.</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label className="text-xs">Nga</Label>
                        <Input type="time" value={row.startTime} onChange={(e) => updateScheduleRow(row.id, "startTime", e.target.value)} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label className="text-xs">Deri</Label>
                        <Input type="time" value={row.endTime} onChange={(e) => updateScheduleRow(row.id, "endTime", e.target.value)} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label className="text-xs">Shënime</Label>
                        <Input value={row.notes} onChange={(e) => updateScheduleRow(row.id, "notes", e.target.value)} placeholder="Opsionale" />
                      </div>
                      <div className="flex items-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => removeScheduleRow(row.id)}
                          disabled={scheduleRows.length === 1 && idx === 0}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  <Button type="button" variant="outline" size="sm" onClick={addScheduleRow}>
                    + Shto datë/orë
                  </Button>
                </div>
              )}

              {scheduleDuplicateDateSet.size > 0 && (
                <p className="text-sm text-destructive">Nuk lejohet data e njëjtë më shumë se një herë.</p>
              )}
              {scheduleError && <p className="text-sm text-destructive">{scheduleError}</p>}

              <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
                <Button type="button" variant="ghost" onClick={closeScheduleModal}>Anulo</Button>
                <Button type="button" onClick={saveSchedule} disabled={scheduleSaving || scheduleLoading || scheduleDuplicateDateSet.size > 0}>
                  {scheduleSaving ? "Duke ruajtur..." : "Ruaj Orarin"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {endingStazhStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-lg">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <h3 className="text-base font-semibold text-foreground">Mbyll Stazhin</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {endingStazhStudent.firstName} {endingStazhStudent.lastName} • {endingStazhStudent.memberRegistryNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={closeEndStazhModal}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-6">
              <div>
                <Label className="text-sm font-medium">Vlerësimi i mentorit</Label>
                <div className="mt-2 flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      key={rating}
                      type="button"
                      onClick={() => setEndingStazhRating(rating)}
                      className="rounded-md p-1"
                    >
                      <Star className={`h-5 w-5 ${endingStazhRating >= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                    </button>
                  ))}
                  <span className="ml-2 text-xs text-muted-foreground">{endingStazhRating}/5</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Koment i mentorit</Label>
                <Textarea
                  value={endingStazhComment}
                  onChange={(e) => setEndingStazhComment(e.target.value)}
                  placeholder="Koment për ecurinë e studentit (opsionale)"
                  className="min-h-[100px]"
                />
              </div>

              {endingStazhError && <p className="text-sm text-destructive">{endingStazhError}</p>}

              <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
                <Button type="button" variant="ghost" onClick={closeEndStazhModal} disabled={endingStazhSaving}>
                  Anulo
                </Button>
                <Button type="button" onClick={submitEndStazh} disabled={endingStazhSaving}>
                  {endingStazhSaving ? "Duke ruajtur..." : "Mbyll stazhin"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

type EvalSubTab = "results" | "questionnaires"

function StudentCalendarView() {

  // My Modules state
  const [myModules, setMyModules] = useState<StudentMyModuleResponse[]>([])
  const [myModulesLoading, setMyModulesLoading] = useState(true)
  const [showModuleScanner, setShowModuleScanner] = useState(false)
  const [moduleScanManualToken, setModuleScanManualToken] = useState("")
  const [moduleScanNotice, setModuleScanNotice] = useState("")
  const [moduleScanError, setModuleScanError] = useState("")
  const [moduleScanBusy, setModuleScanBusy] = useState(false)
  const moduleScanInFlightRef = useRef(false)
  const lastModuleScannedTokenRef = useRef<{ token: string; at: number } | null>(null)

  // Topic documents popup
  const [selectedTopic, setSelectedTopic] = useState<{ topic: StudentMyTopicResponse; moduleName: string } | null>(null)
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null)

  async function loadMyModules() {
    setMyModulesLoading(true)
    try {
      const data = (await fetchApi("/StudentModules/my-modules")) as StudentMyModuleResponse[]
      setMyModules(data)
    } catch {
      setMyModules([])
    } finally {
      setMyModulesLoading(false)
    }
  }

  useEffect(() => {
    void loadMyModules()
  }, [])

  async function scanModuleToken(token: string) {
    if (moduleScanInFlightRef.current) return
    const now = Date.now()
    const last = lastModuleScannedTokenRef.current
    if (last && last.token === token && now - last.at < 5000) return
    lastModuleScannedTokenRef.current = { token, at: now }

    moduleScanInFlightRef.current = true
    setModuleScanBusy(true)
    setModuleScanError("")
    setModuleScanNotice("")

    try {
      const raw = token.startsWith("IEKA-SM:") ? token.slice(8)
        : (() => { try { const u = new URL(token); return u.searchParams.get("token") ?? token } catch { return token } })()
      const result = (await fetchApi("/StudentModules/scan", {
        method: "POST",
        body: JSON.stringify({ qrToken: raw }),
      })) as ScanModuleAttendanceResponse
      setModuleScanNotice("Prezenca u konfirmua me sukses!")
      setShowModuleScanner(false)
      void loadMyModules()
    } catch (e: any) {
      setModuleScanError(e?.message ?? "Gabim gjatë skanimit.")
    } finally {
      setModuleScanBusy(false)
      moduleScanInFlightRef.current = false
    }
  }

  function handleModuleScannerResult(result: any[]) {
    if (!result || result.length === 0) return
    const text = result[0]?.rawValue ?? result[0]?.text ?? ""
    if (text && (text.includes("IEKA-SM:") || text.includes("/scan/attendance"))) {
      void scanModuleToken(text)
    }
  }

  async function handleDownloadDocument(doc: { id: string; fileName: string; fileUrl: string }) {
    setDownloadingDocId(doc.id)
    try {
      const response = await fetchWithAuth(doc.fileUrl, { method: "GET" })
      if (!response.ok) throw new Error("Nuk u hap dokumenti.")
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = doc.fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch {
      // silent fail
    } finally {
      setDownloadingDocId(null)
    }
  }

  // All topic dates for the date overview
  const allTopicDates = useMemo(() => {
    const dates: { date: string; topicName: string; moduleName: string; location?: string | null; attended: boolean }[] = []
    myModules.forEach((mod) => {
      mod.topics.forEach((t) => {
        if (t.scheduledDate) {
          dates.push({ date: t.scheduledDate, topicName: t.name, moduleName: mod.title, location: t.location, attended: t.attended })
        }
      })
    })
    return dates.sort((a, b) => a.date.localeCompare(b.date))
  }, [myModules])

  const upcomingTopics = useMemo(() => {
    const now = new Date().toISOString()
    return allTopicDates.filter((t) => t.date >= now)
  }, [allTopicDates])

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
      <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Library className="h-5 w-5 text-primary" />
            Modulet e Mia
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">Modulet ku jeni caktuar, temat dhe dokumentet</p>
        </div>
      </div>

      {moduleScanNotice && (
        <p className="mb-3 rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs text-green-700">
          {moduleScanNotice}
        </p>
      )}

      {/* Upcoming topics dates */}
      {!myModulesLoading && upcomingTopics.length > 0 && (
        <div className="mb-5 rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            Datat e ardhshme
          </h3>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Data</th>
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Tema</th>
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Moduli</th>
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Vendndodhja</th>
                </tr>
              </thead>
              <tbody>
                {upcomingTopics.slice(0, 8).map((t, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 text-xs text-foreground">{format(parseISO(t.date), "dd MMM yyyy, HH:mm")}</td>
                    <td className="px-3 py-2 text-xs text-foreground font-medium">{t.topicName}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{t.moduleName}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{t.location ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {myModulesLoading ? (
        <div className="rounded-xl border border-border bg-card px-5 py-8 text-sm text-muted-foreground">
          Duke ngarkuar modulet...
        </div>
      ) : myModules.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
          <Library className="mb-3 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Nuk keni asnjë modul të caktuar akoma.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {myModules.map((mod) => (
            <div key={mod.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                      mod.yearGrade === 1
                        ? "bg-blue-500/10 text-blue-600"
                        : mod.yearGrade === 2
                          ? "bg-purple-500/10 text-purple-600"
                          : "bg-emerald-500/10 text-emerald-600"
                    )}>
                      Viti {mod.yearGrade}
                    </span>
                    <h3 className="text-sm font-semibold text-foreground">{mod.title}</h3>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {mod.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {mod.location}
                      </span>
                    )}
                    <span>{mod.topics.length} temë</span>
                  </div>
                </div>
              </div>

              {/* Nested topics */}
              {mod.topics.length > 0 && (
                <div className="mt-3 space-y-1.5 border-t border-border pt-3">
                  {mod.topics.map((topic) => (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() => setSelectedTopic({ topic, moduleName: mod.title })}
                      className="flex w-full items-center justify-between gap-2 rounded-lg bg-muted/30 px-3 py-2 text-left transition-colors hover:bg-muted/60 cursor-pointer"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-foreground">{topic.name}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                          <span>Lektori: <strong className="text-foreground">{topic.lecturer}</strong></span>
                          {topic.scheduledDate && (
                            <span className="inline-flex items-center gap-0.5">
                              <CalendarDays className="h-2.5 w-2.5" />
                              {format(parseISO(topic.scheduledDate), "dd MMM yyyy, HH:mm")}
                            </span>
                          )}
                          {topic.location && (
                            <span className="inline-flex items-center gap-0.5">
                              <MapPin className="h-2.5 w-2.5" />
                              {topic.location}
                            </span>
                          )}
                          {topic.documentCount > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-primary">
                              <FileText className="h-2.5 w-2.5" />
                              {topic.documentCount} dokument{topic.documentCount > 1 ? "e" : ""}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        {(() => {
                          const topicIsToday = topic.scheduledDate ? format(parseISO(topic.scheduledDate), "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd") : false
                          return topicIsToday && !topic.attended ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span
                                  role="button"
                                  tabIndex={0}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setShowModuleScanner(true)
                                    setModuleScanNotice("")
                                    setModuleScanError("")
                                    setModuleScanManualToken("")
                                  }}
                                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); e.preventDefault(); setShowModuleScanner(true); setModuleScanNotice(""); setModuleScanError(""); setModuleScanManualToken("") } }}
                                  className="inline-flex items-center justify-center rounded-md p-1 text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                                >
                                  <ScanLine className="h-3.5 w-3.5" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top">Skano</TooltipContent>
                            </Tooltip>
                          ) : null
                        })()}
                        {topic.attended ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            Prezent
                          </span>
                        ) : topic.scheduledDate && new Date(topic.scheduledDate) > new Date() ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-600">
                            Në pritje
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                            Pa prezencë
                          </span>
                        )}
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Module QR Scanner Modal */}
      {showModuleScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card shadow-lg">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Skano Kodin QR të Modulit</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">Skanoni kodin QR që shfaqet nga mentori/admini</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowModuleScanner(false)
                  setModuleScanError("")
                }}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="aspect-square overflow-hidden rounded-lg border border-border">
                <Scanner
                  onScan={(result) => {
                    handleModuleScannerResult(result)
                  }}
                  components={{ onOff: true, torch: true, zoom: false, finder: true }}
                  styles={{ container: { width: "100%", height: "100%" } }}
                />
              </div>

              <p className="text-xs text-muted-foreground text-center">ose vendosni kodin manualisht:</p>

              <div className="flex items-center gap-2">
                <Input
                  value={moduleScanManualToken}
                  onChange={(e) => setModuleScanManualToken(e.target.value)}
                  placeholder="Vendos token-in QR të modulit"
                  className="h-9 text-xs font-mono"
                />
                <Button
                  type="button"
                  size="sm"
                  className="h-9 px-3"
                  disabled={moduleScanBusy || !moduleScanManualToken.trim()}
                  onClick={() => {
                    void scanModuleToken(moduleScanManualToken)
                  }}
                >
                  {moduleScanBusy ? "..." : "Konfirmo"}
                </Button>
              </div>

              {moduleScanError && (
                <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {moduleScanError}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Topic Detail Modal */}
      {selectedTopic && (() => {
        const t = selectedTopic.topic
        const docs = t.documents ?? []
        const isToday = t.scheduledDate ? format(parseISO(t.scheduledDate), "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd") : false
        const isPast = t.scheduledDate ? new Date(t.scheduledDate) < new Date() && !isToday : false
        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/40 backdrop-blur-sm" onClick={() => setSelectedTopic(null)}>
            <div
              className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-2xl animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-2 duration-200 max-h-[92vh] sm:max-h-[80vh] flex flex-col sm:mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drag handle (mobile) */}
              <div className="flex justify-center pt-3 pb-1 sm:hidden">
                <div className="h-1 w-10 rounded-full bg-border" />
              </div>

              {/* Header */}
              <div className="flex items-start justify-between gap-3 px-5 pt-2 sm:pt-5 pb-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    {isToday && (
                      <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">Sot</span>
                    )}
                    {t.attended ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-600">
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        Prezent
                      </span>
                    ) : isPast ? (
                      <span className="rounded-full bg-red-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-red-600">Pa prezencë</span>
                    ) : (
                      <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-blue-600">Në pritje</span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-foreground leading-tight">{t.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{selectedTopic.moduleName}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTopic(null)}
                  className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0 -mr-1 -mt-1"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4">
                {/* Info grid */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Lektori</span>
                    </div>
                    <p className="text-sm font-semibold text-foreground leading-snug">{t.lecturer}</p>
                  </div>
                  {t.scheduledDate && (
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Data</span>
                      </div>
                      <p className="text-sm font-semibold text-foreground leading-snug">{format(parseISO(t.scheduledDate), "dd MMM yyyy")}</p>
                      <p className="text-xs text-muted-foreground">{format(parseISO(t.scheduledDate), "HH:mm")}</p>
                    </div>
                  )}
                  {t.location && (
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Vendndodhja</span>
                      </div>
                      <p className="text-sm font-semibold text-foreground leading-snug">{t.location}</p>
                    </div>
                  )}
                  {t.attended && t.attendedAt && (
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="text-[10px] font-medium uppercase tracking-wider text-emerald-600">Prezenca</span>
                      </div>
                      <p className="text-sm font-semibold text-emerald-700 leading-snug">{format(parseISO(t.attendedAt), "dd MMM yyyy")}</p>
                      <p className="text-xs text-emerald-600">{format(parseISO(t.attendedAt), "HH:mm")}</p>
                    </div>
                  )}
                </div>

                {/* Scan QR for today's topic */}
                {isToday && !t.attended && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTopic(null)
                      setShowModuleScanner(true)
                      setModuleScanNotice("")
                      setModuleScanError("")
                      setModuleScanManualToken("")
                    }}
                    className="flex w-full items-center gap-3 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-4 text-left transition-colors hover:bg-primary/10 hover:border-primary/60 active:scale-[0.98]"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <ScanLine className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Skano kodin QR</p>
                      <p className="text-xs text-muted-foreground">Regjistro prezencën për këtë temë</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
                  </button>
                )}

                {/* Documents */}
                {docs.length > 0 ? (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2.5">
                      <FileText className="h-3.5 w-3.5 text-primary" />
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dokumentet ({docs.length})</h4>
                    </div>
                    <div className="space-y-1.5">
                      {docs.map((doc) => (
                        <div key={doc.id} className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/10 px-3 py-2.5 transition-colors hover:bg-muted/30">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                            <FileText className="h-4 w-4 text-blue-500" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground truncate">{doc.fileName}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {(doc.sizeBytes / 1024).toFixed(0)} KB • {format(parseISO(doc.uploadedAt), "dd MMM yyyy")}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 shrink-0 hover:bg-primary/10"
                            disabled={downloadingDocId === doc.id}
                            onClick={() => void handleDownloadDocument(doc)}
                          >
                            <Download className={cn("h-4 w-4 text-primary", downloadingDocId === doc.id && "animate-pulse")} />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : t.documentCount > 0 ? (
                  <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/10 p-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                      <FileText className="h-4 w-4 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{t.documentCount} dokument{t.documentCount > 1 ? "e" : ""}</p>
                      <p className="text-[11px] text-muted-foreground">Disponohen pas rinisjes së serverit</p>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )
      })()}
      </>
    </div>
  )
}

export function StudentEvaluationsView() {
  const [evalSubTab, setEvalSubTab] = useState<EvalSubTab>("results")
  const [myModules, setMyModules] = useState<StudentMyModuleResponse[]>([])
  const [myModulesLoading, setMyModulesLoading] = useState(true)
  const [myQResponses, setMyQResponses] = useState<MyQuestionnaireResponseItem[]>([])
  const [myQLoading, setMyQLoading] = useState(false)
  const [expandedQResponse, setExpandedQResponse] = useState<string | null>(null)

  useEffect(() => {
    setMyModulesLoading(true)
    fetchApi("/StudentModules/my-modules")
      .then((data) => setMyModules(data as StudentMyModuleResponse[]))
      .catch(() => setMyModules([]))
      .finally(() => setMyModulesLoading(false))
  }, [])

  useEffect(() => {
    if (evalSubTab === "questionnaires" && myQResponses.length === 0 && !myQLoading) {
      setMyQLoading(true)
      fetchApi("/StudentModules/my-questionnaire-responses")
        .then((data) => setMyQResponses((data ?? []) as MyQuestionnaireResponseItem[]))
        .catch(() => setMyQResponses([]))
        .finally(() => setMyQLoading(false))
    }
  }, [evalSubTab])

  const modulesWithResults = useMemo(() => myModules.filter(m => m.result), [myModules])

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-foreground flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-primary" />
          Vlerësimet
        </h1>
        <p className="mt-0.5 text-xs text-muted-foreground">Vlerësimet e moduleve dhe pyetësorët e plotësuar</p>
      </div>

      <div className="mb-5 flex items-center gap-1 border-b border-border">
        <button
          onClick={() => setEvalSubTab("results")}
          className={cn(
            "whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
            evalSubTab === "results" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
          )}
        >
          <span className="inline-flex items-center gap-1.5">
            <GraduationCap className="h-3.5 w-3.5" />
            Vlerësimi i modulit
          </span>
        </button>
        <button
          onClick={() => setEvalSubTab("questionnaires")}
          className={cn(
            "whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
            evalSubTab === "questionnaires" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
          )}
        >
          <span className="inline-flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Pyetësorët
          </span>
        </button>
      </div>

      {evalSubTab === "results" && (
        <div>
          {myModulesLoading ? (
            <div className="rounded-xl border border-border bg-card px-5 py-8 text-sm text-muted-foreground">
              Duke ngarkuar...
            </div>
          ) : modulesWithResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
              <GraduationCap className="mb-3 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Nuk ka vlerësime ende për modulet tuaja.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {modulesWithResults.map((mod) => (
                <div key={mod.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn(
                          "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                          mod.yearGrade === 1
                            ? "bg-blue-500/10 text-blue-600"
                            : mod.yearGrade === 2
                              ? "bg-purple-500/10 text-purple-600"
                              : "bg-emerald-500/10 text-emerald-600"
                        )}>
                          Viti {mod.yearGrade}
                        </span>
                        <h3 className="text-sm font-semibold text-foreground">{mod.title}</h3>
                      </div>
                      {mod.location && (
                        <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {mod.location}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <span className={cn(
                        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold",
                        mod.result?.toLowerCase() === "kaluar" || mod.result?.toLowerCase() === "kalueshëm"
                          ? "bg-green-500/10 text-green-600"
                          : mod.result?.toLowerCase() === "ngelur" || mod.result?.toLowerCase() === "nuk ka kaluar"
                            ? "bg-red-500/10 text-red-600"
                            : "bg-amber-500/10 text-amber-600"
                      )}>
                        {mod.result}
                      </span>
                    </div>
                  </div>
                  {(mod.resultNote || mod.resultSetAt) && (
                    <div className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
                      {mod.resultNote && <p>{mod.resultNote}</p>}
                      {mod.resultSetAt && (
                        <p className="mt-0.5 flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />
                          Vendosur më {format(parseISO(mod.resultSetAt), "dd MMM yyyy, HH:mm")}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {evalSubTab === "questionnaires" && (
        <div>
          {myQLoading ? (
            <div className="rounded-xl border border-border bg-card px-5 py-8 text-sm text-muted-foreground">
              Duke ngarkuar pyetësorët...
            </div>
          ) : myQResponses.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
              <FileText className="mb-3 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Nuk keni plotësuar asnjë pyetësor ende.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {myQResponses.map((resp) => (
                <div key={resp.responseId} className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedQResponse(expandedQResponse === resp.responseId ? null : resp.responseId)}
                    className="flex w-full items-center justify-between gap-3 p-4 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          resp.yearGrade === 1
                            ? "bg-blue-500/10 text-blue-600"
                            : resp.yearGrade === 2
                              ? "bg-purple-500/10 text-purple-600"
                              : "bg-emerald-500/10 text-emerald-600"
                        )}>
                          Viti {resp.yearGrade}
                        </span>
                        <p className="text-sm font-semibold text-foreground">{resp.questionnaireTitle}</p>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {resp.topicName} • {resp.moduleName}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        Plotësuar më {format(parseISO(resp.submittedAt), "dd MMM yyyy, HH:mm")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2.5 py-1 text-[11px] font-medium text-green-600">
                        <CheckCircle2 className="h-3 w-3" />
                        Plotësuar
                      </span>
                      <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", expandedQResponse === resp.responseId && "rotate-90")} />
                    </div>
                  </button>
                  {expandedQResponse === resp.responseId && (
                    <div className="border-t border-border px-4 pb-4">
                      <div className="mt-3 space-y-2">
                        {resp.answers.map((a, i) => (
                          <div key={a.questionId} className="rounded-lg bg-muted/30 p-3">
                            <p className="text-xs text-muted-foreground mb-1">
                              {i + 1}. {a.questionText}
                              <span className={cn(
                                "ml-2 inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium",
                                a.questionType === "Stars" ? "bg-amber-500/10 text-amber-600"
                                  : a.questionType === "Options" ? "bg-blue-500/10 text-blue-600"
                                    : "bg-muted text-muted-foreground"
                              )}>
                                {a.questionType === "Stars" ? "Yje" : a.questionType === "Options" ? "Opsione" : "Tekst i lirë"}
                              </span>
                            </p>
                            {a.questionType === "Stars" ? (
                              <div className="flex items-center gap-0.5">
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <Star
                                    key={s}
                                    className={cn("h-4 w-4", s <= Number(a.answer) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")}
                                  />
                                ))}
                                <span className="ml-1 text-xs text-muted-foreground">({a.answer}/5)</span>
                              </div>
                            ) : (
                              <p className="text-sm text-foreground">{a.answer}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SortableTh({
  label,
  sortKey,
  current,
  dir,
  onSort,
  className = "",
}: {
  label: string
  sortKey: SortKey
  current: SortKey
  dir: SortDir
  onSort: (k: SortKey) => void
  className?: string
}) {
  const isActive = current === sortKey
  return (
    <th className={`px-4 py-3 text-xs font-medium text-muted-foreground ${className}`}>
      <button onClick={() => onSort(sortKey)} className={`flex items-center gap-1 hover:text-foreground transition-colors ${isActive ? "text-foreground" : ""}`}>
        {label}
        {isActive ? dir === "asc" ? <ChevronUp className="h-3 w-3 text-primary" /> : <ChevronDown className="h-3 w-3 text-primary" /> : <ChevronsUpDown className="h-3 w-3 opacity-40" />}
      </button>
    </th>
  )
}
