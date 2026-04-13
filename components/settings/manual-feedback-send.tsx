"use client"

import { useState, useEffect, useRef } from "react"
import { fetchApi } from "@/lib/api-client"
import { Send, Check, Loader2, X, CheckSquare, Square, ChevronsUpDown, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface FeedbackSection {
    id: string
    title: string
}

interface ModuleOption {
    id: string
    title: string
    subtitle?: string
}

export function ManualFeedbackSendSection() {
    const [targetRole, setTargetRole] = useState<"Member" | "Student">("Student")

    // Module dropdown
    const [moduleOptions, setModuleOptions] = useState<ModuleOption[]>([])
    const [moduleOptionsLoading, setModuleOptionsLoading] = useState(false)
    const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null)
    const [moduleSearch, setModuleSearch] = useState("")
    const [moduleDropdownOpen, setModuleDropdownOpen] = useState(false)
    const moduleDropdownRef = useRef<HTMLDivElement>(null)

    const [sections, setSections] = useState<FeedbackSection[]>([])
    const [selectedSectionIds, setSelectedSectionIds] = useState<Set<string>>(new Set())
    const [sectionsLoading, setSectionsLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const [sendResult, setSendResult] = useState<{ emailsSent: number; recipientsReached: number } | null>(null)
    const [error, setError] = useState("")

    // Load sections once
    useEffect(() => {
        let cancelled = false
        setSectionsLoading(true)
        fetchApi("/ModuleFeedback/sections")
            .then((data) => { if (!cancelled) setSections((data as FeedbackSection[]) ?? []) })
            .catch(() => { })
            .finally(() => { if (!cancelled) setSectionsLoading(false) })
        return () => { cancelled = true }
    }, [])

    // Load module options whenever targetRole changes
    useEffect(() => {
        let cancelled = false
        setSelectedModuleId(null)
        setModuleSearch("")
        setModuleOptions([])
        setModuleOptionsLoading(true)

        const endpoint = targetRole === "Student"
            ? "/StudentModules"
            : "/Events?pageNumber=1&pageSize=200"

        fetchApi(endpoint)
            .then((data: any) => {
                if (cancelled) return
                if (targetRole === "Student") {
                    const modules = (Array.isArray(data) ? data : []) as { id: string; title: string; yearGrade: number }[]
                    setModuleOptions(modules.map(m => ({
                        id: m.id,
                        title: m.title,
                        subtitle: `Viti ${m.yearGrade}`,
                    })))
                } else {
                    const items = (data?.items ?? (Array.isArray(data) ? data : [])) as { id: string; name: string }[]
                    setModuleOptions(items.map(e => ({ id: e.id, title: e.name })))
                }
            })
            .catch(() => { if (!cancelled) setModuleOptions([]) })
            .finally(() => { if (!cancelled) setModuleOptionsLoading(false) })

        return () => { cancelled = true }
    }, [targetRole])

    // Close dropdown on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (moduleDropdownRef.current && !moduleDropdownRef.current.contains(e.target as Node)) {
                setModuleDropdownOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClick)
        return () => document.removeEventListener("mousedown", handleClick)
    }, [])

    function toggleSection(id: string) {
        setSelectedSectionIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const selectedModule = moduleOptions.find(m => m.id === selectedModuleId) ?? null
    const filteredModules = moduleOptions.filter(m =>
        m.title.toLowerCase().includes(moduleSearch.toLowerCase())
    )

    const canSend = selectedSectionIds.size > 0

    async function handleSend() {
        if (selectedSectionIds.size === 0) { setError("Zgjidhni të paktën një seksion."); return }

        setSending(true)
        setError("")
        setSendResult(null)
        try {
            const result = (await fetchApi("/ModuleFeedback/send-lecturer-manual", {
                method: "POST",
                body: JSON.stringify({
                    targetRole,
                    yearGrades: null,
                    additionalSectionIds: Array.from(selectedSectionIds),
                    targetModuleId: selectedModuleId ?? null,
                }),
            })) as { emailsSent: number; recipientsReached: number; sentAt: string }
            setSendResult({ emailsSent: result.emailsSent, recipientsReached: result.recipientsReached })
        } catch (e: any) {
            setError(e?.message ?? "Dërgimi dështoi.")
        } finally {
            setSending(false)
        }
    }

    return (
        <div>
            {/* Header */}
            <div className="flex items-center gap-2 mb-5">
                <Send className="h-4 w-4 text-primary" />
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dërgo Email Vlerësimi</h3>
            </div>

            {/* Info note */}
            <div className="mb-4 rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-[11px] text-muted-foreground leading-relaxed">
                Dërgon email vlerësimi te pjesëmarrësit që kanë ndenjur në seanca por nuk kanë marrë ende email. Zgjidhni modulin dhe seksionet që dëshironi të përfshini.
            </div>

            <div className="space-y-4">
                {/* Row: Dërgo te + Module selector side by side */}
                <div className="flex items-end gap-3">
                    {/* Dërgo te */}
                    <div className="shrink-0">
                        <label className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-muted text-[10px] font-bold">1</span>
                            Dërgo te
                        </label>
                        <div className="flex h-9 overflow-hidden rounded-lg border border-border w-fit">
                            {(["Member", "Student"] as const).map((role, i) => (
                                <button
                                    key={role}
                                    type="button"
                                    onClick={() => { setTargetRole(role); setError("") }}
                                    className={cn(
                                        "px-4 text-xs font-medium transition-colors whitespace-nowrap",
                                        i > 0 && "border-l border-border",
                                        targetRole === role
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                                    )}
                                >
                                    {role === "Member" ? "Anëtarë" : "Studentë"}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Module / Activity dropdown */}
                    <div className="flex-1 min-w-0">
                        <label className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-muted text-[10px] font-bold">2</span>
                            {targetRole === "Student" ? "Moduli" : "Aktiviteti"}
                            <span className="text-[10px] font-normal">(opsionale)</span>
                        </label>
                        <div ref={moduleDropdownRef} className="relative">
                            <button
                                type="button"
                                onClick={() => setModuleDropdownOpen(v => !v)}
                                disabled={moduleOptionsLoading}
                                className={cn(
                                    "flex h-9 w-full items-center justify-between gap-2 rounded-lg border px-3 text-xs transition-colors",
                                    selectedModuleId
                                        ? "border-primary/40 bg-primary/5 text-foreground"
                                        : "border-border bg-card text-muted-foreground hover:border-foreground/20 hover:text-foreground"
                                )}
                            >
                                <span className="truncate">
                                    {moduleOptionsLoading
                                        ? "Duke ngarkuar..."
                                        : selectedModule
                                            ? selectedModule.title
                                            : targetRole === "Student" ? "Të gjitha modulet..." : "Të gjitha aktivitetet..."
                                    }
                                </span>
                                <div className="flex items-center gap-1 shrink-0">
                                    {selectedModuleId && (
                                        <span
                                            role="button"
                                            tabIndex={0}
                                            onClick={(e) => { e.stopPropagation(); setSelectedModuleId(null); setModuleSearch(""); setError("") }}
                                            onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setSelectedModuleId(null) } }}
                                            className="rounded p-0.5 hover:bg-muted"
                                        >
                                            <X className="h-3 w-3 text-muted-foreground" />
                                        </span>
                                    )}
                                    <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                                </div>
                            </button>

                            {moduleDropdownOpen && !moduleOptionsLoading && (
                                <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-border bg-card shadow-lg">
                                    <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                                        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                        <input
                                            autoFocus
                                            type="text"
                                            value={moduleSearch}
                                            onChange={(e) => setModuleSearch(e.target.value)}
                                            placeholder="Kërko..."
                                            className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                                        />
                                        {moduleSearch && (
                                            <button type="button" onClick={() => setModuleSearch("")} className="shrink-0 text-muted-foreground hover:text-foreground">
                                                <X className="h-3 w-3" />
                                            </button>
                                        )}
                                    </div>
                                    <div className="max-h-48 overflow-y-auto p-1">
                                        {filteredModules.length === 0 ? (
                                            <p className="px-3 py-2 text-xs text-muted-foreground">Nuk u gjet asnjë.</p>
                                        ) : (
                                            filteredModules.map(opt => (
                                                <button
                                                    key={opt.id}
                                                    type="button"
                                                    onClick={() => { setSelectedModuleId(opt.id); setModuleDropdownOpen(false); setModuleSearch(""); setError("") }}
                                                    className={cn(
                                                        "flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-xs transition-colors hover:bg-muted",
                                                        selectedModuleId === opt.id && "bg-primary/5 text-primary"
                                                    )}
                                                >
                                                    <span className="truncate font-medium">{opt.title}</span>
                                                    {opt.subtitle && (
                                                        <span className="shrink-0 text-[10px] text-muted-foreground">{opt.subtitle}</span>
                                                    )}
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Step 3: Sections */}
                {!sectionsLoading && sections.length > 0 && (
                    <div>
                        <label className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-muted text-[10px] font-bold">3</span>
                            Seksione në email
                        </label>
                        <div className="grid grid-cols-2 gap-1.5">
                            {sections.map(section => {
                                const checked = selectedSectionIds.has(section.id)
                                const isLektore = section.title.toUpperCase().includes("LEKTOR")
                                return (
                                    <button
                                        key={section.id}
                                        type="button"
                                        onClick={() => toggleSection(section.id)}
                                        className={cn(
                                            "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-xs transition-all",
                                            isLektore && "col-span-2",
                                            checked
                                                ? "border-primary/40 bg-primary/5 text-foreground"
                                                : "border-border bg-card text-muted-foreground hover:border-foreground/20 hover:text-foreground"
                                        )}
                                    >
                                        {checked
                                            ? <CheckSquare className="h-3.5 w-3.5 shrink-0 text-primary" />
                                            : <Square className="h-3.5 w-3.5 shrink-0" />
                                        }
                                        <span className="font-medium">{section.title}</span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                        <X className="h-3.5 w-3.5 shrink-0" />
                        {error}
                    </div>
                )}

                {/* Send button */}
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                        <Button
                            size="sm"
                            className="h-9 gap-2 px-5"
                            disabled={sending || !canSend}
                            onClick={() => void handleSend()}
                        >
                            {sending
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Send className="h-3.5 w-3.5" />
                            }
                            {sending ? "Duke dërguar..." : "Dërgo"}
                        </Button>
                    </div>

                    {/* Result banner — below button */}
                    {sendResult && (
                        sendResult.emailsSent === 0 ? (
                            <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-amber-700">Asnjë email nuk u dërgua</p>
                                    <p className="text-xs text-amber-600 mt-0.5">Të gjithë pjesëmarrësit me seksionet e zgjedhura e kanë marrë tashmë emailin e vlerësimit.</p>
                                </div>
                                <button type="button" onClick={() => setSendResult(null)} className="shrink-0 text-amber-500 hover:text-amber-700">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-start gap-3 rounded-lg border border-green-500/20 bg-green-500/10 p-3">
                                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-500/20">
                                    <Check className="h-3.5 w-3.5 text-green-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-green-700">Dërguar me sukses</p>
                                    <p className="text-xs text-green-600 mt-0.5">
                                        <strong>{sendResult.emailsSent}</strong> email{sendResult.emailsSent !== 1 ? "e" : ""} dërguar te <strong>{sendResult.recipientsReached}</strong> person{sendResult.recipientsReached !== 1 ? "a" : ""}.
                                    </p>
                                </div>
                                <button type="button" onClick={() => setSendResult(null)} className="shrink-0 text-green-500 hover:text-green-700">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    )
}

