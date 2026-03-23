"use client"

import { useEffect, useMemo, useState } from "react"
import { format, parseISO } from "date-fns"
import {
  CalendarDays,
  Clock3,
  Download,
  FileText,
  FolderOpen,
  MessageSquareText,
  UserCheck,
  X,
} from "lucide-react"

import { fetchApi, fetchWithAuth } from "@/lib/api-client"
import type {
  AppUser,
  StazhDocument,
  StazhItem,
  StudentTrainingCalendarResponse,
  StudentTrainingSession,
  StudentTrainingStazh,
} from "@/lib/data"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const MENTOR_UPLOADER_TAG = "[uploader:mentor]"
const STUDENT_UPLOADER_TAG = "[uploader:student]"

type DocumentOrigin = "mentor" | "student" | "unknown"

function formatDate(value?: string | null) {
  if (!value) return "—"
  try {
    return format(parseISO(value), "dd MMM yyyy")
  } catch {
    return value
  }
}

function formatDateTime(value?: string | null) {
  if (!value) return "—"
  try {
    return format(parseISO(value), "dd MMM yyyy HH:mm")
  } catch {
    return value
  }
}

function formatMonthYear(value?: string | null) {
  if (!value) return "—"

  const match = value.match(/^(\d{4})-(\d{2})$/)
  if (!match) return value

  const monthLabels: Record<string, string> = {
    "01": "Janar",
    "02": "Shkurt",
    "03": "Mars",
    "04": "Prill",
    "05": "Maj",
    "06": "Qershor",
    "07": "Korrik",
    "08": "Gusht",
    "09": "Shtator",
    "10": "Tetor",
    "11": "Nentor",
    "12": "Dhjetor",
  }

  return `${monthLabels[match[2]] ?? match[2]} ${match[1]}`
}

function parseDocumentOrigin(description?: string): { origin: DocumentOrigin; cleanDescription: string } {
  const raw = (description ?? "").trim()
  if (!raw) {
    return { origin: "unknown", cleanDescription: "" }
  }

  const lower = raw.toLowerCase()
  if (lower.startsWith(MENTOR_UPLOADER_TAG)) {
    return {
      origin: "mentor",
      cleanDescription: raw.slice(MENTOR_UPLOADER_TAG.length).trim(),
    }
  }

  if (lower.startsWith(STUDENT_UPLOADER_TAG)) {
    return {
      origin: "student",
      cleanDescription: raw.slice(STUDENT_UPLOADER_TAG.length).trim(),
    }
  }

  return { origin: "unknown", cleanDescription: raw }
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null
  }

  return hours * 60 + minutes
}

function getSessionDurationMinutes(session: StudentTrainingSession) {
  const start = timeToMinutes(session.startTime)
  const end = timeToMinutes(session.endTime)
  if (start === null || end === null || end <= start) {
    return 0
  }

  return end - start
}

function formatDuration(minutes: number) {
  if (minutes <= 0) {
    return "0 orë"
  }

  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60

  if (hours === 0) {
    return `${remainder} min`
  }

  if (remainder === 0) {
    return `${hours} orë`
  }

  return `${hours} orë ${remainder} min`
}

function isPastSessionDate(value?: string | null) {
  if (!value) return false
  return value < format(new Date(), "yyyy-MM-dd")
}

function getSessionHistoryStatus(session: StudentTrainingSession) {
  if (session.attendanceStatus === "attended") {
    return {
      key: "confirmed",
      label: "Konfirmuar",
      className: "bg-green-500/10 text-green-600",
    }
  }

  if (session.attendanceStatus === "rejected") {
    return {
      key: "rejected",
      label: "Refuzuar",
      className: "bg-red-500/10 text-red-600",
    }
  }

  if (isPastSessionDate(session.date)) {
    return {
      key: "absent",
      label: "Mungesë",
      className: "bg-amber-500/10 text-amber-700",
    }
  }

  return {
    key: "pending",
    label: "Në pritje",
    className: "bg-muted text-muted-foreground",
  }
}

function StatCard({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-semibold text-foreground">{value}</p>
      {helper ? <p className="mt-1 text-xs text-muted-foreground">{helper}</p> : null}
    </div>
  )
}

interface StudentHistoryModalProps {
  student: AppUser | null
  mentorName?: string
  onClose: () => void
}

export function StudentHistoryModal({ student, mentorName = "—", onClose }: StudentHistoryModalProps) {
  const [sessions, setSessions] = useState<StudentTrainingSession[]>([])
  const [stazhet, setStazhet] = useState<StazhItem[]>([])
  const [feedbackRows, setFeedbackRows] = useState<StudentTrainingStazh[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState("")

  useEffect(() => {
    if (!student) {
      setSessions([])
      setStazhet([])
      setFeedbackRows([])
      setError("")
      setDownloadError("")
      setDownloadingDocId(null)
      return
    }

    let cancelled = false

    const run = async () => {
      setLoading(true)
      setError("")
      setDownloadError("")
      try {
        const [calendarResponse, stazhResponse, feedbackResponse] = await Promise.all([
          fetchApi(`/StudentTraining/students/${student.id}/schedule`) as Promise<StudentTrainingCalendarResponse>,
          fetchApi(`/Stazh/student/${student.id}`) as Promise<StazhItem[]>,
          fetchApi(`/StudentTraining/students/${student.id}/feedback`) as Promise<StudentTrainingStazh[]>,
        ])

        if (cancelled) return

        setSessions(
          [...(calendarResponse.sessions ?? [])].sort((a, b) =>
            `${b.date}-${b.startTime}`.localeCompare(`${a.date}-${a.startTime}`)
          )
        )
        setStazhet(
          [...(stazhResponse ?? [])].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
        )
        setFeedbackRows(
          [...(feedbackResponse ?? [])].sort((a, b) =>
            `${b.endedAt ?? b.startedAt}`.localeCompare(`${a.endedAt ?? a.startedAt}`)
          )
        )
      } catch (e: any) {
        if (!cancelled) {
          setSessions([])
          setStazhet([])
          setFeedbackRows([])
          setError(e?.message ?? "Gabim gjatë ngarkimit të historikut të studentit.")
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [student])

  const attendedSessions = useMemo(
    () => sessions.filter((session) => session.attendanceStatus === "attended"),
    [sessions]
  )
  const sessionHistoryStatuses = useMemo(
    () => sessions.map((session) => getSessionHistoryStatus(session)),
    [sessions]
  )
  const sessionsWithoutAttendanceCount = useMemo(
    () => sessionHistoryStatuses.filter((status) => status.key === "absent" || status.key === "rejected").length,
    [sessionHistoryStatuses]
  )
  const attendedDayCount = useMemo(
    () => new Set(attendedSessions.map((session) => session.date)).size,
    [attendedSessions]
  )
  const attendedMinutes = useMemo(
    () => attendedSessions.reduce((total, session) => total + getSessionDurationMinutes(session), 0),
    [attendedSessions]
  )
  const totalStazhDays = useMemo(() => {
    const uniqueDates = new Set<string>()

    stazhet.forEach((stazh) => {
      ;(stazh.dates ?? []).forEach((dateItem) => {
        if (dateItem.date) {
          uniqueDates.add(dateItem.date)
        }
      })
    })

    sessions.forEach((session) => {
      if (session.date) {
        uniqueDates.add(session.date)
      }
    })

    return uniqueDates.size
  }, [sessions, stazhet])
  const finalFeedbackHelper = useMemo(() => {
    const totalStazhet = stazhet.length
    const stazhLabel = totalStazhet === 1 ? "1 stazh total" : `${totalStazhet} stazhe totale`
    return `${stazhLabel} • shfaqet vetëm pas mbylljes së stazhit`
  }, [stazhet.length])

  const allDocuments = useMemo(
    () =>
      stazhet
        .flatMap((stazh) =>
          (stazh.documents ?? []).map((doc) => {
            const parsed = parseDocumentOrigin(doc.description)
            return {
              ...doc,
              stazhTitle: stazh.title,
              stazhStatus: stazh.status,
              origin: parsed.origin,
              cleanDescription: parsed.cleanDescription,
            }
          })
        )
        .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()),
    [stazhet]
  )

  const studentDocuments = useMemo(
    () => allDocuments.filter((doc) => doc.origin === "student" || doc.origin === "unknown"),
    [allDocuments]
  )

  async function handleOpenDocument(doc: StazhDocument) {
    setDownloadError("")
    setDownloadingDocId(doc.id)
    try {
      const response = await fetchWithAuth(doc.fileUrl, { method: "GET" })
      if (!response.ok) {
        throw new Error("Nuk u hap dokumenti.")
      }

      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = objectUrl
      link.download = doc.fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(objectUrl)
    } catch (e: any) {
      setDownloadError(e?.message ?? "Gabim gjatë hapjes së dokumentit.")
    } finally {
      setDownloadingDocId(null)
    }
  }

  if (!student) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-5xl rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">Historiku i Studentit</h2>
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-medium",
                  student.isActive !== false ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"
                )}
              >
                {student.isActive !== false ? "Aktiv" : "Jo aktiv"}
              </span>
              {student.isExpired ? (
                <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-600">
                  Validitet i skaduar
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm font-medium text-foreground">
              {student.firstName} {student.lastName}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {student.memberRegistryNumber} • {student.email}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Mbyll historikun"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[80vh] overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="rounded-xl border border-border bg-muted/20 px-4 py-10 text-sm text-muted-foreground">
              Duke ngarkuar historikun e studentit...
            </div>
          ) : error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-4 text-sm text-destructive">
              {error}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Ditë prezence" value={String(attendedDayCount)} helper="Ditë me pjesëmarrje të konfirmuar" />
                <StatCard label="Orë prezence" value={formatDuration(attendedMinutes)} helper={`${attendedSessions.length} seanca të konfirmuara`} />
                <StatCard label="Dokumente studenti" value={String(studentDocuments.length)} helper="Dokumente të ngarkuara nga studenti" />
                <StatCard label="Vlerësime finale" value={String(feedbackRows.length)} helper={finalFeedbackHelper} />
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-xl border border-border bg-muted/20 p-4">
                  <h3 className="text-sm font-semibold text-foreground">Profili i studentit</h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Mentori</p>
                      <p className="mt-1 text-sm font-medium text-foreground">{mentorName}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Valid deri në</p>
                      <p className="mt-1 text-sm font-medium text-foreground">{formatMonthYear(student.validUntilMonth)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Llogaria bazë</p>
                      <p className="mt-1 text-sm font-medium text-foreground">{student.accountIsActive !== false ? "Aktive" : "Jo aktive"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Ditë stazhi</p>
                      <p className="mt-1 text-sm font-medium text-foreground">{totalStazhDays}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-muted/20 p-4">
                  <h3 className="text-sm font-semibold text-foreground">Pamje e shpejtë</h3>
                  <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center justify-between rounded-lg border border-border/70 bg-card px-3 py-2">
                      <span>Seanca gjithsej</span>
                      <span className="font-medium text-foreground">{sessions.length}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border/70 bg-card px-3 py-2">
                      <span>Seanca në pritje</span>
                      <span className="font-medium text-foreground">
                        {sessionHistoryStatuses.filter((status) => status.key === "pending").length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border/70 bg-card px-3 py-2">
                      <span>Seanca pa prezencë</span>
                      <span className="font-medium text-foreground">{sessionsWithoutAttendanceCount}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border/70 bg-card px-3 py-2">
                      <span>Seanca të konfirmuara</span>
                      <span className="font-medium text-foreground">{attendedSessions.length}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <UserCheck className="h-4 w-4 text-primary" />
                  Historiku i seancave të stazhit
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ditët dhe orët e planifikuara, me statusin e pjesëmarrjes për secilën seancë.
                </p>

                {sessions.length === 0 ? (
                  <p className="mt-4 rounded-lg border border-dashed border-border px-4 py-8 text-sm text-muted-foreground text-center">
                    Nuk ka seanca të regjistruara për këtë student.
                  </p>
                ) : (
                  <div className="mt-4 space-y-2">
                    {sessions.map((session) => {
                      const status = getSessionHistoryStatus(session)

                      return (
                        <div key={session.id} className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {formatDate(session.date)} • {session.startTime} - {session.endTime}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Mentori: {session.mentorFirstName} {session.mentorLastName}
                              </p>
                            </div>
                            <span
                              className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium", status.className)}
                            >
                              {status.label}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <Clock3 className="h-3.5 w-3.5 text-primary" />
                              Kohëzgjatja: {formatDuration(getSessionDurationMinutes(session))}
                            </span>
                            {session.notes ? <span>Shënime: {session.notes}</span> : null}
                            {session.rejectionReason ? <span className="text-destructive">Arsye: {session.rejectionReason}</span> : null}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <FolderOpen className="h-4 w-4 text-primary" />
                  Dokumente të ngarkuara nga studenti
                </h3>
                {downloadError ? (
                  <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                    {downloadError}
                  </p>
                ) : null}

                {studentDocuments.length === 0 ? (
                  <p className="mt-4 rounded-lg border border-dashed border-border px-4 py-8 text-sm text-muted-foreground text-center">
                    Nuk ka dokumente të ngarkuara nga studenti.
                  </p>
                ) : (
                  <div className="mt-4 space-y-2">
                    {studentDocuments.map((doc) => (
                      <div key={doc.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="h-4 w-4 shrink-0 text-blue-500" />
                            <p className="truncate text-sm font-medium text-foreground">{doc.fileName}</p>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {doc.cleanDescription ? `${doc.cleanDescription} • ` : ""}
                            {doc.stazhTitle} • {formatDateTime(doc.uploadedAt)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => void handleOpenDocument(doc)}
                          disabled={downloadingDocId === doc.id}
                        >
                          <Download className="h-3.5 w-3.5" />
                          {downloadingDocId === doc.id ? "Duke hapur..." : "Hap"}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <MessageSquareText className="h-4 w-4 text-primary" />
                  Feedback i mbylljes së stazhit
                </h3>
                {feedbackRows.length === 0 ? (
                  <p className="mt-4 rounded-lg border border-dashed border-border px-4 py-8 text-sm text-muted-foreground text-center">
                    Nuk ka feedback të mbyllur për këtë student.
                  </p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {feedbackRows.map((row) => (
                      <div key={row.id} className="rounded-xl border border-border/70 bg-muted/20 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              Mentori: {row.mentorFirstName} {row.mentorLastName}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {formatDate(row.startedAt)} - {formatDate(row.endedAt)}
                            </p>
                          </div>
                          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                            {row.status}
                          </span>
                        </div>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <div className="rounded-lg border border-border/70 bg-card px-3 py-2">
                            <p className="text-xs font-medium text-foreground">Feedback nga mentori</p>
                            <p className="mt-1 text-xs text-muted-foreground">Vlerësim: {row.mentorFeedbackRating ?? 0}/5</p>
                            <p className="mt-1 text-xs text-muted-foreground">{row.mentorFeedbackComment ?? "Pa koment nga mentori."}</p>
                          </div>
                          <div className="rounded-lg border border-border/70 bg-card px-3 py-2">
                            <p className="text-xs font-medium text-foreground">Feedback nga studenti</p>
                            {row.studentFeedbackSubmittedAt ? (
                              <>
                                <p className="mt-1 text-xs text-muted-foreground">Vlerësim: {row.studentFeedbackRating ?? 0}/5</p>
                                <p className="mt-1 text-xs text-muted-foreground">{row.studentFeedbackComment ?? "Pa koment nga studenti."}</p>
                                <p className="mt-1 text-[11px] text-muted-foreground">
                                  Dërguar më {formatDateTime(row.studentFeedbackSubmittedAt)}
                                </p>
                              </>
                            ) : (
                              <p className="mt-1 text-xs text-muted-foreground">Studenti nuk ka dërguar ende feedback.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
