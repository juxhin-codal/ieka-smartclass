"use client"

import { useMemo, useEffect } from "react"
import { useEvents } from "@/lib/events-context"
import { useAuth } from "@/lib/auth-context"
import { fetchApi } from "@/lib/api-client"
import {
  BookOpen, Users, UserCheck, BarChart3, Clock, AlertCircle, TrendingUp, CalendarRange, GraduationCap,
} from "lucide-react"

export function DashboardView() {
  const { events, users } = useEvents()
  const { user } = useAuth()
  const isLecturer = user?.role === "Lecturer"

  // Trigger notification processing once on dashboard load (replaces background scheduler)
  useEffect(() => {
    if (!user) return
    fetchApi("/Notifications/process", { method: "POST" }).catch(() => { })
  }, [user])

  const stats = useMemo(() => {
    const upcoming = events.filter((e) => e.status === "upcoming")
    const past = events.filter((e) => e.status === "past")

    const totalRegistered = upcoming.reduce((s, e) =>
      s + (e.participants ?? []).filter((p) => p.status === "registered").length, 0)
    const totalWaitlisted = events.reduce((s, e) =>
      s + (e.participants ?? []).filter((p) => p.status === "waitlisted").length, 0)
    const totalAttended = past.reduce((s, e) =>
      s + (e.participants ?? []).filter((p) => p.attendance === "attended").length, 0)
    const totalBooked = past.reduce((s, e) => s + (e.participants ?? []).length, 0)
    const noShowRate = totalBooked > 0 ? Math.round(((totalBooked - totalAttended) / totalBooked) * 100) : 0

    const totalMembers = users.filter((u) => u.role === "Member").length
    const compliantCount = users.filter((u) => u.cpdHoursCompleted >= u.cpdHoursRequired).length

    // Sessions with available seats (not fully filled)
    const availableSessions = upcoming.reduce((s, e) => {
      return s + (e.dates ?? []).filter((d) => d.currentParticipants < d.maxParticipants).length
    }, 0)

    const totalStudents = users.filter((u) => u.role === "Student").length

    return {
      upcomingModules: upcoming.length,
      totalRegistered,
      totalWaitlisted,
      noShowRate,
      totalMembers,
      compliantCount,
      availableSessions,
      totalStudents,
    }
  }, [events, users])

  const sessionFillData = useMemo(() => {
    return events
      .filter((e) => e.status === "upcoming")
      .flatMap((e) =>
        (e.dates ?? []).map((d, idx) => ({
          label: `${e.name.substring(0, 18)}… S${idx + 1}`,
          fill: d.maxParticipants > 0 ? Math.round((d.currentParticipants / d.maxParticipants) * 100) : 0,
          current: d.currentParticipants,
          max: d.maxParticipants,
          date: d.date,
        }))
      )
      .slice(0, 10)
  }, [events])

  // Build monthly CPD chart from real event dates
  const ALBANIAN_MONTHS = ["Jan", "Shk", "Mar", "Pri", "Mai", "Qer", "Kor", "Gus", "Sht", "Tet", "Nën", "Dhj"]
  const monthlyCpdData = useMemo(() => {
    const buckets: Record<string, { modules: Set<string>; participants: number }> = {}
    ALBANIAN_MONTHS.forEach((m) => { buckets[m] = { modules: new Set(), participants: 0 } })

    events.forEach((e) => {
      e.dates.forEach((d) => {
        const month = new Date(d.date).getMonth() // 0-based
        const label = ALBANIAN_MONTHS[month]
        if (label) {
          buckets[label].modules.add(e.id)
          buckets[label].participants += d.currentParticipants
        }
      })
    })

    return ALBANIAN_MONTHS.map((m) => ({
      month: m,
      modules: buckets[m].modules.size,
      participants: buckets[m].participants,
    }))
  }, [events])

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Paneli i Bordit – IEKA SmartClass</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Analitika e përgjithshme e trajnimeve dhe pajtueshmërisë</p>
        </div>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 mb-6">
        <StatCard
          icon={BookOpen}
          title={isLecturer ? "Modulet Tuaja" : "Module Aktive"}
          value={stats.upcomingModules}
          subtitle="sesione të ardhshme"
          accent="blue"
        />
        <StatCard
          icon={UserCheck}
          title="Regjistruar"
          value={stats.totalRegistered}
          subtitle={`+ ${stats.totalWaitlisted} në listë pritjeje`}
          accent="green"
        />
        <StatCard
          icon={CalendarRange}
          title="Sesione Disponueshme"
          value={stats.availableSessions}
          subtitle="me vende të lira"
          accent="purple"
        />
        {!isLecturer && (
          <>
            <StatCard
              icon={Users}
              title="Gjithsej Anëtarë"
              value={stats.totalMembers}
              subtitle="anëtarë aktiv dhe jo aktiv"
              accent="blue"
            />
            <StatCard
              icon={GraduationCap}
              title="Studentë"
              value={stats.totalStudents}
              subtitle="studentë të regjistruar"
              accent="indigo"
            />
          </>
        )}
        <StatCard
          icon={AlertCircle}
          title="Shkalla e Mungesës"
          value={`${stats.noShowRate}%`}
          subtitle="nga modulet e kaluara"
          accent={stats.noShowRate > 15 ? "red" : "green"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Session Fill Rate Chart */}
        <div className="rounded-lg border border-border bg-card p-5 lg:col-span-3">
          <h2 className="text-sm font-semibold text-foreground mb-0.5">Statusi i Sesioneve</h2>
          <p className="text-xs text-muted-foreground mb-4">Kapaciteti 45 vende/sesion</p>
          <div className="flex flex-col gap-2.5">
            {sessionFillData.length === 0 ? (
              <p className="text-sm text-muted-foreground">Asnjë sesion aktiv</p>
            ) : sessionFillData.map((s, i) => (
              <div
                key={i}
                className="flex items-center gap-3"
                title={`${s.label} • ${s.current}/${s.max} • ${new Date(s.date).toLocaleDateString("sq-AL")}`}
              >
                <span className="text-xs text-muted-foreground w-48 truncate shrink-0">{s.label}</span>
                <div className="flex-1 h-5 rounded-md overflow-hidden bg-muted relative">
                  <div
                    className={`h-full rounded-md transition-all ${s.fill >= 100 ? "bg-amber-500" : s.fill >= 80 ? "bg-primary" : "bg-primary/60"
                      }`}
                    style={{ width: `${s.fill}%` }}
                  />
                  <span className="absolute inset-0 flex items-center px-2 text-xs font-medium text-foreground">
                    {s.current}/{s.max}
                  </span>
                </div>
                <span className="text-xs font-semibold w-10 text-right text-foreground">{s.fill}%</span>
                {s.fill >= 100 && (
                  <span className="text-xs rounded px-1.5 py-0.5 bg-amber-500/10 text-amber-500 whitespace-nowrap">Lista pritjeje</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Monthly CPD Activity */}
        <div className="rounded-lg border border-border bg-card p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-foreground mb-0.5">Aktiviteti CPD</h2>
          <p className="text-xs text-muted-foreground mb-4">Pjesëmarrja mujore (sipas datave reale)</p>
          {monthlyCpdData.every((d) => d.participants === 0) ? (
            <div className="flex h-36 items-center justify-center">
              <p className="text-sm text-muted-foreground">Nuk ka të dhëna akoma</p>
            </div>
          ) : (
            <MonthlyChart data={monthlyCpdData} />
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({
  icon: Icon, title, value, subtitle, accent,
}: {
  icon: typeof BookOpen; title: string; value: string | number; subtitle: string
  accent: "blue" | "green" | "red" | "purple" | "amber" | "indigo" | "teal"
}) {
  const colors = {
    blue: "bg-blue-500/10 text-blue-400",
    green: "bg-green-500/10 text-green-500",
    red: "bg-red-500/10 text-red-500",
    purple: "bg-purple-500/10 text-purple-400",
    amber: "bg-amber-500/10 text-amber-500",
    indigo: "bg-indigo-500/10 text-indigo-400",
    teal: "bg-teal-500/10 text-teal-400",
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className={`flex h-8 w-8 items-center justify-center rounded-md mb-3 ${colors[accent]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-xs text-muted-foreground mb-1">{title}</p>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
    </div>
  )
}

function MonthlyChart({ data }: { data: { month: string; modules: number; participants: number }[] }) {
  const max = Math.max(...data.map((d) => d.participants), 1)
  return (
    <div className="flex items-end gap-1.5 h-36">
      {data.map((d) => {
        const height = Math.round((d.participants / max) * 100)
        return (
          <div key={d.month} className="group relative flex flex-1 flex-col items-center gap-1">
            <div className="pointer-events-none absolute -top-14 left-1/2 z-20 w-max -translate-x-1/2 rounded-md border border-border bg-popover px-2 py-1 text-[10px] text-popover-foreground shadow-sm opacity-0 transition-all duration-150 group-hover:-translate-y-1 group-hover:opacity-100 group-focus-within:-translate-y-1 group-focus-within:opacity-100">
              <div className="font-semibold">{d.month}</div>
              <div className="text-muted-foreground">{d.participants} pjesëmarrës</div>
              <div className="text-muted-foreground">{d.modules} module</div>
            </div>
            <div className="w-full flex items-end" style={{ height: "100px" }}>
              <div
                tabIndex={0}
                className={`w-full rounded-sm transition-all ${d.participants > 0 ? "bg-primary" : "bg-muted"}`}
                style={{ height: `${height}%`, minHeight: d.participants > 0 ? "4px" : "2px" }}
                title={`${d.month}: ${d.participants} pjesëmarrës, ${d.modules} module`}
                aria-label={`${d.month}: ${d.participants} pjesëmarrës, ${d.modules} module`}
              />
            </div>
            <span className="text-xs text-muted-foreground">{d.month}</span>
          </div>
        )
      })}
    </div>
  )
}
