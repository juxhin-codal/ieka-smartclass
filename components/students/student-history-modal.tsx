"use client"

import { useEffect, useState } from "react"
import { format, parseISO } from "date-fns"
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  X,
} from "lucide-react"

import { fetchApi } from "@/lib/api-client"
import type {
  AppUser,
  StudentMyModuleResponse,
} from "@/lib/data"
import { cn } from "@/lib/utils"

function formatDateTime(value?: string | null) {
  if (!value) return "—"
  try {
    return format(parseISO(value), "dd MMM yyyy HH:mm")
  } catch {
    return value
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

export function StudentHistoryModal({ student, onClose }: StudentHistoryModalProps) {
  const [studentModules, setStudentModules] = useState<StudentMyModuleResponse[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [modulesExpanded, setModulesExpanded] = useState(false)

  useEffect(() => {
    if (!student) {
      setStudentModules([])
      setError("")
      return
    }

    let cancelled = false

    const run = async () => {
      setLoading(true)
      setError("")
      try {
        const modulesResponse = await fetchApi(`/StudentModules/student/${student.id}/modules`) as StudentMyModuleResponse[]

        if (cancelled) return

        setStudentModules(modulesResponse ?? [])
      } catch (e: any) {
        if (!cancelled) {
          setStudentModules([])
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

  if (!student) {
    return null
  }

  // Compute topic-level stats across all modules
  const allTopics = studentModules.flatMap(m => m.topics ?? [])
  const attendedTopics = allTopics.filter(t => t.attended)
  const now = new Date()
  const upcomingTopics = allTopics.filter(t => !t.attended && t.scheduledDate && new Date(t.scheduledDate) > now)
  const missedTopics = allTopics.filter(t => !t.attended && (!t.scheduledDate || new Date(t.scheduledDate) <= now))

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
              <div className="grid gap-3 md:grid-cols-4">
                <StatCard label="Module" value={String(studentModules.length)} helper={`${allTopics.length} tema gjithsej`} />
                <StatCard label="Tema me prezencë" value={String(attendedTopics.length)} helper={`nga ${allTopics.length} tema`} />
                <StatCard label="Në pritje" value={String(upcomingTopics.length)} helper="Tema që nuk kanë ndodhur ende" />
                <StatCard label="Pa prezencë" value={String(missedTopics.length)} helper="Tema ku studenti nuk ka prezencë" />
              </div>

              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <button
                  type="button"
                  onClick={() => setModulesExpanded(v => !v)}
                  className="flex w-full items-center justify-between p-4 text-left"
                >
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <BookOpen className="h-4 w-4 text-primary" />
                      Modulet e caktuara
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {studentModules.length} module • {allTopics.length} tema • {attendedTopics.length} me prezencë
                    </p>
                  </div>
                  <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", modulesExpanded && "rotate-90")} />
                </button>
                {modulesExpanded && (
                  <div className="border-t border-border px-4 pb-4">
                    {studentModules.length === 0 ? (
                      <p className="mt-4 rounded-lg border border-dashed border-border px-4 py-8 text-sm text-muted-foreground text-center">
                        Nuk ka module të caktuara për këtë student.
                      </p>
                    ) : (
                      <div className="mt-4 space-y-4">
                        {studentModules.map((mod) => (
                          <div key={mod.id} className="rounded-xl border border-border/70 bg-muted/10 overflow-hidden">
                            {/* Module header */}
                            <div className="px-4 py-3 bg-muted/20">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={cn(
                                  "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                  mod.yearGrade === 1 ? "bg-blue-500/10 text-blue-600"
                                    : mod.yearGrade === 2 ? "bg-purple-500/10 text-purple-600"
                                      : "bg-emerald-500/10 text-emerald-600"
                                )}>
                                  Viti {mod.yearGrade}
                                </span>
                                <p className="text-sm font-semibold text-foreground">{mod.title}</p>
                              </div>
                              {mod.location ? (
                                <p className="mt-0.5 text-xs text-muted-foreground">{mod.location}</p>
                              ) : null}
                            </div>

                            {/* Topics list */}
                            {(mod.topics ?? []).length === 0 ? (
                              <p className="px-4 py-3 text-xs text-muted-foreground italic">Asnjë temë e shtuar.</p>
                            ) : (
                              <div className="divide-y divide-border/50">
                                {(mod.topics ?? []).map((topic) => (
                                  <div key={topic.id} className="px-4 py-2.5 flex flex-wrap items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium text-foreground">{topic.name}</p>
                                      <p className="mt-0.5 text-xs text-muted-foreground">
                                        Lektori: {topic.lecturer}
                                        {topic.location ? ` • ${topic.location}` : ""}
                                      </p>
                                      {topic.scheduledDate ? (
                                        <p className="mt-0.5 text-xs text-muted-foreground">
                                          <CalendarDays className="inline h-3 w-3 mr-0.5 -mt-0.5" />
                                          {formatDateTime(topic.scheduledDate)}
                                        </p>
                                      ) : null}
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      {topic.attended ? (
                                        <span className="flex items-center gap-1 rounded-full bg-green-500/10 px-2.5 py-1 text-[11px] font-medium text-green-600">
                                          <CheckCircle2 className="h-3 w-3" />
                                          Prezent
                                        </span>
                                      ) : topic.scheduledDate && new Date(topic.scheduledDate) > now ? (
                                        <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-[11px] font-medium text-blue-600">
                                          Në pritje
                                        </span>
                                      ) : (
                                        <span className="rounded-full bg-red-500/10 px-2.5 py-1 text-[11px] font-medium text-red-600">
                                          Pa prezencë
                                        </span>
                                      )}
                                    </div>
                                    {topic.attended && topic.attendedAt ? (
                                      <p className="w-full text-[11px] text-muted-foreground">
                                        Prezenca u regjistrua më {formatDateTime(topic.attendedAt)}
                                      </p>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
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
