"use client"

import { useEffect, useMemo, useState } from "react"
import { format, parseISO } from "date-fns"
import { sq } from "date-fns/locale"
import { useAuth } from "@/lib/auth-context"
import { useEvents } from "@/lib/events-context"
import type { EventItem, Participant } from "@/lib/data"
import { Button } from "@/components/ui/button"
import { BarChart3, CalendarRange, CheckCircle2, Clock3, Download, FileText, MessageSquare, BookOpen } from "lucide-react"

type HistorySubTab = "modules" | "feedback" | "questionnaire"
type MemberBooking = { event: EventItem; participant: Participant }

const MONTH_LABELS = ["Jan", "Shk", "Mar", "Pri", "Maj", "Qer", "Kor", "Gus", "Sht", "Tet", "Nën", "Dhj"]

function getBookingDateIso(booking: MemberBooking) {
    return booking.event.dates.find((d) => d.id === booking.participant.dateId)?.date ?? booking.event.dates[0]?.date ?? null
}

function formatBookingDate(value: string | null) {
    if (!value) return "—"
    try {
        return format(parseISO(value), "dd MMM yyyy", { locale: sq })
    } catch {
        return value
    }
}

function formatAttendanceLabel(status: string) {
    if (status === "attended") return "I pranishëm"
    if (status === "absent") return "Mungesë"
    if (status === "pending") return "Në pritje"
    return status
}

function escapeHtml(value: string) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;")
}

export function MyHistoryView({ onOpenModule }: { onOpenModule: (eventId: string) => void }) {
    const { user } = useAuth()
    const { getBookingsForMember } = useEvents()
    const [activeSubTab, setActiveSubTab] = useState<HistorySubTab>("modules")

    const allBookings = useMemo(
        () => (user ? getBookingsForMember(user.memberRegistryNumber) : []),
        [user, getBookingsForMember]
    )

    const sortedBookings = useMemo(() => {
        return [...allBookings].sort((a, b) => {
            const ad = getBookingDateIso(a) ?? ""
            const bd = getBookingDateIso(b) ?? ""
            return bd.localeCompare(ad)
        })
    }, [allBookings])

    const years = useMemo(() => {
        const set = new Set<number>()
        sortedBookings.forEach((booking) => {
            const date = getBookingDateIso(booking)
            if (!date) return
            const year = new Date(date).getFullYear()
            if (!Number.isNaN(year)) set.add(year)
        })
        return Array.from(set).sort((a, b) => b - a)
    }, [sortedBookings])

    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())

    useEffect(() => {
        if (years.length === 0) {
            setSelectedYear(new Date().getFullYear())
            return
        }
        if (!years.includes(selectedYear)) {
            setSelectedYear(years[0])
        }
    }, [years, selectedYear])

    const filteredBookings = useMemo(() => {
        return sortedBookings.filter((booking) => {
            const date = getBookingDateIso(booking)
            if (!date) return false
            return new Date(date).getFullYear() === selectedYear
        })
    }, [sortedBookings, selectedYear])

    const placedBookings = filteredBookings.filter((b) => b.participant.status === "registered")
    const attendedCount = filteredBookings.filter((b) => b.participant.attendance === "attended").length
    const absentCount = filteredBookings.filter((b) => b.participant.attendance === "absent").length
    const pendingCount = filteredBookings.filter((b) => b.participant.attendance === "pending").length
    const cpdHours = filteredBookings
        .filter((b) => b.participant.attendance === "attended")
        .reduce((sum, b) => sum + b.event.cpdHours, 0)

    const feedbackEntries = useMemo(() => {
        return filteredBookings
            .map((booking) => ({
                booking,
                date: getBookingDateIso(booking),
                answers: booking.participant.answers ?? [],
            }))
            .filter((entry) => entry.answers.length > 0)
    }, [filteredBookings])

    const questionnaireEntries = useMemo(() => {
        return filteredBookings
            .map((booking) => ({
                booking,
                date: getBookingDateIso(booking),
                questionCount: booking.event.feedbackQuestions?.length ?? 0,
                answerCount: booking.participant.answers?.length ?? 0,
            }))
            .filter((entry) => entry.questionCount > 0)
    }, [filteredBookings])

    const monthlyData = useMemo(() => {
        const byMonth = MONTH_LABELS.map((month) => ({ month, reservations: 0, attended: 0, cpd: 0 }))
        filteredBookings.forEach((booking) => {
            const iso = getBookingDateIso(booking)
            if (!iso) return
            const monthIndex = new Date(iso).getMonth()
            if (monthIndex < 0 || monthIndex > 11) return
            byMonth[monthIndex].reservations += 1
            if (booking.participant.attendance === "attended") {
                byMonth[monthIndex].attended += 1
                byMonth[monthIndex].cpd += booking.event.cpdHours
            }
        })
        return byMonth
    }, [filteredBookings])

    const maxMonthlyReservations = Math.max(...monthlyData.map((m) => m.reservations), 1)

    function handleDownloadData() {
        if (!user) return

        const reportDate = new Date().toLocaleString()
        const chartBars = monthlyData
            .map((item, index) => {
                const x = 50 + index * 46
                const barHeight = Math.round((item.reservations / maxMonthlyReservations) * 120)
                const y = 25 + (120 - barHeight)
                return `
                <rect x="${x}" y="${y}" width="24" height="${barHeight}" rx="4" fill="#2563eb"></rect>
                <text x="${x + 12}" y="${160}" text-anchor="middle" font-size="10" fill="#475569">${item.month}</text>
                <text x="${x + 12}" y="${Math.max(y - 4, 12)}" text-anchor="middle" font-size="10" fill="#0f172a">${item.reservations}</text>
            `
            })
            .join("")

        const moduleRows = filteredBookings
            .map((booking) => {
                const date = formatBookingDate(getBookingDateIso(booking))
                const status = booking.participant.status === "registered" ? "Konfirmuar" : "Në pritje"
                return `
                <tr>
                    <td>${escapeHtml(booking.event.name)}</td>
                    <td>${escapeHtml(date)}</td>
                    <td>${escapeHtml(status)}</td>
                    <td>${escapeHtml(booking.participant.attendance)}</td>
                    <td>${booking.participant.attendance === "attended" ? `${booking.event.cpdHours}h` : "0h"}</td>
                </tr>
            `
            })
            .join("")

        const html = `<!doctype html>
<html lang="sq">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Raporti i Historikut Tim</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 24px; color: #0f172a; }
        h1, h2 { margin-bottom: 8px; }
        p { margin: 4px 0; color: #334155; }
        .summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 16px 0 20px; }
        .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #f8fafc; }
        .value { font-size: 22px; font-weight: 700; color: #0f172a; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #e2e8f0; text-align: left; padding: 8px; font-size: 13px; }
        th { background: #f1f5f9; }
        .chart-wrap { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-top: 12px; background: #ffffff; }
    </style>
</head>
<body>
    <h1>Historiku Im - ${selectedYear}</h1>
    <p>Anëtari: ${escapeHtml(user.name)}</p>
    <p>Numri i regjistrit: ${escapeHtml(user.memberRegistryNumber)}</p>
    <p>Gjeneruar më: ${escapeHtml(reportDate)}</p>

    <div class="summary">
        <div class="card"><p>Modulet e rezervuara</p><div class="value">${filteredBookings.length}</div></div>
        <div class="card"><p>Prezenca (të ndjekura)</p><div class="value">${attendedCount}</div></div>
        <div class="card"><p>Orë CPD</p><div class="value">${cpdHours}h</div></div>
        <div class="card"><p>Modulet e konfirmuara</p><div class="value">${placedBookings.length}</div></div>
        <div class="card"><p>Mungesa</p><div class="value">${absentCount}</div></div>
        <div class="card"><p>Në pritje</p><div class="value">${pendingCount}</div></div>
    </div>

    <h2>Detajet e moduleve të rezervuara</h2>
    <table>
        <thead>
            <tr>
                <th>Moduli</th>
                <th>Data</th>
                <th>Statusi</th>
                <th>Prezenca</th>
                <th>CPD</th>
            </tr>
        </thead>
        <tbody>
            ${moduleRows || `<tr><td colspan="5">Nuk u gjetën rezervime për ${selectedYear}.</td></tr>`}
        </tbody>
    </table>

    <h2 style="margin-top: 18px;">Grafiku mujor i rezervimeve</h2>
    <div class="chart-wrap">
        <svg width="620" height="175" viewBox="0 0 620 175" role="img" aria-label="Grafiku mujor i rezervimeve">
            <line x1="40" y1="145" x2="610" y2="145" stroke="#cbd5e1" stroke-width="1" />
            ${chartBars}
        </svg>
    </div>
</body>
</html>`

        const blob = new Blob([html], { type: "text/html;charset=utf-8" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `historiku-im-${user.memberRegistryNumber}-${selectedYear}.html`
        a.click()
        URL.revokeObjectURL(url)
    }

    return (
        <div className="mx-auto max-w-5xl px-4 py-6 lg:px-8">
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-xl font-semibold text-foreground">Historiku Im</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">Prezenca, orët CPD dhe evidencat e të nxënit</p>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="h-9 rounded-md border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                        {(years.length > 0 ? years : [selectedYear]).map((year) => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>
                    <Button variant="outline" size="sm" className="gap-2" onClick={handleDownloadData}>
                        <Download className="h-4 w-4" /> Shkarko të dhënat e mia
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 mb-6">
                <div className="rounded-lg border border-border bg-card p-4">
                    <p className="text-xs text-muted-foreground mb-1">Modulet e rezervuara</p>
                    <p className="text-2xl font-bold text-foreground">{filteredBookings.length}</p>
                </div>
                <div className="rounded-lg border border-border bg-card p-4">
                    <p className="text-xs text-muted-foreground mb-1">Prezenca</p>
                    <p className="text-2xl font-bold text-foreground">{attendedCount}</p>
                </div>
                <div className="rounded-lg border border-border bg-card p-4">
                    <p className="text-xs text-muted-foreground mb-1">Orë CPD</p>
                    <p className="text-2xl font-bold text-foreground">{cpdHours}h</p>
                </div>
                <div className="rounded-lg border border-border bg-card p-4">
                    <p className="text-xs text-muted-foreground mb-1">Modulet e konfirmuara</p>
                    <p className="text-2xl font-bold text-foreground">{placedBookings.length}</p>
                </div>
            </div>

            <div className="mb-6 rounded-lg border border-border bg-card p-4">
                <div className="mb-3 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    <h2 className="text-sm font-semibold text-foreground">Grafiku mujor i rezervimeve ({selectedYear})</h2>
                </div>
                <div className="flex h-40 items-end gap-1.5">
                    {monthlyData.map((m) => {
                        const height = Math.round((m.reservations / maxMonthlyReservations) * 100)
                        return (
                            <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
                                <div className="w-full rounded-sm bg-muted h-28 flex items-end">
                                    <div
                                        className={`w-full rounded-sm transition-all ${m.reservations > 0 ? "bg-primary" : "bg-border"}`}
                                        style={{ height: `${height}%`, minHeight: m.reservations > 0 ? "4px" : "2px" }}
                                        title={`${m.reservations} rezervime`}
                                    />
                                </div>
                                <span className="text-[10px] text-muted-foreground">{m.month}</span>
                            </div>
                        )
                    })}
                </div>
            </div>

            <div className="mb-5 flex items-center gap-1 overflow-x-auto border-b border-border">
                <button
                    onClick={() => setActiveSubTab("modules")}
                    className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${activeSubTab === "modules"
                        ? "border-primary text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                        }`}
                >
                    <span className="inline-flex items-center gap-1.5">
                        <BookOpen className="h-3.5 w-3.5" />
                        Modulet e konfirmuara ({placedBookings.length})
                    </span>
                </button>
                <button
                    onClick={() => setActiveSubTab("feedback")}
                    className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${activeSubTab === "feedback"
                        ? "border-primary text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                        }`}
                >
                    <span className="inline-flex items-center gap-1.5">
                        <MessageSquare className="h-3.5 w-3.5" />
                        Historiku i feedback-ut tim ({feedbackEntries.length})
                    </span>
                </button>
                <button
                    onClick={() => setActiveSubTab("questionnaire")}
                    className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${activeSubTab === "questionnaire"
                        ? "border-primary text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                        }`}
                >
                    <span className="inline-flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5" />
                        Historiku i pyetësorëve ({questionnaireEntries.length})
                    </span>
                </button>
            </div>

            {activeSubTab === "modules" && (
                <div className="rounded-lg border border-border bg-card p-4">
                    {placedBookings.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nuk u gjet asnjë modul i konfirmuar për {selectedYear}.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="border-b border-border">
                                        <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Moduli</th>
                                        <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Data</th>
                                        <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Prezenca</th>
                                        <th className="px-3 py-2 text-xs font-medium text-muted-foreground">CPD</th>
                                        <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Veprimi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {placedBookings.map((booking) => {
                                        const bookingDate = formatBookingDate(getBookingDateIso(booking))
                                        return (
                                            <tr key={booking.participant.id} className="border-b border-border last:border-0">
                                                <td className="px-3 py-2.5 font-medium text-foreground">{booking.event.name}</td>
                                                <td className="px-3 py-2.5 text-muted-foreground">{bookingDate}</td>
                                                <td className="px-3 py-2.5">
                                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${booking.participant.attendance === "attended"
                                                        ? "bg-green-500/10 text-green-600"
                                                        : booking.participant.attendance === "absent"
                                                            ? "bg-red-500/10 text-red-600"
                                                            : "bg-amber-500/10 text-amber-600"
                                                        }`}>
                                                        {formatAttendanceLabel(booking.participant.attendance)}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2.5 text-muted-foreground">
                                                    {booking.participant.attendance === "attended" ? `${booking.event.cpdHours}h` : "0h"}
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <Button variant="ghost" size="sm" onClick={() => onOpenModule(booking.event.id)}>
                                                        Hape
                                                    </Button>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {activeSubTab === "feedback" && (
                <div className="rounded-lg border border-border bg-card p-4">
                    {feedbackEntries.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nuk u gjet histori feedback-u për {selectedYear}.</p>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {feedbackEntries.map((entry) => (
                                <div key={entry.booking.participant.id} className="rounded-lg border border-border bg-background p-3">
                                    <div className="mb-2 flex items-center justify-between gap-2">
                                        <p className="text-sm font-semibold text-foreground">{entry.booking.event.name}</p>
                                        <span className="text-xs text-muted-foreground">{formatBookingDate(entry.date)}</span>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        {entry.answers.map((answer) => {
                                            const question = entry.booking.event.feedbackQuestions?.find((q) => q.id === answer.questionId)
                                            return (
                                                <div key={answer.questionId} className="rounded-md bg-muted/40 p-2.5">
                                                    <p className="text-xs text-muted-foreground">{question?.question ?? "Pyetje"}</p>
                                                    <p className="text-sm text-foreground mt-0.5">{answer.answer}</p>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeSubTab === "questionnaire" && (
                <div className="rounded-lg border border-border bg-card p-4">
                    {questionnaireEntries.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nuk u gjet histori pyetësorësh për {selectedYear}.</p>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {questionnaireEntries.map((entry) => {
                                const completed = entry.answerCount > 0
                                return (
                                    <div key={entry.booking.participant.id} className="rounded-lg border border-border bg-background p-3">
                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                            <div>
                                                <p className="text-sm font-semibold text-foreground">{entry.booking.event.name}</p>
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                    <CalendarRange className="inline h-3 w-3 mr-1" />
                                                    {formatBookingDate(entry.date)}
                                                </p>
                                            </div>
                                            <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${completed
                                                ? "bg-green-500/10 text-green-600"
                                                : entry.booking.event.status === "past"
                                                    ? "bg-red-500/10 text-red-600"
                                                    : "bg-amber-500/10 text-amber-600"
                                                }`}>
                                                {completed ? (
                                                    <>
                                                        <CheckCircle2 className="h-3.5 w-3.5" /> Përfunduar
                                                    </>
                                                ) : entry.booking.event.status === "past" ? (
                                                    <>
                                                        <Clock3 className="h-3.5 w-3.5" /> Nuk është dorëzuar
                                                    </>
                                                ) : (
                                                    <>
                                                        <Clock3 className="h-3.5 w-3.5" /> Në pritje
                                                    </>
                                                )}
                                            </span>
                                        </div>
                                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                            <span className="rounded bg-muted px-2 py-0.5">
                                                Pyetje: {entry.questionCount}
                                            </span>
                                            <span className="rounded bg-muted px-2 py-0.5">
                                                Përgjigje: {entry.answerCount}
                                            </span>
                                            <span className="rounded bg-muted px-2 py-0.5">
                                                CPD: {entry.booking.event.cpdHours}h
                                            </span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
