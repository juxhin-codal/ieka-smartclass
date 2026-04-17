"use client"

import { Fragment, useState, useMemo, useEffect } from "react"
import { useEvents } from "@/lib/events-context"
import { useAuth } from "@/lib/auth-context"
import { API_BASE_URL, fetchApi, fetchWithAuth } from "@/lib/api-client"
import { EditEventForm } from "@/components/events/edit-event-form"
import { QrScannerModal } from "@/components/events/qr-scanner-modal"
import { FeedbackForm } from "@/components/events/feedback-form"
import type { AppUser, EventItem, EventDateDocument, FeedbackQuestion, FeedbackQuestionnaire, Participant, EventQuestionnaireInfo, QuestionnaireQuestion } from "@/lib/data"
import { LiveQuizPanel } from "@/components/quiz/live-quiz-panel"
import { Button } from "@/components/ui/button"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { QRCodeCanvas } from "qrcode.react"
import { format, parseISO, isToday } from "date-fns"
import {
  ArrowLeft,
  Bell,
  Share2,
  MapPin,
  CalendarRange,
  Users,
  Tag,
  Plus,
  X,
  Trash2,
  Save,
  ChevronDown,
  ChevronUp,
  Star,
  MessageSquare,
  CheckCircle2,
  Copy,
  Mail,
  Send,
  QrCode,
  Pencil,
  FileText,
  Upload,
  Search,
  Download,
  Loader2,
} from "lucide-react"

interface EventDetailProps {
  eventId: string
  onBack: () => void
}

function resolveParticipantIdentity(participant: Participant, usersById: Map<string, AppUser>) {
  const participantWithUser = participant as Participant & { user?: Partial<AppUser> }
  const nestedUser = participantWithUser.user
  const fallbackUser = usersById.get(participant.userId)

  const firstName =
    (participant.firstName ?? "").trim() ||
    (nestedUser?.firstName ?? "").trim() ||
    (fallbackUser?.firstName ?? "").trim()

  const lastName =
    (participant.lastName ?? "").trim() ||
    (nestedUser?.lastName ?? "").trim() ||
    (fallbackUser?.lastName ?? "").trim()

  const email =
    (participant.email ?? "").trim() ||
    (nestedUser?.email ?? "").trim() ||
    (fallbackUser?.email ?? "").trim()

  const memberRegistryNumber =
    (participant.memberRegistryNumber ?? "").trim() ||
    (nestedUser?.memberRegistryNumber ?? "").trim() ||
    (fallbackUser?.memberRegistryNumber ?? "").trim()

  const fullName = `${firstName} ${lastName}`.trim()
  const displayName = fullName || memberRegistryNumber || email || "Pa të dhëna"

  return {
    firstName,
    lastName,
    email,
    memberRegistryNumber,
    displayName,
  }
}

function getParticipantStatusMeta(participant: Participant) {
  if (participant.status === "waitlisted") {
    return {
      label: "Në listë pritje",
      className: "bg-amber-500/10 text-amber-600",
    }
  }

  if (participant.attendance === "attended") {
    return {
      label: "I pranishëm",
      className: "bg-green-500/10 text-green-600",
    }
  }

  if (participant.attendance === "absent") {
    return {
      label: "Refuzuar",
      className: "bg-red-500/10 text-red-600",
    }
  }

  return {
    label: "I regjistruar",
    className: "bg-blue-500/10 text-blue-600",
  }
}

function normalizeFeedbackQuestionnaires(event: EventItem): FeedbackQuestionnaire[] {
  if (event.feedbackQuestionnaires && event.feedbackQuestionnaires.length > 0) {
    return event.feedbackQuestionnaires.map((questionnaire, questionnaireIndex) => ({
      id: questionnaire.id || `questionnaire-${questionnaireIndex + 1}`,
      title: questionnaire.title || `Pyetësori ${questionnaireIndex + 1}`,
      questions: (questionnaire.questions ?? []).map((question, questionIndex) => ({
        id: question.id || `question-${questionIndex + 1}`,
        question: question.question ?? "",
        type: question.type ?? "text",
        options: question.options ?? [],
      })),
    }))
  }

  if (event.feedbackQuestions && event.feedbackQuestions.length > 0) {
    return [
      {
        id: "legacy-default",
        title: "Pyetësori i Feedback-ut",
        questions: event.feedbackQuestions.map((question, index) => ({
          id: question.id || `question-${index + 1}`,
          question: question.question ?? "",
          type: question.type ?? "text",
          options: question.options ?? [],
        })),
      },
    ]
  }

  return []
}

export function EventDetail({ eventId, onBack }: EventDetailProps) {
  const { getEvent, updateEvent, markAttendance, endSession, addEventDocument, deleteEventDocument, deleteEvent } = useEvents()
  const { user } = useAuth()
  const event = getEvent(eventId)
  const [showEditForm, setShowEditForm] = useState(false)
  const [showQrScanner, setShowQrScanner] = useState(false)
  const [showDeletePrompt, setShowDeletePrompt] = useState(false)
  const [deletingEvent, setDeletingEvent] = useState(false)
  const [deleteError, setDeleteError] = useState("")

  if (!event) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Button variant="ghost" onClick={onBack} className="mb-4 gap-2">
          <ArrowLeft className="h-4 w-4" />
          Kthehu te modulet
        </Button>
        <p className="text-muted-foreground">Moduli nuk u gjet.</p>
      </div>
    )
  }

  const isUpcoming = event.status === "upcoming"
  const isAdmin = user?.role === "Admin"

  async function handleDeleteEvent() {
    setDeletingEvent(true)
    setDeleteError("")
    try {
      await deleteEvent(event.id)
      onBack()
    } catch (error: any) {
      setDeleteError(error?.message ?? "Gabim gjatë fshirjes së modulit.")
    } finally {
      setDeletingEvent(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 lg:px-8">
      {/* Top bar */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" onClick={onBack} className="w-fit gap-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Kthehu te modulet
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && isUpcoming && (
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowEditForm(true)}>
              <Pencil className="h-4 w-4" />
              Modifiko Modulin
            </Button>
          )}
          {(isAdmin || user?.role === "Lecturer") && (
            <Button variant="default" size="sm" className="gap-2 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setShowQrScanner(true)}>
              <QrCode className="h-4 w-4" />
              Skano QR
            </Button>
          )}
          {isAdmin && isUpcoming && <NotifyButton eventId={event.id} isNotified={event.isNotified} />}
          {isAdmin && <ShareButton eventId={event.id} />}
          {isAdmin && (
            <Button variant="destructive" size="sm" className="gap-2" onClick={() => setShowDeletePrompt(true)}>
              <Trash2 className="h-4 w-4" />
              Fshi Modulin
            </Button>
          )}
        </div>
      </div>

      {isUpcoming ? (
        <UpcomingEventDetail
          event={event}
          onUpdate={updateEvent}
          onEndSession={(dateId) => endSession(event.id, dateId)}
          onAddDocument={(file, fileName) => addEventDocument(event.id, file, fileName)}
          onDeleteDocument={(docId) => deleteEventDocument(event.id, docId)}
        />
      ) : (
        <PastEventDetail event={event} />
      )}

      {/* Edit Modal */}
      {showEditForm && isUpcoming && <EditEventForm event={event} onClose={() => setShowEditForm(false)} />}

      {/* Scanner Modal */}
      {showQrScanner && (
        <QrScannerModal
          eventId={event.id}
          onClose={() => setShowQrScanner(false)}
          onScanSuccess={async (participantId) => {
            // Check-in the user
            await markAttendance(event.id, participantId, "attended")
          }}
        />
      )}

      {showDeletePrompt && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-foreground/50 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
            <h3 className="text-base font-semibold text-foreground">Fshi këtë modul?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Kjo do të fshijë modulin, sesionet, pjesëmarrësit, dokumentet dhe pyetësorët e lidhur.
            </p>
            {deleteError && (
              <p className="mt-3 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {deleteError}
              </p>
            )}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={() => setShowDeletePrompt(false)} disabled={deletingEvent}>
                Anulo
              </Button>
              <Button variant="destructive" onClick={() => void handleDeleteEvent()} disabled={deletingEvent}>
                {deletingEvent ? "Duke fshirë..." : "Po, fshije"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* --- Notify Button --- */
function NotifyButton({ eventId, isNotified }: { eventId: string; isNotified?: boolean }) {
  const { markAsNotified } = useEvents()
  const [loading, setLoading] = useState(false)

  async function handleNotify() {
    if (isNotified) return
    setLoading(true)
    await markAsNotified(eventId)
    setLoading(false)
  }

  return (
    <Button
      variant={isNotified ? "secondary" : "default"}
      size="sm"
      className="gap-2"
      onClick={handleNotify}
      disabled={loading || isNotified}
    >
      {isNotified ? <CheckCircle2 className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
      {isNotified ? "Të njoftuar" : (loading ? "Duke njoftuar..." : "Njofto përdoruesit")}
    </Button>
  )
}

/* --- Share Button --- */
function ShareButton({ eventId }: { eventId: string }) {
  const [copied, setCopied] = useState(false)
  const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/event/${eventId}`

  function handleCopy() {
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button variant="outline" size="sm" className="gap-2" onClick={handleCopy}>
      {copied ? <CheckCircle2 className="h-4 w-4 text-accent" /> : <Share2 className="h-4 w-4" />}
      {copied ? "U kopjua" : "Shpërndaje"}
    </Button>
  )
}

/* ==================================================================
   UPCOMING EVENT DETAIL - Editable setup
   ================================================================== */
function UpcomingEventDetail({
  event,
  onUpdate,
  onEndSession,
  onAddDocument,
  onDeleteDocument
}: {
  event: EventItem,
  onUpdate: (id: string, updates: Partial<EventItem>) => void,
  onEndSession: (dateId: string) => void,
  onAddDocument: (file: File, fileName?: string) => Promise<void>,
  onDeleteDocument: (docId: string) => void
}) {
  const [name, setName] = useState(event.name)
  const [place, setPlace] = useState(event.place)
  const [topics, setTopics] = useState(event.topics || [])
  const [topicInput, setTopicInput] = useState("")
  const [questionnaires, setQuestionnaires] = useState<FeedbackQuestionnaire[]>(() => normalizeFeedbackQuestionnaires(event))
  const [showParticipants, setShowParticipants] = useState(false)
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null)
  const [sessionSearch, setSessionSearch] = useState<Record<string, string>>({})
  const [attendanceUpdatingKey, setAttendanceUpdatingKey] = useState<string | null>(null)
  const [removingSessionParticipantId, setRemovingSessionParticipantId] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [saved, setSaved] = useState(false)

  function markChanged() {
    setHasChanges(true)
    setSaved(false)
  }

  // Keep local editable fields in sync after external updates (e.g. modal edit + refetch).
  useEffect(() => {
    if (hasChanges) return
    setName(event.name)
    setPlace(event.place)
    setTopics(event.topics || [])
    setQuestionnaires(normalizeFeedbackQuestionnaires(event))
  }, [event, hasChanges])

  function handleSave() {
    onUpdate(event.id, {
      ...event,
      name,
      place,
      topics,
      dates: event.dates.map(d => ({ ...d, location: d.location || "" })),
      feedbackQuestions: questionnaires.flatMap((questionnaire) => questionnaire.questions),
      feedbackQuestionnaires: questionnaires,
    })
    setHasChanges(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function addTopic() {
    const t = topicInput.trim()
    if (t && !topics.includes(t)) {
      setTopics((prev) => [...prev, t])
      setTopicInput("")
      markChanged()
    }
  }

  function removeTopic(topic: string) {
    setTopics((prev) => prev.filter((x) => x !== topic))
    markChanged()
  }

  function addQuestionnaire() {
    setQuestionnaires((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        title: `Pyetësori ${prev.length + 1}`,
        questions: [],
      },
    ])
    markChanged()
  }

  function removeQuestionnaire(questionnaireId: string) {
    setQuestionnaires((prev) => prev.filter((questionnaire) => questionnaire.id !== questionnaireId))
    markChanged()
  }

  function updateQuestionnaireTitle(questionnaireId: string, title: string) {
    setQuestionnaires((prev) =>
      prev.map((questionnaire) =>
        questionnaire.id === questionnaireId
          ? { ...questionnaire, title }
          : questionnaire)
    )
    markChanged()
  }

  function addQuestion(questionnaireId: string) {
    setQuestionnaires((prev) =>
      prev.map((questionnaire) =>
        questionnaire.id === questionnaireId
          ? {
            ...questionnaire,
            questions: [
              ...questionnaire.questions,
              { id: crypto.randomUUID(), question: "", type: "text", options: [] },
            ],
          }
          : questionnaire)
    )
    markChanged()
  }

  function removeQuestion(questionnaireId: string, questionId: string) {
    setQuestionnaires((prev) =>
      prev.map((questionnaire) =>
        questionnaire.id === questionnaireId
          ? {
            ...questionnaire,
            questions: questionnaire.questions.filter((question) => question.id !== questionId),
          }
          : questionnaire)
    )
    markChanged()
  }

  function updateQuestion(questionnaireId: string, questionId: string, field: keyof FeedbackQuestion, value: string | string[]) {
    setQuestionnaires((prev) =>
      prev.map((questionnaire) => {
        if (questionnaire.id !== questionnaireId) {
          return questionnaire
        }

        return {
          ...questionnaire,
          questions: questionnaire.questions.map((question) => {
            if (question.id !== questionId) {
              return question
            }

            if (field === "type") {
              return {
                ...question,
                type: value as FeedbackQuestion["type"],
                options: value === "multiple-choice" ? (question.options && question.options.length > 0 ? question.options : [""]) : [],
              }
            }

            return { ...question, [field]: value }
          }),
        }
      })
    )
    markChanged()
  }

  function addOption(questionnaireId: string, questionId: string) {
    setQuestionnaires((prev) =>
      prev.map((questionnaire) =>
        questionnaire.id === questionnaireId
          ? {
            ...questionnaire,
            questions: questionnaire.questions.map((question) =>
              question.id === questionId
                ? { ...question, options: [...(question.options || []), ""] }
                : question),
          }
          : questionnaire)
    )
    markChanged()
  }

  function updateOption(questionnaireId: string, questionId: string, optionIndex: number, value: string) {
    setQuestionnaires((prev) =>
      prev.map((questionnaire) =>
        questionnaire.id === questionnaireId
          ? {
            ...questionnaire,
            questions: questionnaire.questions.map((question) =>
              question.id === questionId
                ? {
                  ...question,
                  options: (question.options || []).map((option, index) => index === optionIndex ? value : option),
                }
                : question),
          }
          : questionnaire)
    )
    markChanged()
  }

  function removeOption(questionnaireId: string, questionId: string, optionIndex: number) {
    setQuestionnaires((prev) =>
      prev.map((questionnaire) =>
        questionnaire.id === questionnaireId
          ? {
            ...questionnaire,
            questions: questionnaire.questions.map((question) =>
              question.id === questionId
                ? { ...question, options: (question.options || []).filter((_, index) => index !== optionIndex) }
                : question),
          }
          : questionnaire)
    )
    markChanged()
  }

  const startDate = event.dates[0]?.date
  const endDate = event.dates[event.dates.length - 1]?.date
  const fillPercent = Math.round((event.currentParticipants / event.maxParticipants) * 100)

  const [liveQuizRound, setLiveQuizRound] = useState<number | null>(null)
  const [feedbackDateId, setFeedbackDateId] = useState<string | null>(null)
  const [docName, setDocName] = useState("")
  const [docFile, setDocFile] = useState<File | null>(null)
  const [docUploadError, setDocUploadError] = useState("")
  const [isUploadingDoc, setIsUploadingDoc] = useState(false)
  const [docInputKey, setDocInputKey] = useState(0)
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null)
  const [downloadingSessionExcelId, setDownloadingSessionExcelId] = useState<string | null>(null)
  const [sessionExportError, setSessionExportError] = useState("")
  const [sessionQrDialogId, setSessionQrDialogId] = useState<string | null>(null)
  const [sessionQrToken, setSessionQrToken] = useState<string | null>(null)
  const [sessionQrLoading, setSessionQrLoading] = useState(false)
  const [sendingQuestionnaireEmailDateId, setSendingQuestionnaireEmailDateId] = useState<string | null>(null)
  const [questionnaireEmailResult, setQuestionnaireEmailResult] = useState<Record<string, { sent: number } | "error">>({})
  const [sendingDocumentsEmailDateId, setSendingDocumentsEmailDateId] = useState<string | null>(null)
  const [documentsEmailResult, setDocumentsEmailResult] = useState<Record<string, { sent: number } | "error">>({})
  const [sessionDocFile, setSessionDocFile] = useState<Record<string, File | null>>({})
  const [sessionDocName, setSessionDocName] = useState<Record<string, string>>({})
  const [sessionDocUploading, setSessionDocUploading] = useState<string | null>(null)
  const [sessionDocInputKey, setSessionDocInputKey] = useState(0)
  const [deletingSessionDocId, setDeletingSessionDocId] = useState<string | null>(null)
  // Event Questionnaires (module-level)
  const [eventQuestionnaires, setEventQuestionnaires] = useState<EventQuestionnaireInfo[]>(event.eventQuestionnaires ?? [])
  const [eqCreateTitle, setEqCreateTitle] = useState("")
  const [eqCreating, setEqCreating] = useState(false)
  const [eqDeletingId, setEqDeletingId] = useState<string | null>(null)
  const [eqQrDialogId, setEqQrDialogId] = useState<string | null>(null)
  const [eqQrToken, setEqQrToken] = useState<string | null>(null)
  const [eqQrLoading, setEqQrLoading] = useState(false)
  const [eqExpandedId, setEqExpandedId] = useState<string | null>(null)
  const [eqDetail, setEqDetail] = useState<any>(null)
  const [eqDetailLoading, setEqDetailLoading] = useState(false)
  const [eqResponses, setEqResponses] = useState<any[]>([])
  const [eqResponsesLoading, setEqResponsesLoading] = useState(false)
  const [eqShowResponses, setEqShowResponses] = useState<string | null>(null)
  const [assignSessionId, setAssignSessionId] = useState<string | null>(null)
  const [memberSearchQuery, setMemberSearchQuery] = useState("")
  const [assigningMemberId, setAssigningMemberId] = useState<string | null>(null)
  const [assignMemberError, setAssignMemberError] = useState("")
  const [sessionAssignNotice, setSessionAssignNotice] = useState<Record<string, string>>({})
  const { user } = useAuth()
  const { markAttendance, users, cancelBooking, fetchEvents, fetchUsers } = useEvents()
  const isAdmin = user?.role === "Admin"
  const canRunQuiz = user?.role === "Admin" || user?.role === "Lecturer"
  const canManageSessionParticipants = isAdmin || user?.role === "Lecturer"
  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users])
  const selectedAssignSession = useMemo(
    () => event.dates.find((date) => date.id === assignSessionId) ?? null,
    [assignSessionId, event.dates],
  )
  const assignableMembers = useMemo(() => {
    if (!assignSessionId) return []

    const normalizedQuery = memberSearchQuery.trim().toLowerCase()
    const sessionParticipantIds = new Set(
      event.participants
        .filter((participant) => participant.dateId === assignSessionId)
        .map((participant) => participant.userId),
    )

    return users
      .filter((candidate) => candidate.role === "Member" && !sessionParticipantIds.has(candidate.id))
      .filter((candidate) => {
        if (!normalizedQuery) return true
        const fullName = `${candidate.firstName} ${candidate.lastName}`.trim().toLowerCase()
        return (
          fullName.includes(normalizedQuery) ||
          candidate.memberRegistryNumber.toLowerCase().includes(normalizedQuery) ||
          candidate.email.toLowerCase().includes(normalizedQuery)
        )
      })
      .sort((a, b) => {
        const aReservations = event.participants.filter((participant) => participant.userId === a.id).length
        const bReservations = event.participants.filter((participant) => participant.userId === b.id).length
        if (aReservations !== bReservations) return aReservations - bReservations
        return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
      })
      .slice(0, 40)
  }, [assignSessionId, event.participants, memberSearchQuery, users])

  useEffect(() => {
    if (assignSessionId && users.length === 0) {
      void fetchUsers()
    }
  }, [assignSessionId, fetchUsers, users.length])

  async function handleSessionAttendance(participantId: string, status: "attended" | "absent") {
    const key = `${participantId}-${status}`
    setAttendanceUpdatingKey(key)
    try {
      await markAttendance(event.id, participantId, status)
    } catch (error) {
      console.error("Failed to update session attendance", error)
    } finally {
      setAttendanceUpdatingKey(null)
    }
  }

  async function handleRemoveSessionParticipant(participantId: string) {
    setRemovingSessionParticipantId(participantId)
    try {
      await cancelBooking(event.id, participantId)
    } catch (error) {
      console.error("Failed to remove participant from session", error)
    } finally {
      setRemovingSessionParticipantId(null)
    }
  }

  function openAssignMemberDialog(dateId: string) {
    setAssignSessionId(dateId)
    setMemberSearchQuery("")
    setAssignMemberError("")
  }

  async function handleAssignMemberToSession(memberId: string) {
    if (!assignSessionId) return

    setAssigningMemberId(memberId)
    setAssignMemberError("")
    try {
      const response = await fetchApi(`/Events/${event.id}/sessions/${assignSessionId}/participants`, {
        method: "POST",
        body: JSON.stringify({ userId: memberId }),
      }) as { status?: string } | null

      const message = response?.status === "waitlisted"
        ? "Anëtari u shtua në listën e pritjes për këtë sesion."
        : "Anëtari u shtua me sukses në sesion."

      setSessionAssignNotice((prev) => ({ ...prev, [assignSessionId]: message }))
      setAssignSessionId(null)
      setMemberSearchQuery("")
      await fetchEvents()
    } catch (error: any) {
      setAssignMemberError(error?.message ?? "Gabim gjatë shtimit të anëtarit.")
    } finally {
      setAssigningMemberId(null)
    }
  }

  async function handleDocumentUpload() {
    if (!docFile) {
      setDocUploadError("Zgjidhni një dokument për të ngarkuar.")
      return
    }

    setDocUploadError("")
    setIsUploadingDoc(true)
    try {
      await onAddDocument(docFile, docName.trim() || undefined)
      setDocName("")
      setDocFile(null)
      setDocInputKey((value) => value + 1)
    } catch (error: any) {
      setDocUploadError(error?.message ?? "Gabim gjatë ngarkimit të dokumentit.")
    } finally {
      setIsUploadingDoc(false)
    }
  }

  async function handleOpenDocument(docId: string, fileUrl: string, fileName: string) {
    setDownloadingDocId(docId)
    try {
      const response = await fetchWithAuth(fileUrl, { method: "GET" })
      if (!response.ok) {
        throw new Error(`Gabim gjatë hapjes së dokumentit (${response.status}).`)
      }

      const blob = await response.blob()
      const objectUrl = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = objectUrl
      link.download = fileName
      link.target = "_blank"
      link.rel = "noopener noreferrer"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 30_000)
    } catch (error: any) {
      setDocUploadError(error?.message ?? "Gabim gjatë hapjes së dokumentit.")
    } finally {
      setDownloadingDocId(null)
    }
  }

  async function handleDownloadSessionParticipantsExcel(dateId: string) {
    setSessionExportError("")
    setDownloadingSessionExcelId(dateId)
    try {
      const response = await fetchWithAuth(
        `${API_BASE_URL}/Events/${event.id}/sessions/${dateId}/participants/export`,
        { method: "GET" })

      if (!response.ok) {
        throw new Error(`Gabim gjatë shkarkimit të listës (${response.status}).`)
      }

      const blob = await response.blob()
      const contentDisposition = response.headers.get("content-disposition") || ""
      const fileNameMatch = contentDisposition.match(/filename\*?=(?:UTF-8''|")?([^\";]+)/i)
      const fileName = fileNameMatch?.[1]
        ? decodeURIComponent(fileNameMatch[1].replace(/"/g, "").trim())
        : `pjesemarresit-${dateId}.xlsx`

      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.setTimeout(() => window.URL.revokeObjectURL(url), 30_000)
    } catch (error: any) {
      setSessionExportError(error?.message ?? "Gabim gjatë shkarkimit të listës së pjesëmarrësve.")
    } finally {
      setDownloadingSessionExcelId(null)
    }
  }

  async function handleGenerateSessionQr(dateId: string) {
    setSessionQrDialogId(dateId)
    setSessionQrLoading(true)
    setSessionQrToken(null)
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/Events/${event.id}/dates/${dateId}/qr`)
      if (!res.ok) throw new Error("Gabim gjatë gjenerimit të QR kodit.")
      const data = await res.json()
      setSessionQrToken(data.qrToken ?? data.token ?? data)
    } catch {
      setSessionQrToken(null)
    } finally {
      setSessionQrLoading(false)
    }
  }

  async function handleSendSessionQuestionnaireEmails(dateId: string) {
    setSendingQuestionnaireEmailDateId(dateId)
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/Events/${event.id}/dates/${dateId}/send-questionnaire-emails`, { method: "POST" })
      const data = await res.json()
      setQuestionnaireEmailResult(prev => ({ ...prev, [dateId]: { sent: data.sent ?? 0 } }))
    } catch {
      setQuestionnaireEmailResult(prev => ({ ...prev, [dateId]: "error" }))
    } finally {
      setSendingQuestionnaireEmailDateId(null)
    }
  }

  async function handleSendSessionDocumentsEmail(dateId: string) {
    setSendingDocumentsEmailDateId(dateId)
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/Events/${event.id}/dates/${dateId}/send-documents-email`, { method: "POST" })
      const data = await res.json()
      setDocumentsEmailResult(prev => ({ ...prev, [dateId]: { sent: data.sent ?? 0 } }))
    } catch {
      setDocumentsEmailResult(prev => ({ ...prev, [dateId]: "error" }))
    } finally {
      setSendingDocumentsEmailDateId(null)
    }
  }

  async function handleUploadSessionDocument(dateId: string) {
    const file = sessionDocFile[dateId]
    if (!file) return
    setSessionDocUploading(dateId)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const displayName = sessionDocName[dateId]?.trim()
      if (displayName) formData.append("displayName", displayName)
      await fetchWithAuth(`${API_BASE_URL}/Events/${event.id}/dates/${dateId}/documents/upload`, { method: "POST", body: formData })
      setSessionDocFile(prev => ({ ...prev, [dateId]: null }))
      setSessionDocName(prev => ({ ...prev, [dateId]: "" }))
      setSessionDocInputKey(k => k + 1)
      // Refetch event to get updated documents
      await fetchEvents()
    } catch (error: any) {
      setDocUploadError(error?.message ?? "Gabim gjatë ngarkimit të dokumentit të sesionit.")
    } finally {
      setSessionDocUploading(null)
    }
  }

  async function handleDeleteSessionDocument(dateId: string, docId: string) {
    setDeletingSessionDocId(docId)
    try {
      await fetchWithAuth(`${API_BASE_URL}/Events/${event.id}/dates/${dateId}/documents/${docId}`, { method: "DELETE" })
      await fetchEvents()
    } catch (error: any) {
      setDocUploadError(error?.message ?? "Gabim gjatë fshirjes së dokumentit.")
    } finally {
      setDeletingSessionDocId(null)
    }
  }

  async function handleCreateEventQuestionnaire() {
    if (!eqCreateTitle.trim()) return
    setEqCreating(true)
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/Events/${event.id}/questionnaires`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: eqCreateTitle.trim(), questions: [] }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setEventQuestionnaires(prev => [...prev, { id: data.id, title: data.title, questionCount: 0, responseCount: 0 }])
      setEqCreateTitle("")
    } catch { /* ignore */ } finally {
      setEqCreating(false)
    }
  }

  async function handleDeleteEventQuestionnaire(qId: string) {
    setEqDeletingId(qId)
    try {
      await fetchWithAuth(`${API_BASE_URL}/Events/questionnaires/${qId}`, { method: "DELETE" })
      setEventQuestionnaires(prev => prev.filter(q => q.id !== qId))
    } catch { /* ignore */ } finally {
      setEqDeletingId(null)
    }
  }

  async function handleEventQuestionnaireQr(qId: string) {
    setEqQrDialogId(qId)
    setEqQrLoading(true)
    setEqQrToken(null)
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/Events/questionnaires/${qId}/qr`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setEqQrToken(data.qrToken ?? data.token ?? data)
    } catch { setEqQrToken(null) } finally { setEqQrLoading(false) }
  }

  async function handleToggleEventQuestionnaireDetail(qId: string) {
    if (eqExpandedId === qId) { setEqExpandedId(null); return }
    setEqExpandedId(qId)
    setEqDetailLoading(true)
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/Events/questionnaires/${qId}`)
      if (!res.ok) throw new Error()
      setEqDetail(await res.json())
    } catch { setEqDetail(null) } finally { setEqDetailLoading(false) }
  }

  async function handleViewEventQuestionnaireResponses(qId: string) {
    if (eqShowResponses === qId) { setEqShowResponses(null); return }
    setEqShowResponses(qId)
    setEqResponsesLoading(true)
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/Events/questionnaires/${qId}/responses`)
      if (!res.ok) throw new Error()
      setEqResponses(await res.json())
    } catch { setEqResponses([]) } finally { setEqResponsesLoading(false) }
  }

  // Group quiz rounds
  const quizRounds = useMemo(() => {
    if (!event.quizQuestions?.length) return []
    return Array.from(new Set(event.quizQuestions.map(q => q.round))).sort((a, b) => a - b)
  }, [event.quizQuestions])

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-10">
      {liveQuizRound !== null && (
        <LiveQuizPanel
          eventId={event.id}
          eventName={event.name}
          questions={event.quizQuestions?.filter(q => q.round === liveQuizRound) || []}
          participantCount={event.participants.filter((p) => p.status === "registered").length || 30}
          onClose={() => setLiveQuizRound(null)}
        />
      )}

      {feedbackDateId && (
        <FeedbackForm
          eventId={event.id}
          dateId={feedbackDateId}
          open={!!feedbackDateId}
          onClose={() => setFeedbackDateId(null)}
        />
      )}

      {/* Session QR Dialog */}
      {sessionQrDialogId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSessionQrDialogId(null)}>
          <div className="rounded-lg border border-border bg-card p-6 shadow-lg max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">QR Kod për Sesionin</h3>
              <button onClick={() => setSessionQrDialogId(null)} className="rounded p-1 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            {sessionQrLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : sessionQrToken ? (
              <div className="flex flex-col items-center gap-3">
                <QRCodeCanvas value={sessionQrToken} size={200} includeMargin />
                <p className="text-xs text-muted-foreground text-center">
                  Skanoni këtë QR kod me telefonin për të konfirmuar praninë në sesion.
                </p>
              </div>
            ) : (
              <p className="text-xs text-destructive text-center py-4">Gabim gjatë gjenerimit të QR kodit.</p>
            )}
          </div>
        </div>
      )}

      {/* Header Card */}
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="rounded bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">Në vazhdim</span>
              {saved && <span className="rounded bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">Ruajtur</span>}
            </div>
            {isAdmin ? (
              <Input
                value={name}
                onChange={(e) => { setName(e.target.value); markChanged() }}
                className="mb-2 border-none bg-transparent p-0 text-xl font-semibold text-foreground shadow-none focus-visible:ring-0 h-auto"
              />
            ) : (
              <h1 className="mb-2 text-xl font-semibold text-foreground">{name}</h1>
            )}
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              {isAdmin ? (
                <Input
                  value={place}
                  onChange={(e) => { setPlace(e.target.value); markChanged() }}
                  className="border-none bg-transparent p-0 text-sm text-muted-foreground shadow-none focus-visible:ring-0 h-auto"
                />
              ) : (
                <span className="text-sm text-muted-foreground">{place}</span>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            {hasChanges && (
              <Button onClick={handleSave} size="sm" className="gap-2">
                <Save className="h-4 w-4" />
                Ruaj
              </Button>
            )}
            <div className="flex gap-2">

              <div className="flex gap-2 flex-wrap justify-end">
                {canRunQuiz && quizRounds.length > 0 && quizRounds.map(round => {
                  const qCount = event.quizQuestions?.filter(q => q.round === round).length ?? 0
                  return (
                    <Button key={round} variant="default" size="sm" onClick={() => setLiveQuizRound(round)} className="gap-2 text-xs h-8">
                      <QrCode className="h-3.5 w-3.5" />Kuizi Raundi {round} ({qCount} pyetje)
                    </Button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat icon={CalendarRange} label="Datat">
            {startDate && format(parseISO(startDate), "MMM d")}
            {endDate && endDate !== startDate && ` - ${format(parseISO(endDate), "MMM d")}`}
          </MiniStat>
          <MiniStat icon={Users} label="Pjesëmarrësit">
            {event.currentParticipants} / {event.maxParticipants}
          </MiniStat>
          <MiniStat icon={CalendarRange} label="Ditët">
            {event.dates.length}
          </MiniStat>
          <div className="rounded-md bg-muted/50 p-3">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <Tag className="h-3 w-3" />
              Shkalla e plotësimit
            </p>
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
                <div
                  className={`h-full rounded-full transition-all ${fillPercent >= 90 ? "bg-destructive" : "bg-primary"}`}
                  style={{ width: `${fillPercent}%` }}
                />
              </div>
              <span className="text-xs font-medium text-foreground">{fillPercent}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Topics */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">Temat</h3>
        <div className="flex flex-wrap gap-2 mb-3">
          {topics.map((topic) => (
            <span
              key={topic}
              className="inline-flex items-center gap-1 rounded-md bg-primary/8 px-2.5 py-1 text-xs font-medium text-primary"
            >
              {topic}
              {isAdmin && (
                <button onClick={() => removeTopic(topic)} className="ml-0.5 rounded p-0.5 hover:bg-primary/20" aria-label={`Hiq ${topic}`}>
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Input
              placeholder="Shto një temë..."
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  addTopic()
                }
              }}
              className="text-sm border-border bg-muted/30 max-w-sm"
            />
            <Button onClick={addTopic} variant="secondary" size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Shto
            </Button>
          </div>
        )}
      </div>

      {/* Dates */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">Datat dhe sesionet e modulit</h3>
        <div className="flex flex-col gap-2">
          {event.dates.map((d) => {
            const participantsForSession = event.participants.filter((p) => p.dateId === d.id)
            const isExpanded = expandedSessionId === d.id
            const searchValue = sessionSearch[d.id] ?? ""
            const normalizedSearch = searchValue.trim().toLowerCase()
            const filteredParticipants = normalizedSearch
              ? participantsForSession.filter((p) => {
                const identity = resolveParticipantIdentity(p, usersById)
                const firstName = identity.firstName.toLowerCase()
                const lastName = identity.lastName.toLowerCase()
                const fullName = `${firstName} ${lastName}`.trim()
                return (
                  firstName.includes(normalizedSearch) ||
                  lastName.includes(normalizedSearch) ||
                  fullName.includes(normalizedSearch) ||
                  identity.memberRegistryNumber.toLowerCase().includes(normalizedSearch) ||
                  identity.email.toLowerCase().includes(normalizedSearch)
                )
              })
              : participantsForSession

            return (
              <div key={d.id} className="rounded-md border border-border bg-muted/40">
                <div
                  className={`flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between ${canManageSessionParticipants ? "cursor-pointer transition-colors hover:bg-muted/30" : ""}`}
                  onClick={() => {
                    if (!canManageSessionParticipants) return
                    setExpandedSessionId(isExpanded ? null : d.id)
                  }}
                  onKeyDown={(eventKey) => {
                    if (!canManageSessionParticipants) return
                    if (eventKey.key === "Enter" || eventKey.key === " ") {
                      eventKey.preventDefault()
                      setExpandedSessionId(isExpanded ? null : d.id)
                    }
                  }}
                  role={canManageSessionParticipants ? "button" : undefined}
                  tabIndex={canManageSessionParticipants ? 0 : undefined}
                >
                  <div className="flex items-center gap-2">
                    <CalendarRange className="h-3.5 w-3.5 text-primary" />
                    <span className="text-sm text-foreground">{format(parseISO(d.date), "EEEE, MMM d, yyyy")}</span>
                    {d.isEnded && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded ml-1">Mbyllur</span>}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <span className="text-xs text-muted-foreground">{d.currentParticipants}/{d.maxParticipants} p.</span>
                    <span className="text-xs text-muted-foreground">{participantsForSession.length} pjesëmarrës</span>
                    {!d.isEnded && canRunQuiz && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={(clickEvent) => {
                          clickEvent.stopPropagation()
                          onEndSession(d.id)
                        }}
                      >
                        Mbyll sesionin
                      </Button>
                    )}
                    {isAdmin && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1"
                        onClick={(clickEvent) => {
                          clickEvent.stopPropagation()
                          void handleGenerateSessionQr(d.id)
                        }}
                      >
                        <QrCode className="h-3 w-3" />
                        QR
                      </Button>
                    )}
                    {isAdmin && d.isEnded && (() => {
                      const qeState = questionnaireEmailResult[d.id]
                      return (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          disabled={sendingQuestionnaireEmailDateId === d.id}
                          onClick={(clickEvent) => {
                            clickEvent.stopPropagation()
                            void handleSendSessionQuestionnaireEmails(d.id)
                          }}
                        >
                          {sendingQuestionnaireEmailDateId === d.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
                          {typeof qeState === "object" ? `Dërguar ${qeState.sent}` : qeState === "error" ? "Gabim" : "Dërgo Pyetësorin"}
                        </Button>
                      )
                    })()}
                    {isAdmin && d.isEnded && (() => {
                      const deState = documentsEmailResult[d.id]
                      return (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          disabled={sendingDocumentsEmailDateId === d.id}
                          onClick={(clickEvent) => {
                            clickEvent.stopPropagation()
                            void handleSendSessionDocumentsEmail(d.id)
                          }}
                        >
                          {sendingDocumentsEmailDateId === d.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                          {typeof deState === "object" ? `Dërguar ${deState.sent}` : deState === "error" ? "Gabim" : "Dërgo Dokumentet"}
                        </Button>
                      )
                    })()}
                    {d.isEnded && !isAdmin && user?.role === "Member" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs text-amber-600 border-amber-600 hover:bg-amber-50"
                        onClick={(clickEvent) => {
                          clickEvent.stopPropagation()
                          setFeedbackDateId(d.id)
                        }}
                      >
                        Lër Vlerësim
                      </Button>
                    )}
                    {canManageSessionParticipants && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        {isExpanded ? "Mbyll" : "Shfaq"}
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </span>
                    )}
                  </div>
                </div>

                {canManageSessionParticipants && isExpanded && (
                  <div className="border-t border-border bg-card/60 px-3 py-3">
                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="relative w-full max-w-sm">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={searchValue}
                          onChange={(e) => setSessionSearch((prev) => ({ ...prev, [d.id]: e.target.value }))}
                          placeholder="Kërko emër, mbiemër ose nr. regjistri IEKA"
                          className="h-8 pl-8 text-xs"
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {isAdmin && !d.isEnded && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-2 text-xs"
                            onClick={() => openAssignMemberDialog(d.id)}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Shto anëtar
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-2 text-xs"
                          disabled={downloadingSessionExcelId === d.id}
                          onClick={() => void handleDownloadSessionParticipantsExcel(d.id)}
                        >
                          <Download className="h-3.5 w-3.5" />
                          {downloadingSessionExcelId === d.id ? "Duke shkarkuar..." : "Shkarko Excel"}
                        </Button>
                      </div>
                    </div>
                    {sessionExportError && (
                      <p className="mb-3 text-xs text-destructive">{sessionExportError}</p>
                    )}
                    {sessionAssignNotice[d.id] && (
                      <p className="mb-3 rounded-md border border-green-500/20 bg-green-500/5 px-3 py-2 text-xs font-medium text-green-700">
                        {sessionAssignNotice[d.id]}
                      </p>
                    )}

                    {filteredParticipants.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Nuk u gjet asnjë pjesëmarrës për këtë sesion.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        <div className="space-y-2 md:hidden">
                          {filteredParticipants.map((p) => {
                            const identity = resolveParticipantIdentity(p, usersById)
                            const statusMeta = getParticipantStatusMeta(p)
                            const isAttended = p.attendance === "attended"
                            const isAbsent = p.attendance === "absent"
                            const confirmKey = `${p.id}-attended`
                            const rejectKey = `${p.id}-absent`
                            const isUpdating = attendanceUpdatingKey === confirmKey || attendanceUpdatingKey === rejectKey
                            const isRemoving = removingSessionParticipantId === p.id

                            return (
                              <div key={p.id} className="rounded-lg border border-border bg-background px-3 py-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-foreground">{identity.displayName}</p>
                                    <p className="mt-1 text-xs text-muted-foreground">{identity.memberRegistryNumber || "Pa nr. regjistri"}</p>
                                    <p className="truncate text-xs text-muted-foreground">{identity.email || "Pa email"}</p>
                                  </div>
                                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${statusMeta.className}`}>
                                    {statusMeta.label}
                                  </span>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <Button
                                    size="sm"
                                    className="h-8 flex-1 min-w-[110px] text-[11px]"
                                    variant={isAttended ? "default" : "outline"}
                                    disabled={isUpdating || isAttended || isRemoving || p.status === "waitlisted"}
                                    onClick={() => handleSessionAttendance(p.id, "attended")}
                                  >
                                    Konfirmo
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="h-8 flex-1 min-w-[110px] text-[11px]"
                                    variant={isAbsent ? "destructive" : "outline"}
                                    disabled={isUpdating || isAbsent || isRemoving || p.status === "waitlisted"}
                                    onClick={() => handleSessionAttendance(p.id, "absent")}
                                  >
                                    Refuzo
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="h-8 flex-1 min-w-[110px] text-[11px]"
                                    variant="ghost"
                                    disabled={isUpdating || isRemoving}
                                    onClick={() => void handleRemoveSessionParticipant(p.id)}
                                  >
                                    {isRemoving ? "Duke hequr..." : "Hiq"}
                                  </Button>
                                </div>
                              </div>
                            )
                          })}
                        </div>

                        <div className="hidden overflow-x-auto rounded-md border border-border md:block">
                          <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="border-b border-border bg-muted/50">
                              <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Emri</th>
                              <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Nr. Regjistri</th>
                              <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Email</th>
                              <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Status</th>
                              <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Veprime</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredParticipants.map((p) => {
                              const identity = resolveParticipantIdentity(p, usersById)
                              const isAttended = p.attendance === "attended"
                              const isAbsent = p.attendance === "absent"
                              const confirmKey = `${p.id}-attended`
                              const rejectKey = `${p.id}-absent`
                              const isUpdating = attendanceUpdatingKey === confirmKey || attendanceUpdatingKey === rejectKey
                              const isRemoving = removingSessionParticipantId === p.id

                              return (
                                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                                  <td className="px-3 py-2 text-xs font-medium text-foreground whitespace-nowrap">
                                    {identity.displayName}
                                  </td>
                                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{identity.memberRegistryNumber || "-"}</td>
                                  <td className="px-3 py-2 text-xs text-muted-foreground">{identity.email || "-"}</td>
                                  <td className="px-3 py-2 text-xs">
                                    <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${isAttended
                                      ? "bg-green-500/10 text-green-600"
                                      : isAbsent
                                        ? "bg-red-500/10 text-red-600"
                                        : "bg-muted text-muted-foreground"
                                      }`}>
                                      {isAttended ? "I pranishëm" : isAbsent ? "Refuzuar" : "Në pritje"}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2">
                                    <div className="flex items-center gap-1.5">
                                      <Button
                                        size="sm"
                                        className="h-7 px-2 text-[11px]"
                                        variant={isAttended ? "default" : "outline"}
                                        disabled={isUpdating || isAttended || isRemoving || p.status === "waitlisted"}
                                        onClick={() => handleSessionAttendance(p.id, "attended")}
                                      >
                                        Konfirmo
                                      </Button>
                                      <Button
                                        size="sm"
                                        className="h-7 px-2 text-[11px]"
                                        variant={isAbsent ? "destructive" : "outline"}
                                        disabled={isUpdating || isAbsent || isRemoving || p.status === "waitlisted"}
                                        onClick={() => handleSessionAttendance(p.id, "absent")}
                                      >
                                        Refuzo
                                      </Button>
                                      <Button
                                        size="sm"
                                        className="h-7 px-2 text-[11px]"
                                        variant="ghost"
                                        disabled={isUpdating || isRemoving}
                                        onClick={() => void handleRemoveSessionParticipant(p.id)}
                                      >
                                        {isRemoving ? "Duke hequr..." : "Hiq"}
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Session Documents */}
                    {canManageSessionParticipants && (
                      <div className="mt-3 border-t border-border pt-3">
                        <h4 className="text-xs font-semibold text-foreground mb-2">Dokumentet e sesionit</h4>
                        {d.documents && d.documents.length > 0 ? (
                          <div className="flex flex-col gap-1.5 mb-2">
                            {d.documents.map(doc => (
                              <div key={doc.id} className="flex items-center justify-between p-1.5 rounded border border-border">
                                <div className="flex items-center gap-2">
                                  <FileText className="h-3.5 w-3.5 text-blue-500" />
                                  <button
                                    type="button"
                                    onClick={() => void handleOpenDocument(doc.id, doc.fileUrl, doc.fileName)}
                                    className="text-xs hover:underline font-medium text-foreground text-left"
                                  >
                                    {doc.fileName}
                                  </button>
                                  <span className="text-[10px] text-muted-foreground">{doc.sizeBytes ? `${(doc.sizeBytes / 1024).toFixed(0)} KB` : ""}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-1.5 text-destructive"
                                    disabled={deletingSessionDocId === doc.id}
                                    onClick={() => void handleDeleteSessionDocument(d.id, doc.id)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-muted-foreground mb-2">Nuk ka dokumente për këtë sesion.</p>
                        )}
                        <div className="flex gap-2 items-end">
                          <div className="flex-1 space-y-1">
                            <Label className="text-[11px]">Emri</Label>
                            <Input
                              value={sessionDocName[d.id] ?? ""}
                              onChange={e => setSessionDocName(prev => ({ ...prev, [d.id]: e.target.value }))}
                              placeholder="Opsionale"
                              className="h-7 text-xs"
                            />
                          </div>
                          <div className="flex-1 space-y-1">
                            <Label className="text-[11px]">Skedari</Label>
                            <Input
                              key={`${d.id}-${sessionDocInputKey}`}
                              type="file"
                              className="h-7 text-xs"
                              onChange={e => setSessionDocFile(prev => ({ ...prev, [d.id]: e.target.files?.[0] ?? null }))}
                            />
                          </div>
                          <Button
                            size="sm"
                            className="h-7 gap-1 text-xs"
                            onClick={() => void handleUploadSessionDocument(d.id)}
                            disabled={!sessionDocFile[d.id] || sessionDocUploading === d.id}
                          >
                            <Upload className="h-3 w-3" />
                            {sessionDocUploading === d.id ? "..." : "Ngarko"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Documents */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">Dokumentet</h3>
        <div className="flex flex-col gap-3">
          {event.documents && event.documents.length > 0 ? (
            <div className="flex flex-col gap-2">
              {event.documents.map(doc => (
                <div key={doc.id} className="flex items-center justify-between p-2 rounded-md border border-border">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-500" />
                    <button
                      type="button"
                      onClick={() => void handleOpenDocument(doc.id, doc.fileUrl, doc.fileName)}
                      className="text-sm hover:underline font-medium text-foreground text-left"
                    >
                      {doc.fileName}
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleOpenDocument(doc.id, doc.fileUrl, doc.fileName)}
                      className="h-7 px-2"
                      disabled={downloadingDocId === doc.id}
                    >
                      {downloadingDocId === doc.id ? "Duke hapur..." : "Hap"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => onDeleteDocument(doc.id)} className="text-destructive h-7 px-2">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Nuk ka dokumente të bashkangjitura.</p>
          )}

          <div className="flex gap-2 items-end mt-2">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Emri i dokumentit</Label>
              <Input value={docName} onChange={e => setDocName(e.target.value)} placeholder="Opsionale: emri i dokumentit" className="h-8 text-sm" />
            </div>
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Skedari</Label>
              <Input
                key={docInputKey}
                type="file"
                className="h-8 text-sm"
                onChange={(event) => {
                  setDocUploadError("")
                  setDocFile(event.target.files?.[0] ?? null)
                }}
              />
            </div>
            <Button
              size="sm"
              className="h-8 gap-2"
              onClick={() => void handleDocumentUpload()}
              disabled={!docFile || isUploadingDoc}
            >
              <Upload className="h-4 w-4" /> {isUploadingDoc ? "Duke ngarkuar..." : "Bashkangjit"}
            </Button>
          </div>
          {docUploadError && <p className="text-xs text-destructive">{docUploadError}</p>}
        </div>
      </div>

      {/* Feedback Questions */}
      <FeedbackQuestionnairesEditor
        eventId={event.id}
        questionnaires={questionnaires}
        onAddQuestionnaire={addQuestionnaire}
        onRemoveQuestionnaire={removeQuestionnaire}
        onUpdateQuestionnaireTitle={updateQuestionnaireTitle}
        onAddQuestion={addQuestion}
        onRemoveQuestion={removeQuestion}
        onUpdateQuestion={updateQuestion}
        onAddOption={addOption}
        onUpdateOption={updateOption}
        onRemoveOption={removeOption}
      />

      {/* Event Questionnaires (module-level, like student module questionnaires) */}
      {isAdmin && (
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">Pyetësorët e modulit</h3>
          <p className="text-xs text-muted-foreground mb-3">Pyetësorë të strukturuar për të gjitha sesionet e modulit. Gjeneroni QR ose dërgoni me email.</p>

          {eventQuestionnaires.length > 0 && (
            <div className="flex flex-col gap-2 mb-3">
              {eventQuestionnaires.map(eq => (
                <div key={eq.id} className="rounded-md border border-border bg-muted/30">
                  <div className="flex items-center justify-between px-3 py-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-primary" />
                      <button type="button" onClick={() => void handleToggleEventQuestionnaireDetail(eq.id)} className="text-sm font-medium text-foreground hover:underline text-left">
                        {eq.title}
                      </button>
                      <span className="text-[11px] text-muted-foreground">{eq.questionCount} pyetje • {eq.responseCount} përgjigje</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="outline" className="h-6 px-2 text-[11px] gap-1" onClick={() => void handleEventQuestionnaireQr(eq.id)}>
                        <QrCode className="h-3 w-3" /> QR
                      </Button>
                      <Button size="sm" variant="outline" className="h-6 px-2 text-[11px] gap-1" onClick={() => void handleViewEventQuestionnaireResponses(eq.id)}>
                        <Users className="h-3 w-3" /> Përgjigjet
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-1.5 text-destructive"
                        disabled={eqDeletingId === eq.id}
                        onClick={() => void handleDeleteEventQuestionnaire(eq.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Detail view */}
                  {eqExpandedId === eq.id && (
                    <div className="border-t border-border px-3 py-2">
                      {eqDetailLoading ? (
                        <div className="flex items-center gap-2 py-2"><Loader2 className="h-4 w-4 animate-spin" /> <span className="text-xs">Duke ngarkuar...</span></div>
                      ) : eqDetail ? (
                        <div className="flex flex-col gap-1.5">
                          {(eqDetail.questions ?? []).map((q: any, i: number) => (
                            <div key={q.id} className="flex items-center gap-2 rounded bg-card p-2 text-xs">
                              <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-[10px] font-semibold text-primary">{i + 1}</span>
                              <span className="text-foreground">{q.text}</span>
                              <span className="text-muted-foreground ml-auto">{q.type === "Options" || q.type === 0 ? "Opsione" : q.type === "FreeText" || q.type === 1 ? "Tekst" : "Yje"}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">Nuk u gjetën detaje.</p>
                      )}
                    </div>
                  )}

                  {/* Responses view */}
                  {eqShowResponses === eq.id && (
                    <div className="border-t border-border px-3 py-2">
                      {eqResponsesLoading ? (
                        <div className="flex items-center gap-2 py-2"><Loader2 className="h-4 w-4 animate-spin" /> <span className="text-xs">Duke ngarkuar...</span></div>
                      ) : eqResponses.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-1">Nuk ka përgjigje ende.</p>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          {eqResponses.map((r: any) => (
                            <div key={r.responseId ?? r.id} className="rounded bg-card/80 p-2 text-xs">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-foreground">{r.firstName} {r.lastName}</span>
                                <span className="text-muted-foreground">{r.submittedAt ? format(parseISO(r.submittedAt), "dd/MM/yyyy HH:mm") : ""}</span>
                              </div>
                              <div className="flex flex-col gap-0.5 pl-2">
                                {(r.answers ?? []).map((a: any) => (
                                  <div key={a.questionId} className="flex gap-2">
                                    <span className="text-muted-foreground">{a.questionText ?? "Pyetje"}:</span>
                                    <span className="text-foreground">{a.answerText ?? a.answer}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Input
                value={eqCreateTitle}
                onChange={e => setEqCreateTitle(e.target.value)}
                placeholder="Titulli i pyetësorit të ri..."
                className="h-8 text-sm"
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); void handleCreateEventQuestionnaire() } }}
              />
            </div>
            <Button size="sm" className="h-8 gap-2" onClick={() => void handleCreateEventQuestionnaire()} disabled={eqCreating || !eqCreateTitle.trim()}>
              <Plus className="h-4 w-4" /> Shto pyetësor
            </Button>
          </div>
        </div>
      )}

      {/* Event Questionnaire QR Dialog */}
      {eqQrDialogId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setEqQrDialogId(null)}>
          <div className="rounded-lg border border-border bg-card p-6 shadow-lg max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">QR Kod për Pyetësorin</h3>
              <button onClick={() => setEqQrDialogId(null)} className="rounded p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            {eqQrLoading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : eqQrToken ? (
              <div className="flex flex-col items-center gap-3">
                <QRCodeCanvas value={eqQrToken} size={200} includeMargin />
                <p className="text-xs text-muted-foreground text-center">Skanoni për të plotësuar pyetësorin.</p>
              </div>
            ) : (
              <p className="text-xs text-destructive text-center py-4">Gabim gjatë gjenerimit të QR kodit.</p>
            )}
          </div>
        </div>
      )}

      <CommandDialog
        open={!!assignSessionId}
        onOpenChange={(open) => {
          if (!open) {
            setAssignSessionId(null)
            setMemberSearchQuery("")
            setAssignMemberError("")
          }
        }}
        title="Shto anëtar në sesion"
        description="Kërkoni dhe zgjidhni anëtarin që dëshironi të shtoni."
        className="max-w-2xl"
      >
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-semibold text-foreground">
            {selectedAssignSession
              ? `Shto anëtar • ${format(parseISO(selectedAssignSession.date), "EEEE, d MMM yyyy")}${selectedAssignSession.time ? ` • ${selectedAssignSession.time}` : ""}`
              : "Shto anëtar"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Zgjidhni një anëtar të rolit Member. Sistemi respekton rregullat ekzistuese të rezervimeve për modul.
          </p>
          {assignMemberError && (
            <p className="mt-2 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive">
              {assignMemberError}
            </p>
          )}
        </div>
        <CommandInput
          value={memberSearchQuery}
          onValueChange={setMemberSearchQuery}
          placeholder="Kërko me emër, email ose nr. regjistri..."
        />
        <CommandList>
          <CommandEmpty>Nuk u gjet asnjë anëtar i disponueshëm.</CommandEmpty>
          <CommandGroup heading="Anëtarët">
            {assignableMembers.map((member) => {
              const reservationCount = event.participants.filter((participant) => participant.userId === member.id).length
              const isAssigning = assigningMemberId === member.id
              const fullName = `${member.firstName} ${member.lastName}`.trim()

              return (
                <CommandItem
                  key={member.id}
                  value={member.id}
                  onSelect={() => void handleAssignMemberToSession(member.id)}
                  disabled={isAssigning}
                  className="items-start py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{fullName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {member.memberRegistryNumber} • {member.email}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {reservationCount > 0 ? `${reservationCount} rezervim(e) në këtë modul` : "Pa rezervime në këtë modul"}
                      {member.isActive === false ? " • Joaktiv" : ""}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-primary">
                    {isAssigning ? "Duke shtuar..." : "Shto"}
                  </span>
                </CommandItem>
              )
            })}
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      {/* Participants */}
      <div className="rounded-lg border border-border bg-card p-5">
        <button onClick={() => setShowParticipants(!showParticipants)} className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">Pjesëmarrësit</h3>
            <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {event.participants.length}
            </span>
          </div>
          {showParticipants ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>
        {showParticipants && (
          <div className="mt-4">
            <ParticipantsTable participants={event.participants} dates={event.dates} eventId={event.id} />
          </div>
        )}
      </div>
    </div >
  )
}

/* ==================================================================
   PAST EVENT DETAIL - Read Only, inline answers
   ================================================================== */
function PastEventDetail({ event }: { event: EventItem }) {
  const { user } = useAuth()
  const isAdmin = user?.role === "Admin"
  const [showParticipants, setShowParticipants] = useState(true)
  const [expandedParticipantId, setExpandedParticipantId] = useState<string | null>(null)
  const [expandedPastSessionParticipants, setExpandedPastSessionParticipants] = useState<Record<string, boolean>>({})
  const [questionnaireSent, setQuestionnaireSent] = useState(false)
  const [feedbackEmailState, setFeedbackEmailState] = useState<Record<string, "idle" | "loading" | { sent: number } | "error">>({})

  async function sendFeedbackEmails(dateId: string) {
    setFeedbackEmailState(prev => ({ ...prev, [dateId]: "loading" }))
    try {
      const res = await fetchWithAuth(`/api/Events/${event.id}/dates/${dateId}/send-lecturer-feedback-emails`, { method: "POST" })
      const data = await res.json()
      setFeedbackEmailState(prev => ({ ...prev, [dateId]: { sent: data.sent ?? 0 } }))
    } catch {
      setFeedbackEmailState(prev => ({ ...prev, [dateId]: "error" }))
    }
  }
  const feedbackQuestionnaires = useMemo(() => normalizeFeedbackQuestionnaires(event), [event])
  const flatFeedbackQuestions = useMemo(
    () => feedbackQuestionnaires.flatMap((questionnaire) => questionnaire.questions),
    [feedbackQuestionnaires]
  )

  const startDate = event.dates[0]?.date
  const endDate = event.dates[event.dates.length - 1]?.date

  // Check if the event's last date is today
  const finishedToday = useMemo(() => {
    const last = event.dates[event.dates.length - 1]?.date
    if (!last) return false
    try {
      return isToday(parseISO(last))
    } catch {
      return false
    }
  }, [event.dates])

  // For demo: always show the button on at least the first past event
  const showSendButton = finishedToday || event.status === "past"

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              Përfunduar
            </span>
            <h1 className="mt-2 text-xl font-semibold text-foreground">{event.name}</h1>
            <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              {event.place}
            </div>
          </div>
          {showSendButton && (
            <Button
              variant={questionnaireSent ? "secondary" : "default"}
              size="sm"
              className="gap-2 shrink-0"
              onClick={() => setQuestionnaireSent(true)}
              disabled={questionnaireSent}
            >
              {questionnaireSent ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  U dërgua
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Dërgo pyetësorin
                </>
              )}
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <MiniStat icon={CalendarRange} label="Datat">
            {startDate && format(parseISO(startDate), "MMM d")}
            {endDate && endDate !== startDate && ` - ${format(parseISO(endDate), "MMM d, yyyy")}`}
          </MiniStat>
          <MiniStat icon={Users} label="Pjesëmarrësit">
            {event.currentParticipants} / {event.maxParticipants}
          </MiniStat>
          <MiniStat icon={Tag} label="Temat">
            {event.topics?.length ?? 0}
          </MiniStat>
        </div>
      </div>

      {/* Topics */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">Temat</h3>
        <div className="flex flex-wrap gap-2">
          {(event.topics || []).map((topic) => (
            <span key={topic} className="rounded-md bg-primary/8 px-2.5 py-1 text-xs font-medium text-primary">
              {topic}
            </span>
          ))}
        </div>
      </div>

      {/* Sessions + participants by session (read-only) */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">Sesionet dhe pjesëmarrësit</h3>
        {event.dates.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nuk ka sesione të regjistruara për këtë modul.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {[...event.dates]
              .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""))
              .map((sessionDate) => {
                const participantsForSession = event.participants
                  .filter((participant) => participant.dateId === sessionDate.id)
                  .sort((a, b) => {
                    const aName = `${a.firstName} ${a.lastName}`.trim()
                    const bName = `${b.firstName} ${b.lastName}`.trim()
                    return aName.localeCompare(bName)
                  })
                const isSessionExpanded = expandedPastSessionParticipants[sessionDate.id] === true

                return (
                  <div key={sessionDate.id} className="rounded-md border border-border bg-muted/20">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedPastSessionParticipants((prev) => ({
                          ...prev,
                          [sessionDate.id]: !prev[sessionDate.id],
                        }))
                      }
                      className="flex w-full flex-col gap-1 border-b border-border px-3 py-2.5 text-left transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-center gap-2 text-sm text-foreground">
                        <CalendarRange className="h-3.5 w-3.5 text-primary" />
                        <span>{format(parseISO(sessionDate.date), "EEEE, MMM d, yyyy")}</span>
                        {sessionDate.time && (
                          <span className="text-xs text-muted-foreground">• {sessionDate.time}</span>
                        )}
                      </div>
                      <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{participantsForSession.length} pjesëmarrës</span>
                        {isAdmin && (() => {
                          const st = feedbackEmailState[sessionDate.id]
                          return (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); void sendFeedbackEmails(sessionDate.id) }}
                              disabled={st === "loading"}
                              className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
                            >
                              {st === "loading" ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Mail className="h-3 w-3" />
                              )}
                              {typeof st === "object" ? `Dërguar ${st.sent}` : st === "error" ? "Gabim" : "Feedback Email"}
                            </button>
                          )
                        })()}
                        {isSessionExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </div>
                    </button>

                    {isSessionExpanded && (
                      <>
                        {participantsForSession.length === 0 ? (
                          <p className="px-3 py-3 text-xs text-muted-foreground">
                            Nuk ka pjesëmarrës të lidhur me këtë sesion.
                          </p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                              <thead>
                                <tr className="border-b border-border bg-card/70">
                                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Emri</th>
                                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Nr. Regjistri</th>
                                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Email</th>
                                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Statusi</th>
                                </tr>
                              </thead>
                              <tbody>
                                {participantsForSession.map((participant) => {
                                  const isAttended = participant.attendance === "attended"
                                  const isAbsent = participant.attendance === "absent"
                                  return (
                                    <tr key={participant.id} className="border-b border-border last:border-0">
                                      <td className="px-3 py-2.5 text-xs font-medium text-foreground">
                                        {participant.firstName} {participant.lastName}
                                      </td>
                                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                                        {participant.memberRegistryNumber || "—"}
                                      </td>
                                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                                        {participant.email || "—"}
                                      </td>
                                      <td className="px-3 py-2.5 text-xs">
                                        <span
                                          className={`rounded px-2 py-0.5 font-medium ${isAttended
                                              ? "bg-green-500/10 text-green-600"
                                              : isAbsent
                                                ? "bg-red-500/10 text-red-600"
                                                : "bg-muted text-muted-foreground"
                                            }`}
                                        >
                                          {isAttended ? "Konfirmuar" : isAbsent ? "Refuzuar" : "Në pritje"}
                                        </span>
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
          </div>
        )}
      </div>

      {/* Feedback Questions (read-only) */}
      {feedbackQuestionnaires.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">Pyetësorët e feedback-ut</h3>
          <div className="flex flex-col gap-3">
            {feedbackQuestionnaires.map((questionnaire) => (
              <div key={questionnaire.id} className="rounded-md border border-border bg-muted/30 p-3">
                <p className="mb-2 text-sm font-semibold text-foreground">{questionnaire.title}</p>
                <div className="flex flex-col gap-2">
                  {questionnaire.questions.map((question) => (
                    <div key={question.id} className="flex items-start gap-2.5 rounded-md bg-card/80 p-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/10">
                        {question.type === "rating" ? (
                          <Star className="h-3 w-3 text-primary" />
                        ) : question.type === "multiple-choice" ? (
                          <CheckCircle2 className="h-3 w-3 text-primary" />
                        ) : (
                          <MessageSquare className="h-3 w-3 text-primary" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{question.question}</p>
                        <p className="text-xs text-muted-foreground capitalize">{question.type.replace("-", " ")}</p>
                        {question.type === "multiple-choice" && question.options && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {question.options.map((option) => (
                              <span key={option} className="rounded border border-border bg-card px-2 py-0.5 text-xs text-muted-foreground">{option}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Participants with inline-expand answers */}
      <div className="rounded-lg border border-border bg-card p-5">
        <button onClick={() => setShowParticipants(!showParticipants)} className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">Pjesëmarrësit</h3>
            <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {event.participants.length}
            </span>
          </div>
          {showParticipants ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>

        {showParticipants && (
          <div className="mt-4 overflow-x-auto rounded-md border border-border">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-3 py-2.5 text-xs font-medium text-muted-foreground">Emri</th>
                  <th className="px-3 py-2.5 text-xs font-medium text-muted-foreground">Email</th>
                  <th className="px-3 py-2.5 text-xs font-medium text-muted-foreground">Vendi</th>
                  <th className="px-3 py-2.5 text-xs font-medium text-muted-foreground">Përgjigjet</th>
                </tr>
              </thead>
              <tbody>
                {event.participants.slice(0, 50).map((p) => {
                  const isExpanded = expandedParticipantId === p.id
                  const hasAnswers = p.answers && p.answers.length > 0
                  return (
                    <Fragment key={p.id}>
                      <tr
                        className={`border-b border-border last:border-0 transition-colors ${isExpanded ? "bg-muted/30" : "hover:bg-muted/20"
                          }`}
                      >
                        <td className="px-3 py-2.5 font-medium text-foreground whitespace-nowrap">
                          {p.firstName} {p.lastName}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">{p.email}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">#{p.seatNumber}</td>
                        <td className="px-3 py-2.5">
                          {hasAnswers ? (
                            <button
                              onClick={() => setExpandedParticipantId(isExpanded ? null : p.id)}
                              className={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors ${isExpanded
                                ? "bg-primary text-primary-foreground"
                                : "bg-primary/10 text-primary hover:bg-primary/20"
                                }`}
                            >
                              {isExpanded ? "Fshih" : "Shfaq përgjigjet"}
                              {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            </button>
                          ) : (
                            <span className="text-xs text-muted-foreground">--</span>
                          )}
                        </td>
                      </tr>
                      {/* Inline expanded answers row */}
                      {isExpanded && hasAnswers && (
                        <tr>
                          <td colSpan={4} className="px-3 pb-3 pt-0 bg-muted/20">
                            <div className="rounded-md border border-border bg-card p-3">
                              <p className="text-xs font-medium text-muted-foreground mb-2">
                                Feedback nga {p.firstName} {p.lastName}
                              </p>
                              <div className="flex flex-col gap-2">
                                {p.answers!.map((a) => {
                                  const question = flatFeedbackQuestions.find((q) => q.id === a.questionId)
                                  return (
                                    <div key={a.questionId} className="flex flex-col gap-0.5 rounded bg-muted/40 p-2.5">
                                      <p className="text-xs text-muted-foreground">{question?.question || "E panjohur"}</p>
                                      {question?.type === "rating" ? (
                                        <div className="flex items-center gap-1">
                                          {Array.from({ length: 5 }, (_, i) => (
                                            <Star
                                              key={i}
                                              className={`h-3.5 w-3.5 ${i < Number(a.answer) ? "fill-chart-3 text-chart-3" : "text-border"}`}
                                            />
                                          ))}
                                          <span className="ml-1 text-xs text-muted-foreground">({a.answer}/5)</span>
                                        </div>
                                      ) : (
                                        <p className="text-sm text-foreground">{a.answer}</p>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
            {event.participants.length > 50 && (
              <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
                Duke shfaqur 50 nga {event.participants.length} pjesëmarrës
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ==================================================================
   Mini Stat component
   ================================================================== */
function MiniStat({ icon: Icon, label, children }: { icon: typeof CalendarRange; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md bg-muted/40 p-3">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
        <Icon className="h-3 w-3" />
        {label}
      </p>
      <p className="text-sm font-semibold text-foreground">{children}</p>
    </div>
  )
}

/* ==================================================================
   Feedback Questionnaires Editor
   ================================================================== */
function FeedbackQuestionnairesEditor({
  eventId,
  questionnaires,
  onAddQuestionnaire,
  onRemoveQuestionnaire,
  onUpdateQuestionnaireTitle,
  onAddQuestion,
  onRemoveQuestion,
  onUpdateQuestion,
  onAddOption,
  onUpdateOption,
  onRemoveOption,
}: {
  eventId: string
  questionnaires: FeedbackQuestionnaire[]
  onAddQuestionnaire: () => void
  onRemoveQuestionnaire: (questionnaireId: string) => void
  onUpdateQuestionnaireTitle: (questionnaireId: string, title: string) => void
  onAddQuestion: (questionnaireId: string) => void
  onRemoveQuestion: (questionnaireId: string, questionId: string) => void
  onUpdateQuestion: (questionnaireId: string, questionId: string, field: keyof FeedbackQuestion, value: string | string[]) => void
  onAddOption: (questionnaireId: string, questionId: string) => void
  onUpdateOption: (questionnaireId: string, questionId: string, index: number, value: string) => void
  onRemoveOption: (questionnaireId: string, questionId: string, index: number) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const [copiedQuestionnaireId, setCopiedQuestionnaireId] = useState<string | null>(null)
  const origin = typeof window !== "undefined" ? window.location.origin : ""

  function buildQuestionnaireLink(questionnaireId: string) {
    const params = new URLSearchParams()
    params.set("eventId", eventId)
    params.set("questionnaireId", questionnaireId)
    return `${origin}/questionnaire?${params.toString()}`
  }

  async function copyQuestionnaireLink(questionnaireId: string) {
    const link = buildQuestionnaireLink(questionnaireId)
    await navigator.clipboard.writeText(link)
    setCopiedQuestionnaireId(questionnaireId)
    window.setTimeout(() => setCopiedQuestionnaireId((current) => current === questionnaireId ? null : current), 2000)
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between p-5 hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <MessageSquare className="h-4 w-4 text-primary" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-foreground">Pyetësori i feedback-ut</h3>
            <p className="text-xs text-muted-foreground">
              {questionnaires.length} pyetësorë të pavarur
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="border-t border-border px-5 pb-5">
          {questionnaires.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <MessageSquare className="mb-2 h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground mb-3">Nuk ka pyetësorë ende</p>
              <Button onClick={onAddQuestionnaire} size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Shto pyetësor
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 pt-4">
              {questionnaires.map((questionnaire, questionnaireIndex) => {
                const questionnaireLink = buildQuestionnaireLink(questionnaire.id)
                const isCopied = copiedQuestionnaireId === questionnaire.id

                return (
                  <div key={questionnaire.id} className="rounded-lg border border-border bg-muted/20">
                    <div className="flex flex-col gap-3 border-b border-border/50 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-2.5">
                        <span className="mt-1 flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-xs font-semibold text-primary">
                          {questionnaireIndex + 1}
                        </span>
                        <div className="flex min-w-0 flex-col gap-2">
                          <Input
                            value={questionnaire.title}
                            onChange={(e) => onUpdateQuestionnaireTitle(questionnaire.id, e.target.value)}
                            placeholder="Titulli i pyetësorit"
                            className="h-8 max-w-sm bg-card text-sm"
                          />
                          <p className="text-xs text-muted-foreground">
                            {questionnaire.questions.length} pyetje
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1.5 text-xs"
                          onClick={() => void copyQuestionnaireLink(questionnaire.id)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                          {isCopied ? "U kopjua" : "Kopjo linkun"}
                        </Button>
                        <a
                          href={questionnaireLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-7 items-center rounded-md border border-border px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          Hap formularin
                        </a>
                        <button
                          onClick={() => onRemoveQuestionnaire(questionnaire.id)}
                          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          aria-label="Fshi pyetësorin"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-4 p-3.5 lg:grid-cols-[1fr_auto]">
                      <div className="min-w-0">
                        {questionnaire.questions.length === 0 ? (
                          <div className="rounded-md border border-dashed border-border bg-card/70 px-3 py-4 text-center text-xs text-muted-foreground">
                            Ky pyetësor nuk ka pyetje ende.
                          </div>
                        ) : (
                          <div className="flex flex-col gap-3">
                            {questionnaire.questions.map((question, questionIndex) => (
                              <div key={question.id} className="group rounded-lg border border-border bg-card/80">
                                <div className="flex items-center gap-2.5 border-b border-border/60 px-3.5 py-2.5">
                                  <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-xs font-semibold text-primary">
                                    {questionIndex + 1}
                                  </span>
                                  <div className="flex items-center gap-1 rounded border border-border bg-card px-2 py-0.5">
                                    {question.type === "rating" ? <Star className="h-3 w-3" /> : question.type === "multiple-choice" ? <CheckCircle2 className="h-3 w-3" /> : <MessageSquare className="h-3 w-3" />}
                                    <span className="text-xs font-medium text-foreground capitalize">
                                      {question.type === "multiple-choice" ? "Opsione" : question.type === "rating" ? "Vlerësim" : "Tekst"}
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => onRemoveQuestion(questionnaire.id, question.id)}
                                    className="ml-auto rounded p-1 text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                                    aria-label="Fshi pyetjen"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>

                                <div className="flex flex-col gap-3 p-3.5">
                                  <div className="flex flex-col gap-1.5">
                                    <Label className="text-xs text-muted-foreground">Pyetja</Label>
                                    <Input
                                      value={question.question}
                                      onChange={(e) => onUpdateQuestion(questionnaire.id, question.id, "question", e.target.value)}
                                      placeholder="Shkruaj pyetjen..."
                                      className="h-8 bg-card text-sm"
                                    />
                                  </div>

                                  <div className="flex flex-col gap-1.5">
                                    <Label className="text-xs text-muted-foreground">Lloji</Label>
                                    <div className="flex gap-1.5">
                                      {(["text", "rating", "multiple-choice"] as const).map((type) => (
                                        <button
                                          key={type}
                                          onClick={() => onUpdateQuestion(questionnaire.id, question.id, "type", type)}
                                          className={`flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${question.type === type
                                            ? "border-primary bg-primary/10 text-primary"
                                            : "border-border bg-card text-muted-foreground hover:text-foreground"
                                            }`}
                                        >
                                          {type === "rating" ? <Star className="h-3 w-3" /> : type === "multiple-choice" ? <CheckCircle2 className="h-3 w-3" /> : <MessageSquare className="h-3 w-3" />}
                                          {type === "text" ? "Tekst" : type === "rating" ? "Vlerësim" : "Opsione"}
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  {question.type === "rating" && (
                                    <div className="flex items-center gap-1 rounded border border-border bg-card p-2.5">
                                      <span className="mr-2 text-xs text-muted-foreground">Parapamje:</span>
                                      {[1, 2, 3, 4, 5].map((star) => (
                                        <Star key={star} className="h-4 w-4 text-chart-3/30" />
                                      ))}
                                    </div>
                                  )}

                                  {question.type === "multiple-choice" && (
                                    <div className="flex flex-col gap-1.5">
                                      <Label className="text-xs text-muted-foreground">Opsionet</Label>
                                      <div className="flex flex-col gap-1.5 rounded border border-border bg-card p-2.5">
                                        {(question.options ?? []).map((option, optionIndex) => (
                                          <div key={optionIndex} className="flex items-center gap-2">
                                            <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-border" />
                                            <Input
                                              value={option}
                                              onChange={(e) => onUpdateOption(questionnaire.id, question.id, optionIndex, e.target.value)}
                                              placeholder={`Opsioni ${optionIndex + 1}`}
                                              className="h-7 flex-1 border-border bg-muted/30 text-xs"
                                            />
                                            <button
                                              onClick={() => onRemoveOption(questionnaire.id, question.id, optionIndex)}
                                              className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                                              aria-label="Hiq opsionin"
                                            >
                                              <X className="h-3 w-3" />
                                            </button>
                                          </div>
                                        ))}
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => onAddOption(questionnaire.id, question.id)}
                                          className="mt-1 h-7 w-fit gap-1 text-xs"
                                        >
                                          <Plus className="h-3 w-3" />
                                          Shto opsion
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        <Button
                          variant="outline"
                          onClick={() => onAddQuestion(questionnaire.id)}
                          size="sm"
                          className="mt-3 gap-2 border-dashed"
                        >
                          <Plus className="h-4 w-4" />
                          Shto pyetje
                        </Button>
                      </div>

                      <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-3">
                        <QRCodeCanvas value={questionnaireLink} size={120} includeMargin />
                        <p className="max-w-[160px] text-center text-[11px] text-muted-foreground">
                          Skanoje me kamerën e telefonit për të hapur këtë pyetësor.
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}

              <Button variant="outline" onClick={onAddQuestionnaire} size="sm" className="gap-2 border-dashed">
                <Plus className="h-4 w-4" />
                Shto pyetësor
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ==================================================================
   Participants Table (for upcoming events)
   ================================================================== */
function ParticipantsTable({
  participants,
  dates,
  eventId
}: {
  participants: Participant[];
  dates: EventItem["dates"];
  eventId: string
}) {
  const dateMap = new Map(dates.map((d) => [d.id, d.date]))
  const { markAttendance, users, cancelBooking } = useEvents()
  const { user } = useAuth()
  const canManageAttendance = user?.role === "Admin" || user?.role === "Lecturer"
  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users])
  const [updatingKey, setUpdatingKey] = useState<string | null>(null)
  const [removingParticipantId, setRemovingParticipantId] = useState<string | null>(null)

  async function setAttendance(participantId: string, status: "attended" | "absent") {
    const key = `${participantId}-${status}`
    setUpdatingKey(key)
    try {
      await markAttendance(eventId, participantId, status)
    } catch (error) {
      console.error("Failed to update participant attendance", error)
    } finally {
      setUpdatingKey(null)
    }
  }

  async function removeParticipant(participantId: string) {
    setRemovingParticipantId(participantId)
    try {
      await cancelBooking(eventId, participantId)
    } catch (error) {
      console.error("Failed to remove participant", error)
    } finally {
      setRemovingParticipantId(null)
    }
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-3 py-2.5 text-xs font-medium text-muted-foreground">Emri</th>
            <th className="px-3 py-2.5 text-xs font-medium text-muted-foreground">Email</th>
            <th className="px-3 py-2.5 text-xs font-medium text-muted-foreground">Data</th>
            <th className="px-3 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
            <th className="px-3 py-2.5 text-xs font-medium text-muted-foreground border-l border-border bg-card">
              Prezenca
            </th>
          </tr>
        </thead>
        <tbody>
          {participants.slice(0, 50).map((p) => {
            const identity = resolveParticipantIdentity(p, usersById)
            const isAttended = p.attendance === "attended"
            const isAbsent = p.attendance === "absent"
            const isRemoving = removingParticipantId === p.id

            return (
              <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                <td className="px-3 py-2.5 font-medium text-foreground whitespace-nowrap">
                  <div className="flex flex-col gap-0.5">
                    <span>{identity.displayName}</span>
                    {identity.memberRegistryNumber && (
                      <span className="text-[11px] font-normal text-muted-foreground">{identity.memberRegistryNumber}</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">{identity.email || "-"}</td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  {dateMap.get(p.dateId) ? format(parseISO(dateMap.get(p.dateId)!), "MMM d, yyyy") : "-"}
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${p.status === "waitlisted" ? "bg-amber-500/10 text-amber-500" : "bg-primary/10 text-primary"}`}>
                    {p.status === "waitlisted" ? "Në pritje" : "I regjistruar (#" + p.seatNumber + ")"}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-muted-foreground border-l border-border bg-card">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${isAttended ? "bg-green-500/10 text-green-500" : isAbsent ? "bg-red-500/10 text-red-500" : "bg-muted text-muted-foreground"}`}>
                      {isAttended ? "I Pranishëm" : isAbsent ? "Mungon" : "E Rezervuar"}
                    </span>

                    {canManageAttendance && (
                      <div className="flex bg-muted/50 rounded-md p-0.5">
                        <Button
                          variant={isAttended ? "default" : "ghost"}
                          size="sm"
                          className={`h-6 text-[10px] px-2 rounded-sm ${isAttended ? "bg-green-600 hover:bg-green-700 text-white" : "text-muted-foreground hover:text-green-600"}`}
                          disabled={isAttended || isRemoving || updatingKey === `${p.id}-attended` || updatingKey === `${p.id}-absent`}
                          onClick={() => setAttendance(p.id, "attended")}
                        >
                          Konfirmo
                        </Button>
                        <Button
                          variant={isAbsent ? "default" : "ghost"}
                          size="sm"
                          className={`h-6 text-[10px] px-2 rounded-sm ${isAbsent ? "bg-red-600 hover:bg-red-700 text-white" : "text-muted-foreground hover:text-red-600"}`}
                          disabled={isAbsent || isRemoving || updatingKey === `${p.id}-attended` || updatingKey === `${p.id}-absent`}
                          onClick={() => setAttendance(p.id, "absent")}
                        >
                          Refuzo
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] px-2 rounded-sm text-muted-foreground hover:text-destructive"
                          disabled={isRemoving || updatingKey === `${p.id}-attended` || updatingKey === `${p.id}-absent`}
                          onClick={() => void removeParticipant(p.id)}
                        >
                          {isRemoving ? "Duke hequr..." : "Hiq"}
                        </Button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {participants.length > 50 && (
        <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
          Duke shfaqur 50 nga {participants.length}
        </div>
      )}
    </div>
  )
}
