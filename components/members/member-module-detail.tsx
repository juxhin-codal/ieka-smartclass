"use client"

/**
 * MemberModuleDetail — What a Member sees when they open a module to reserve.
 * Shows: module info + topics + available dates → select date → confirm.
 * No seat selector, no admin panels, no participant lists.
 */

import { useEffect, useState } from "react"
import { useEvents } from "@/lib/events-context"
import { useAuth } from "@/lib/auth-context"
import { parseISO } from "date-fns"
import { formatDate } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    ArrowLeft, CalendarRange, MapPin, Tag, Clock, CheckCircle2,
    BookOpen, CreditCard, Video, X
} from "lucide-react"

interface MemberModuleDetailProps {
    eventId: string
    onBack: () => void
}

export function MemberModuleDetail({ eventId, onBack }: MemberModuleDetailProps) {
    const { getEvent, reserveSeat, cancelBooking } = useEvents()
    const { user, refreshProfile } = useAuth()
    const event = getEvent(eventId)
    const currentYear = new Date().getFullYear()

    const [selectedDateId, setSelectedDateId] = useState<string | null>(null)
    const [step, setStep] = useState<"view" | "done">("view")
    const [error, setError] = useState("")
    const [cancellingParticipantId, setCancellingParticipantId] = useState<string | null>(null)
    const [cancelReservationPrompt, setCancelReservationPrompt] = useState<{
        dateId: string
        participantId: string
        sessionDateLabel: string
        moduleName: string
    } | null>(null)

    useEffect(() => {
        void refreshProfile()
    }, [refreshProfile])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onBack()
        }
        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [onBack])

    if (!event) {
        return (
            <div className="mx-auto max-w-2xl px-4 py-12 text-center">
                <p className="text-muted-foreground">Moduli nuk u gjet.</p>
                <Button variant="ghost" onClick={onBack} className="mt-4 gap-2">
                    <ArrowLeft className="h-4 w-4" /> Kthehu
                </Button>
            </div>
        )
    }

    const normalizedUserRegistry = (user?.memberRegistryNumber ?? "").trim().toUpperCase()
    const memberReservations = user
        ? event.participants.filter((p) => (p.memberRegistryNumber ?? "").trim().toUpperCase() === normalizedUserRegistry)
        : []
    const hasYearlyInactivePayment = user?.yearlyPaymentPaidYear === currentYear
    const requiresPerModulePayment = user?.role === "Member" && user?.isActive === false && !hasYearlyInactivePayment
    const payableModulePrice = requiresPerModulePayment ? (event.price ?? 0) : 0
    const requiresAdminPaymentApproval = requiresPerModulePayment && payableModulePrice > 0
    const reservedDateIds = new Set(memberReservations.map((p) => p.dateId))
    const reservationByDateId = new Map(memberReservations.map((p) => [p.dateId, p]))
    const maxReservationsPerModule = 2
    const reachedMaxReservations = memberReservations.length >= maxReservationsPerModule
    const maxReservationsMessage = "Maksimumi 2 rezervime seancash për modul. Anuloni një për të rezervuar një tjetër."

    async function handleSubmit() {
        if (!selectedDateId || !user) return
        if (requiresAdminPaymentApproval) {
            setError(`Nuk mund të rezervoni pa pagesën vjetore. Administratori duhet t'ju shënojë si "Paguar" për vitin ${currentYear}.`)
            return
        }
        if (reachedMaxReservations) {
            setError(maxReservationsMessage)
            return
        }
        if (reservedDateIds.has(selectedDateId)) {
            setError("Ky sesion është tashmë i rezervuar nga ju.")
            return
        }

        const dateObj = event!.dates.find((d) => d.id === selectedDateId)!
        const isFull = dateObj.currentParticipants >= dateObj.maxParticipants

        // Auto-assign next seat number or -1 for waitlist
        const seatNumber = isFull ? -1 : dateObj.currentParticipants + 1

        const result = await reserveSeat(eventId, selectedDateId, seatNumber, {
            firstName: user.name.split(" ")[0] ?? user.name,
            lastName: user.name.split(" ").slice(1).join(" ") ?? "",
            email: user.email ?? "",
            memberRegistryNumber: user.memberRegistryNumber,
        })

        if (!result.ok) {
            setError(result.reason ?? "Gabim gjatë rezervimit.")
            return
        }
        setStep("done")
    }

    async function handleCancelReservedSession(dateId: string) {
        const reservation = reservationByDateId.get(dateId)
        if (!reservation) return

        const moduleName = event!.name
        const sessionDateRaw = event!.dates.find((d) => d.id === dateId)?.date
        const sessionDateLabel = sessionDateRaw ? formatDate(sessionDateRaw, "EEEE, d MMMM yyyy") : dateId
        setCancelReservationPrompt({
            dateId,
            participantId: reservation.id,
            sessionDateLabel,
            moduleName,
        })
    }

    async function confirmCancelReservedSession() {
        if (!cancelReservationPrompt) return

        setCancellingParticipantId(cancelReservationPrompt.participantId)
        setError("")
        try {
            await cancelBooking(eventId, cancelReservationPrompt.participantId)
            if (selectedDateId === cancelReservationPrompt.dateId) {
                setSelectedDateId(null)
            }
            setCancelReservationPrompt(null)
        } catch {
            setError("Gabim gjatë anulimit të rezervimit.")
        } finally {
            setCancellingParticipantId(null)
        }
    }

    // Confirmed
    if (step === "done") {
        const selectedDate = event.dates.find((d) => d.id === selectedDateId)
        const isFull = selectedDate ? selectedDate.currentParticipants >= selectedDate.maxParticipants : false
        return (
            <div className="mx-auto max-w-2xl px-4 py-12 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/15">
                    <CheckCircle2 className="h-8 w-8 text-green-500" />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">Rezervimi u konfirmua!</h2>
                <p className="text-sm text-muted-foreground mb-1">
                    Jeni regjistruar për <strong>{event.name}</strong>
                </p>
                {isFull ? (
                    <p className="text-sm text-amber-600 mt-2">
                        Sesioni ishte i plotë — jeni vendosur në listën e pritjes.
                    </p>
                ) : (
                    <p className="text-sm text-muted-foreground">
                        {selectedDate && formatDate(selectedDate.date, "EEEE, d MMMM yyyy")}
                        {selectedDate?.time && ` • ${selectedDate.time}`}
                    </p>
                )}
                <p className="text-xs text-muted-foreground mt-3">
                    Do merrni njoftim me email / SMS para sesionit.
                </p>
                <Button onClick={onBack} className="mt-6 gap-2">
                    <BookOpen className="h-4 w-4" /> Kthehu tek Modulet e Mia
                </Button>
            </div>
        )
    }

    const startDate = event.dates[0]?.date
    const endDate = event.dates[event.dates.length - 1]?.date

    return (
        <div className="mx-auto max-w-3xl px-4 py-6 lg:px-8">
            <Button variant="ghost" size="sm" onClick={onBack} className="mb-5 gap-1.5 text-muted-foreground">
                <ArrowLeft className="h-4 w-4" /> Kthehu
            </Button>

            {/* Module Info Card */}
            <div className="rounded-xl border border-border bg-card p-6 mb-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                        <h1 className="text-xl font-bold text-foreground">{event.name}</h1>
                        {event.lecturerName && (
                            <p className="text-sm text-muted-foreground mt-0.5">Lektori: {event.lecturerName}</p>
                        )}
                    </div>
                    <span className="shrink-0 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-bold text-primary">
                        {event.cpdHours}h CPD
                    </span>
                </div>

                <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mb-4">
                    <span className="flex items-center gap-1.5">
                        <CalendarRange className="h-4 w-4" />
                        {startDate && formatDate(startDate, "d MMMM")}
                        {endDate && endDate !== startDate && ` — ${formatDate(endDate, "d MMMM yyyy")}`}
                    </span>
                    <span className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4" />
                        {event.dates.length} sesione
                    </span>
                    <span className="flex items-center gap-1.5">
                        <MapPin className="h-4 w-4" />
                        {event.place}
                    </span>
                    {event.webinarLink && (
                        <span className="flex items-center gap-1.5 text-blue-600 font-medium">
                            <Video className="h-4 w-4" />
                            Webinar Online
                        </span>
                    )}
                </div>

                <div className="mb-4">
                    {requiresPerModulePayment && payableModulePrice > 0 ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600">
                            <CreditCard className="h-3.5 w-3.5" />
                            Ky modul kërkon pagesë: {payableModulePrice.toLocaleString()} LEK
                        </span>
                    ) : (
                        <span className="inline-flex items-center rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-600">
                            Ky modul është pa pagesë për ju
                        </span>
                    )}
                </div>
                {requiresAdminPaymentApproval && (
                    <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                        Nuk mund të rezervoni derisa administratori t'ju shënojë "Paguar" për vitin {currentYear}.
                    </p>
                )}

                {/* Topics */}
                <div className="mb-1">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Temat</h3>
                    <div className="flex flex-wrap gap-2">
                        {event.topics.map((topic) => (
                            <span
                                key={topic}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-sm text-foreground"
                            >
                                <Tag className="h-3 w-3 text-primary" />
                                {topic}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Date Selection */}
            <div className="rounded-xl border border-border bg-card p-6">
                <h2 className="text-base font-semibold text-foreground mb-1">Zgjidhni Sesionin</h2>
                <p className="text-xs text-muted-foreground mb-4">Zgjidhni datën e sesionit ku dëshironi të merrni pjesë</p>
                {memberReservations.length > 0 && (
                    <p className="mb-3 text-xs text-muted-foreground">
                        Rezervime aktive në këtë trajnim: <strong className="text-foreground">{memberReservations.length}/{maxReservationsPerModule}</strong>
                    </p>
                )}
                {reachedMaxReservations && (
                    <p className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                        {maxReservationsMessage}
                    </p>
                )}

                <div className="flex flex-col gap-2.5">
                    {event.dates.map((d) => {
                        const isFull = d.currentParticipants >= d.maxParticipants
                        const isSelected = selectedDateId === d.id
                        const remaining = d.maxParticipants - d.currentParticipants
                        const isReservedByMember = reservedDateIds.has(d.id)
                        const reservedParticipant = reservationByDateId.get(d.id)
                        const isDisabled = isReservedByMember || reachedMaxReservations || requiresAdminPaymentApproval

                        return (
                            <div
                                key={d.id}
                                onClick={() => {
                                    if (isDisabled) return
                                    setSelectedDateId(d.id)
                                    setError("")
                                }}
                                onKeyDown={(e) => {
                                    if (isDisabled) return
                                    if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault()
                                        setSelectedDateId(d.id)
                                        setError("")
                                    }
                                }}
                                role="button"
                                tabIndex={isDisabled ? -1 : 0}
                                aria-disabled={isDisabled}
                                className={`flex items-center justify-between rounded-xl border-2 p-4 text-left transition-all ${isSelected
                                    ? "border-primary bg-primary/5 shadow-sm"
                                    : isReservedByMember
                                        ? "border-blue-200 bg-blue-50/30 dark:border-blue-900/60 dark:bg-blue-950/20"
                                        : isDisabled
                                            ? "border-border bg-muted/20 opacity-60 cursor-not-allowed"
                                            : "border-border bg-card hover:border-primary/40"
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <CalendarRange className={`h-5 w-5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                                    <div>
                                        <p className={`text-sm font-semibold ${isSelected ? "text-primary" : "text-foreground"}`}>
                                            {formatDate(d.date, "EEEE, d MMMM yyyy")}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {d.time && `${d.time} • `}
                                            {isReservedByMember
                                                ? "Ky sesion është rezervuar nga ju"
                                                : requiresAdminPaymentApproval
                                                    ? "Rezervimi bllokohet derisa pagesa vjetore të verifikohet nga administratori"
                                                    : reachedMaxReservations
                                                        ? "Maksimumi i rezervimeve është arritur"
                                                        : isFull
                                                            ? "Sesioni plotë — Listë Pritjeje"
                                                            : `${remaining} vende të lira nga ${d.maxParticipants}`}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {isReservedByMember ? (
                                        <>
                                            <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-600">
                                                E rezervuar
                                            </span>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    void handleCancelReservedSession(d.id)
                                                }}
                                                title="Anulo rezervimin për këtë sesion"
                                                disabled={!reservedParticipant || cancellingParticipantId === reservedParticipant.id}
                                                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </button>
                                        </>
                                    ) : reachedMaxReservations ? (
                                        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                                            E çaktivizuar
                                        </span>
                                    ) : requiresAdminPaymentApproval ? (
                                        <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600">
                                            Prit verifikim pagese
                                        </span>
                                    ) : isFull ? (
                                        <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-500">
                                            Listë Pritjeje
                                        </span>
                                    ) : isSelected ? (
                                        <CheckCircle2 className="h-5 w-5 text-primary" />
                                    ) : (
                                        <span className="rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-600">
                                            {remaining} vende
                                        </span>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>

                {error && <p className="text-sm text-destructive mt-3">{error}</p>}

                <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-border">
                    <Button variant="ghost" onClick={onBack}>Anulo</Button>
                    <Button
                        disabled={!selectedDateId || reachedMaxReservations || requiresAdminPaymentApproval}
                        onClick={handleSubmit}
                        className="gap-2"
                    >
                        {requiresAdminPaymentApproval ? (
                            <>
                                <CreditCard className="h-4 w-4" />
                                Prit verifikim pagese
                            </>
                        ) : payableModulePrice > 0 ? (
                            <>
                                <CreditCard className="h-4 w-4" />
                                Paguaj {payableModulePrice.toLocaleString()} LEK & Rezervo
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="h-4 w-4" /> Konfirmo Regjistrimin
                            </>
                        )}
                    </Button>
                </div>
            </div>

            {cancelReservationPrompt && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 px-4 py-8 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-lg">
                        <div className="flex items-center justify-between border-b border-border px-5 py-4">
                            <h3 className="text-base font-semibold text-foreground">Konfirmo anulimin</h3>
                            <button
                                type="button"
                                onClick={() => setCancelReservationPrompt(null)}
                                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="px-5 py-4">
                            <p className="text-sm text-foreground">
                                A jeni te sigurt qe doni te anullloni reervimin me date{" "}
                                <strong>{cancelReservationPrompt.sessionDateLabel}</strong>{" "}
                                per modulin <strong>{cancelReservationPrompt.moduleName}</strong>
                            </p>
                        </div>

                        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setCancelReservationPrompt(null)}
                            >
                                Jo
                            </Button>
                            <Button
                                type="button"
                                variant="destructive"
                                disabled={cancellingParticipantId === cancelReservationPrompt.participantId}
                                onClick={() => {
                                    void confirmCancelReservedSession()
                                }}
                            >
                                {cancellingParticipantId === cancelReservationPrompt.participantId ? "Duke anuluar..." : "Po, anulo"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
