"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { format, parseISO } from "date-fns"
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Download,
  FileText,
  FolderOpen,
  X,
} from "lucide-react"

import { fetchApi, fetchWithAuth } from "@/lib/api-client"
import type {
  AppUser,
  StazhItem,
  StudentMyModuleResponse,
} from "@/lib/data"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

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

const STUDENT_UPLOADER_TAG = "[uploader:student]"

function parseStudentDocDescription(description?: string): string {
  const raw = (description ?? "").trim()
  if (raw.toLowerCase().startsWith(STUDENT_UPLOADER_TAG)) {
    return raw.slice(STUDENT_UPLOADER_TAG.length).trim()
  }
  return raw
}

export function StudentHistoryModal({ student, onClose }: StudentHistoryModalProps) {
  const [studentModules, setStudentModules] = useState<StudentMyModuleResponse[]>([])
  const [studentDocs, setStudentDocs] = useState<{ id: string; fileName: string; fileUrl: string; description: string; uploadedAt: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [modulesExpanded, setModulesExpanded] = useState(false)
  const [docsExpanded, setDocsExpanded] = useState(false)
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null)
  const [exportYears, setExportYears] = useState<number[]>([1, 2, 3])

  const handleDownload = useCallback(async (fileUrl: string, fileName: string, docId: string) => {
    setDownloadingDocId(docId)
    try {
      const response = await fetchWithAuth(fileUrl, { method: "GET" })
      if (!response.ok) throw new Error("Nuk u shkarkua dokumenti.")
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = objectUrl
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(objectUrl)
    } catch {
      // silent fail
    } finally {
      setDownloadingDocId(null)
    }
  }, [])

  useEffect(() => {
    if (!student) {
      setStudentModules([])
      setStudentDocs([])
      setError("")
      return
    }

    let cancelled = false

    const run = async () => {
      setLoading(true)
      setError("")
      try {
        const [modulesResponse, stazhResponse] = await Promise.all([
          fetchApi(`/StudentModules/student/${student.id}/modules`) as Promise<StudentMyModuleResponse[]>,
          fetchApi(`/Stazh/student/${student.id}`) as Promise<StazhItem[]>,
        ])

        if (cancelled) return

        setStudentModules(modulesResponse ?? [])

        // Extract student-uploaded documents from all stazhet
        const docs: typeof studentDocs = []
        for (const stazh of stazhResponse ?? []) {
          for (const doc of stazh.documents ?? []) {
            const desc = (doc.description ?? "").toLowerCase()
            if (desc.startsWith(STUDENT_UPLOADER_TAG)) {
              docs.push({
                id: doc.id,
                fileName: doc.fileName,
                fileUrl: doc.fileUrl,
                description: parseStudentDocDescription(doc.description),
                uploadedAt: doc.uploadedAt,
              })
            }
          }
        }
        docs.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
        setStudentDocs(docs)
      } catch (e: any) {
        if (!cancelled) {
          setStudentModules([])
          setStudentDocs([])
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

  // Gather all topic documents across modules
  const allTopicDocs = useMemo(() => {
    const docs: { id: string; fileName: string; fileUrl: string; relativePath: string; sizeBytes: number; uploadedAt: string; topicName: string; moduleName: string }[] = []
    for (const mod of studentModules) {
      for (const topic of mod.topics ?? []) {
        for (const doc of topic.documents ?? []) {
          docs.push({ ...doc, topicName: topic.name, moduleName: mod.title })
        }
      }
    }
    return docs
  }, [studentModules])

  if (!student) {
    return null
  }

  // Compute topic-level stats across all modules
  const allTopics = studentModules.flatMap(m =>
    (m.topics ?? []).map(t => ({ ...t, assignedAt: m.assignedAt }))
  )
  const attendedTopics = allTopics.filter(t => t.attended)
  const now = new Date()
  const upcomingTopics = allTopics.filter(t => !t.attended && t.scheduledDate && new Date(t.scheduledDate) > now)
  // Only count as missed if the topic was after the student was assigned to the module
  const missedTopics = allTopics.filter(t => {
    if (t.attended) return false
    if (t.scheduledDate && new Date(t.scheduledDate) > now) return false
    // If topic was before student was assigned, don't count as missed
    if (t.scheduledDate && t.assignedAt && new Date(t.scheduledDate) < new Date(t.assignedAt)) return false
    return true
  })

  const totalDocs = allTopicDocs.length + studentDocs.length

  function handleExportStudentAttendance() {
    const filteredModules = exportYears.length > 0
      ? studentModules.filter(m => exportYears.includes(m.yearGrade))
      : studentModules
    const rows = ["sep=;", "Moduli;Viti;Tema;Lektori;Data;Vendndodhja;Statusi;Data Prezences"]
    for (const mod of filteredModules) {
      for (const topic of [...(mod.topics ?? [])].sort((a, b) => (a.scheduledDate ?? "").localeCompare(b.scheduledDate ?? ""))) {
        const status = topic.attended ? "Prezent"
          : topic.scheduledDate && new Date(topic.scheduledDate) > now ? "Ne pritje"
          : "Pa prezence"
        const attendedDate = topic.attendedAt ? formatDateTime(topic.attendedAt) : ""
        const topicDate = topic.scheduledDate ? formatDateTime(topic.scheduledDate) : ""
        rows.push(`"${mod.title}";${mod.yearGrade};"${topic.name}";"${topic.lecturer}";"${topicDate}";"${topic.location ?? ""}";"${status}";"${attendedDate}"`)
      }
    }
    const blob = new Blob(["\uFEFF" + rows.join("\n")], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `prezenca-${student!.firstName}-${student!.lastName}.csv`
    a.click()
    URL.revokeObjectURL(url)
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
              <div className="grid gap-3 md:grid-cols-4">
                <StatCard label="Module" value={String(studentModules.length)} helper={`${allTopics.length} tema gjithsej`} />
                <StatCard label="Tema me prezencë" value={String(attendedTopics.length)} helper={`nga ${allTopics.length} tema`} />
                <StatCard label="Në pritje" value={String(upcomingTopics.length)} helper="Tema që nuk kanë ndodhur ende" />
                <StatCard label="Pa prezencë" value={String(missedTopics.length)} helper="Tema ku studenti nuk ka prezencë" />
              </div>

              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/10 px-4 py-3">
                <p className="text-xs font-medium text-foreground">Eksporto prezencën:</p>
                {[1, 2, 3].map(y => (
                  <label key={y} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={exportYears.includes(y)}
                      onChange={() => setExportYears(prev =>
                        prev.includes(y) ? prev.filter(v => v !== y) : [...prev, y]
                      )}
                      className="h-3.5 w-3.5 rounded border-border"
                    />
                    <span className="text-xs text-muted-foreground">Viti {y}</span>
                  </label>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5 text-xs ml-auto"
                  disabled={exportYears.length === 0}
                  onClick={handleExportStudentAttendance}
                >
                  <Download className="h-3.5 w-3.5" />
                  Eksporto CSV
                </Button>
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
                                {[...(mod.topics ?? [])].sort((a, b) => (a.scheduledDate ?? "").localeCompare(b.scheduledDate ?? "")).map((topic) => (
                                  <div key={topic.id} className="px-4 py-2.5 flex items-center gap-3">
                                    <div className="min-w-0 flex-1">
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
                                      {topic.attended && topic.attendedAt ? (
                                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                                          Prezenca u regjistrua më {formatDateTime(topic.attendedAt)}
                                        </p>
                                      ) : null}
                                    </div>
                                    <div className="shrink-0 w-[100px] flex justify-end">
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

              {/* Documents section */}
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <button
                  type="button"
                  onClick={() => setDocsExpanded(v => !v)}
                  className="flex w-full items-center justify-between p-4 text-left"
                >
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <FolderOpen className="h-4 w-4 text-primary" />
                      Dokumentet
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {totalDocs} dokumente ({allTopicDocs.length} tema • {studentDocs.length} ngarkuar nga studenti)
                    </p>
                  </div>
                  <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", docsExpanded && "rotate-90")} />
                </button>
                {docsExpanded && (
                  <div className="border-t border-border px-4 pb-4">
                    {totalDocs === 0 ? (
                      <p className="mt-4 rounded-lg border border-dashed border-border px-4 py-8 text-sm text-muted-foreground text-center">
                        Nuk ka dokumente për këtë student.
                      </p>
                    ) : (
                      <div className="mt-4 space-y-4">
                        {/* Student-uploaded documents */}
                        {studentDocs.length > 0 && (
                          <div className="rounded-xl border border-border/70 bg-muted/10 overflow-hidden">
                            <div className="px-4 py-3 bg-muted/20">
                              <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                                <FileText className="h-4 w-4 text-indigo-500" />
                                Dokumente të ngarkuara nga studenti
                              </p>
                              <p className="mt-0.5 text-xs text-muted-foreground">{studentDocs.length} dokumente</p>
                            </div>
                            <div className="divide-y divide-border/50">
                              {studentDocs.map((doc) => (
                                <div key={doc.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">{doc.fileName}</p>
                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                      {doc.description ? `${doc.description} • ` : ""}{formatDateTime(doc.uploadedAt)}
                                    </p>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 shrink-0"
                                    disabled={downloadingDocId === doc.id}
                                    onClick={() => void handleDownload(doc.fileUrl, doc.fileName, doc.id)}
                                  >
                                    <Download className={cn("h-4 w-4", downloadingDocId === doc.id && "animate-pulse")} />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Topic documents grouped by module */}
                        {allTopicDocs.length > 0 && (
                          <div className="rounded-xl border border-border/70 bg-muted/10 overflow-hidden">
                            <div className="px-4 py-3 bg-muted/20">
                              <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                                <BookOpen className="h-4 w-4 text-primary" />
                                Dokumente nga temat
                              </p>
                              <p className="mt-0.5 text-xs text-muted-foreground">{allTopicDocs.length} dokumente</p>
                            </div>
                            <div className="divide-y divide-border/50">
                              {allTopicDocs.map((doc) => (
                                <div key={doc.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">{doc.fileName}</p>
                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                      {doc.topicName} • {doc.moduleName}
                                    </p>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 shrink-0"
                                    disabled={downloadingDocId === doc.id}
                                    onClick={() => void handleDownload(doc.fileUrl, doc.fileName, doc.id)}
                                  >
                                    <Download className={cn("h-4 w-4", downloadingDocId === doc.id && "animate-pulse")} />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
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
