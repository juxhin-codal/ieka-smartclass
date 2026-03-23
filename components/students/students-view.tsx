"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { format, parseISO } from "date-fns"
import { useAuth } from "@/lib/auth-context"
import { fetchApi } from "@/lib/api-client"
import { useEvents } from "@/lib/events-context"
import { AdminPasswordResetCard } from "@/components/admin/admin-password-reset-card"
import { StudentHistoryModal } from "@/components/students/student-history-modal"
import { formatStudentTrackingCode, generateStudentNumber, parseStudentTrackingNumber } from "@/lib/student-registry"
import type {
  AppUser,
  MentorAttendanceQrResponse,
  StudentAttendanceDayResponse,
  StudentAttendanceScanResponse,
  StudentTrainingCalendarResponse,
  StudentTrainingQrResponse,
  StudentTrainingSession,
  StudentTrainingStazh,
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
} from "lucide-react"
import { PaginationBar, usePagination, type PageSize } from "@/components/ui/pagination-bar"

type SortKey = "name" | "attendance" | "mentor"
type SortDir = "asc" | "desc"
type ManagementTab = "students" | "attendance"

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
  return String(new Date().getFullYear() + 2)
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

  return `${studentEndYear}-12`
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

export function StudentEvaluationsView() {
  return <StudentFeedbackView />
}

export function MentorAttendanceView() {
  return <MentorAdminStudentsView forcedTab="attendance" />
}

function MentorAdminStudentsView({ forcedTab }: { forcedTab?: ManagementTab } = {}) {
  const { user } = useAuth()
  const { users, addUser, updateMember, deleteUser } = useEvents()

  const isAdmin = user?.role === "Admin"
  const isMentor = user?.role === "Mentor"

  const [activeTab, setActiveTab] = useState<ManagementTab>(forcedTab ?? (isMentor ? "attendance" : "students"))
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
  const [newStudentStartYear, setNewStudentStartYear] = useState(getDefaultStudentStartYear())
  const [newStudentEndYear, setNewStudentEndYear] = useState(getDefaultStudentEndYear())
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
  const [editStudentStartYear, setEditStudentStartYear] = useState("")
  const [editStudentEndYear, setEditStudentEndYear] = useState("")
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

  const [attendanceDate, setAttendanceDate] = useState(toDateInputValue(new Date()))
  const [attendanceMentorId, setAttendanceMentorId] = useState("")
  const [attendanceData, setAttendanceData] = useState<StudentAttendanceDayResponse | null>(null)
  const [attendanceLoading, setAttendanceLoading] = useState(false)
  const [attendanceError, setAttendanceError] = useState("")
  const [attendanceUpdatingKey, setAttendanceUpdatingKey] = useState<string | null>(null)
  const [rejectAttendanceSession, setRejectAttendanceSession] = useState<StudentTrainingSession | null>(null)
  const [rejectAttendanceReason, setRejectAttendanceReason] = useState("")
  const [rejectAttendanceSaving, setRejectAttendanceSaving] = useState(false)
  const [rejectAttendanceError, setRejectAttendanceError] = useState("")
  const [showAttendanceScanner, setShowAttendanceScanner] = useState(false)
  const [scanManualToken, setScanManualToken] = useState("")
  const [scanNotice, setScanNotice] = useState("")
  const [scanError, setScanError] = useState("")
  const [scanBusy, setScanBusy] = useState(false)
  const [showMentorAttendanceQr, setShowMentorAttendanceQr] = useState(false)
  const [mentorAttendanceQrData, setMentorAttendanceQrData] = useState<MentorAttendanceQrResponse | null>(null)
  const [mentorAttendanceQrLoading, setMentorAttendanceQrLoading] = useState(false)
  const [mentorAttendanceQrError, setMentorAttendanceQrError] = useState("")
  const scanInFlightRef = useRef(false)
  const lastScannedTokenRef = useRef<{ token: string; at: number } | null>(null)

  const [endingStazhStudent, setEndingStazhStudent] = useState<AppUser | null>(null)
  const [endingStazhRating, setEndingStazhRating] = useState(5)
  const [endingStazhComment, setEndingStazhComment] = useState("")
  const [endingStazhSaving, setEndingStazhSaving] = useState(false)
  const [endingStazhError, setEndingStazhError] = useState("")

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

  const pagedStudents = usePagination(filteredStudents, pageSize, currentPage)
  const scheduleDuplicateDateSet = useMemo(() => getDuplicateScheduleDates(scheduleRows), [scheduleRows])
  const newStudentStartYearNumber = parseStudentYear(newStudentStartYear)
  const newStudentEndYearNumber = parseStudentYear(newStudentEndYear)
  const editStudentStartYearNumber = parseStudentYear(editStudentStartYear)
  const editStudentEndYearNumber = parseStudentYear(editStudentEndYear)
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
  const newStartYearOptions = useMemo(
    () => STUDENT_YEAR_OPTIONS.filter((year) => !newStudentEndYearNumber || Number.parseInt(year, 10) <= newStudentEndYearNumber),
    [newStudentEndYearNumber]
  )
  const newEndYearOptions = useMemo(
    () => STUDENT_YEAR_OPTIONS.filter((year) => !newStudentStartYearNumber || Number.parseInt(year, 10) >= newStudentStartYearNumber),
    [newStudentStartYearNumber]
  )
  const editStartYearOptions = useMemo(
    () => STUDENT_YEAR_OPTIONS.filter((year) => !editStudentEndYearNumber || Number.parseInt(year, 10) <= editStudentEndYearNumber),
    [editStudentEndYearNumber]
  )
  const editEndYearOptions = useMemo(
    () => STUDENT_YEAR_OPTIONS.filter((year) => !editStudentStartYearNumber || Number.parseInt(year, 10) >= editStudentStartYearNumber),
    [editStudentStartYearNumber]
  )

  const enabledAttendanceDates = useMemo(() => attendanceData?.enabledDates ?? [], [attendanceData])
  const enabledAttendanceDateSet = useMemo(() => new Set(enabledAttendanceDates), [enabledAttendanceDates])
  const attendanceSelectedIndex = enabledAttendanceDates.indexOf(attendanceDate)
  const attendancePrevDate = attendanceSelectedIndex > 0 ? enabledAttendanceDates[attendanceSelectedIndex - 1] : null
  const attendanceNextDate =
    attendanceSelectedIndex >= 0 && attendanceSelectedIndex < enabledAttendanceDates.length - 1
      ? enabledAttendanceDates[attendanceSelectedIndex + 1]
      : null
  const attendanceActionsAllowed = attendanceDate === toDateInputValue(new Date())

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
    if (!newMentorId) {
      setError("Ju lutem zgjidhni mentorin për studentin.")
      return
    }
    if (!newStudentStartYearNumber || !newStudentEndYearNumber) {
      setError("Ju lutem plotësoni vitin e fillimit dhe vitin e mbarimit.")
      return
    }
    if (newStudentEndYearNumber < newStudentStartYearNumber) {
      setError("Viti i mbarimit nuk mund të jetë më i vogël se viti i fillimit.")
      return
    }
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
        mentorId: newMentorId,
        validUntilMonth: toStudentValidUntilMonth(newStudentEndYearNumber),
        studentTrackingNumber: newStudentTrackingNumber,
        studentNumber: newRegistry.trim().toUpperCase(),
        studentStartYear: newStudentStartYearNumber,
        studentEndYear: newStudentEndYearNumber,
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
      setNewStudentStartYear(getDefaultStudentStartYear())
      setNewStudentEndYear(getDefaultStudentEndYear())
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
    setEditPhone(student.phone ?? "")
    setEditStudentStartYear(student.studentStartYear ? String(student.studentStartYear) : "")
    setEditStudentEndYear(student.studentEndYear ? String(student.studentEndYear) : "")
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

    if (!editMentorId) {
      setEditError("Ju lutem zgjidhni mentorin për studentin.")
      return
    }
    if (!editStudentStartYearNumber || !editStudentEndYearNumber) {
      setEditError("Ju lutem plotësoni vitin e fillimit dhe vitin e mbarimit.")
      return
    }
    if (editStudentEndYearNumber < editStudentStartYearNumber) {
      setEditError("Viti i mbarimit nuk mund të jetë më i vogël se viti i fillimit.")
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
        role: "Student",
        mentorId: editMentorId,
        validUntilMonth: toStudentValidUntilMonth(editStudentEndYearNumber),
        studentTrackingNumber: editStudentTrackingNumber,
        studentNumber: editRegistry.trim().toUpperCase(),
        studentStartYear: editStudentStartYearNumber,
        studentEndYear: editStudentEndYearNumber,
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
      if (activeTab === "attendance") {
        await loadAttendance(attendanceDate)
      }
    } catch (e: any) {
      setScheduleError(e?.message ?? "Gabim gjatë ruajtjes së orarit.")
    } finally {
      setScheduleSaving(false)
    }
  }

  async function loadAttendance(targetDate: string) {
    setAttendanceLoading(true)
    setAttendanceError("")
    try {
      const params = new URLSearchParams({ date: targetDate })
      if (isAdmin && attendanceMentorId) {
        params.set("mentorId", attendanceMentorId)
      }
      const data = (await fetchApi(`/StudentTraining/attendance?${params.toString()}`)) as StudentAttendanceDayResponse
      setAttendanceData(data)
    } catch (e: any) {
      setAttendanceData(null)
      setAttendanceError(e?.message ?? "Gabim gjatë ngarkimit të prezencës.")
    } finally {
      setAttendanceLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab !== "attendance") return
    void loadAttendance(attendanceDate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, attendanceDate, attendanceMentorId])

  useEffect(() => {
    if (!attendanceData) return
    if (attendanceData.enabledDates.length === 0) return
    if (attendanceData.enabledDates.includes(attendanceDate)) return

    const today = toDateInputValue(new Date())
    const fallback = attendanceData.enabledDates.find((d) => d >= today) ?? attendanceData.enabledDates[0]
    setAttendanceDate(fallback)
  }, [attendanceData, attendanceDate])

  function openRejectAttendanceModal(session: StudentTrainingSession) {
    setRejectAttendanceSession(session)
    setRejectAttendanceReason("")
    setRejectAttendanceError("")
  }

  function closeRejectAttendanceModal() {
    if (rejectAttendanceSaving) return
    setRejectAttendanceSession(null)
    setRejectAttendanceReason("")
    setRejectAttendanceError("")
  }

  async function markAttendance(
    session: StudentTrainingSession,
    status: "attended" | "rejected",
    reasonOverride?: string | null
  ) {
    let reason: string | null = reasonOverride ?? null
    if (status === "rejected" && reasonOverride === undefined) {
      openRejectAttendanceModal(session)
      return false
    }

    const updateKey = `${session.id}-${status}`
    setAttendanceUpdatingKey(updateKey)
    try {
      await fetchApi(`/StudentTraining/sessions/${session.id}/attendance`, {
        method: "PUT",
        body: JSON.stringify({
          status,
          reason,
        }),
      })
      await loadAttendance(attendanceDate)
      return true
    } catch (e: any) {
      const message = e?.message ?? "Gabim gjatë përditësimit të prezencës."
      setAttendanceError(message)
      if (status === "rejected") {
        setRejectAttendanceError(message)
      }
      return false
    } finally {
      setAttendanceUpdatingKey(null)
    }
  }

  async function submitRejectAttendance() {
    if (!rejectAttendanceSession) return

    setRejectAttendanceSaving(true)
    setRejectAttendanceError("")
    const ok = await markAttendance(
      rejectAttendanceSession,
      "rejected",
      rejectAttendanceReason.trim() || null
    )
    setRejectAttendanceSaving(false)

    if (ok) {
      closeRejectAttendanceModal()
    }
  }

  async function scanAttendanceToken(token: string) {
    const trimmedToken = token.trim()
    if (!trimmedToken) return
    const now = Date.now()
    const previous = lastScannedTokenRef.current
    if (scanInFlightRef.current) return
    if (previous && previous.token === trimmedToken && now - previous.at < 2500) {
      return
    }

    scanInFlightRef.current = true
    setScanBusy(true)
    setScanError("")
    setScanNotice("")
    try {
      const response = (await fetchApi("/StudentTraining/attendance/scan", {
        method: "POST",
        body: JSON.stringify({ qrToken: trimmedToken }),
      })) as StudentAttendanceScanResponse

      setScanNotice(response.message)
      setScanManualToken("")
      lastScannedTokenRef.current = { token: trimmedToken, at: Date.now() }
      await loadAttendance(attendanceDate)
      setTimeout(() => {
        setShowAttendanceScanner(false)
      }, 900)
    } catch (e: any) {
      setScanError(e?.message ?? "Gabim gjatë skanimit të QR.")
    } finally {
      setScanBusy(false)
      scanInFlightRef.current = false
    }
  }

  async function openMentorAttendanceQrModal() {
    setShowMentorAttendanceQr(true)
    setMentorAttendanceQrData(null)
    setMentorAttendanceQrError("")
    setMentorAttendanceQrLoading(true)
    try {
      const data = (await fetchApi(`/MentorQr/today?date=${encodeURIComponent(attendanceDate)}`)) as MentorAttendanceQrResponse
      setMentorAttendanceQrData(data)
    } catch (e: any) {
      setMentorAttendanceQrError(e?.message ?? "Gabim gjatë gjenerimit të QR të mentorit.")
    } finally {
      setMentorAttendanceQrLoading(false)
    }
  }

  async function handleScannerResult(result: any) {
    if (!result || scanBusy) return
    try {
      const rawValue = Array.isArray(result)
        ? result[0]?.rawValue ?? result[0]?.text
        : result.rawValue ?? result.text ?? result
      if (!rawValue || typeof rawValue !== "string") return
      await scanAttendanceToken(rawValue)
    } catch {
      setScanError("Kodi QR është i pavlefshëm.")
    }
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
      if (activeTab === "attendance") {
        await loadAttendance(attendanceDate)
      }
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
            ) : (
              <GraduationCap className="h-5 w-5 text-primary" />
            )}
            {activeTab === "attendance" ? "Prezenca" : "Studentë"}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {activeTab === "attendance"
              ? "Menaxhimi i prezencës dhe skanimit QR për studentët"
              : "Menaxhimi i studentëve dhe orarit të stazhit"}
          </p>
        </div>
        {isAdmin && activeTab === "students" && (
          <Button size="sm" className="gap-2 shrink-0" onClick={() => setShowAddForm(true)}>
            <UserPlus className="h-4 w-4" /> Shto Student
          </Button>
        )}
      </div>

      {!forcedTab && (
        <div className="mb-6 grid w-full grid-cols-2 gap-2 rounded-2xl border border-border bg-card p-1.5 sm:w-fit">
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
            <div className="mb-6 rounded-xl border border-border bg-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-foreground">Shto Student të Ri</h3>
                <button
                  onClick={() => { setShowAddForm(false); setError(""); setStudentTrackingLoading(false) }}
                  disabled={addingStudent}
                  className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
                  <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+355 69 123 4567" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Viti Fillimit *</Label>
                  <select
                    value={newStudentStartYear}
                    onChange={(e) => {
                      const nextStartYear = e.target.value
                      const nextStartYearNumber = parseStudentYear(nextStartYear)
                      setNewStudentStartYear(nextStartYear)
                      if (nextStartYearNumber && newStudentEndYearNumber && nextStartYearNumber > newStudentEndYearNumber) {
                        setNewStudentEndYear(nextStartYear)
                      }
                    }}
                    className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Zgjidh vitin e fillimit</option>
                    {newStartYearOptions.map((year) => (
                      <option key={`new-start-${year}`} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Viti Mbarimit *</Label>
                  <select
                    value={newStudentEndYear}
                    onChange={(e) => {
                      const nextEndYear = e.target.value
                      const nextEndYearNumber = parseStudentYear(nextEndYear)
                      setNewStudentEndYear(nextEndYear)
                      if (nextEndYearNumber && newStudentStartYearNumber && nextEndYearNumber < newStudentStartYearNumber) {
                        setNewStudentStartYear(nextEndYear)
                      }
                    }}
                    className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Zgjidh vitin e mbarimit</option>
                    {newEndYearOptions.map((year) => (
                      <option key={`new-end-${year}`} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Mentori *</Label>
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
              {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
              <div className="mt-4 flex justify-end gap-2">
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
                            <code className="rounded-full bg-blue-500/10 px-2.5 py-1 text-[10px] font-mono text-blue-700">
                              {getStudentTrackingCode(s) || "—"}
                            </code>
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

                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
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
                        <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
                          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                            Mentori
                          </span>
                          <p className="mt-2 text-sm font-semibold text-foreground">{mentorName}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {isInactiveStudent ? "Orari është i bllokuar derisa studenti të riaktivizohet." : "Menaxho orarin dhe mbylljen e stazhit nga kjo kartë."}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-w-[5.5rem] flex-1 gap-1.5"
                          onClick={() => openScheduleModal(s)}
                          disabled={isInactiveStudent}
                        >
                          <CalendarDays className="h-3.5 w-3.5" />
                          Orari
                        </Button>
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
                              <button
                                type="button"
                                onClick={() => openScheduleModal(s)}
                                disabled={isInactiveStudent}
                                className={cn(
                                  "inline-flex items-center rounded-md border border-border px-2 py-1 text-xs font-medium",
                                  isInactiveStudent
                                    ? "cursor-not-allowed text-muted-foreground/50"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                                title={isInactiveStudent ? "Studenti është jo aktiv" : "Menaxho orarin"}
                              >
                                <CalendarDays className="h-3.5 w-3.5" />
                              </button>
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

      {activeTab === "attendance" && (
        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          <div className="h-fit rounded-2xl border border-border bg-card p-3 sm:p-4">
            <div className="mb-4 flex flex-col gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Data</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {format(parseISO(attendanceDate), "dd MMM yyyy")}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 justify-center gap-2"
                  disabled={!attendancePrevDate}
                  onClick={() => attendancePrevDate && setAttendanceDate(attendancePrevDate)}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Pas
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 justify-center gap-2"
                  disabled={!attendanceNextDate}
                  onClick={() => attendanceNextDate && setAttendanceDate(attendanceNextDate)}
                >
                  Para
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {isAdmin && (
              <div className="mb-4 rounded-xl bg-muted/30 p-3">
                <Label className="text-xs">Filtro sipas mentorit</Label>
                <select
                  value={attendanceMentorId}
                  onChange={(e) => setAttendanceMentorId(e.target.value)}
                  className="mt-1 flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Të gjithë mentorët</option>
                  {mentors.map((mentor) => (
                    <option key={mentor.id} value={mentor.id}>
                      {mentor.firstName} {mentor.lastName} ({mentor.memberRegistryNumber})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <DayCalendar
              mode="single"
              selected={parseISO(attendanceDate)}
              onSelect={(date) => {
                if (!date) return
                const next = toDateInputValue(date)
                if (enabledAttendanceDateSet.has(next)) {
                  setAttendanceDate(next)
                }
              }}
              disabled={(date) => !enabledAttendanceDateSet.has(toDateInputValue(date))}
              className="rounded-xl border border-border bg-card p-2 sm:p-3"
            />
            <p className="mt-3 text-xs text-muted-foreground">
              Aktivizohen vetëm datat ku ka studentë të planifikuar.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-primary" />
                  Prezenca për {format(parseISO(attendanceDate), "dd MMM yyyy")}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {attendanceData?.sessions.length ?? 0} studentë të planifikuar
                </p>
                {!attendanceActionsAllowed && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Veprimet e prezencës shfaqen vetëm për datën e sotme.
                  </p>
                )}
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                {isMentor && attendanceActionsAllowed && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full gap-2 sm:w-auto"
                    onClick={() => {
                      void openMentorAttendanceQrModal()
                    }}
                  >
                    <QrCode className="h-4 w-4" />
                    QR për studentët
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full gap-2 sm:w-auto"
                  onClick={() => {
                    setShowAttendanceScanner(true)
                    setScanError("")
                    setScanNotice("")
                    scanInFlightRef.current = false
                    lastScannedTokenRef.current = null
                  }}
                >
                  <ScanLine className="h-4 w-4" />
                  Skano QR
                </Button>
              </div>
            </div>

            {attendanceLoading ? (
              <p className="text-sm text-muted-foreground">Duke ngarkuar prezencën...</p>
            ) : attendanceError ? (
              <p className="text-sm text-destructive">{attendanceError}</p>
            ) : !attendanceData || attendanceData.sessions.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                Nuk ka studentë të planifikuar për këtë datë.
              </div>
            ) : (
              <>
                <div className="space-y-3 md:hidden">
                  {attendanceData.sessions.map((session) => {
                    const acceptKey = `${session.id}-attended`
                    const rejectKey = `${session.id}-rejected`
                    const isUpdating = attendanceUpdatingKey === acceptKey || attendanceUpdatingKey === rejectKey
                    const isAttended = session.attendanceStatus === "attended"
                    const isRejected = session.attendanceStatus === "rejected"
                    const hasResolvedAttendance = isAttended || isRejected
                    const displayStatus = getAttendanceDisplayStatus(session)

                    return (
                      <div key={session.id} className="rounded-2xl border border-border bg-muted/20 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground">
                              {session.studentFirstName} {session.studentLastName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {session.studentMemberRegistryNumber}
                            </p>
                          </div>
                          <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium", displayStatus.className)}>
                            {displayStatus.label}
                          </span>
                        </div>

                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                          <div className="rounded-xl border border-border/70 bg-card/70 p-3">
                            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                              Ora
                            </span>
                            <div className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
                              <Clock3 className="h-3.5 w-3.5 text-primary" />
                              {session.startTime} - {session.endTime}
                            </div>
                          </div>
                          <div className="rounded-xl border border-border/70 bg-card/70 p-3">
                            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                              Mentori
                            </span>
                            <p className="mt-2 text-sm font-semibold text-foreground">
                              {session.mentorFirstName} {session.mentorLastName}
                            </p>
                          </div>
                        </div>

                        {session.rejectionReason && (
                          <p className="mt-3 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                            Arsye refuzimi: {session.rejectionReason}
                          </p>
                        )}

                        {attendanceActionsAllowed ? (
                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              className="min-w-[6rem] flex-1"
                              variant={isAttended ? "default" : "outline"}
                              disabled={isUpdating || hasResolvedAttendance}
                              onClick={() => markAttendance(session, "attended")}
                            >
                              Prano
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              className="min-w-[6rem] flex-1"
                              variant={isRejected ? "destructive" : "outline"}
                              disabled={isUpdating || hasResolvedAttendance}
                              onClick={() => markAttendance(session, "rejected")}
                            >
                              Mungesë
                            </Button>
                          </div>
                        ) : (
                          <DisabledAttendanceActions
                            isAttended={isAttended}
                            isRejected={isRejected}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>

                <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Studenti</th>
                        <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Ora</th>
                        <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Mentori</th>
                        <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Statusi</th>
                        <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Veprime</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendanceData.sessions.map((session) => {
                        const acceptKey = `${session.id}-attended`
                        const rejectKey = `${session.id}-rejected`
                        const isUpdating = attendanceUpdatingKey === acceptKey || attendanceUpdatingKey === rejectKey
                        const isAttended = session.attendanceStatus === "attended"
                        const isRejected = session.attendanceStatus === "rejected"
                        const hasResolvedAttendance = isAttended || isRejected
                        const displayStatus = getAttendanceDisplayStatus(session)

                        return (
                          <tr key={session.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                            <td className="px-3 py-2 text-xs">
                              <div className="font-medium text-foreground">
                                {session.studentFirstName} {session.studentLastName}
                              </div>
                              <div className="text-muted-foreground">{session.studentMemberRegistryNumber}</div>
                            </td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">
                              <div className="inline-flex items-center gap-1">
                                <Clock3 className="h-3 w-3" />
                                {session.startTime} - {session.endTime}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">
                              {session.mentorFirstName} {session.mentorLastName}
                            </td>
                            <td className="px-3 py-2 text-xs">
                              <span className={cn("rounded px-2 py-0.5 text-[11px] font-medium", displayStatus.className)}>
                                {displayStatus.label}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              {attendanceActionsAllowed ? (
                                <div className="flex items-center gap-1.5">
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="h-7 px-2 text-[11px]"
                                    variant={isAttended ? "default" : "outline"}
                                    disabled={isUpdating || hasResolvedAttendance}
                                    onClick={() => markAttendance(session, "attended")}
                                  >
                                    Prano
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="h-7 px-2 text-[11px]"
                                    variant={isRejected ? "destructive" : "outline"}
                                    disabled={isUpdating || hasResolvedAttendance}
                                    onClick={() => markAttendance(session, "rejected")}
                                  >
                                    Mungesë
                                  </Button>
                                </div>
                              ) : (
                                <DisabledAttendanceActions
                                  compact
                                  isAttended={isAttended}
                                  isRejected={isRejected}
                                />
                              )}
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
        </div>
      )}

      {editingStudent && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-lg">
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
                  <Label>Telefon</Label>
                  <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Viti Fillimit *</Label>
                  <select
                    value={editStudentStartYear}
                    onChange={(e) => {
                      const nextStartYear = e.target.value
                      const nextStartYearNumber = parseStudentYear(nextStartYear)
                      setEditStudentStartYear(nextStartYear)
                      if (nextStartYearNumber && editStudentEndYearNumber && nextStartYearNumber > editStudentEndYearNumber) {
                        setEditStudentEndYear(nextStartYear)
                      }
                    }}
                    className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Zgjidh vitin e fillimit</option>
                    {editStartYearOptions.map((year) => (
                      <option key={`edit-start-${year}`} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Viti Mbarimit *</Label>
                  <select
                    value={editStudentEndYear}
                    onChange={(e) => {
                      const nextEndYear = e.target.value
                      const nextEndYearNumber = parseStudentYear(nextEndYear)
                      setEditStudentEndYear(nextEndYear)
                      if (nextEndYearNumber && editStudentStartYearNumber && nextEndYearNumber < editStudentStartYearNumber) {
                        setEditStudentStartYear(nextEndYear)
                      }
                    }}
                    className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Zgjidh vitin e mbarimit</option>
                    {editEndYearOptions.map((year) => (
                      <option key={`edit-end-${year}`} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Mentori *</Label>
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
                <div className="flex flex-col gap-2">
                  <Label>Statusi i llogarisë</Label>
                  <select
                    value={editIsActive ? "active" : "inactive"}
                    onChange={(e) => setEditIsActive(e.target.value === "active")}
                    className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
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
                <div className="flex flex-col gap-3 sm:flex-row">
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

      {rejectAttendanceSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-lg">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <h3 className="text-base font-semibold text-foreground">Shëno mungesë</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {rejectAttendanceSession.studentFirstName} {rejectAttendanceSession.studentLastName} • {rejectAttendanceSession.studentMemberRegistryNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={closeRejectAttendanceModal}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-6">
              <p className="text-xs text-muted-foreground">
                Sesioni: {format(parseISO(rejectAttendanceSession.date), "dd MMM yyyy")} • {rejectAttendanceSession.startTime} - {rejectAttendanceSession.endTime}
              </p>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Arsyeja e mungesës (opsionale)</Label>
                <Textarea
                  value={rejectAttendanceReason}
                  onChange={(e) => setRejectAttendanceReason(e.target.value)}
                  placeholder="Shkruani arsyen e mungesës..."
                  className="min-h-[100px]"
                />
              </div>

              {rejectAttendanceError && <p className="text-sm text-destructive">{rejectAttendanceError}</p>}

              <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
                <Button type="button" variant="ghost" onClick={closeRejectAttendanceModal} disabled={rejectAttendanceSaving}>
                  Anulo
                </Button>
                <Button type="button" variant="destructive" onClick={submitRejectAttendance} disabled={rejectAttendanceSaving}>
                  {rejectAttendanceSaving ? "Duke ruajtur..." : "Mungesë"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAttendanceScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-lg">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold text-foreground">Skano QR për prezencë</h3>
              <button
                type="button"
                onClick={() => setShowAttendanceScanner(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="overflow-hidden rounded-xl border border-border bg-black aspect-square">
                <Scanner
                  onScan={(result) => {
                    void handleScannerResult(result)
                  }}
                  components={{ onOff: true, torch: true, zoom: false, finder: true }}
                  styles={{ container: { width: "100%", height: "100%" } }}
                />
              </div>

              <p className="text-xs text-muted-foreground">
                Ose vendos manualisht token-in e QR nëse po përdorni skaner hardware.
              </p>

              <div className="flex items-center gap-2">
                <Input
                  value={scanManualToken}
                  onChange={(e) => setScanManualToken(e.target.value)}
                  placeholder="Vendos token-in QR"
                  className="h-9 text-xs font-mono"
                />
                <Button
                  type="button"
                  size="sm"
                  className="h-9 px-3"
                  disabled={scanBusy || !scanManualToken.trim()}
                  onClick={() => {
                    void scanAttendanceToken(scanManualToken)
                  }}
                >
                  {scanBusy ? "..." : "Konfirmo"}
                </Button>
              </div>

              {scanNotice && (
                <p className="rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs text-green-700">
                  {scanNotice}
                </p>
              )}
              {scanError && (
                <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {scanError}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {showMentorAttendanceQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card shadow-lg">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">QR i mentorit</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Studentët e skanojnë për të konfirmuar prezencën e sotme.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowMentorAttendanceQr(false)
                  setMentorAttendanceQrData(null)
                  setMentorAttendanceQrError("")
                }}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 text-center">
              {mentorAttendanceQrLoading ? (
                <p className="text-sm text-muted-foreground">Duke gjeneruar QR...</p>
              ) : mentorAttendanceQrError ? (
                <p className="text-sm text-destructive">{mentorAttendanceQrError}</p>
              ) : mentorAttendanceQrData ? (
                <div className="space-y-3">
                  <div className="inline-block rounded-lg border border-border bg-white p-3">
                    <QRCodeCanvas value={`IEKA-MT:${mentorAttendanceQrData.qrToken}`} size={220} fgColor={"#000000"} bgColor={"#ffffff"} level={"Q"} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Vlen për {format(parseISO(mentorAttendanceQrData.date), "dd MMM yyyy")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Kodi skadon më {format(parseISO(mentorAttendanceQrData.expiresAt), "dd MMM yyyy HH:mm")}
                  </p>
                </div>
              ) : null}
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

function StudentCalendarView() {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [calendarData, setCalendarData] = useState<StudentTrainingCalendarResponse | null>(null)
  const [selectedDate, setSelectedDate] = useState(toDateInputValue(new Date()))

  const [qrSession, setQrSession] = useState<StudentTrainingSession | null>(null)
  const [qrData, setQrData] = useState<StudentTrainingQrResponse | null>(null)
  const [qrError, setQrError] = useState("")
  const [qrLoading, setQrLoading] = useState(false)
  const [showMentorQrScanner, setShowMentorQrScanner] = useState(false)
  const [mentorScanManualToken, setMentorScanManualToken] = useState("")
  const [mentorScanNotice, setMentorScanNotice] = useState("")
  const [mentorScanError, setMentorScanError] = useState("")
  const [mentorScanBusy, setMentorScanBusy] = useState(false)
  const mentorScanInFlightRef = useRef(false)
  const lastMentorScannedTokenRef = useRef<{ token: string; at: number } | null>(null)

  async function refreshCalendarData() {
    const data = (await fetchApi("/StudentTraining/my-calendar")) as StudentTrainingCalendarResponse
    setCalendarData(data)

    if (data.enabledDates.length > 0) {
      const today = toDateInputValue(new Date())
      const fallback = data.enabledDates.find((d) => d >= today) ?? data.enabledDates[0]
      if (!data.enabledDates.includes(selectedDate)) {
        setSelectedDate(fallback)
      }
    }
  }

  useEffect(() => {
    let isCancelled = false
    const run = async () => {
      setIsLoading(true)
      setError("")
      try {
        const data = (await fetchApi("/StudentTraining/my-calendar")) as StudentTrainingCalendarResponse
        if (isCancelled) return
        setCalendarData(data)

        if (data.enabledDates.length > 0) {
          const today = toDateInputValue(new Date())
          const fallback = data.enabledDates.find((d) => d >= today) ?? data.enabledDates[0]
          setSelectedDate(fallback)
        }
      } catch (e: any) {
        if (!isCancelled) {
          setError(e?.message ?? "Gabim gjatë ngarkimit të kalendarit.")
          setCalendarData(null)
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    void run()
    return () => {
      isCancelled = true
    }
  }, [])

  const enabledDates = calendarData?.enabledDates ?? []
  const enabledSet = useMemo(() => new Set(enabledDates), [enabledDates])
  const sessions = calendarData?.sessions ?? []
  const sessionsForSelectedDate = useMemo(
    () => sessions.filter((s) => s.date === selectedDate).sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [selectedDate, sessions]
  )
  const upcomingSessions = useMemo(() => {
    const today = toDateInputValue(new Date())
    return sessions
      .filter((s) => s.date >= today)
      .sort((a, b) => (`${a.date}-${a.startTime}`).localeCompare(`${b.date}-${b.startTime}`))
  }, [sessions])
  const todayPendingSessions = useMemo(() => {
    const today = toDateInputValue(new Date())
    return sessions.filter((session) => session.date === today && session.attendanceStatus === "pending")
  }, [sessions])

  function canShowQr(session: StudentTrainingSession) {
    const today = toDateInputValue(new Date())
    return session.date === today && session.attendanceStatus === "pending"
  }

  async function openQrModal(session: StudentTrainingSession) {
    setQrSession(session)
    setQrData(null)
    setQrError("")
    setQrLoading(true)
    try {
      const data = (await fetchApi(`/StudentTraining/sessions/${session.id}/qr`)) as StudentTrainingQrResponse
      setQrData(data)
    } catch (e: any) {
      setQrError(e?.message ?? "Gabim gjatë gjenerimit të QR.")
    } finally {
      setQrLoading(false)
    }
  }

  async function scanMentorAttendanceToken(token: string) {
    const trimmedToken = token.trim()
    if (!trimmedToken) return
    const now = Date.now()
    const previous = lastMentorScannedTokenRef.current
    if (mentorScanInFlightRef.current) return
    if (previous && previous.token === trimmedToken && now - previous.at < 2500) {
      return
    }

    mentorScanInFlightRef.current = true
    setMentorScanBusy(true)
    setMentorScanError("")
    setMentorScanNotice("")
    try {
      const response = (await fetchApi("/MentorQr/confirm", {
        method: "POST",
        body: JSON.stringify({ qrToken: trimmedToken }),
      })) as StudentAttendanceScanResponse

      setMentorScanNotice(response.message)
      setMentorScanManualToken("")
      lastMentorScannedTokenRef.current = { token: trimmedToken, at: Date.now() }
      await refreshCalendarData()
      setTimeout(() => {
        setShowMentorQrScanner(false)
      }, 900)
    } catch (e: any) {
      setMentorScanError(e?.message ?? "Gabim gjatë skanimit të QR të mentorit.")
    } finally {
      setMentorScanBusy(false)
      mentorScanInFlightRef.current = false
    }
  }

  async function handleMentorQrScannerResult(result: any) {
    if (!result || mentorScanBusy) return
    try {
      const rawValue = Array.isArray(result)
        ? result[0]?.rawValue ?? result[0]?.text
        : result.rawValue ?? result.text ?? result
      if (!rawValue || typeof rawValue !== "string") return
      await scanMentorAttendanceToken(rawValue)
    } catch {
      setMentorScanError("Kodi QR i mentorit është i pavlefshëm.")
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-foreground flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          Trajnimi i Studentit
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Kalendari i sesioneve dhe QR për prezencë
        </p>
      </div>
      {isLoading ? (
        <div className="rounded-xl border border-border bg-card px-5 py-10 text-sm text-muted-foreground">
          Duke ngarkuar kalendarin...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm text-destructive">
          {error}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          <div className="rounded-xl border border-border bg-card p-4 h-fit">
            <DayCalendar
              mode="single"
              selected={parseISO(selectedDate)}
              onSelect={(date) => {
                if (!date) return
                const next = toDateInputValue(date)
                if (enabledSet.has(next)) {
                  setSelectedDate(next)
                }
              }}
              disabled={(date) => !enabledSet.has(toDateInputValue(date))}
              className="rounded-md border border-border bg-card p-3"
            />
            <p className="mt-3 text-xs text-muted-foreground">
              Aktivizohen vetëm datat ku jeni i/e planifikuar për trajnim.
            </p>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="mb-1 text-base font-semibold text-foreground">
                    Sesionet e datës {format(parseISO(selectedDate), "dd MMM yyyy")}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {todayPendingSessions.length > 0
                      ? "Sot mund të skanoni QR-në e mentorit për të konfirmuar prezencën."
                      : "Zgjidhni një datë për të parë sesionet e planifikuara."}
                  </p>
                </div>
                {todayPendingSessions.length > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full gap-2 sm:w-auto"
                    onClick={() => {
                      setShowMentorQrScanner(true)
                      setMentorScanError("")
                      setMentorScanNotice("")
                      mentorScanInFlightRef.current = false
                      lastMentorScannedTokenRef.current = null
                    }}
                  >
                    <ScanLine className="h-4 w-4" />
                    Skano QR të mentorit
                  </Button>
                )}
              </div>
              {sessionsForSelectedDate.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nuk ka sesione për këtë datë.</p>
              ) : (
                <div className="space-y-2">
                  {sessionsForSelectedDate.map((session) => (
                    <div key={session.id} className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="inline-flex items-center gap-1 text-sm font-medium text-foreground">
                          <Clock3 className="h-4 w-4 text-primary" />
                          {session.startTime} - {session.endTime}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${session.attendanceStatus === "attended" ? "bg-green-500/10 text-green-600" : session.attendanceStatus === "rejected" ? "bg-red-500/10 text-red-600" : "bg-muted text-muted-foreground"}`}>
                            {session.attendanceStatus === "attended" ? "Konfirmuar" : session.attendanceStatus === "rejected" ? "Refuzuar" : "Në pritje"}
                          </span>
                          {canShowQr(session) && (
                            <Button type="button" size="sm" variant="outline" className="h-7 gap-1.5 text-[11px]" onClick={() => { void openQrModal(session) }}>
                              <QrCode className="h-3.5 w-3.5" />
                              Trego QR
                            </Button>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Mentori: {session.mentorFirstName} {session.mentorLastName}
                      </p>
                      {session.notes && (
                        <p className="text-xs text-muted-foreground mt-1">Shënime: {session.notes}</p>
                      )}
                      {session.rejectionReason && (
                        <p className="text-xs text-destructive mt-1">Arsye refuzimi: {session.rejectionReason}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-base font-semibold text-foreground mb-3">Datat e ardhshme</h3>
              {upcomingSessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nuk ka sesione të planifikuara.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Data</th>
                        <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Ora</th>
                        <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Mentori</th>
                        <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Statusi</th>
                        <th className="px-3 py-2 text-xs font-medium text-muted-foreground">QR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {upcomingSessions.map((session) => (
                        <tr key={session.id} className="border-b border-border last:border-0">
                          <td className="px-3 py-2 text-xs text-foreground">{format(parseISO(session.date), "dd MMM yyyy")}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{session.startTime} - {session.endTime}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{session.mentorFirstName} {session.mentorLastName}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground capitalize">{session.attendanceStatus}</td>
                          <td className="px-3 py-2 text-xs">
                            {canShowQr(session) ? (
                              <Button type="button" size="sm" variant="outline" className="h-7 gap-1.5 text-[11px]" onClick={() => { void openQrModal(session) }}>
                                <QrCode className="h-3.5 w-3.5" />
                                QR
                              </Button>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {qrSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card shadow-lg">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-foreground">QR për Prezencë</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {format(parseISO(qrSession.date), "dd MMM yyyy")} • {qrSession.startTime} - {qrSession.endTime}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setQrSession(null)
                  setQrData(null)
                  setQrError("")
                }}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 text-center">
              {qrLoading ? (
                <p className="text-sm text-muted-foreground">Duke gjeneruar QR...</p>
              ) : qrError ? (
                <p className="text-sm text-destructive">{qrError}</p>
              ) : qrData ? (
                <div className="space-y-3">
                  <div className="inline-block rounded-lg border border-border bg-white p-3">
                    <QRCodeCanvas value={`IEKA-ST:${qrData.qrToken}`} size={220} fgColor={"#000000"} bgColor={"#ffffff"} level={"Q"} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Kodi skadon më {format(parseISO(qrData.expiresAt), "dd MMM yyyy HH:mm")}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {showMentorQrScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-lg">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold text-foreground">Skano QR të mentorit</h3>
              <button
                type="button"
                onClick={() => setShowMentorQrScanner(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 p-4">
              <div className="overflow-hidden rounded-xl border border-border bg-black aspect-square">
                <Scanner
                  onScan={(result) => {
                    void handleMentorQrScannerResult(result)
                  }}
                  components={{ onOff: true, torch: true, zoom: false, finder: true }}
                  styles={{ container: { width: "100%", height: "100%" } }}
                />
              </div>

              <p className="text-xs text-muted-foreground">
                Ose vendos manualisht token-in e QR të mentorit nëse po përdorni skaner hardware.
              </p>

              <div className="flex items-center gap-2">
                <Input
                  value={mentorScanManualToken}
                  onChange={(e) => setMentorScanManualToken(e.target.value)}
                  placeholder="Vendos token-in QR të mentorit"
                  className="h-9 text-xs font-mono"
                />
                <Button
                  type="button"
                  size="sm"
                  className="h-9 px-3"
                  disabled={mentorScanBusy || !mentorScanManualToken.trim()}
                  onClick={() => {
                    void scanMentorAttendanceToken(mentorScanManualToken)
                  }}
                >
                  {mentorScanBusy ? "..." : "Konfirmo"}
                </Button>
              </div>

              {mentorScanNotice && (
                <p className="rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs text-green-700">
                  {mentorScanNotice}
                </p>
              )}
              {mentorScanError && (
                <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {mentorScanError}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StudentFeedbackView() {
  const [feedbackLoading, setFeedbackLoading] = useState(true)
  const [feedbackError, setFeedbackError] = useState("")
  const [feedbackRows, setFeedbackRows] = useState<StudentTrainingStazh[]>([])

  useEffect(() => {
    let isCancelled = false
    const run = async () => {
      setFeedbackLoading(true)
      setFeedbackError("")
      try {
        const data = (await fetchApi("/StudentTraining/my-feedback")) as StudentTrainingStazh[]
        if (!isCancelled) {
          setFeedbackRows(data)
        }
      } catch (e: any) {
        if (!isCancelled) {
          setFeedbackRows([])
          setFeedbackError(e?.message ?? "Gabim gjatë ngarkimit të feedback-ut.")
        }
      } finally {
        if (!isCancelled) {
          setFeedbackLoading(false)
        }
      }
    }

    void run()
    return () => {
      isCancelled = true
    }
  }, [])

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-foreground flex items-center gap-2">
          <MessageSquareText className="h-5 w-5 text-primary" />
          Vlerësimet
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Feedback-u i mentorit dhe formulari juaj i vlerësimit për stazhin.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
          <MessageSquareText className="h-4 w-4 text-primary" />
          Feedback i Stazhit
        </h3>

        {feedbackLoading ? (
          <p className="text-sm text-muted-foreground">Duke ngarkuar feedback-un...</p>
        ) : feedbackError ? (
          <p className="text-sm text-destructive">{feedbackError}</p>
        ) : feedbackRows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-8 text-sm text-muted-foreground text-center">
            Nuk ka stazh të mbyllur me feedback.
          </p>
        ) : (
          <div className="space-y-3">
            {feedbackRows.map((row) => (
              <div key={row.id} className="rounded-lg border border-border bg-muted/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Mentori: {row.mentorFirstName} {row.mentorLastName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Nga {row.startedAt} deri më {row.endedAt ?? "—"}
                    </p>
                  </div>
                  <span className="rounded px-2 py-0.5 text-[11px] font-medium bg-primary/10 text-primary">Stazh i mbyllur</span>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded-md border border-border bg-card px-3 py-2">
                    <p className="text-xs font-medium text-foreground">Feedback nga mentori</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Vlerësim: {row.mentorFeedbackRating ?? 0}/5
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {row.mentorFeedbackComment ?? "Mentori nuk ka lënë koment."}
                    </p>
                  </div>

                  <div className="rounded-md border border-border bg-card px-3 py-2">
                    <p className="text-xs font-medium text-foreground">Feedback-u juaj</p>
                    {row.studentFeedbackSubmittedAt ? (
                      <>
                        <p className="mt-1 text-xs text-muted-foreground">Vlerësim: {row.studentFeedbackRating ?? 0}/5</p>
                        <p className="mt-1 text-xs text-muted-foreground">{row.studentFeedbackComment ?? "Pa koment."}</p>
                      </>
                    ) : row.studentFeedbackToken ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          className="h-7 text-[11px]"
                          onClick={() => {
                            window.location.href = `/stazh-feedback?token=${encodeURIComponent(row.studentFeedbackToken ?? "")}`
                          }}
                        >
                          Plotëso feedback
                        </Button>
                        <span className="text-[11px] text-muted-foreground">
                          Afati: {row.studentFeedbackTokenExpiresAt ? format(parseISO(row.studentFeedbackTokenExpiresAt), "dd MMM yyyy HH:mm") : "—"}
                        </span>
                      </div>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground">Feedback-u juaj nuk është dërguar ende.</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
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
