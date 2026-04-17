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
import { parseISO, isToday } from "date-fns"
import { formatDate } from "@/lib/utils"
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
  ClipboardList,
  BookOpen,
  Calculator,
  Briefcase,
  Globe,
  BarChart2,
  Shield,
  Cpu,
  Leaf,
  Landmark,
  Scale,
  Banknote,
  TrendingUp,
  Building2,
  GraduationCap,
  FlaskConical,
  type LucideIcon,
} from "lucide-react"

const TOPIC_ICONS: LucideIcon[] = [
  BookOpen, Calculator, Briefcase, Globe, BarChart2,
  Shield, Cpu, Leaf, Landmark, Scale,
  Banknote, TrendingUp, Building2, GraduationCap, FlaskConical,
]

function topicIcon(topic: string): LucideIcon {
  let hash = 0
  for (let i = 0; i < topic.length; i++) {
    hash = (hash * 31 + topic.charCodeAt(i)) >>> 0
  }
  return TOPIC_ICONS[hash % TOPIC_ICONS.length]
}

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
    <div className="mx-auto max-w-4xl px-4 py-6 lg:px-8">
      {/* Top bar */}
      <div className="mb-6 rounded-lg border border-border bg-card px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="h-8 w-fit gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Kthehu te modulet
        </Button>

        {/* Divider on desktop */}
        <div className="hidden sm:block h-5 w-px bg-border mx-0.5" />

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-1.5 sm:ml-auto">
          {isAdmin && isUpcoming && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 px-3 text-xs"
              onClick={() => setShowEditForm(true)}
            >
              <Pencil className="h-3.5 w-3.5" />
              Modifiko
            </Button>
          )}
          {(isAdmin || user?.role === "Lecturer") && (
            <Button
              size="sm"
              className="h-8 gap-1.5 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => setShowQrScanner(true)}
            >
              <QrCode className="h-3.5 w-3.5" />
              Skano QR
            </Button>
          )}
          {isAdmin && isUpcoming && <NotifyButton eventId={event.id} isNotified={event.isNotified} />}
          {isAdmin && <ShareButton eventId={event.id} />}
          {isAdmin && (
            <Button
              variant="destructive"
              size="sm"
              className="h-8 gap-1.5 px-3 text-xs"
              onClick={() => setShowDeletePrompt(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Fshi
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

/* --- QR Modal --- */
function QrModal({
  title,
  onClose,
  loading,
  error,
  children,
}: {
  title: string
  onClose: () => void
  loading: boolean
  error: string | null
  children?: React.ReactNode
}) {
  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm mx-4 rounded-xl border border-border bg-card shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <QrCode className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Duke gjeneruar...</p>
            </div>
          ) : error ? (
            <p className="text-sm text-destructive text-center py-4">{error}</p>
          ) : (
            children
          )}
        </div>
      </div>
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
      className={`h-8 gap-1.5 px-3 text-xs ${isNotified ? "" : "bg-amber-500 hover:bg-amber-600 text-white"}`}
      onClick={handleNotify}
      disabled={loading || isNotified}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isNotified ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
      {isNotified ? "Të njoftuar" : (loading ? "Duke njoftuar..." : "Njofto")}
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
    <Button variant="outline" size="sm" className="h-8 gap-1.5 px-3 text-xs" onClick={handleCopy}>
      {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <Share2 className="h-3.5 w-3.5" />}
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
  const [sendingDocumentsEmailDateId, setSendingDocumentsEmailDateId] = useState<string | null>(null)
  const [documentsEmailResult, setDocumentsEmailResult] = useState<Record<string, { sent: number } | "error">>({})
  const [sessionDocFile, setSessionDocFile] = useState<Record<string, File | null>>({})
  const [sessionDocName, setSessionDocName] = useState<Record<string, string>>({})
  const [sessionDocUploading, setSessionDocUploading] = useState<string | null>(null)
  const [sessionDocInputKey, setSessionDocInputKey] = useState(0)
  const [deletingSessionDocId, setDeletingSessionDocId] = useState<string | null>(null)
  const [expandedSessionDocsId, setExpandedSessionDocsId] = useState<string | null>(null)
  const [endSessionConfirmId, setEndSessionConfirmId] = useState<string | null>(null)
  const [docsExpanded, setDocsExpanded] = useState(false)
  const [eqSectionExpanded, setEqSectionExpanded] = useState(false)
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
    <div className="mx-auto max-w-4xl space-y-3 pb-10">
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

      {/* End Session Confirm Modal */}
      {endSessionConfirmId && (() => {
        const sessionDate = event.dates.find(d => d.id === endSessionConfirmId)
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => setEndSessionConfirmId(null)}
          >
            <div
              className="rounded-lg border border-border bg-card shadow-lg w-full max-w-sm mx-4 overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-950/40">
                    <X className="h-4 w-4 text-amber-600" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">Mbyll sesionin</h3>
                </div>
                <button
                  onClick={() => setEndSessionConfirmId(null)}
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Body */}
              <div className="px-5 pb-4">
                <p className="text-sm text-muted-foreground">
                  Jeni i sigurt që dëshironi të mbyllni sesionin e{" "}
                  <span className="font-medium text-foreground">
                    {sessionDate ? formatDate(sessionDate.date, "EEEE, d MMMM yyyy") : "zgjedhur"}
                  </span>
                  ?
                </p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Kjo veprim nuk mund të anulohet.
                </p>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setEndSessionConfirmId(null)}
                >
                  Anulo
                </Button>
                <Button
                  size="sm"
                  className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={() => {
                    onEndSession(endSessionConfirmId)
                    setEndSessionConfirmId(null)
                  }}
                >
                  Po, mbyll sesionin
                </Button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Session QR Dialog */}
      {sessionQrDialogId && (
        <QrModal
          title="QR Kod për Sesionin"
          onClose={() => setSessionQrDialogId(null)}
          loading={sessionQrLoading}
          error={!sessionQrToken && !sessionQrLoading ? "Gabim gjatë gjenerimit të QR kodit." : null}
        >
          {sessionQrToken && (
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
                <QRCodeCanvas value={sessionQrToken} size={220} includeMargin={false} />
              </div>
              <p className="text-sm text-muted-foreground text-center max-w-xs">
                Skanoni këtë QR kod me telefonin për të konfirmuar praninë në sesion.
              </p>
            </div>
          )}
        </QrModal>
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
            {startDate && formatDate(startDate, "d MMMM")}
            {endDate && endDate !== startDate && ` - ${formatDate(endDate, "d MMMM")}`}
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
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-50 dark:bg-amber-950/40">
            <Tag className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground leading-none">Temat</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {topics.length === 0 ? "Nuk ka tema" : `${topics.length} temë${topics.length !== 1 ? "" : ""}`}
            </p>
          </div>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          {/* Tags */}
          {topics.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {topics.map((topic) => {
                const TopicIcon = topicIcon(topic)
                return (
                  <span
                    key={topic}
                    className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400"
                  >
                    <TopicIcon className="h-3 w-3 shrink-0" />
                    {topic}
                    {isAdmin && (
                      <button
                        onClick={() => removeTopic(topic)}
                        className="ml-0.5 rounded-full p-0.5 hover:bg-amber-200/60 dark:hover:bg-amber-800/40 transition-colors"
                        aria-label={`Hiq ${topic}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                )
              })}
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-md border border-dashed border-border bg-muted/20 px-4 py-3">
              <Tag className="h-4 w-4 text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">Nuk ka tema të shtuara.</p>
            </div>
          )}

          {/* Add input */}
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
                className="h-8 flex-1 max-w-sm text-sm bg-muted/30"
              />
              <Button onClick={addTopic} variant="outline" size="sm" className="h-8 gap-1.5 text-xs shrink-0" disabled={!topicInput.trim()}>
                <Plus className="h-3.5 w-3.5" />
                Shto
              </Button>
            </div>
          )}
        </div>
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
              <div key={d.id} className={`rounded-lg border bg-card overflow-hidden transition-shadow hover:shadow-sm ${d.isEnded ? "border-green-200 dark:border-green-900/50" : "border-border"}`}>
                <div
                  className={`flex items-center gap-3 px-3 py-3 ${canManageSessionParticipants ? "cursor-pointer transition-colors hover:bg-muted/30" : ""}`}
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
                  {/* Status accent bar */}
                  <div className={`shrink-0 w-1 self-stretch rounded-full ${d.isEnded ? "bg-green-500" : "bg-primary"}`} />

                  {/* Date + meta */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">{formatDate(d.date, "EEEE, d MMMM yyyy")}</span>
                      {d.isEnded
                        ? <span className="rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 text-[10px] font-medium">Mbyllur</span>
                        : <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-medium">Aktiv</span>
                      }
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <div className="h-1 w-16 overflow-hidden rounded-full bg-border">
                          <div
                            className={`h-full rounded-full transition-all ${d.maxParticipants > 0 && d.currentParticipants / d.maxParticipants >= 0.9 ? "bg-destructive" : "bg-primary"}`}
                            style={{ width: `${d.maxParticipants > 0 ? Math.min(100, Math.round(d.currentParticipants / d.maxParticipants * 100)) : 0}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-muted-foreground">{d.currentParticipants} / {d.maxParticipants} vende</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">{participantsForSession.length} pjesëmarrës të regjistruar</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {!d.isEnded && canRunQuiz && new Date(d.date) < new Date() && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={(clickEvent) => {
                          clickEvent.stopPropagation()
                          setEndSessionConfirmId(d.id)
                        }}
                      >
                        Mbyll sesionin
                      </Button>
                    )}
                    {isAdmin && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                        title="QR Kod"
                        onClick={(clickEvent) => {
                          clickEvent.stopPropagation()
                          void handleGenerateSessionQr(d.id)
                        }}
                      >
                        <QrCode className="h-3.5 w-3.5" />
                      </Button>
                    )}

                    {isAdmin && d.isEnded && (() => {
                      const deState = documentsEmailResult[d.id]
                      return (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                          title={typeof deState === "object" ? `Dërguar ${deState.sent}` : deState === "error" ? "Gabim dërgimi dokumentesh" : "Dërgo Dokumentet"}
                          disabled={sendingDocumentsEmailDateId === d.id}
                          onClick={(clickEvent) => {
                            clickEvent.stopPropagation()
                            void handleSendSessionDocumentsEmail(d.id)
                          }}
                        >
                          {sendingDocumentsEmailDateId === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
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
                      <div className="ml-1 text-muted-foreground">
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
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
                      <div className="mt-4 border-t border-border pt-4">
                        {/* Section header — clickable toggle */}
                        <button
                          type="button"
                          className="flex w-full items-center justify-between mb-0 group"
                          onClick={() => setExpandedSessionDocsId(prev => prev === d.id ? null : d.id)}
                        >
                          <div className="flex items-center gap-2">
                            <div className="flex items-center justify-center h-6 w-6 rounded-md bg-blue-50 dark:bg-blue-950/40">
                              <FileText className="h-3.5 w-3.5 text-blue-500" />
                            </div>
                            <h4 className="text-xs font-semibold text-foreground">Dokumentet e sesionit</h4>
                            {d.documents && d.documents.length > 0 && (
                              <span className="inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                {d.documents.length}
                              </span>
                            )}
                          </div>
                          <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                            {expandedSessionDocsId === d.id
                              ? <ChevronUp className="h-3.5 w-3.5" />
                              : <ChevronDown className="h-3.5 w-3.5" />
                            }
                          </span>
                        </button>

                        {expandedSessionDocsId === d.id && (
                          <div className="mt-3">
                            {/* Document list */}
                            {d.documents && d.documents.length > 0 ? (
                              <div className="flex flex-col gap-1.5 mb-3">
                                {d.documents.map(doc => (
                                  <div
                                    key={doc.id}
                                    className="group flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2 transition-colors hover:bg-muted/60"
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <FileText className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                                      <button
                                        type="button"
                                        onClick={() => void handleOpenDocument(doc.id, doc.fileUrl, doc.fileName)}
                                        className="text-xs font-medium text-foreground hover:text-blue-600 hover:underline truncate text-left max-w-[180px]"
                                        title={doc.fileName}
                                      >
                                        {doc.fileName}
                                      </button>
                                      {doc.sizeBytes ? (
                                        <span className="shrink-0 text-[10px] text-muted-foreground bg-muted rounded px-1 py-0.5">
                                          {(doc.sizeBytes / 1024).toFixed(0)} KB
                                        </span>
                                      ) : null}
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                                      disabled={deletingSessionDocId === doc.id}
                                      onClick={() => void handleDeleteSessionDocument(d.id, doc.id)}
                                      title="Fshi dokumentin"
                                    >
                                      {deletingSessionDocId === doc.id
                                        ? <Loader2 className="h-3 w-3 animate-spin" />
                                        : <Trash2 className="h-3 w-3" />
                                      }
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-border bg-muted/20 py-4 mb-3">
                                <FileText className="h-5 w-5 text-muted-foreground/50" />
                                <p className="text-[11px] text-muted-foreground">Nuk ka dokumente për këtë sesion.</p>
                              </div>
                            )}

                            {/* Upload form */}
                            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-2.5">
                              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Ngarko dokument</p>
                              <div className="flex gap-2 items-end">
                                <div className="flex-1 space-y-1">
                                  <Label className="text-[11px] text-muted-foreground">Emri i dokumentit</Label>
                                  <Input
                                    value={sessionDocName[d.id] ?? ""}
                                    onChange={e => setSessionDocName(prev => ({ ...prev, [d.id]: e.target.value }))}
                                    placeholder="Opsionale"
                                    className="h-7 text-xs"
                                  />
                                </div>
                                <div className="flex-1 space-y-1">
                                  <Label className="text-[11px] text-muted-foreground">Skedari</Label>
                                  <Input
                                    key={`${d.id}-${sessionDocInputKey}`}
                                    type="file"
                                    className="h-7 text-xs cursor-pointer"
                                    onChange={e => setSessionDocFile(prev => ({ ...prev, [d.id]: e.target.files?.[0] ?? null }))}
                                  />
                                </div>
                                <Button
                                  size="sm"
                                  className="h-7 gap-1.5 text-xs shrink-0"
                                  onClick={() => void handleUploadSessionDocument(d.id)}
                                  disabled={!sessionDocFile[d.id] || sessionDocUploading === d.id}
                                >
                                  {sessionDocUploading === d.id
                                    ? <><Loader2 className="h-3 w-3 animate-spin" /> Duke ngarkuar...</>
                                    : <><Upload className="h-3 w-3" /> Ngarko</>
                                  }
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
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
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {/* Section header — clickable toggle */}
        <button
          type="button"
          onClick={() => setDocsExpanded(prev => !prev)}
          className="flex w-full items-center justify-between p-5 hover:bg-muted/20 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-7 w-7 rounded-md bg-blue-50 dark:bg-blue-950/40">
              <FileText className="h-4 w-4 text-blue-500" />
            </div>
            <div className="text-left">
              <h3 className="text-sm font-semibold text-foreground">Dokumentet</h3>
              <p className="text-xs text-muted-foreground">
                {(event.documents?.length ?? 0) === 0 ? "Nuk ka dokumente" : `${event.documents!.length} dokument${event.documents!.length !== 1 ? "e" : ""}`}
              </p>
            </div>
          </div>
          {docsExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>

        {docsExpanded && (
          <div className="border-t border-border px-5 pb-5 pt-4 flex flex-col gap-3">
            {/* Document list */}
            {event.documents && event.documents.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {event.documents.map(doc => (
                  <div
                    key={doc.id}
                    className="group flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2.5 transition-colors hover:bg-muted/60"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText className="h-4 w-4 shrink-0 text-blue-500" />
                      <button
                        type="button"
                        onClick={() => void handleOpenDocument(doc.id, doc.fileUrl, doc.fileName)}
                        className="text-sm font-medium text-foreground hover:text-blue-600 hover:underline truncate text-left max-w-xs"
                        title={doc.fileName}
                      >
                        {doc.fileName}
                      </button>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleOpenDocument(doc.id, doc.fileUrl, doc.fileName)}
                        className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                        disabled={downloadingDocId === doc.id}
                      >
                        {downloadingDocId === doc.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Download className="h-3.5 w-3.5" />
                        }
                        {downloadingDocId === doc.id ? "Duke hapur..." : "Hap"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDeleteDocument(doc.id)}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        title="Fshi dokumentin"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/20 py-6">
                <FileText className="h-6 w-6 text-muted-foreground/40" />
                <p className="text-xs text-muted-foreground">Nuk ka dokumente të bashkangjitura.</p>
              </div>
            )}

            {/* Upload form */}
            <div className="rounded-md border border-border bg-muted/20 p-3.5 space-y-3">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Bashkangjit dokument</p>
              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Emri i dokumentit</Label>
                  <Input
                    value={docName}
                    onChange={e => setDocName(e.target.value)}
                    placeholder="Opsionale"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Skedari</Label>
                  <Input
                    key={docInputKey}
                    type="file"
                    className="h-8 text-xs cursor-pointer"
                    onChange={(event) => {
                      setDocUploadError("")
                      setDocFile(event.target.files?.[0] ?? null)
                    }}
                  />
                </div>
                <Button
                  size="sm"
                  className="h-8 gap-1.5 text-xs shrink-0"
                  onClick={() => void handleDocumentUpload()}
                  disabled={!docFile || isUploadingDoc}
                >
                  {isUploadingDoc
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Duke ngarkuar...</>
                    : <><Upload className="h-3.5 w-3.5" /> Bashkangjit</>
                  }
                </Button>
              </div>
              {docUploadError && (
                <p className="text-xs text-destructive">{docUploadError}</p>
              )}
            </div>
          </div>
        )}
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

      {/* Event Questionnaires (module-level) */}
      {isAdmin && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {/* Toggle header */}
          <button
            type="button"
            onClick={() => setEqSectionExpanded(prev => !prev)}
            className="flex w-full items-center justify-between p-5 hover:bg-muted/20 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-950/40">
                <ClipboardList className="h-4 w-4 text-violet-500" />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-semibold text-foreground">Pyetësorët e modulit</h3>
                <p className="text-xs text-muted-foreground">
                  {eventQuestionnaires.length === 0 ? "Nuk ka pyetësorë" : `${eventQuestionnaires.length} pyetësor${eventQuestionnaires.length !== 1 ? "ë" : ""}`}
                </p>
              </div>
            </div>
            {eqSectionExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>

          {eqSectionExpanded && (
            <div className="border-t border-border px-5 pb-5 pt-4 flex flex-col gap-3">
              {eventQuestionnaires.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {eventQuestionnaires.map(eq => (
                    <div key={eq.id} className="rounded-lg border border-border bg-muted/20 overflow-hidden">
                      {/* Questionnaire row */}
                      <div className="flex items-center justify-between px-4 py-3 gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-violet-100 dark:bg-violet-900/30">
                            <FileText className="h-3.5 w-3.5 text-violet-600" />
                          </div>
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => void handleToggleEventQuestionnaireDetail(eq.id)}
                              className="text-sm font-medium text-foreground hover:underline text-left truncate block max-w-xs"
                            >
                              {eq.title}
                            </button>
                            <p className="text-[11px] text-muted-foreground">
                              {eq.questionCount} pyetje · {eq.responseCount} përgjigje
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] gap-1" onClick={() => void handleEventQuestionnaireQr(eq.id)}>
                            <QrCode className="h-3 w-3" /> QR
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] gap-1" onClick={() => void handleViewEventQuestionnaireResponses(eq.id)}>
                            <Users className="h-3 w-3" /> Përgjigjet
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            disabled={eqDeletingId === eq.id}
                            onClick={() => void handleDeleteEventQuestionnaire(eq.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      {/* Detail expand */}
                      {eqExpandedId === eq.id && (
                        <div className="border-t border-border bg-card/50 px-4 py-3">
                          {eqDetailLoading ? (
                            <div className="flex items-center gap-2 py-2">
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">Duke ngarkuar...</span>
                            </div>
                          ) : eqDetail ? (
                            <div className="flex flex-col gap-1.5">
                              {(eqDetail.questions ?? []).map((q: any, i: number) => (
                                <div key={q.id} className="flex items-center gap-2.5 rounded-md bg-muted/40 px-3 py-2 text-xs">
                                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/10 text-[10px] font-semibold text-primary">{i + 1}</span>
                                  <span className="text-foreground flex-1">{q.text}</span>
                                  <span className="text-muted-foreground">
                                    {q.type === "Options" || q.type === 0 ? "Opsione" : q.type === "FreeText" || q.type === 1 ? "Tekst" : "Yje"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">Nuk u gjetën detaje.</p>
                          )}
                        </div>
                      )}

                      {/* Responses expand */}
                      {eqShowResponses === eq.id && (
                        <div className="border-t border-border bg-card/50 px-4 py-3">
                          {eqResponsesLoading ? (
                            <div className="flex items-center gap-2 py-2">
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">Duke ngarkuar...</span>
                            </div>
                          ) : eqResponses.length === 0 ? (
                            <p className="text-xs text-muted-foreground py-1">Nuk ka përgjigje ende.</p>
                          ) : (
                            <div className="flex flex-col gap-2">
                              {eqResponses.map((r: any) => (
                                <div key={r.responseId ?? r.id} className="rounded-md border border-border bg-card px-3 py-2.5 text-xs">
                                  <div className="flex items-center gap-2 mb-1.5">
                                    <span className="font-semibold text-foreground">{r.firstName} {r.lastName}</span>
                                    <span className="text-muted-foreground">{r.submittedAt ? formatDate(r.submittedAt, "dd/MM/yyyy HH:mm") : ""}</span>
                                  </div>
                                  <div className="flex flex-col gap-0.5 pl-2 border-l-2 border-muted">
                                    {(r.answers ?? []).map((a: any) => (
                                      <div key={a.questionId} className="flex gap-2">
                                        <span className="text-muted-foreground shrink-0">{a.questionText ?? "Pyetje"}:</span>
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
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/20 py-6">
                  <ClipboardList className="h-6 w-6 text-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground">Nuk ka pyetësorë të modulit.</p>
                </div>
              )}

              {/* Create new */}
              <div className="flex gap-2 items-center rounded-md border border-border bg-muted/20 p-3">
                <Input
                  value={eqCreateTitle}
                  onChange={e => setEqCreateTitle(e.target.value)}
                  placeholder="Titulli i pyetësorit të ri..."
                  className="h-8 flex-1 text-sm bg-card"
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); void handleCreateEventQuestionnaire() } }}
                />
                <Button size="sm" className="h-8 gap-1.5 text-xs shrink-0" onClick={() => void handleCreateEventQuestionnaire()} disabled={eqCreating || !eqCreateTitle.trim()}>
                  <Plus className="h-3.5 w-3.5" /> Shto pyetësor
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Event Questionnaire QR Dialog */}
      {eqQrDialogId && (
        <QrModal
          title="QR Kod për Pyetësorin"
          onClose={() => setEqQrDialogId(null)}
          loading={eqQrLoading}
          error={!eqQrToken && !eqQrLoading ? "Gabim gjatë gjenerimit të QR kodit." : null}
        >
          {eqQrToken && (
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
                <QRCodeCanvas value={eqQrToken} size={220} includeMargin={false} />
              </div>
              <p className="text-sm text-muted-foreground text-center max-w-xs">Skanoni për të plotësuar pyetësorin.</p>
            </div>
          )}
        </QrModal>
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
              ? `Shto anëtar • ${formatDate(selectedAssignSession.date, "EEEE, d MMMM yyyy")}${selectedAssignSession.time ? ` • ${selectedAssignSession.time}` : ""}`
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
            {startDate && formatDate(startDate, "d MMMM")}
            {endDate && endDate !== startDate && ` - ${formatDate(endDate, "d MMMM yyyy")}`}
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
                        <span>{formatDate(sessionDate.date, "EEEE, d MMMM yyyy")}</span>
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
  const [expanded, setExpanded] = useState(false)
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
                  {dateMap.get(p.dateId) ? formatDate(dateMap.get(p.dateId)!, "d MMMM yyyy") : "-"}
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
