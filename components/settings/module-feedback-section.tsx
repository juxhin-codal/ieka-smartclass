"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { fetchApi } from "@/lib/api-client"
import type { ModuleFeedbackTemplateResponse } from "@/lib/data"
import { ClipboardList, Pencil, Plus, Trash2, X, Loader2, Mail, Check, Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type QuestionDraft = { text: string; type: number; order: number }
type SectionDraft = {
    title: string; order: number; repeatsPerTopic: boolean;
    ratingLabelLow: string; ratingLabelHigh: string; questions: QuestionDraft[]
}

function emptyQuestion(order: number): QuestionDraft {
    return { text: "", type: 2, order }
}

export function ModuleFeedbackSection() {
    const [template, setTemplate] = useState<ModuleFeedbackTemplateResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")

    // editingSectionIndex: which section pencil was clicked (null = modal closed)
    const [editingSectionIndex, setEditingSectionIndex] = useState<number | null>(null)
    const [sections, setSections] = useState<SectionDraft[]>([])
    const [saving, setSaving] = useState(false)
    const [formError, setFormError] = useState("")
    const [togglingId, setTogglingId] = useState<string | null>(null)
    const questionsListRef = useRef<HTMLDivElement>(null)
    const [newlyAddedQIndex, setNewlyAddedQIndex] = useState<number | null>(null)

    // 48h reminder config
    const [reminderEnabled, setReminderEnabled] = useState(false)
    const [reminderToggling, setReminderToggling] = useState(false)

    const loadTemplate = useCallback(async () => {
        try {
            const data = (await fetchApi("/ModuleFeedback/template")) as ModuleFeedbackTemplateResponse
            setTemplate(data)
            setError("")
        } catch {
            setTemplate(null)
        } finally {
            setLoading(false)
        }
    }, [])

    const loadReminderConfig = useCallback(async () => {
        try {
            const res = await fetchApi("/Configurations/ModuleFeedbackReminderEnabled") as { key: string; value: string } | null
            setReminderEnabled(res?.value?.toLowerCase() === "true")
        } catch {
            setReminderEnabled(false)
        }
    }, [])

    useEffect(() => {
        void loadTemplate()
        void loadReminderConfig()
    }, [loadTemplate, loadReminderConfig])

    function openEdit(sectionIndex: number) {
        if (!template) return
        setSections(
            template.sections.map((s) => ({
                title: s.title,
                order: s.order,
                repeatsPerTopic: s.repeatsPerTopic,
                ratingLabelLow: s.ratingLabelLow ?? "",
                ratingLabelHigh: s.ratingLabelHigh ?? "",
                questions: s.questions.map((q) => ({ text: q.text, type: q.type, order: q.order })),
            }))
        )
        setFormError("")
        setEditingSectionIndex(sectionIndex)
    }

    function closeModal() {
        setEditingSectionIndex(null)
        setFormError("")
    }

    // Toggle repeatsPerTopic for a section directly from the preview card
    async function toggleAutoSend(sectionId: string, newValue: boolean) {
        if (!template || togglingId) return
        const prev = template
        setTemplate({
            ...template,
            sections: template.sections.map(s =>
                s.id === sectionId ? { ...s, repeatsPerTopic: newValue } : s
            ),
        })
        setTogglingId(sectionId)
        try {
            await fetchApi(`/ModuleFeedback/sections/${sectionId}/auto-send`, {
                method: "PATCH",
                body: JSON.stringify({ repeatsPerTopic: newValue }),
            })
        } catch {
            setTemplate(prev)
            setError("Ndryshimi nuk u ruajt.")
        } finally {
            setTogglingId(null)
        }
    }

    async function handleSave() {
        if (!template || editingSectionIndex === null) return
        const section = sections[editingSectionIndex]
        if (!section) return
        if (section.questions.some((q) => !q.text.trim())) {
            setFormError("Çdo pyetje duhet të ketë tekst.")
            return
        }

        setSaving(true)
        setFormError("")
        try {
            await fetchApi("/ModuleFeedback/template", {
                method: "PUT",
                body: JSON.stringify({
                    title: template.title,
                    sections: sections.map((s, si) => ({
                        title: s.title.trim(),
                        order: si,
                        repeatsPerTopic: s.repeatsPerTopic,
                        ratingLabelLow: s.ratingLabelLow.trim() || null,
                        ratingLabelHigh: s.ratingLabelHigh.trim() || null,
                        questions: s.questions.map((q, qi) => ({
                            text: q.text.trim(),
                            type: q.type,
                            order: qi,
                        })),
                    })),
                }),
            })
            closeModal()
            await loadTemplate()
        } catch (e: any) {
            setFormError(e?.message ?? "Ruajtja dështoi.")
        } finally {
            setSaving(false)
        }
    }

    function updateSection(patch: Partial<SectionDraft>) {
        if (editingSectionIndex === null) return
        setSections((prev) => prev.map((s, i) => (i === editingSectionIndex ? { ...s, ...patch } : s)))
    }

    function updateQuestion(qIndex: number, patch: Partial<QuestionDraft>) {
        if (editingSectionIndex === null) return
        setSections((prev) =>
            prev.map((s, si) =>
                si === editingSectionIndex
                    ? { ...s, questions: s.questions.map((q, qi) => (qi === qIndex ? { ...q, ...patch } : q)) }
                    : s
            )
        )
    }

    function removeQuestion(qIndex: number) {
        if (editingSectionIndex === null) return
        setSections((prev) =>
            prev.map((s, si) =>
                si === editingSectionIndex ? { ...s, questions: s.questions.filter((_, qi) => qi !== qIndex) } : s
            )
        )
    }

    function addQuestion() {
        if (editingSectionIndex === null) return
        setSections((prev) => {
            const updated = prev.map((s, si) =>
                si === editingSectionIndex ? { ...s, questions: [...s.questions, emptyQuestion(s.questions.length)] } : s
            )
            const newIndex = updated[editingSectionIndex].questions.length - 1
            setNewlyAddedQIndex(newIndex)
            setTimeout(() => setNewlyAddedQIndex(null), 1500)
            setTimeout(() => {
                questionsListRef.current?.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "nearest" })
            }, 50)
            return updated
        })
    }

    async function toggleReminder(newValue: boolean) {
        if (reminderToggling) return
        setReminderEnabled(newValue)
        setReminderToggling(true)
        try {
            await fetchApi("/Configurations", {
                method: "POST",
                body: JSON.stringify({
                    key: "ModuleFeedbackReminderEnabled",
                    value: newValue ? "true" : "false",
                    description: "Dërgo kujtesë 48h studentëve që nuk kanë plotësuar vlerësimin e lektorit",
                }),
            })
        } catch {
            setReminderEnabled(!newValue)
        } finally {
            setReminderToggling(false)
        }
    }

    const totalQuestions = template?.sections.reduce((sum, s) => sum + s.questions.length, 0) ?? 0
    const isModalOpen = editingSectionIndex !== null
    const editingSection = isModalOpen ? sections[editingSectionIndex] : null

    // Lock body scroll when modal is open
    useEffect(() => {
        if (isModalOpen) {
            document.body.style.overflow = "hidden"
            return () => { document.body.style.overflow = "" }
        }
    }, [isModalOpen])

    const editModal = isModalOpen && editingSection ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm">
            <div className="flex w-full max-w-2xl flex-col mx-4 max-h-[90vh] rounded-2xl border border-border bg-card shadow-xl">
                {/* Modal header */}
                <div className="flex items-center justify-between border-b border-border px-6 py-4 shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                            <Pencil className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Ndrysho seksionin</p>
                            <h2 className="text-sm font-semibold text-foreground truncate">{editingSection.title}</h2>
                        </div>
                    </div>
                    <button onClick={closeModal} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Modal body — only this section */}
                <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-4">
                    <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">Titulli i seksionit</label>
                        <Input
                            value={editingSection.title}
                            onChange={(e) => updateSection({ title: e.target.value })}
                            className="text-sm"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Etiketa e ulët</label>
                            <select
                                value={editingSection.ratingLabelLow}
                                onChange={(e) => updateSection({ ratingLabelLow: e.target.value })}
                                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                            >
                                <option value="">— Zgjidh —</option>
                                <option value="Shumë keq">Shumë keq</option>
                                <option value="Keq">Keq</option>
                                <option value="Dobët">Dobët</option>
                                <option value="Aspak">Aspak</option>
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Etiketa e lartë</label>
                            <select
                                value={editingSection.ratingLabelHigh}
                                onChange={(e) => updateSection({ ratingLabelHigh: e.target.value })}
                                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                            >
                                <option value="">— Zgjidh —</option>
                                <option value="Shumë mirë">Shumë mirë</option>
                                <option value="Mirë">Mirë</option>
                                <option value="Shkëlqyeshëm">Shkëlqyeshëm</option>
                                <option value="Plotësisht">Plotësisht</option>
                            </select>
                        </div>
                    </div>

                    <label className="flex cursor-pointer items-center gap-2 text-xs">
                        <input
                            type="checkbox"
                            checked={editingSection.repeatsPerTopic}
                            onChange={(e) => updateSection({ repeatsPerTopic: e.target.checked })}
                            className="rounded"
                        />
                        <span className="text-muted-foreground">Dërgo Email automatikisht në 19:00 (↺ Për çdo temë)</span>
                    </label>

                    {/* Questions */}
                    <div className="border-t border-border pt-4">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-semibold text-foreground">Pyetjet</p>
                            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => addQuestion()}>
                                <Plus className="h-3.5 w-3.5" /> Shto pyetje
                            </Button>
                        </div>
                        <div ref={questionsListRef} className="space-y-2">
                            {editingSection.questions.map((q, qi) => (
                                <div
                                    key={qi}
                                    className={cn(
                                        "flex items-start gap-2.5 rounded-lg border bg-background p-2.5 transition-all duration-300",
                                        newlyAddedQIndex === qi
                                            ? "border-primary/60 bg-primary/5 ring-2 ring-primary/20"
                                            : "border-border"
                                    )}
                                >
                                    <span className="mt-2.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                                        {qi + 1}
                                    </span>
                                    <div className="flex-1 space-y-1.5">
                                        <Input
                                            value={q.text}
                                            onChange={(e) => updateQuestion(qi, { text: e.target.value })}
                                            placeholder="Teksti i pyetjes..."
                                            className="text-sm"
                                        />
                                        <div className="flex items-center gap-2">
                                            <select
                                                value={q.type}
                                                onChange={(e) => updateQuestion(qi, { type: Number(e.target.value) })}
                                                className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground"
                                            >
                                                <option value={1}>Tekst i lirë</option>
                                                <option value={2}>Yje (1–5)</option>
                                            </select>
                                            {editingSection.questions.length > 1 && (
                                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => removeQuestion(qi)}>
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {formError && <p className="text-xs text-destructive">{formError}</p>}
                </div>

                <div className="flex justify-end gap-2 border-t border-border px-6 py-4 shrink-0">
                    <Button variant="outline" size="sm" onClick={closeModal}>Anulo</Button>
                    <Button size="sm" onClick={() => void handleSave()} disabled={saving}>
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                        Ruaj Ndryshimet
                    </Button>
                </div>
            </div>
        </div>
    ) : null

    return (
        <>
            <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                        <ClipboardList className="h-4 w-4 text-primary" />
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Formulari i Pyetjeve</h3>
                    </div>
                    {template && !loading && (
                        <span className="text-[11px] text-muted-foreground">{totalQuestions} pyetje gjithsej</span>
                    )}
                </div>

                {error && <p className="text-xs text-destructive mb-2">{error}</p>}

                {loading ? (
                    <div className="flex items-center justify-center py-6">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                ) : !template ? (
                    <p className="text-sm text-muted-foreground py-4">Formulari nuk u gjet.</p>
                ) : (
                    <div className="rounded-lg border border-border overflow-hidden">
                        {/* Section rows — each with toggle + pencil, no global title row */}
                        <div className="divide-y divide-border">
                            {template.sections.map((s, si) => (
                                <div key={s.id} className="px-3 py-3 space-y-2">
                                    {/* Row 1: title + badge + question count + pencil */}
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <div className="h-2 w-2 rounded-full bg-primary/60 shrink-0" />
                                            <p className="text-xs font-semibold text-foreground truncate">{s.title}</p>
                                            {s.repeatsPerTopic && (
                                                <span className="shrink-0 rounded-full bg-blue-500/10 text-blue-600 px-2 py-0.5 text-[10px] font-medium">
                                                    ↺ Për çdo temë
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="text-[11px] text-muted-foreground">{s.questions.length} pyetje</span>
                                            <button
                                                type="button"
                                                onClick={() => openEdit(si)}
                                                title="Ndrysho seksionin"
                                                className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Row 2: auto-send toggle */}
                                    <div className="flex items-center justify-between gap-3 rounded-md bg-muted/30 px-2.5 py-1.5">
                                        <div className="flex items-center gap-2">
                                            <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                                            <span className="text-[11px] text-muted-foreground">Dërgo Email Vlerësimi në 19:00</span>
                                        </div>
                                        <button
                                            type="button"
                                            disabled={togglingId === s.id}
                                            onClick={() => void toggleAutoSend(s.id, !s.repeatsPerTopic)}
                                            className={cn(
                                                "relative flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
                                                s.repeatsPerTopic ? "bg-primary" : "bg-muted-foreground/30",
                                                togglingId === s.id && "opacity-60 cursor-not-allowed"
                                            )}
                                        >
                                            <span className={cn(
                                                "flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white shadow transition-transform",
                                                s.repeatsPerTopic ? "translate-x-4" : "translate-x-0.5"
                                            )}>
                                                {s.repeatsPerTopic && <Check className="h-2 w-2 text-primary" />}
                                            </span>
                                        </button>
                                    </div>

                                    {/* Row 3 (lecturer section only): 48h reminder toggle */}
                                    {s.repeatsPerTopic && (
                                        <div className="flex items-center justify-between gap-3 rounded-md bg-violet-500/5 border border-violet-500/15 px-2.5 py-1.5">
                                            <div className="flex items-center gap-2">
                                                <Bell className="h-3 w-3 text-violet-500 shrink-0" />
                                                <span className="text-[11px] text-muted-foreground">Kujtesë 48h – studentët pa përgjigje</span>
                                            </div>
                                            <button
                                                type="button"
                                                disabled={reminderToggling || !s.repeatsPerTopic}
                                                onClick={() => void toggleReminder(!reminderEnabled)}
                                                className={cn(
                                                    "relative flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
                                                    reminderEnabled ? "bg-violet-500" : "bg-muted-foreground/30",
                                                    (reminderToggling || !s.repeatsPerTopic) && "opacity-60 cursor-not-allowed"
                                                )}
                                            >
                                                <span className={cn(
                                                    "flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white shadow transition-transform",
                                                    reminderEnabled ? "translate-x-4" : "translate-x-0.5"
                                                )}>
                                                    {reminderEnabled && <Check className="h-2 w-2 text-violet-500" />}
                                                </span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Footer summary */}
                        <div className="flex items-center gap-3 border-t border-border bg-muted/10 px-3 py-2 text-[11px] text-muted-foreground">
                            <span>{template.sections.length} seksione</span>
                            <span>·</span>
                            <span>{totalQuestions} pyetje gjithsej</span>
                            <span>·</span>
                            <span>{template.sections.filter(s => s.repeatsPerTopic).length} automatike</span>
                        </div>
                    </div>
                )}
            </div>
            {editModal}
        </>
    )
}
