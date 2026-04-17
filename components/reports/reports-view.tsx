"use client"

import { useState, useMemo } from "react"
import { useEvents } from "@/lib/events-context"
import { formatDate } from "@/lib/utils"
import {
  Star, MessageSquare, CheckCircle2, ChevronDown, ChevronUp, ChevronsUpDown,
  BarChart3, FileText, Search, Users, TrendingUp, Clock, Download, AlertCircle,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { PaginationBar, usePagination, type PageSize } from "@/components/ui/pagination-bar"

type Tab = "feedback" | "attendance" | "booking"

export function ReportsView() {
  const { events, users } = useEvents()
  const [activeTab, setActiveTab] = useState<Tab>("attendance")
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null)
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  // Per-tab pagination
  const [attPage, setAttPage] = useState(1)
  const [attPageSize, setAttPageSize] = useState<PageSize>(25)
  const [attSearch, setAttSearch] = useState("")
  const [attSortKey, setAttSortKey] = useState<"name" | "date" | "rate">("date")
  const [attSortDir, setAttSortDir] = useState<"asc" | "desc">("desc")
  const [bookPage, setBookPage] = useState(1)
  const [bookPageSize, setBookPageSize] = useState<PageSize>(25)
  const [bookSearch, setBookSearch] = useState("")
  const [memberPage, setMemberPage] = useState(1)
  const [memberPageSize, setMemberPageSize] = useState<PageSize>(25)
  const [fbPage, setFbPage] = useState(1)
  const [fbPageSize, setFbPageSize] = useState<PageSize>(25)

  // ── Attendance analytics ──────────────────────────────────────────────
  const attendanceStats = useMemo(() => {
    return events.map((e) => {
      const pts = e.participants ?? []
      const dates = e.dates ?? []
      const total = pts.length
      const attended = pts.filter((p) => p.attendance === "attended").length
      const absent = pts.filter((p) => p.attendance === "absent").length
      const pending = pts.filter((p) => p.attendance === "pending").length
      const waitlisted = pts.filter((p) => p.status === "waitlisted").length
      const attendanceTotal = attended + absent
      const rate = attendanceTotal > 0 ? Math.round((attended / attendanceTotal) * 100) : null
      // Date range from session dates
      const sortedDates = [...dates].sort((a, b) => a.date.localeCompare(b.date))
      const firstDate = sortedDates[0]?.date ?? null
      const lastDate = sortedDates[sortedDates.length - 1]?.date ?? null
      return { event: e, total, attended, absent, pending, waitlisted, rate, firstDate, lastDate }
    })
  }, [events])

  // Filtered + sorted attendance stats
  const filteredAttStats = useMemo(() => {
    let result = attendanceStats
    if (attSearch.trim()) {
      const q = attSearch.toLowerCase()
      result = result.filter((r) =>
        r.event.name.toLowerCase().includes(q) ||
        (r.firstDate ?? "").includes(q)
      )
    }
    return [...result].sort((a, b) => {
      let cmp = 0
      if (attSortKey === "name") {
        cmp = a.event.name.localeCompare(b.event.name)
      } else if (attSortKey === "date") {
        cmp = (a.firstDate ?? "").localeCompare(b.firstDate ?? "")
      } else if (attSortKey === "rate") {
        cmp = (a.rate ?? -1) - (b.rate ?? -1)
      }
      return attSortDir === "asc" ? cmp : -cmp
    })
  }, [attendanceStats, attSearch, attSortKey, attSortDir])

  function handleAttSort(key: "name" | "date" | "rate") {
    if (attSortKey === key) setAttSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else { setAttSortKey(key); setAttSortDir("asc") }
    setAttPage(1)
  }

  // ── Per-member CPD report ─────────────────────────────────────────────
  const memberReport = useMemo(() => {
    return users.map((u) => {
      const bookings = events.flatMap((e) =>
        (e.participants ?? []).filter((p) => p.memberRegistryNumber === u.memberRegistryNumber)
          .map((p) => ({ event: e, participant: p }))
      )
      const attended = bookings.filter((b) => b.participant.attendance === "attended")
      const cpdEarned = attended.reduce((s, b) => s + b.event.cpdHours, 0)
      const total = bookings.length
      const rate = total > 0 ? Math.round((attended.length / total) * 100) : null
      return { user: u, bookings, attended: attended.length, cpdEarned, total, rate }
    }).filter((r) => r.total > 0)
  }, [events, users])

  // ── Booking analytics ─────────────────────────────────────────────────
  const bookingAnalytics = useMemo(() => {
    return events.map((e) => {
      const pts = e.participants ?? []
      const totalSeats = e.sessionCapacity * e.totalSessions
      const registeredParticipants = pts.filter((p) => p.status === "registered")
      const booked = registeredParticipants.length
      const attended = registeredParticipants.filter((p) => p.attendance === "attended").length
      const waitlisted = pts.filter((p) => p.status === "waitlisted").length
      const attendanceRate = booked > 0 ? Math.round((attended / booked) * 100) : 0
      const isPastEvent = e.status === "past"
      const pastNoShows = registeredParticipants.filter((p) => p.attendance !== "attended").length
      const noShows = isPastEvent ? pastNoShows : null
      const noShowRate = isPastEvent && booked > 0
        ? Math.round((pastNoShows / booked) * 100)
        : isPastEvent
          ? 0
          : null

      return { event: e, booked, attended, waitlisted, attendanceRate, noShows, noShowRate, totalSeats }
    })
  }, [events])

  const filteredBooking = useMemo(() => {
    if (!bookSearch.trim()) return bookingAnalytics
    const q = bookSearch.toLowerCase()
    return bookingAnalytics.filter((r) => r.event.name.toLowerCase().includes(q))
  }, [bookingAnalytics, bookSearch])

  // ── Feedback (past events only) ───────────────────────────────────────
  const eventsWithAnswers = useMemo(() =>
    events
      .filter((e) => e.status === "past" && (e.feedbackQuestions ?? []).length > 0)
      .filter((e) => {
        if (!search.trim()) return true
        const q = search.toLowerCase()
        return e.name.toLowerCase().includes(q) || e.place.toLowerCase().includes(q)
      })
    , [events, search])

  const summaryStats = useMemo(() => {
    const pastEvents = events.filter((e) => e.status === "past")

    // Participants and attendance across ALL events (past + ongoing/upcoming with marked attendance)
    const allRegisteredParticipants = events.flatMap((e) =>
      (e.participants ?? []).filter((p) => p.status === "registered")
    )
    const totalParticipants = allRegisteredParticipants.length
    const totalAttended = allRegisteredParticipants.filter((p) => p.attendance === "attended").length
    const totalMarked = allRegisteredParticipants.filter(
      (p) => p.attendance === "attended" || p.attendance === "absent"
    ).length
    const attendanceRate = totalMarked > 0
      ? Math.round((totalAttended / totalMarked) * 100)
      : null

    // Ratings from all events that have feedback
    const allRatings: number[] = []
    events.forEach((e) => (e.participants ?? []).forEach((p) =>
      (p.answers ?? []).forEach((a) => {
        const q = (e.feedbackQuestions ?? []).find((fq) => fq.id === a.questionId)
        if (q?.type === "rating") allRatings.push(Number(a.answer))
      })
    ))
    const avgRating = allRatings.length > 0 ? allRatings.reduce((a, b) => a + b, 0) / allRatings.length : 0
    return { totalEvents: pastEvents.length, totalParticipants, attendanceRate, avgRating }
  }, [events])

  function handleExportAttendance() {
    const rows = ["Moduli,Sesione,Total Blerë,Attending,Absent,Pritje,Shkallë Prezenca"]
    attendanceStats.forEach(({ event: e, total, attended, absent, waitlisted, rate }) => {
      rows.push(`"${e.name}",${e.dates.length},${total},${attended},${absent},${waitlisted},${rate ?? "N/A"}%`)
    })
    const blob = new Blob([rows.join("\n")], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = "raporti-prezenca.csv"; a.click()
    URL.revokeObjectURL(url)
  }

  function handleExportBooking() {
    const rows = ["Moduli,Total Vende,Prezenca %,Pranishëm,Blerë,Listë Pritjeje,No-Show,Shkalla No-Show"]
    bookingAnalytics.forEach(({ event: e, totalSeats, attendanceRate, attended, booked, waitlisted, noShows, noShowRate }) => {
      rows.push(`"${e.name}",${totalSeats},${attendanceRate}%,${attended},${booked},${waitlisted},${noShows ?? "—"},${noShowRate !== null ? noShowRate + "%" : "—"}`)
    })
    const blob = new Blob([rows.join("\n")], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = "raporti-rezervime.csv"; a.click()
    URL.revokeObjectURL(url)
  }

  function handleExportMemberCPD() {
    const rows = ["Regjistri,Emri,Mbiemri,Module,Prezenca,Orë CPD,Pajtueshmëria"]
    memberReport.forEach(({ user: u, attended, total, cpdEarned }) => {
      const compliant = (u.cpdHoursCompleted + cpdEarned) >= u.cpdHoursRequired ? "PO" : "JO"
      rows.push(`${u.memberRegistryNumber},${u.firstName},${u.lastName},${total},${attended},${cpdEarned}h,${compliant}`)
    })
    const blob = new Blob([rows.join("\n")], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = "raporti-cpd-anetaret.csv"; a.click()
    URL.revokeObjectURL(url)
  }

  function handleExportFeedback() {
    const rows = ["Moduli,Data,Pyetja,Lloji,Përgjigja,Anëtari"]
    eventsWithAnswers.forEach((e) => {
      const date = e.dates[0]?.date ? formatDate(e.dates[0].date, "d MMM yyyy") : ""
      const pts = e.participants.filter((p) => p.answers && p.answers.length > 0)
      e.feedbackQuestions.forEach((q) => {
        pts.forEach((p) => {
          const a = p.answers?.find((a) => a.questionId === q.id)
          if (a) rows.push(`"${e.name}","${date}","${q.question}",${q.type},"${a.answer}","${p.firstName} ${p.lastName}"`)
        })
      })
    })
    const blob = new Blob([rows.join("\n")], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = "raporti-vleresime.csv"; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Raporte IEKA</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Prezenca, pajtueshmëri dhe analitikë e IEKA SmartClass</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
        <SummaryCard icon={BarChart3} label="Module të Kaluara" value={summaryStats.totalEvents} />
        <SummaryCard icon={Users} label="Gjithsej Pjesëmarrës" value={summaryStats.totalParticipants} />
        <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Star className="h-3 w-3" />Vlerësimi Mesatar</p>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-semibold text-foreground">{summaryStats.avgRating.toFixed(1)}</p>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} className={`h-3 w-3 ${s <= Math.round(summaryStats.avgRating) ? "fill-amber-400 text-amber-400" : "text-border"}`} />
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><TrendingUp className="h-3 w-3" />Shkalla e Prezencës</p>
          <p className="text-2xl font-semibold text-foreground">
            {summaryStats.attendanceRate !== null
              ? `${summaryStats.attendanceRate}%`
              : "—"}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex items-center gap-1 rounded-lg bg-muted p-1 w-fit">
        {([
          { key: "attendance", label: "Prezenca" },
          { key: "booking", label: "Rezervime" },
          { key: "feedback", label: "Vlerësime" },
        ] as { key: Tab; label: string }[]).map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${activeTab === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ATTENDANCE TAB */}
      {activeTab === "attendance" && (
        <div className="flex flex-col gap-4">
          {/* Per Module */}
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3">Prezenca sipas Modulit</h2>

            {/* Attendance search + sort controls */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Kërko modul ose datë..."
                  value={attSearch}
                  onChange={(e) => { setAttSearch(e.target.value); setAttPage(1) }}
                  className="pl-9 h-9"
                />
              </div>
              <span className="text-xs text-muted-foreground">
                {filteredAttStats.length} nga {attendanceStats.length} module
              </span>
              <div className="flex gap-2 sm:ml-auto">
                <Button variant="outline" size="sm" className="gap-2" onClick={handleExportAttendance}>
                  <Download className="h-4 w-4" /> Eksporto Modulet
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <AttSortTh label="Moduli" col="name" current={attSortKey} dir={attSortDir} onSort={handleAttSort} />
                    <AttSortTh label="Data" col="date" current={attSortKey} dir={attSortDir} onSort={handleAttSort} />
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Sesione</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Të Regjistruar</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Orë </th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Të pranishëm</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Munguan</th>
                    <AttSortTh label="Shkalla e Prezencës" col="rate" current={attSortKey} dir={attSortDir} onSort={handleAttSort} />
                  </tr>
                </thead>
                <tbody>
                  {usePagination(filteredAttStats, attPageSize, attPage).map(({ event: e, total, attended, absent, pending, rate, firstDate, lastDate }) => (
                    <tr key={e.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground max-w-[180px]">
                        <p className="truncate">{e.name}</p>
                        <p className="text-xs text-muted-foreground">{e.status === "past" ? "Kryer" : "Aktiv"}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {firstDate ? (
                          <>
                            <span className="font-medium text-foreground">
                              {formatDate(firstDate, "d MMM yyyy")}
                            </span>
                            {lastDate && lastDate !== firstDate && (
                              <span className="block text-muted-foreground">→ {formatDate(lastDate, "d MMM yyyy")}</span>
                            )}
                          </>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{(e.dates ?? []).length}</td>
                      <td className="px-4 py-3 text-muted-foreground">{total}</td>
                      <td className="px-4 py-3 text-muted-foreground font-medium">{e.cpdHours}h</td>
                      <td className="px-4 py-3">
                        <span className="text-green-500 font-medium">{attended}</span>
                        {pending > 0 && <span className="text-muted-foreground text-xs ml-1">(+{pending} pritje)</span>}
                      </td>
                      <td className="px-4 py-3 text-red-500 font-medium">{absent}</td>
                      <td className="px-4 py-3">
                        {rate !== null ? (
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-border">
                              <div
                                className={`h-full rounded-full ${rate >= 85 ? "bg-green-500" : rate >= 70 ? "bg-amber-500" : "bg-red-500"}`}
                                style={{ width: `${rate}%` }}
                              />
                            </div>
                            <span className="text-xs font-semibold">{rate}%</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <PaginationBar totalItems={filteredAttStats.length} pageSize={attPageSize} currentPage={attPage}
                onPageChange={setAttPage} onPageSizeChange={(s) => { setAttPageSize(s); setAttPage(1) }}
                className="px-4 border-t border-border" />
            </div>
          </div>

          {/* Per Member CPD */}
          {memberReport.length > 0 && (
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <h2 className="text-sm font-semibold text-foreground">CPD sipas Anëtarit</h2>
                <Button variant="outline" size="sm" className="gap-2" onClick={handleExportMemberCPD}>
                  <Download className="h-4 w-4" /> Eksporto Anëtarët
                </Button>
              </div>
              <div className="overflow-x-auto rounded-xl border border-border bg-card">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Anëtari</th>
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Të Regjistruar</th>
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Module</th>
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Të pranishëm</th>
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Orë Të Fituara</th>
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground"> Kalueshmëria</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usePagination(memberReport, memberPageSize, memberPage).map(({ user: u, attended, total, cpdEarned }) => {
                      const cpdTotal = u.cpdHoursCompleted + cpdEarned
                      const compliant = cpdTotal >= u.cpdHoursRequired
                      return (
                        <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 font-medium text-foreground">{u.firstName} {u.lastName}</td>
                          <td className="px-4 py-3">
                            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{u.memberRegistryNumber}</code>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{total}</td>
                          <td className="px-4 py-3 text-green-500 font-medium">{attended}</td>
                          <td className="px-4 py-3 font-medium text-foreground">{cpdEarned}h</td>
                          <td className="px-4 py-3">
                            <span className={`rounded px-2 py-0.5 text-xs font-medium ${compliant ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}>
                              {compliant ? "✓ Pajtues" : "✗ Mangët"}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <PaginationBar totalItems={memberReport.length} pageSize={memberPageSize} currentPage={memberPage}
                  onPageChange={setMemberPage} onPageSizeChange={(s) => { setMemberPageSize(s); setMemberPage(1) }}
                  className="px-4 border-t border-border" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* BOOKING ANALYTICS TAB */}
      {activeTab === "booking" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Kërko aktivitet..."
                value={bookSearch}
                onChange={(e) => { setBookSearch(e.target.value); setBookPage(1) }}
                className="pl-9 h-9"
              />
            </div>
            <span className="text-xs text-muted-foreground">{filteredBooking.length} nga {bookingAnalytics.length} module</span>
            <div className="ml-auto">
              <Button variant="outline" size="sm" className="gap-2" onClick={handleExportBooking}>
                <Download className="h-4 w-4" /> Eksporto të dhënat
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Moduli</th>
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Total Vende</th>
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Prezenca</th>
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Listë Pritjeje</th>
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground">No-Show</th>
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Shkalla No-Show</th>
                </tr>
              </thead>
              <tbody>
                {usePagination(filteredBooking, bookPageSize, bookPage).map(({ event: e, booked, attended, waitlisted, attendanceRate, noShows, noShowRate, totalSeats }) => (
                  <tr key={e.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground max-w-[200px]">
                      <p className="truncate">{e.name}</p>
                      <p className="text-xs text-muted-foreground">{e.sessionCapacity} vende × {e.totalSessions} sesione</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{totalSeats}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-border">
                          <div
                            className={`h-full rounded-full ${attendanceRate >= 85 ? "bg-green-500" : attendanceRate >= 60 ? "bg-amber-500" : "bg-red-500"}`}
                            style={{ width: `${Math.min(100, attendanceRate)}%` }}
                          />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold">{attendanceRate}%</span>
                          <span className="text-[11px] text-muted-foreground">{attended}/{booked || 0}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={waitlisted > 0 ? "text-amber-500 font-medium" : "text-muted-foreground"}>{waitlisted}</span>
                    </td>
                    <td className="px-4 py-3">
                      {noShows === null ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <span className={noShows > 0 ? "font-medium text-red-500" : "text-muted-foreground"}>{noShows}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {noShowRate === null ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <span className={`text-xs font-semibold ${noShowRate > 15 ? "text-red-500" : "text-muted-foreground"}`}>
                          {noShowRate}%
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationBar totalItems={filteredBooking.length} pageSize={bookPageSize} currentPage={bookPage}
              onPageChange={setBookPage} onPageSizeChange={(s) => { setBookPageSize(s); setBookPage(1) }}
              className="px-4 border-t border-border" />
          </div>
        </div>
      )}

      {/* FEEDBACK TAB */}
      {activeTab === "feedback" && (
        <div className="flex flex-col gap-4">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Kërko module..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setFbPage(1) }}
                className="pl-9 h-9"
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {eventsWithAnswers.length} nga {events.filter(e => e.status === "past" && (e.feedbackQuestions ?? []).length > 0).length} module
            </span>
            <div className="ml-auto">
              <Button variant="outline" size="sm" className="gap-2" onClick={handleExportFeedback} disabled={eventsWithAnswers.length === 0}>
                <Download className="h-4 w-4" /> Eksporto të dhënat
              </Button>
            </div>
          </div>

          {eventsWithAnswers.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-14 text-center">
              <FileText className="mb-2 h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                {search ? "Asnjë modul nuk përputhet" : "Asnjë modul i kryer me feedback akoma"}
              </p>
            </div>
          ) : (
            <>
              {usePagination(eventsWithAnswers, fbPageSize, fbPage).map((event) => {
                const isExpanded = expandedEvent === event.id
                const participantsWithAnswers = event.participants.filter((p) => p.answers && p.answers.length > 0)
                const responseRate = event.participants.length > 0
                  ? Math.round((participantsWithAnswers.length / event.participants.length) * 100)
                  : 0

                return (
                  <div key={event.id} className="rounded-lg border border-border bg-card overflow-hidden">
                    <button
                      onClick={() => setExpandedEvent(isExpanded ? null : event.id)}
                      className="flex w-full items-center justify-between p-4 hover:bg-muted/20 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                          <BarChart3 className="h-4 w-4 text-primary" />
                        </div>
                        <div className="text-left">
                          <h3 className="text-sm font-semibold text-foreground">{event.name}</h3>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-xs text-muted-foreground">
                              {event.dates[0]?.date && formatDate(event.dates[0].date, "d MMMM yyyy")}
                            </span>
                            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary font-medium">
                              {responseRate}% përgjigje
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="hidden sm:block text-xs text-muted-foreground">{participantsWithAnswers.length} përgjigje</span>
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-border">
                        {event.feedbackQuestions.map((question) => {
                          const qKey = `${event.id}-${question.id}`
                          const isQExpanded = expandedQuestion === qKey
                          const answers = participantsWithAnswers
                            .map((p) => {
                              const a = p.answers?.find((a) => a.questionId === question.id)
                              return a ? { participant: p, answer: a.answer } : null
                            })
                            .filter(Boolean) as { participant: typeof participantsWithAnswers[0]; answer: string }[]

                          return (
                            <div key={question.id} className="border-b border-border last:border-0">
                              <button
                                onClick={() => setExpandedQuestion(isQExpanded ? null : qKey)}
                                className="flex w-full items-center justify-between px-4 py-3 hover:bg-muted/10 transition-colors"
                              >
                                <div className="flex items-start gap-2.5 text-left">
                                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/10 mt-0.5">
                                    {question.type === "rating" ? <Star className="h-3 w-3 text-primary" /> :
                                      question.type === "multiple-choice" ? <CheckCircle2 className="h-3 w-3 text-primary" /> :
                                        <MessageSquare className="h-3 w-3 text-primary" />}
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-foreground">{question.question}</p>
                                    <div className="mt-1"><QuestionSummary question={question} answers={answers} /></div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 ml-3">
                                  <span className="text-xs text-muted-foreground">{answers.length}</span>
                                  {isQExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                                </div>
                              </button>

                              {isQExpanded && (
                                <div className="px-4 pb-4">
                                  <div className="max-h-60 overflow-y-auto rounded-md border border-border bg-muted/20 divide-y divide-border">
                                    {answers.map((a, idx) => (
                                      <div key={idx} className="flex items-start gap-2.5 p-3">
                                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-primary/10 text-xs font-semibold text-primary">
                                          {a.participant.firstName[0]}{a.participant.lastName[0]}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs font-medium text-foreground truncate">
                                            {a.participant.firstName} {a.participant.lastName}
                                          </p>
                                          {question.type === "rating" ? (
                                            <div className="flex items-center gap-0.5 mt-0.5">
                                              {[1, 2, 3, 4, 5].map((s) => (
                                                <Star key={s} className={`h-3 w-3 ${s <= Number(a.answer) ? "fill-amber-400 text-amber-400" : "text-border"}`} />
                                              ))}
                                              <span className="ml-1 text-xs text-muted-foreground">{a.answer}/5</span>
                                            </div>
                                          ) : (
                                            <p className="text-sm text-muted-foreground mt-0.5">{a.answer}</p>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}

              <div className="rounded-xl border border-border bg-card">
                <PaginationBar
                  totalItems={eventsWithAnswers.length}
                  pageSize={fbPageSize}
                  currentPage={fbPage}
                  onPageChange={setFbPage}
                  onPageSizeChange={(s) => { setFbPageSize(s); setFbPage(1) }}
                  className="px-4"
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function SummaryCard({ icon: Icon, label, value }: { icon: typeof BarChart3; label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className="h-3 w-3" />{label}</p>
      <p className="text-2xl font-semibold text-foreground">{value}</p>
    </div>
  )
}

function AttSortTh({ label, col, current, dir, onSort }: {
  label: string
  col: "name" | "date" | "rate"
  current: "name" | "date" | "rate"
  dir: "asc" | "desc"
  onSort: (col: "name" | "date" | "rate") => void
}) {
  const isActive = current === col
  return (
    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
      <button
        onClick={() => onSort(col)}
        className={`flex items-center gap-1 hover:text-foreground transition-colors ${isActive ? "text-foreground" : ""}`}
      >
        {label}
        {isActive ? (
          dir === "asc"
            ? <ChevronUp className="h-3 w-3 text-primary" />
            : <ChevronDown className="h-3 w-3 text-primary" />
        ) : (
          <ChevronsUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </th>
  )
}


function QuestionSummary({
  question, answers,
}: {
  question: { type: string; options?: string[] }
  answers: { answer: string }[]
}) {
  if (answers.length === 0) return <span className="text-xs text-muted-foreground">Asnjë përgjigje</span>

  if (question.type === "rating") {
    const avg = answers.reduce((s, a) => s + Number(a.answer), 0) / answers.length
    return (
      <div className="flex items-center gap-2">
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((s) => (
            <Star key={s} className={`h-3 w-3 ${s <= Math.round(avg) ? "fill-amber-400 text-amber-400" : "text-border"}`} />
          ))}
        </div>
        <span className="text-xs font-medium text-foreground">{avg.toFixed(1)}</span>
        <span className="text-xs text-muted-foreground">({answers.length})</span>
      </div>
    )
  }

  if (question.type === "multiple-choice") {
    const counts: Record<string, number> = {}
    answers.forEach((a) => { counts[a.answer] = (counts[a.answer] || 0) + 1 })
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
    return (
      <div className="flex flex-col gap-1.5 mt-1 max-w-xs">
        {sorted.map(([opt, count]) => {
          const pct = Math.round((count / answers.length) * 100)
          return (
            <div key={opt} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-28 truncate">{opt}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
                <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs font-medium text-foreground w-8 text-right">{pct}%</span>
            </div>
          )
        })}
      </div>
    )
  }

  return <span className="text-xs text-muted-foreground">{answers.length} përgjigje tekstuale</span>
}
