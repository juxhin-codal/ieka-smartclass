"use client"

/**
 * MyModulesView — shown to Members in the "Module CPD" tab when logged in.
 * Displays their booked sessions, wait-list status, cancel option, and
 * gives access to the in-class QR quiz and post-training survey.
 */

import { useState, useMemo } from "react"
import { useAuth } from "@/lib/auth-context"
import { useEvents } from "@/lib/events-context"
import { parseISO } from "date-fns"
import { formatDate } from "@/lib/utils"
import {
    CalendarRange, CheckCircle2, QrCode, BookOpen, Star, AlertCircle, Award, ListFilter, PlayCircle, MapPin, Tag,
    Clock, Search, User, FileText, Download, X, Ticket, Video, XCircle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { MemberQuizPage } from "@/components/quiz/member-quiz-page"
import { CertificateModal } from "@/components/certificates/certificate-modal"
import { useAuth as useAuthForCert } from "@/lib/auth-context"
import type { EventItem, Participant } from "@/lib/data"
import { Scanner } from "@yudiel/react-qr-scanner"

// ── Post-Training Survey Modal ───────────────────────────────────────────────
function SurveyModal({
    event,
    onClose,
}: {
    event: EventItem
    onClose: () => void
}) {
    const [answers, setAnswers] = useState<Record<string, string>>({})
    const [submitted, setSubmitted] = useState(false)
    const feedbackQuestions = event.feedbackQuestions ?? []

    function setAns(id: string, val: string) {
        setAnswers((p) => ({ ...p, [id]: val }))
    }

    if (submitted) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
                <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 flex flex-col items-center gap-4 shadow-2xl text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/15">
                        <CheckCircle2 className="h-8 w-8 text-green-500" />
                    </div>
                    <h2 className="text-lg font-bold text-foreground">Faleminderit!</h2>
                    <p className="text-sm text-muted-foreground">
                        Vlerësimi juaj u regjistrua. Kontributi juaj ndihmon IEKA të përmirësojë cilësinë e trajnimeve.
                    </p>
                    <Button onClick={onClose} className="w-full">Mbyll</Button>
                </div>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 backdrop-blur-sm p-4 py-8">
            <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between border-b border-border px-6 py-4"
                    style={{ background: "linear-gradient(135deg, #0d2347, #1a3a6b)" }}>
                    <div>
                        <p className="text-xs text-white/60 mb-0.5">Vlerësim Post-Trajnim</p>
                        <h2 className="text-base font-bold text-white">{event.name}</h2>
                    </div>
                    <button onClick={onClose} className="rounded-lg p-1.5 text-white/60 hover:bg-white/10">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="p-6 flex flex-col gap-5">
                    {feedbackQuestions.map((q, idx) => (
                        <div key={q.id} className="flex flex-col gap-2">
                            <p className="text-sm font-medium text-foreground">
                                <span className="text-primary mr-1.5">{idx + 1}.</span>{q.question}
                            </p>
                            {q.type === "rating" && (
                                <div className="flex gap-2">
                                    {[1, 2, 3, 4, 5].map((s) => (
                                        <button key={s} onClick={() => setAns(q.id, String(s))}
                                            className={`flex h-10 w-10 items-center justify-center rounded-lg border-2 text-sm font-bold transition-all ${Number(answers[q.id]) === s
                                                ? "border-amber-500 bg-amber-500 text-white"
                                                : "border-border bg-muted/30 text-muted-foreground hover:border-amber-400"
                                                }`}>
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            )}
                            {q.type === "multiple-choice" && q.options && (
                                <div className="flex flex-col gap-1.5">
                                    {q.options.map((opt) => (
                                        <button key={opt} onClick={() => setAns(q.id, opt)}
                                            className={`rounded-lg border-2 px-4 py-2.5 text-sm text-left transition-all ${answers[q.id] === opt
                                                ? "border-primary bg-primary/10 text-primary font-medium"
                                                : "border-border bg-muted/20 text-foreground hover:border-primary/40"
                                                }`}>
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                            )}
                            {q.type === "text" && (
                                <textarea
                                    value={answers[q.id] || ""}
                                    onChange={(e) => setAns(q.id, e.target.value)}
                                    placeholder="Shkruani komentin tuaj..."
                                    rows={3}
                                    className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                                />
                            )}
                        </div>
                    ))}
                    <div className="flex gap-2 pt-2 border-t border-border">
                        <Button variant="ghost" onClick={onClose} className="flex-1">Anulo</Button>
                        <Button onClick={() => setSubmitted(true)} className="flex-1">Dërgo Vlerësimin</Button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ── Booking Card ─────────────────────────────────────────────────────────────
function BookingCard({
    event,
    participant,
    onCancel,
    onOpen,
}: {
    event: EventItem
    participant: Participant
    onCancel: () => void
    onOpen: () => void
}) {
    const [showQuiz, setShowQuiz] = useState(false)
    const [showSurvey, setShowSurvey] = useState(false)
    const [showCert, setShowCert] = useState(false)
    const [showEntranceQR, setShowEntranceQR] = useState(false)
    const [cancelConfirm, setCancelConfirm] = useState(false)
    const [scanError, setScanError] = useState<string | null>(null)
    const [scanSuccess, setScanSuccess] = useState<string | null>(null)
    const [isProcessingScan, setIsProcessingScan] = useState(false)
    const { user: certUser } = useAuthForCert()

    const sessionDate = event.dates.find((d) => d.id === participant.dateId)
    const isWaitlisted = participant.status === "waitlisted"
    const isPast = event.status === "past"
    const hasAttended = participant.attendance === "attended"
    const hasQuiz = (event.quizQuestions?.length ?? 0) > 0
    const hasSurvey = (event.feedbackQuestions?.length ?? 0) > 0

    // Quiz is only accessible when the lecturer has started it
    const { isQuizLive, markAttendance } = useEvents()
    const quizLive = isQuizLive(event.id)

    async function handleEntranceScan(result: any) {
        if (!result || isProcessingScan) return
        try {
            const rawValue = Array.isArray(result) ? result[0]?.rawValue : (result.rawValue || result.text || result)
            if (!rawValue || typeof rawValue !== "string") return

            let parsed: any = null
            try {
                parsed = JSON.parse(rawValue)
            } catch {
                parsed = null
            }

            const eventIdFromQr =
                parsed?.eventId ||
                parsed?.moduleId ||
                parsed?.event ||
                (rawValue.startsWith("event:") ? rawValue.slice("event:".length) : null) ||
                (rawValue.match(/\/modules\/([A-Za-z0-9-]+)/)?.[1] ?? null)
            const dateIdFromQr = parsed?.dateId || parsed?.sessionId || parsed?.eventDateId

            if (!eventIdFromQr) {
                setScanError("Kod QR i pavlefshëm.")
                setScanSuccess(null)
                setTimeout(() => setScanError(null), 2500)
                return
            }

            if (eventIdFromQr !== event.id) {
                setScanError("Kodi QR nuk është për këtë modul.")
                setScanSuccess(null)
                setTimeout(() => setScanError(null), 2500)
                return
            }

            if (dateIdFromQr && dateIdFromQr !== participant.dateId) {
                setScanError("Kodi QR nuk i përket sesionit tuaj.")
                setScanSuccess(null)
                setTimeout(() => setScanError(null), 2500)
                return
            }

            setIsProcessingScan(true)
            await markAttendance(event.id, participant.id, "attended")
            setScanSuccess("Prezenca u konfirmua me sukses.")
            setScanError(null)
            setTimeout(() => {
                setShowEntranceQR(false)
                setScanSuccess(null)
            }, 1200)
        } catch {
            setScanError("Gabim gjatë skanimit. Provo përsëri.")
            setScanSuccess(null)
            setTimeout(() => setScanError(null), 2500)
        } finally {
            setIsProcessingScan(false)
        }
    }

    return (
        <>
            {showEntranceQR && certUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm px-4">
                    <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-lg animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-lg font-bold">Skanuesi i Klasës (QR)</h3>
                                <p className="text-sm text-muted-foreground mt-0.5">Drejto kamerën tek QR e sallës</p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setShowEntranceQR(false)} className="-mr-2 -mt-2 h-8 w-8 rounded-full">
                                <X className="h-4 w-4" />
                            </Button>
                        </div>

                        <div className="relative flex justify-center items-center h-56 bg-black rounded-xl mb-4 border-2 border-dashed border-primary/50 overflow-hidden">
                            <Scanner
                                onScan={(result) => handleEntranceScan(result)}
                                components={{
                                    onOff: true,
                                    torch: true,
                                    zoom: false,
                                    finder: true,
                                }}
                                styles={{
                                    container: { width: "100%", height: "100%" }
                                }}
                            />
                        </div>

                        <div className="h-12 w-full mt-1 flex items-center justify-center text-center">
                            {scanError && (
                                <p className="flex items-center gap-1.5 text-sm font-medium text-destructive">
                                    <AlertCircle className="h-4 w-4" /> {scanError}
                                </p>
                            )}
                            {scanSuccess && (
                                <p className="flex items-center gap-1.5 text-sm font-medium text-green-600">
                                    <CheckCircle2 className="h-4 w-4" /> {scanSuccess}
                                </p>
                            )}
                            {!scanError && !scanSuccess && (
                                <p className="text-xs text-muted-foreground">Vendosni kodin QR brenda kornizës</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {showQuiz && (
                <MemberQuizPage
                    eventName={event.name}
                    questions={event.quizQuestions ?? []}
                    onClose={() => setShowQuiz(false)}
                />
            )}
            {showSurvey && (
                <SurveyModal event={event} onClose={() => setShowSurvey(false)} />
            )}
            {showCert && certUser && (
                <CertificateModal
                    memberName={certUser.name}
                    registryNumber={certUser.memberRegistryNumber}
                    moduleName={event.name}
                    cpdHours={event.cpdHours}
                    completionDate={sessionDate?.date ?? ""}
                    lecturerName={event.lecturerName}
                    onClose={() => setShowCert(false)}
                />
            )}

            <div className={`rounded-xl border bg-card overflow-hidden transition-all ${isPast ? "border-border/60 opacity-90" : "border-border hover:shadow-md"}`}>
                {/* Status strip */}
                <div className={`h-1 w-full ${isWaitlisted ? "bg-amber-500" :
                    hasAttended ? "bg-green-500" :
                        isPast ? "bg-muted-foreground" : "bg-primary"
                    }`} />

                <div className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${isWaitlisted ? "bg-amber-500/10 text-amber-500" :
                                    hasAttended ? "bg-green-500/10 text-green-500" :
                                        isPast ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
                                    }`}>
                                    {isWaitlisted ? "⏳ Listë Pritjeje" : hasAttended ? "✓ I Pranishëm" : isPast ? "Përfunduar" : "✓ E Rezervuar"}
                                </span>
                                <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground font-mono">{event.cpdHours}h CPD</span>
                            </div>
                            <button onClick={onOpen} className="text-left">
                                <h3 className="text-sm font-semibold text-foreground truncate hover:underline">{event.name}</h3>
                            </button>
                            {event.lecturerName && (
                                <p className="text-xs text-muted-foreground mt-0.5">{event.lecturerName}</p>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-4">
                        {sessionDate && (
                            <span className="flex items-center gap-1.5">
                                <CalendarRange className="h-3.5 w-3.5" />
                                {formatDate(sessionDate.date, "EEEE, d MMMM yyyy")}
                                {sessionDate.time ? ` • ${sessionDate.time}` : ""}
                            </span>
                        )}
                        <span className="flex items-center gap-1.5 truncate max-w-[200px]">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{event.place}</span>
                        </span>
                        {event.webinarLink && (
                            <span className="flex items-center gap-1.5 text-blue-600 font-medium">
                                <Video className="h-3.5 w-3.5" />
                                Online
                            </span>
                        )}
                        {!isWaitlisted && participant.seatNumber > 0 && (
                            <span className="flex items-center gap-1.5">
                                <Tag className="h-3.5 w-3.5" />
                                Sedia #{participant.seatNumber}
                            </span>
                        )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={onOpen} className="gap-1.5 text-xs">
                            <BookOpen className="h-3.5 w-3.5" /> Hap Modulin
                        </Button>
                        {/* Webinar Link */}
                        {event.webinarLink && !isPast && !isWaitlisted && (
                            <Button variant="default" size="sm" asChild className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-700">
                                <a href={event.webinarLink} target="_blank" rel="noopener noreferrer">
                                    <Video className="h-3.5 w-3.5" /> Bashkohu në Webinar
                                </a>
                            </Button>
                        )}
                        {/* QR Check-in — only visible if confirmed, upcoming, not attended yet */}
                        {!isPast && !hasAttended && !isWaitlisted && (
                            <Button variant="outline" size="sm" onClick={() => setShowEntranceQR(true)} className="gap-1.5 text-xs text-blue-600 border-blue-200 bg-blue-50/50 hover:bg-blue-100 hover:text-blue-700">
                                <QrCode className="h-3.5 w-3.5" /> Skano QR (Hyrja)
                            </Button>
                        )}
                        {/* In-class quiz — only visible when lecturer starts the quiz */}
                        {hasQuiz && !isPast && quizLive && (
                            <Button variant="default" size="sm" onClick={() => setShowQuiz(true)} className="gap-1.5 text-xs animate-pulse">
                                <span className="flex h-2 w-2 rounded-full bg-red-400 animate-ping" />
                                <QrCode className="h-3.5 w-3.5" /> Quiz Live!
                            </Button>
                        )}
                        {/* When quiz exists but not yet started by lecturer */}
                        {hasQuiz && !isPast && !quizLive && (
                            <span className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
                                <Clock className="h-3.5 w-3.5" /> Quiz — duke pritur lektorin
                            </span>
                        )}
                        {/* Post-training survey — shown after past events */}
                        {isPast && hasSurvey && (
                            <Button variant="outline" size="sm" onClick={() => setShowSurvey(true)} className="gap-1.5 text-xs">
                                <Star className="h-3.5 w-3.5" /> Vlerëso Modulin
                            </Button>
                        )}
                        {/* Digital certificate — past + attended */}
                        {isPast && hasAttended && (
                            <Button variant="outline" size="sm" onClick={() => setShowCert(true)} className="gap-1.5 text-xs">
                                <Award className="h-3.5 w-3.5" /> Certifikatë
                            </Button>
                        )}
                        {/* Cancel — only for upcoming + not attended */}
                        {!isPast && !hasAttended && (
                            <>
                                {cancelConfirm ? (
                                    <div className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-1.5">
                                        <p className="text-xs text-red-600 mr-1">Konfirmoni anulimin?</p>
                                        <button onClick={onCancel} className="text-xs font-semibold text-red-600 hover:underline">Po</button>
                                        <span className="text-muted-foreground">·</span>
                                        <button onClick={() => setCancelConfirm(false)} className="text-xs text-muted-foreground hover:underline">Jo</button>
                                    </div>
                                ) : (
                                    <Button variant="ghost" size="sm" onClick={() => setCancelConfirm(true)}
                                        className="gap-1.5 text-xs text-muted-foreground hover:text-red-600">
                                        <XCircle className="h-3.5 w-3.5" /> Anulo Rezervimin
                                    </Button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </>
    )
}

// ── Main View ─────────────────────────────────────────────────────────────────
export function MyModulesView({ onBrowse, onOpenModule }: { onBrowse: () => void; onOpenModule: (eventId: string) => void }) {
    const { user } = useAuth()
    const { getBookingsForMember, cancelBooking } = useEvents()

    const bookings = useMemo(
        () => (user ? getBookingsForMember(user.memberRegistryNumber) : []),
        [user, getBookingsForMember]
    )

    const upcoming = bookings.filter((b) => b.event.status === "upcoming")
    const past = bookings.filter((b) => b.event.status === "past")
    const cpdEarned = past
        .filter((b) => b.participant.attendance === "attended")
        .reduce((s, b) => s + b.event.cpdHours, 0)

    if (bookings.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 mb-5">
                    <BookOpen className="h-10 w-10 text-primary" />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">Nuk keni rezervime akoma</h2>
                <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                    Shfleto modulet CPD në dispozicion dhe rezervo vendin tuaj për të fituar orë CPD.
                </p>
                <Button onClick={onBrowse} className="gap-2">
                    <BookOpen className="h-4 w-4" /> Shfleto Modulet CPD
                </Button>
            </div>
        )
    }

    return (
        <div className="mx-auto max-w-3xl px-4 py-6 lg:px-8">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-xl font-semibold text-foreground">Modulet e Mia CPD</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">Rezervimet, quiz-et dhe vlerësimet tuaja</p>
                </div>
                <Button variant="outline" onClick={onBrowse} size="sm" className="gap-2 shrink-0">
                    <BookOpen className="h-4 w-4" /> Rezervo Modul Tjetër
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="rounded-lg border border-border bg-card p-4">
                    <p className="text-xs text-muted-foreground mb-1">Rezervime Aktive</p>
                    <p className="text-2xl font-bold text-foreground">{upcoming.length}</p>
                </div>
                <div className="rounded-lg border border-border bg-card p-4">
                    <p className="text-xs text-muted-foreground mb-1">Module të Kryera</p>
                    <p className="text-2xl font-bold text-foreground">{past.filter((b) => b.participant.attendance === "attended").length}</p>
                </div>
                <div className="rounded-lg border border-border bg-card p-4">
                    <p className="text-xs text-muted-foreground mb-1">Orë CPD Fituar</p>
                    <p className="text-2xl font-bold text-foreground">{cpdEarned}h</p>
                </div>
            </div>

            {/* Upcoming */}
            {upcoming.length > 0 && (
                <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                        <Clock className="h-4 w-4 text-primary" />
                        <h2 className="text-sm font-semibold text-foreground">Të Ardhshme ({upcoming.length})</h2>
                    </div>
                    <div className="flex flex-col gap-3">
                        {upcoming.map(({ event, participant }) => (
                            <BookingCard
                                key={participant.id}
                                event={event}
                                participant={participant}
                                onCancel={() => cancelBooking(event.id, participant.id)}
                                onOpen={() => onOpenModule(event.id)}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Past */}
            {past.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <h2 className="text-sm font-semibold text-foreground">Të Kaluara ({past.length})</h2>
                    </div>
                    <div className="flex flex-col gap-3">
                        {past.map(({ event, participant }) => (
                            <BookingCard
                                key={participant.id}
                                event={event}
                                participant={participant}
                                onCancel={() => cancelBooking(event.id, participant.id)}
                                onOpen={() => onOpenModule(event.id)}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
