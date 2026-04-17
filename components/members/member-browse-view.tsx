"use client"

/**
 * MemberBrowseView — Simplified module browser for Members.
 * Shows only upcoming modules with topics, dates, CPD hours, and a "Rezervo" button.
 * No admin stats, no past events, no create form.
 */

import { useEffect, useMemo, useState } from "react"
import { useEvents } from "@/lib/events-context"
import { useAuth } from "@/lib/auth-context"
import { formatDate } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    ArrowLeft, CalendarRange, MapPin, Tag, Users, BookOpen, Search, Clock, CreditCard,
} from "lucide-react"

interface MemberBrowseViewProps {
    onBack: () => void
    onOpenModule: (eventId: string) => void
}

export function MemberBrowseView({ onBack, onOpenModule }: MemberBrowseViewProps) {
    const { events } = useEvents()
    const { user, refreshProfile } = useAuth()
    const [search, setSearch] = useState("")
    const currentYear = new Date().getFullYear()
    const hasYearlyInactivePayment = user?.yearlyPaymentPaidYear === currentYear
    const requiresPerModulePayment = user?.role === "Member" && user?.isActive === false && !hasYearlyInactivePayment

    useEffect(() => {
        void refreshProfile()
    }, [refreshProfile])

    // Show all upcoming modules; reserved ones get a badge.
    const availableModules = useMemo(() => {
        let result = events.filter((e) => e.status === "upcoming")

        if (search.trim()) {
            const q = search.toLowerCase()
            result = result.filter(
                (e) =>
                    e.name.toLowerCase().includes(q) ||
                    e.topics.some((t) => t.toLowerCase().includes(q))
            )
        }

        return result.sort((a, b) => (a.dates[0]?.date ?? "").localeCompare(b.dates[0]?.date ?? ""))
    }, [events, search])

    return (
        <div className="mx-auto max-w-3xl px-4 py-6 lg:px-8">
            <div className="mb-5 flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 text-muted-foreground">
                    <ArrowLeft className="h-4 w-4" /> Kthehu
                </Button>
            </div>

            <div className="mb-6">
                <h1 className="text-xl font-semibold text-foreground">Modulet CPD në Dispozicion</h1>
                <p className="text-sm text-muted-foreground mt-0.5">Zgjidhni një modul dhe regjistrohu për një sesion</p>
            </div>

            {/* Search */}
            <div className="relative mb-5">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Kërko module..."
                    className="w-full rounded-lg border border-border bg-card pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
            </div>

            {availableModules.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
                        <BookOpen className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-foreground mb-1">Nuk ka module të disponueshme</p>
                    <p className="text-xs text-muted-foreground">Nuk ka trajnime të ardhshme për momentin.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {availableModules.map((event) => {
                        const startDate = event.dates[0]?.date
                        const endDate = event.dates[event.dates.length - 1]?.date
                        const totalSeats = event.dates.reduce((s, d) => s + d.maxParticipants, 0)
                        const takenSeats = event.dates.reduce((s, d) => s + d.currentParticipants, 0)
                        const remaining = totalSeats - takenSeats
                        const normalizedUserRegistry = (user?.memberRegistryNumber ?? "").trim().toUpperCase()
                        const myReservations = user
                            ? event.participants.filter((p) => (p.memberRegistryNumber ?? "").trim().toUpperCase() === normalizedUserRegistry).length
                            : 0
                        const hasReservation = myReservations > 0

                        return (
                            <div
                                key={event.id}
                                className="rounded-xl border border-border bg-card overflow-hidden hover:shadow-md transition-shadow"
                            >
                                <div className="p-5">
                                    {/* Module name + CPD badge */}
                                    <div className="mb-3 flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-base font-semibold text-foreground">{event.name}</h3>
                                            {event.lecturerName && (
                                                <p className="text-xs text-muted-foreground mt-0.5">{event.lecturerName}</p>
                                            )}
                                        </div>
                                        <div className="flex shrink-0 items-center justify-end gap-1.5 whitespace-nowrap">
                                            <span className="whitespace-nowrap rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                                                {event.cpdHours}h CPD
                                            </span>
                                            {hasReservation && (
                                                <span className="inline-flex items-center whitespace-nowrap rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-semibold text-green-600">
                                                    ✓ Ju keni rezervim ({myReservations})
                                                </span>
                                            )}
                                            {requiresPerModulePayment && (event.price ?? 0) > 0 ? (
                                                <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-600">
                                                    <CreditCard className="h-3 w-3" />
                                                    Me pagesë: {(event.price ?? 0).toLocaleString()} LEK
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center whitespace-nowrap rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-600">
                                                    Pa pagesë
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Topics */}
                                    <div className="flex flex-wrap gap-1.5 mb-3">
                                        {event.topics.map((topic) => (
                                            <span
                                                key={topic}
                                                className="inline-flex items-center gap-1 rounded-md bg-primary/8 px-2 py-0.5 text-xs font-medium text-primary"
                                            >
                                                <Tag className="h-2.5 w-2.5" />
                                                {topic}
                                            </span>
                                        ))}
                                    </div>

                                    {/* Dates + Location info */}
                                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-4">
                                        <span className="flex items-center gap-1.5">
                                            <CalendarRange className="h-3.5 w-3.5" />
                                            {startDate && formatDate(startDate, "d MMMM")}
                                            {endDate && endDate !== startDate && ` — ${formatDate(endDate, "d MMMM")}`}
                                            {startDate && `, ${formatDate(startDate, "yyyy")}`}
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            <Clock className="h-3.5 w-3.5" />
                                            {event.dates.length} sesione
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            <MapPin className="h-3.5 w-3.5" />
                                            {event.place}
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            <Users className="h-3.5 w-3.5" />
                                            {remaining > 0 ? `${remaining} vende të lira` : "Listë pritjeje"}
                                        </span>
                                    </div>

                                    {/* Reserve button */}
                                    <Button
                                        onClick={() => onOpenModule(event.id)}
                                        size="sm"
                                        className="gap-2"
                                        variant={hasReservation ? "outline" : remaining > 0 ? "default" : "outline"}
                                    >
                                        <BookOpen className="h-3.5 w-3.5" />
                                        {hasReservation
                                            ? "Hap Modulin"
                                            : remaining <= 0
                                                ? "Regjistrohu në Listë Pritjeje"
                                                : requiresPerModulePayment && (event.price ?? 0) > 0
                                                    ? `Paguaj ${(event.price ?? 0).toLocaleString()} LEK`
                                                    : remaining > 0
                                                        ? "Rezervo Vendin"
                                                        : "Hap Modulin"}
                                    </Button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
