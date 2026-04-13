"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { fetchApi } from "@/lib/api-client"
import {
    ChevronDown, ChevronUp, Loader2, FileText, Star, Search, User, Download,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { PaginationBar, usePagination, type PageSize } from "@/components/ui/pagination-bar"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

interface FeedbackAnswer {
    id: string
    questionId: string
    questionText: string | null
    questionType: number | null  // 1=text, 2=stars
    sectionTitle: string | null
    topicId: string | null
    topicName: string | null
    topicLecturer: string | null
    answerText: string
}

interface FeedbackResponse {
    id: string
    studentModuleId: string
    moduleTitle: string | null
    moduleYearGrade: number | null
    studentId: string
    studentName: string | null
    studentEmail: string | null
    sectionScope: string
    submittedAt: string
    answers: FeedbackAnswer[]
}

type ModuleGroup = { title: string; yearGrade: number | null; responses: FeedbackResponse[] }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const YEAR_BADGE: Record<number, string> = {
    1: "bg-blue-500/10 text-blue-600",
    2: "bg-purple-500/10 text-purple-600",
    3: "bg-emerald-500/10 text-emerald-600",
}

function StarRow({ value, max = 5 }: { value: number; max?: number }) {
    return (
        <span className="flex items-center gap-0.5">
            {Array.from({ length: max }, (_, i) => (
                <Star
                    key={i}
                    className={cn("h-3 w-3", i < value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")}
                />
            ))}
            <span className="ml-1 text-[11px] text-muted-foreground">{value}/{max}</span>
        </span>
    )
}

function initials(name: string | null) {
    if (!name) return "?"
    const parts = name.trim().split(" ")
    return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")
}

// Normalize Albanian characters for PDF (standard fonts don't include ë/ç)
function pdf(text: string | null | undefined): string {
    return (text ?? "-")
        .replace(/ë/g, "e").replace(/Ë/g, "E")
        .replace(/ç/g, "c").replace(/Ç/g, "C")
        .replace(/[^\x00-\x7E]/g, "?")
}

function starText(value: number, max = 5): string {
    // Use ASCII characters safe for jsPDF Helvetica: filled = "o", empty = "."
    const filled = "o".repeat(value)
    const empty = ".".repeat(max - value)
    return `[${filled}${empty}] ${value}/${max}`
}

// ─── PDF generation ───────────────────────────────────────────────────────────

async function downloadPdf(groups: Map<string, ModuleGroup>, filename: string) {
    const { jsPDF } = await import("jspdf")
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
    const W = doc.internal.pageSize.getWidth()
    const marginL = 15, marginR = 15, textW = W - marginL - marginR
    let y = 18
    let pageNum = 1

    function checkPage(needed = 10) {
        if (y + needed > 278) {
            doc.addPage()
            pageNum++
            y = 18
            // page header line
            doc.setDrawColor(220, 220, 220)
            doc.line(marginL, y, W - marginR, y)
            y += 6
        }
    }

    function writeLine(text: string, size: number, style: "normal" | "bold", color: [number, number, number] = [30, 30, 30]) {
        checkPage(size * 0.6 + 2)
        doc.setFontSize(size)
        doc.setFont("helvetica", style)
        doc.setTextColor(...color)
        const lines = doc.splitTextToSize(pdf(text), textW)
        doc.text(lines, marginL, y)
        y += lines.length * (size * 0.45) + 1.5
    }

    function rule(color: [number, number, number] = [210, 210, 210]) {
        checkPage(4)
        doc.setDrawColor(...color)
        doc.line(marginL, y, W - marginR, y)
        y += 3
    }

    // ── Document header ──
    doc.setFontSize(15)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(30, 30, 30)
    doc.text("IEKA SmartClass — Vleresimet", marginL, y)
    y += 6
    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(130, 130, 130)
    doc.text(`Gjeneruar: ${new Date().toLocaleDateString("sq-AL", { day: "2-digit", month: "long", year: "numeric" })}`, marginL, y)
    y += 8
    rule([180, 180, 180])

    for (const [, group] of groups) {
        // ── Module heading ──
        checkPage(18)
        y += 3
        doc.setFontSize(12)
        doc.setFont("helvetica", "bold")
        doc.setTextColor(15, 15, 15)
        const moduleLabel = group.yearGrade != null
            ? `${pdf(group.title)}  [V${group.yearGrade}]`
            : pdf(group.title)
        doc.text(moduleLabel, marginL, y)
        y += 5

        const stars = group.responses.flatMap(r =>
            r.answers.filter(a => a.questionType === 2).map(a => parseInt(a.answerText)).filter(n => !isNaN(n))
        )
        const avg = stars.length > 0 ? (stars.reduce((s, n) => s + n, 0) / stars.length).toFixed(1) : null
        doc.setFontSize(8)
        doc.setFont("helvetica", "normal")
        doc.setTextColor(110, 110, 110)
        doc.text(
            `${group.responses.length} pergjigje${avg != null ? `  ·  Mesatare: ${avg}/5` : ""}`,
            marginL, y
        )
        y += 5
        rule([200, 200, 200])

        // ── Responses ──
        for (const r of group.responses) {
            checkPage(16)
            y += 2

            // Student row
            doc.setFontSize(9)
            doc.setFont("helvetica", "bold")
            doc.setTextColor(30, 30, 30)
            doc.text(pdf(r.studentName), marginL, y)
            doc.setFont("helvetica", "normal")
            doc.setTextColor(110, 110, 110)
            const dateStr = new Date(r.submittedAt).toLocaleDateString("sq-AL", { day: "2-digit", month: "short", year: "numeric" })
            doc.text(dateStr, W - marginR, y, { align: "right" })
            y += 4
            if (r.studentEmail) {
                doc.setFontSize(7.5)
                doc.text(r.studentEmail, marginL, y)
                y += 3.5
            }

            // Group answers by section → topic
            const bySection = new Map<string, FeedbackAnswer[]>()
            for (const a of r.answers) {
                const sec = a.sectionTitle ?? "—"
                if (!bySection.has(sec)) bySection.set(sec, [])
                bySection.get(sec)!.push(a)
            }

            for (const [sectionTitle, answers] of bySection) {
                checkPage(10)
                y += 2
                doc.setFontSize(7.5)
                doc.setFont("helvetica", "bold")
                doc.setTextColor(80, 80, 180)
                doc.text(pdf(sectionTitle).toUpperCase(), marginL + 3, y)
                y += 3.5

                const byTopic = new Map<string, FeedbackAnswer[]>()
                for (const a of answers) {
                    const key = a.topicName
                        ? `${a.topicName}${a.topicLecturer ? ` — ${a.topicLecturer}` : ""}`
                        : "__general__"
                    if (!byTopic.has(key)) byTopic.set(key, [])
                    byTopic.get(key)!.push(a)
                }

                for (const [topicKey, topicAnswers] of byTopic) {
                    if (topicKey !== "__general__") {
                        checkPage(8)
                        doc.setFontSize(7.5)
                        doc.setFont("helvetica", "bold")
                        doc.setTextColor(60, 60, 60)
                        doc.text(pdf(topicKey), marginL + 3, y)
                        y += 3.5
                    }

                    for (const a of topicAnswers) {
                        checkPage(8)
                        doc.setFontSize(7.5)
                        doc.setFont("helvetica", "normal")
                        doc.setTextColor(80, 80, 80)
                        const qLines = doc.splitTextToSize(pdf(a.questionText), textW * 0.62)
                        const val = parseInt(a.answerText)
                        const ansText = a.questionType === 2 && !isNaN(val) ? starText(val) : pdf(a.answerText)

                        doc.text(qLines, marginL + 3, y)
                        doc.setTextColor(30, 30, 30)
                        doc.text(ansText, W - marginR, y, { align: "right" })
                        y += qLines.length * 3.5 + 0.5
                    }
                }
            }

            rule()
        }

        y += 4
    }

    // Page numbers
    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i)
        doc.setFontSize(7)
        doc.setFont("helvetica", "normal")
        doc.setTextColor(170, 170, 170)
        doc.text(`Faqe ${i} / ${totalPages}`, W / 2, 290, { align: "center" })
    }

    doc.save(filename)
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ModuleFeedbackResponsesView() {
    const [responses, setResponses] = useState<FeedbackResponse[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [expandedModule, setExpandedModule] = useState<string | null>(null)
    const [expandedResponse, setExpandedResponse] = useState<string | null>(null)
    const [downloadingAll, setDownloadingAll] = useState(false)
    const [downloadingModule, setDownloadingModule] = useState<string | null>(null)
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState<PageSize>(25)

    useEffect(() => {
        fetchApi("/ModuleFeedback/responses/all")
            .then((data) => setResponses(data as FeedbackResponse[]))
            .catch(() => setResponses([]))
            .finally(() => setLoading(false))
    }, [])

    // Group by module
    const grouped = useMemo(() => {
        const map = new Map<string, ModuleGroup>()
        for (const r of responses) {
            const key = r.studentModuleId
            if (!map.has(key)) {
                map.set(key, { title: r.moduleTitle ?? "Modul i panjohur", yearGrade: r.moduleYearGrade, responses: [] })
            }
            map.get(key)!.responses.push(r)
        }
        return map
    }, [responses])

    const filtered = useMemo(() => {
        if (!search.trim()) return grouped
        const q = search.toLowerCase()
        const result = new Map<string, ModuleGroup>()
        for (const [key, group] of grouped) {
            const matchesModule = group.title.toLowerCase().includes(q)
            const matchedResponses = matchesModule
                ? group.responses
                : group.responses.filter(r => r.studentName?.toLowerCase().includes(q) || r.studentEmail?.toLowerCase().includes(q))
            if (matchedResponses.length > 0) {
                result.set(key, { ...group, responses: matchedResponses })
            }
        }
        return result
    }, [grouped, search])

    // Reset to page 1 when search changes
    useMemo(() => { setPage(1) }, [search])

    const filteredEntries = useMemo(() => Array.from(filtered.entries()), [filtered])
    const pagedEntries = usePagination(filteredEntries, pageSize, page)

    const handleDownloadAll = useCallback(async () => {
        if (downloadingAll || filtered.size === 0) return
        setDownloadingAll(true)
        try {
            await downloadPdf(filtered, `vlereesimet-${new Date().toISOString().slice(0, 10)}.pdf`)
        } finally {
            setDownloadingAll(false)
        }
    }, [filtered, downloadingAll])

    const handleDownloadModule = useCallback(async (moduleId: string, group: ModuleGroup) => {
        if (downloadingModule) return
        setDownloadingModule(moduleId)
        try {
            const singleMap = new Map([[moduleId, group]])
            const safe = group.title.replace(/[^a-zA-Z0-9-_ ]/g, "").trim().replace(/\s+/g, "-").toLowerCase()
            await downloadPdf(singleMap, `${safe || "modul"}-vlereesimet.pdf`)
        } finally {
            setDownloadingModule(null)
        }
    }, [downloadingModule])

    if (loading) return (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Duke ngarkuar...
        </div>
    )

    return (
        <div className="flex flex-col gap-4">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="relative sm:w-64 w-full">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Kerko modul ose student..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 h-9"
                    />
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                    {filtered.size} module · {responses.length} përgjigje
                </span>
                {filtered.size > 0 && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-9 gap-2 shrink-0 sm:ml-auto"
                        disabled={downloadingAll}
                        onClick={() => void handleDownloadAll()}
                    >
                        {downloadingAll
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Download className="h-3.5 w-3.5" />
                        }
                        Shkarko PDF
                    </Button>
                )}
            </div>

            {filtered.size === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-14 text-center">
                    <FileText className="mb-2 h-8 w-8 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">
                        {search ? "Asnjë rezultat nuk përputhet" : "Asnjë vlerësim moduli ende"}
                    </p>
                </div>
            ) : (
                <>
                    {pagedEntries.map(([moduleId, group]) => {
                        const isModuleExpanded = expandedModule === moduleId
                        const avgStars = (() => {
                            const stars = group.responses.flatMap(r =>
                                r.answers.filter(a => a.questionType === 2).map(a => parseInt(a.answerText)).filter(n => !isNaN(n))
                            )
                            if (stars.length === 0) return null
                            return (stars.reduce((s, n) => s + n, 0) / stars.length).toFixed(1)
                        })()

                        return (
                            <div key={moduleId} className="rounded-lg border border-border bg-card overflow-hidden">
                                {/* Module header */}
                                <div className="flex w-full items-center justify-between px-4 py-3.5 hover:bg-muted/20 transition-colors">
                                    <button
                                        type="button"
                                        onClick={() => setExpandedModule(isModuleExpanded ? null : moduleId)}
                                        className="flex items-center gap-3 min-w-0 flex-1 text-left"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            {group.yearGrade != null && (
                                                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", YEAR_BADGE[group.yearGrade] ?? "bg-muted text-muted-foreground")}>
                                                    V{group.yearGrade}
                                                </span>
                                            )}
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-foreground truncate">{group.title}</p>
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                    {group.responses.length} përgjigje
                                                    {avgStars != null && (
                                                        <span className="ml-2">· Mesatare yje: <strong>{avgStars}</strong>/5</span>
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                    </button>
                                    <div className="flex items-center gap-2 shrink-0 ml-3">
                                        <button
                                            type="button"
                                            disabled={downloadingModule === moduleId}
                                            onClick={(e) => { e.stopPropagation(); void handleDownloadModule(moduleId, group) }}
                                            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
                                            title="Shkarko PDF"
                                        >
                                            {downloadingModule === moduleId
                                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                : <Download className="h-3.5 w-3.5" />
                                            }
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setExpandedModule(isModuleExpanded ? null : moduleId)}
                                            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted transition-colors"
                                        >
                                            {isModuleExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>

                                {/* Responses list */}
                                {isModuleExpanded && (
                                    <div className="border-t border-border divide-y divide-border">
                                        {group.responses.map(r => {
                                            const isRespExpanded = expandedResponse === r.id
                                            const bySection = new Map<string, FeedbackAnswer[]>()
                                            for (const a of r.answers) {
                                                const sec = a.sectionTitle ?? "—"
                                                if (!bySection.has(sec)) bySection.set(sec, [])
                                                bySection.get(sec)!.push(a)
                                            }

                                            return (
                                                <div key={r.id}>
                                                    <button
                                                        type="button"
                                                        onClick={() => setExpandedResponse(isRespExpanded ? null : r.id)}
                                                        className="flex w-full items-center justify-between px-4 py-3 hover:bg-muted/10 transition-colors text-left"
                                                    >
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary uppercase">
                                                                {initials(r.studentName)}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-xs font-medium text-foreground truncate">{r.studentName ?? "—"}</p>
                                                                <p className="text-[11px] text-muted-foreground truncate">{r.studentEmail ?? ""}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3 shrink-0 ml-3">
                                                            <span className="hidden sm:block text-[11px] text-muted-foreground">
                                                                {new Date(r.submittedAt).toLocaleDateString("sq-AL", { day: "2-digit", month: "short", year: "numeric" })}
                                                            </span>
                                                            <span className="text-[10px] rounded bg-muted px-1.5 py-0.5 text-muted-foreground">{r.answers.length} përgjigje</span>
                                                            {isRespExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                                                        </div>
                                                    </button>

                                                    {isRespExpanded && (
                                                        <div className="px-4 pb-4 space-y-4 bg-muted/10">
                                                            {Array.from(bySection.entries()).map(([sectionTitle, answers]) => {
                                                                const byTopic = new Map<string, FeedbackAnswer[]>()
                                                                for (const a of answers) {
                                                                    const key = a.topicName ? `${a.topicName}${a.topicLecturer ? ` — ${a.topicLecturer}` : ""}` : "__general__"
                                                                    if (!byTopic.has(key)) byTopic.set(key, [])
                                                                    byTopic.get(key)!.push(a)
                                                                }
                                                                return (
                                                                    <div key={sectionTitle}>
                                                                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 pt-2">{sectionTitle}</p>
                                                                        {Array.from(byTopic.entries()).map(([topicKey, topicAnswers]) => (
                                                                            <div key={topicKey} className="mb-3">
                                                                                {topicKey !== "__general__" && (
                                                                                    <p className="text-[11px] font-medium text-foreground mb-1.5 flex items-center gap-1">
                                                                                        <User className="h-3 w-3 text-muted-foreground shrink-0" />
                                                                                        {topicKey}
                                                                                    </p>
                                                                                )}
                                                                                <div className="rounded-md border border-border bg-background divide-y divide-border">
                                                                                    {topicAnswers.map((a, i) => (
                                                                                        <div key={i} className="flex items-start justify-between gap-3 px-3 py-2">
                                                                                            <p className="text-[11px] text-muted-foreground flex-1">{a.questionText ?? "—"}</p>
                                                                                            <div className="shrink-0 text-right">
                                                                                                {a.questionType === 2 && !isNaN(parseInt(a.answerText)) ? (
                                                                                                    <StarRow value={parseInt(a.answerText)} />
                                                                                                ) : (
                                                                                                    <p className="text-xs text-foreground">{a.answerText || "—"}</p>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )
                                                            })}
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
                    <PaginationBar
                        totalItems={filteredEntries.length}
                        pageSize={pageSize}
                        currentPage={page}
                        onPageChange={setPage}
                        onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
                    />
                </>
            )}
        </div>
    )
}
