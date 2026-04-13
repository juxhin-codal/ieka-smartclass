"use client"

/**
 * SettingsView — Notification preferences, data management, and future integrations.
 * Covers Section 9 (communication channels), Section 10 (data protection),
 * and Section 12 (future expansion placeholders).
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { useI18n } from "@/lib/i18n"
import { API_BASE_URL, fetchApi, fetchWithAuth } from "@/lib/api-client"
import type { NotificationPreferences, EvaluationListItem, EvaluationDetail, EvaluationResponseItem } from "@/lib/data"
import { ModuleFeedbackSection } from "@/components/settings/module-feedback-section"
import { ManualFeedbackSendSection } from "@/components/settings/manual-feedback-send"
import {
    Bell, Mail, Shield, Globe,
    Link2, Lock, Database, ChevronRight, Check, LogOut,
    ClipboardList, Plus, Pencil, Trash2, Send, Eye, X, Loader2, Star, GripVertical
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

interface ToggleRowProps {
    icon: typeof Bell
    label: string
    description: string
    value: boolean
    onChange: (v: boolean) => void
    color?: string
    disabled?: boolean
}

function ToggleRow({ icon: Icon, label, description, value, onChange, color = "text-primary", disabled }: ToggleRowProps) {
    return (
        <div className={`flex items-center justify-between gap-4 py-3 border-b border-border last:border-0 ${disabled ? 'opacity-70' : ''}`}>
            <div className="flex items-start gap-3">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted ${color}`}>
                    <Icon className="h-4 w-4" />
                </div>
                <div>
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground">{description}</p>
                </div>
            </div>
            <button
                disabled={disabled}
                onClick={() => onChange(!value)}
                className={`relative flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${value ? "bg-primary" : "bg-muted-foreground/30"
                    } ${disabled ? 'cursor-not-allowed opacity-70' : ''}`}
            >
                <span className={`flex h-4 w-4 items-center justify-center rounded-full bg-white shadow transition-transform ${value ? "translate-x-6" : "translate-x-1"
                    }`}>
                    {value && <Check className="h-2.5 w-2.5 text-primary" />}
                </span>
            </button>
        </div>
    )
}

function FutureCard({ icon: Icon, title, desc, color }: {
    icon: typeof Bell; title: string; desc: string; color: string
}) {
    return (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4">
            <div className="flex items-start gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${color}`}>
                    <Icon className="h-4.5 w-4.5" />
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-medium text-foreground">{title}</p>
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">Së shpejti</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
            </div>
        </div>
    )
}

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
    notifyByEmail: true,
    notifyBySms: false,
    notifyBookingOpen: true,
    notifySessionReminder: true,
    notifySurveyReminder: true,
    notifyCpdDeadline: true,
}

export function SettingsView() {
    const { user } = useAuth()
    const { lang } = useI18n()
    const isAdmin = user?.role === "Admin"
    const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES)
    const [prefsLoading, setPrefsLoading] = useState(true)
    const [prefsSaving, setPrefsSaving] = useState(false)
    const [prefsError, setPrefsError] = useState("")
    const [exportingData, setExportingData] = useState(false)
    const [exportError, setExportError] = useState("")

    // Reservation auto-cancel toggle (admin only)
    const [reservationAutoCancelEnabled, setReservationAutoCancelEnabled] = useState(false)
    const [reservationConfigLoading, setReservationConfigLoading] = useState(true)
    const [reservationConfigSaving, setReservationConfigSaving] = useState(false)

    useEffect(() => {
        let cancelled = false

        async function loadPreferences() {
            setPrefsLoading(true)
            try {
                const raw = await fetchApi("/Notifications/preferences") as Record<string, unknown>
                // API returns PascalCase keys; map to camelCase interface
                const response: NotificationPreferences = {
                    notifyByEmail: Boolean(raw.NotifyByEmail ?? raw.notifyByEmail),
                    notifyBySms: Boolean(raw.NotifyBySms ?? raw.notifyBySms),
                    notifyBookingOpen: Boolean(raw.NotifyBookingOpen ?? raw.notifyBookingOpen),
                    notifySessionReminder: Boolean(raw.NotifySessionReminder ?? raw.notifySessionReminder),
                    notifySurveyReminder: Boolean(raw.NotifySurveyReminder ?? raw.notifySurveyReminder),
                    notifyCpdDeadline: Boolean(raw.NotifyCpdDeadline ?? raw.notifyCpdDeadline),
                }
                if (!cancelled) {
                    setPreferences(response)
                    setPrefsError("")
                }
            } catch (e: any) {
                if (!cancelled) {
                    if (e?.status === 404) {
                        setPreferences(DEFAULT_NOTIFICATION_PREFERENCES)
                        setPrefsError("")
                    } else {
                        setPrefsError(e?.message ?? "Nuk u ngarkuan preferencat e njoftimeve.")
                    }
                }
            } finally {
                if (!cancelled) {
                    setPrefsLoading(false)
                }
            }
        }

        void loadPreferences()

        return () => {
            cancelled = true
        }
    }, [])

    // Load reservation auto-cancel config (admin only)
    useEffect(() => {
        if (!isAdmin) { setReservationConfigLoading(false); return }
        let cancelled = false
        async function loadConfig() {
            try {
                const res = (await fetchApi("/Configurations/ReservationAutoCancelEnabled")) as { key: string; value: string }
                if (!cancelled) setReservationAutoCancelEnabled(res.value?.toLowerCase() === "true")
            } catch {
                if (!cancelled) setReservationAutoCancelEnabled(false)
            } finally {
                if (!cancelled) setReservationConfigLoading(false)
            }
        }
        void loadConfig()
        return () => { cancelled = true }
    }, [isAdmin])

    async function toggleReservationAutoCancel(value: boolean) {
        const prev = reservationAutoCancelEnabled
        setReservationAutoCancelEnabled(value)
        setReservationConfigSaving(true)
        try {
            await fetchApi("/Configurations", {
                method: "POST",
                body: JSON.stringify({
                    key: "ReservationAutoCancelEnabled",
                    value: value ? "true" : "false",
                    description: "Aktivizo/çaktivizo anulimin automatik të rezervimeve të dyfishta"
                })
            })
        } catch {
            setReservationAutoCancelEnabled(prev)
        } finally {
            setReservationConfigSaving(false)
        }
    }

    async function savePreferences(nextPreferences: NotificationPreferences) {
        const previous = preferences
        setPreferences(nextPreferences)
        setPrefsSaving(true)
        setPrefsError("")

        try {
            await fetchApi("/Notifications/preferences", {
                method: "PUT",
                body: JSON.stringify(nextPreferences),
            })
        } catch (e: any) {
            setPreferences(previous)
            if (e?.status === 404) {
                setPrefsError("Preferencat e njoftimeve nuk janë aktive ende në server.")
            } else {
                setPrefsError(e?.message ?? "Ruajtja e preferencave dështoi.")
            }
        } finally {
            setPrefsSaving(false)
        }
    }

    function updatePreference<K extends keyof NotificationPreferences>(key: K, value: NotificationPreferences[K]) {
        void savePreferences({
            ...preferences,
            [key]: value,
        })
    }

    function resolveExportFilename(contentDisposition: string | null) {
        if (!contentDisposition) {
            return `ieka-te-dhenat-e-mia-${new Date().toISOString().replace(/[:.]/g, "-")}.pdf`
        }

        const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)
        if (utf8Match?.[1]) {
            return decodeURIComponent(utf8Match[1])
        }

        const basicMatch = contentDisposition.match(/filename="?([^";]+)"?/i)
        if (basicMatch?.[1]) {
            return basicMatch[1]
        }

        return `ieka-te-dhenat-e-mia-${new Date().toISOString().replace(/[:.]/g, "-")}.pdf`
    }

    async function handleDownloadMyData() {
        setExportingData(true)
        setExportError("")

        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/Profile/export`, { method: "GET" })
            if (!response.ok) {
                let message = lang === "sq" ? "Shkarkimi i të dhënave dështoi." : "Failed to download your data."
                try {
                    const payload = await response.clone().json()
                    message = payload?.detail || payload?.message || payload?.title || message
                } catch {
                    try {
                        const text = (await response.text()).trim()
                        if (text) {
                            message = text
                        }
                    } catch {
                        // keep fallback message
                    }
                }

                throw new Error(message)
            }

            const blob = await response.blob()
            const objectUrl = URL.createObjectURL(blob)
            const link = document.createElement("a")
            link.href = objectUrl
            link.download = resolveExportFilename(response.headers.get("content-disposition"))
            document.body.appendChild(link)
            link.click()
            link.remove()
            URL.revokeObjectURL(objectUrl)
        } catch (e: any) {
            setExportError(e?.message ?? (lang === "sq" ? "Shkarkimi i të dhënave dështoi." : "Failed to download your data."))
        } finally {
            setExportingData(false)
        }
    }

    const togglesDisabled = prefsLoading || prefsSaving

    return (
        <div className="mx-auto max-w-3xl px-4 py-6 lg:px-8">
            <div className="mb-6">
                <h1 className="text-xl font-semibold text-foreground">
                    {lang === "sq" ? "Cilësimet" : "Settings"}
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    {lang === "sq" ? "Menaxho preferentat e njoftimeve, sigurinë, dhe llogarinë" : "Manage notification preferences, security, and account"}
                </p>
            </div>

            {/* Section: Communication Channels */}
            <div className="rounded-xl border border-border bg-card p-5 mb-4">
                <div className="flex items-center gap-2 mb-4">
                    <Bell className="h-4.5 w-4.5 text-primary" />
                    <h2 className="text-sm font-semibold text-foreground">
                        {lang === "sq" ? "Kanalet e Komunikimit" : "Communication Channels"}
                    </h2>
                </div>
                <ToggleRow
                    icon={Mail}
                    label={lang === "sq" ? "Njoftimet me Email" : "Email Notifications"}
                    description={user?.email ? `→ ${user.email}` : (lang === "sq" ? "Email i llogarisë" : "Account email")}
                    value={preferences.notifyByEmail}
                    onChange={(value) => updatePreference("notifyByEmail", value)}
                    color="text-purple-500"
                    disabled={togglesDisabled}
                />
                {prefsError && <p className="pt-3 text-sm text-destructive">{prefsError}</p>}
            </div>

            {/* Section: Notification Types */}
            <div className="rounded-xl border border-border bg-card p-5 mb-4">
                <div className="flex items-center gap-2 mb-4">
                    <Bell className="h-4.5 w-4.5 text-primary" />
                    <h2 className="text-sm font-semibold text-foreground">
                        {lang === "sq" ? "Llojet e Njoftimeve" : "Notification Types"}
                    </h2>
                </div>
                <ToggleRow
                    icon={Bell}
                    label={lang === "sq" ? "Hapja e Rezervimeve" : "Booking Opening"}
                    description={lang === "sq" ? "Njoftohuni kur hapet regjistrim për modul të ri" : "Get notified when registration opens for new modules"}
                    value={preferences.notifyBookingOpen}
                    onChange={(value) => updatePreference("notifyBookingOpen", value)}
                    color="text-blue-500"
                    disabled={togglesDisabled}
                />
                <ToggleRow
                    icon={Bell}
                    label={lang === "sq" ? "Kujtues para Sesionit" : "Session Reminder"}
                    description={lang === "sq" ? "24 orë para fillimit të sesionit" : "24 hours before session starts"}
                    value={preferences.notifySessionReminder}
                    onChange={(value) => updatePreference("notifySessionReminder", value)}
                    color="text-amber-500"
                    disabled={togglesDisabled}
                />
                <ToggleRow
                    icon={Bell}
                    label={lang === "sq" ? "Kujtues Vlerësimi" : "Survey Reminder"}
                    description={lang === "sq" ? "Pas përfundimit të modulit — vlerësoni trajnimin" : "After module completion — rate the training"}
                    value={preferences.notifySurveyReminder}
                    onChange={(value) => updatePreference("notifySurveyReminder", value)}
                    color="text-purple-500"
                    disabled={togglesDisabled}
                />
                <ToggleRow
                    icon={Bell}
                    label={lang === "sq" ? "Alarmi i Afatit" : "Deadline Alert"}
                    description={lang === "sq" ? "Kur jeni afër afatit vjetor të orëve trajnuese" : "When you're near the annual training hours deadline"}
                    value={preferences.notifyCpdDeadline}
                    onChange={(value) => updatePreference("notifyCpdDeadline", value)}
                    color="text-red-500"
                    disabled={togglesDisabled}
                />
                <p className="pt-3 text-xs text-muted-foreground">
                    {prefsLoading
                        ? (lang === "sq" ? "Duke ngarkuar preferencat..." : "Loading preferences...")
                        : prefsSaving
                            ? (lang === "sq" ? "Duke ruajtur ndryshimet..." : "Saving changes...")
                            : (lang === "sq" ? "Njoftimet në aplikacion dërgohen sipas këtyre preferencave. Email-i përdoret vetëm kur është aktiv." : "In-app notifications follow these preferences. Email is used only when enabled.")}
                </p>
            </div>

            {/* Section: Data Protection */}
            <div className="rounded-xl border border-border bg-card p-5 mb-4">
                <div className="flex items-center gap-2 mb-4">
                    <Shield className="h-4.5 w-4.5 text-primary" />
                    <h2 className="text-sm font-semibold text-foreground">
                        {lang === "sq" ? "Mbrojtja e të Dhënave (GDPR)" : "Data Protection (GDPR)"}
                    </h2>
                </div>
                <div className="flex flex-col gap-3 text-xs text-muted-foreground">
                    <div className="flex items-start gap-3 rounded-lg bg-muted/30 p-3">
                        <Lock className="h-4 w-4 shrink-0 text-green-500 mt-0.5" />
                        <div>
                            <p className="font-medium text-foreground mb-0.5">
                                {lang === "sq" ? "Ruajtje e sigurt e të dhënave" : "Secure Data Storage"}
                            </p>
                            <p>{lang === "sq" ? "Të dhënat ruhen me enkriptim AES-256 në serverat cloud të certifikuar." : "Data stored with AES-256 encryption on certified cloud servers."}</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-lg bg-muted/30 p-3">
                        <Database className="h-4 w-4 shrink-0 text-blue-500 mt-0.5" />
                        <div>
                            <p className="font-medium text-foreground mb-0.5">
                                {lang === "sq" ? "Kontrolli i aksesit" : "Access Control"}
                            </p>
                            <p>{lang === "sq" ? "Vetëm stafi i autorizuar i IEKA ka akses tek të dhënat e anëtarëve." : "Only authorized IEKA staff has access to member data."}</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-lg bg-muted/30 p-3">
                        <Shield className="h-4 w-4 shrink-0 text-purple-500 mt-0.5" />
                        <div>
                            <p className="font-medium text-foreground mb-0.5">
                                {lang === "sq" ? "Pajtueshmëri GDPR" : "GDPR Compliance"}
                            </p>
                            <p>{lang === "sq" ? "Aplikacioni është në përputhje me rregulloren GDPR të BE-së dhe ligjin shqiptar për mbrojtjen e të dhënave." : "Application complies with EU GDPR regulation and Albanian data protection law."}</p>
                        </div>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-fit mt-1 text-xs"
                        onClick={() => void handleDownloadMyData()}
                        disabled={exportingData}
                    >
                        {exportingData
                            ? (lang === "sq" ? "Duke shkarkuar..." : "Downloading...")
                            : (lang === "sq" ? "Shkarko të Dhënat e Mia" : "Download My Data")}
                    </Button>
                    {exportError && (
                        <p className="text-sm text-destructive">
                            {exportError}
                        </p>
                    )}
                </div>
            </div>

            {/* Section: Module Feedback — Auto-Send Toggle + Template (Admin only) */}
            {isAdmin && (
                <div className="rounded-xl border border-border bg-card overflow-hidden mb-4">
                    {/* Card header */}
                    <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-5 py-3.5">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-500/10">
                            <Send className="h-4 w-4 text-green-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h2 className="text-sm font-semibold text-foreground">
                                {lang === "sq" ? "Vlerësimi i Moduleve të Trajnimit" : "Training Module Feedback"}
                            </h2>
                            <p className="text-xs text-muted-foreground">
                                {lang === "sq" ? "Konfiguro formularin dhe dërgimin manual të vlerësimit" : "Configure feedback form and manual delivery"}
                            </p>
                        </div>
                    </div>

                    <div className="divide-y divide-border">
                        {/* Sub-section: Feedback form template */}
                        <div className="px-5 py-4">
                            <ModuleFeedbackSection />
                        </div>

                        {/* Sub-section: Manual send */}
                        <div className="px-5 py-4">
                            <ManualFeedbackSendSection />
                        </div>
                    </div>
                </div>
            )}
            {isAdmin && (
                <div className="rounded-xl border border-border bg-card p-5 mb-4">
                    <div className="flex items-center gap-2 mb-4">
                        <Send className="h-4.5 w-4.5 text-primary" />
                        <h2 className="text-sm font-semibold text-foreground">
                            {lang === "sq" ? "Anulimi Automatik i Rezervimeve" : "Automatic Reservation Cancellation"}
                        </h2>
                    </div>
                    <ToggleRow
                        icon={Bell}
                        label={lang === "sq" ? "Anulimi Automatik i Rezervimeve të Dyfishta" : "Auto-Cancel Duplicate Reservations"}
                        description={lang === "sq"
                            ? "7 ditë para sesionit: njoftim për të zgjedhur datën. 6 ditë para: anulim automatik i rezervimit të fundit"
                            : "7 days before session: warning to choose date. 6 days before: auto-cancel last booked reservation"}
                        value={reservationAutoCancelEnabled}
                        onChange={(v) => void toggleReservationAutoCancel(v)}
                        color="text-amber-500"
                        disabled={reservationConfigLoading || reservationConfigSaving}
                    />
                    <p className="pt-3 text-xs text-muted-foreground">
                        {reservationConfigLoading
                            ? (lang === "sq" ? "Duke ngarkuar..." : "Loading...")
                            : reservationConfigSaving
                                ? (lang === "sq" ? "Duke ruajtur..." : "Saving...")
                                : (lang === "sq" ? "Kur është aktiv, anëtarët me 2 rezervime marrin njoftim 7 ditë para dhe sistemi anulon automatikisht 6 ditë para sesionit të parë." : "When enabled, members with 2 reservations get warned 7 days before and the system auto-cancels 6 days before the first session.")}
                    </p>
                </div>
            )}

            {/* Section: Evaluation Questionnaires (Admin only) */}
            {isAdmin && (
                <EvaluationSection />
            )}

            {/* Section: Future Expansions */}
            {isAdmin && (
                <div className="rounded-xl border border-border bg-card p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <Globe className="h-4.5 w-4.5 text-primary" />
                        <h2 className="text-sm font-semibold text-foreground">
                            {lang === "sq" ? "Zgjerime të Ardhshme" : "Future Expansions"}
                        </h2>
                    </div>
                    <div className="flex flex-col gap-3">
                        <FutureCard
                            icon={Link2}
                            title={lang === "sq" ? "Integrimi me IEKA Website" : "IEKA Website Integration"}
                            desc={lang === "sq" ? "Sinkronizimi automatik me faqen zyrtare të IEKA-s." : "Automatic synchronization with the official IEKA website."}
                            color="bg-purple-500/10 text-purple-500"
                        />
                        <FutureCard
                            icon={Database}
                            title={lang === "sq" ? "Ndjekja Automatike" : "Automatic Tracking"}
                            desc={lang === "sq" ? "Kalkulimi dhe raportimi automatik i orëve në kohë reale." : "Automatic real-time hours calculation and reporting."}
                            color="bg-amber-500/10 text-amber-500"
                        />
                    </div>
                </div>
            )}

        </div>
    )
}

/* ------------------------------------------------------------------ */
/* Evaluation Questionnaire Admin Section                             */
/* ------------------------------------------------------------------ */

type QuestionDraft = { text: string; type: number; order: number; options: string[] }

function emptyQuestion(order: number): QuestionDraft {
    return { text: "", type: 1, order, options: [] }
}

function EvaluationSection() {
    const [item, setItem] = useState<EvaluationListItem | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")

    // modal state
    const [modal, setModal] = useState<"edit" | "responses" | null>(null)

    // form state
    const [editingId, setEditingId] = useState<string | null>(null)
    const [title, setTitle] = useState("")
    const [description, setDescription] = useState("")
    const [targetMembers, setTargetMembers] = useState(true)
    const [targetStudents, setTargetStudents] = useState(true)
    const [questions, setQuestions] = useState<QuestionDraft[]>([emptyQuestion(0)])
    const [saving, setSaving] = useState(false)
    const [formError, setFormError] = useState("")

    // send state
    const [sendingId, setSendingId] = useState<string | null>(null)
    const [sendResult, setSendResult] = useState<{ count: number; sentAt: string } | null>(null)

    // responses state
    const [responses, setResponses] = useState<EvaluationResponseItem[]>([])
    const [responsesLoading, setResponsesLoading] = useState(false)
    const [expandedResponse, setExpandedResponse] = useState<string | null>(null)

    // confirm delete
    const [confirmDelete, setConfirmDelete] = useState(false)

    const loadItem = useCallback(async () => {
        try {
            const data = (await fetchApi("/Evaluation")) as EvaluationListItem[]
            setItem(data.length > 0 ? data[0] : null)
            setError("")
        } catch (e: any) {
            setError(e?.message ?? "Gabim gjatë ngarkimit.")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { void loadItem() }, [loadItem])

    function resetForm() {
        setModal(null)
        setEditingId(null)
        setTitle("")
        setDescription("")
        setTargetMembers(true)
        setTargetStudents(true)
        setQuestions([emptyQuestion(0)])
        setFormError("")
    }

    async function openEdit() {
        if (!item) {
            resetForm()
            setModal("edit")
            return
        }
        try {
            const detail = (await fetchApi(`/Evaluation/${item.id}`)) as EvaluationDetail
            setEditingId(item.id)
            setTitle(detail.title)
            setDescription(detail.description ?? "")
            setTargetMembers(detail.targetMembers)
            setTargetStudents(detail.targetStudents)
            setQuestions(
                detail.questions.map((q) => ({
                    text: q.text,
                    type: q.type,
                    order: q.order,
                    options: q.options ?? [],
                }))
            )
            setFormError("")
            setModal("edit")
        } catch (e: any) {
            setError(e?.message ?? "Gabim gjatë ngarkimit.")
        }
    }

    async function handleSave() {
        if (!title.trim()) {
            setFormError("Plotësoni titullin e pyetësorit.")
            return
        }
        if (questions.some((q) => !q.text.trim())) {
            setFormError("Çdo pyetje duhet të ketë tekst.")
            return
        }

        setSaving(true)
        setFormError("")
        try {
            const body = {
                title: title.trim(),
                description: description.trim() || null,
                emailSubject: `Pyetësor Vlerësimi — ${title.trim()}`,
                emailBody: "Ju lutem plotësoni pyetësorin e mëposhtëm duke klikuar butonin më poshtë.",
                targetMembers,
                targetStudents,
                questions: questions.map((q, i) => ({
                    text: q.text.trim(),
                    type: q.type,
                    order: i,
                    options: q.type === 0 ? q.options.filter((o) => o.trim()) : null,
                })),
            }

            if (editingId) {
                await fetchApi(`/Evaluation/${editingId}`, { method: "PUT", body: JSON.stringify(body) })
            } else {
                await fetchApi("/Evaluation", { method: "POST", body: JSON.stringify(body) })
            }

            resetForm()
            await loadItem()
        } catch (e: any) {
            setFormError(e?.message ?? "Ruajtja dështoi.")
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete() {
        if (!item) return
        try {
            await fetchApi(`/Evaluation/${item.id}`, { method: "DELETE" })
            setConfirmDelete(false)
            setItem(null)
        } catch (e: any) {
            setError(e?.message ?? "Fshirja dështoi.")
        }
    }

    async function handleSend() {
        if (!item) return
        setSendingId(item.id)
        setSendResult(null)
        try {
            const result = (await fetchApi(`/Evaluation/${item.id}/send`, { method: "POST" })) as { recipientCount: number; sentAt: string }
            setSendResult({ count: result.recipientCount, sentAt: result.sentAt })
            await loadItem()
        } catch (e: any) {
            setError(e?.message ?? "Dërgimi dështoi.")
        } finally {
            setSendingId(null)
        }
    }

    async function openResponses() {
        if (!item) return
        setModal("responses")
        setResponsesLoading(true)
        setExpandedResponse(null)
        try {
            const data = (await fetchApi(`/Evaluation/${item.id}/responses`)) as EvaluationResponseItem[]
            setResponses(data)
        } catch (e: any) {
            setError(e?.message ?? "Gabim gjatë ngarkimit.")
        } finally {
            setResponsesLoading(false)
        }
    }

    function updateQuestion(index: number, patch: Partial<QuestionDraft>) {
        setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...patch } : q)))
    }

    function removeQuestion(index: number) {
        setQuestions((prev) => prev.filter((_, i) => i !== index))
    }

    function addOption(qIndex: number) {
        setQuestions((prev) =>
            prev.map((q, i) => (i === qIndex ? { ...q, options: [...q.options, ""] } : q))
        )
    }

    function updateOption(qIndex: number, oIndex: number, value: string) {
        setQuestions((prev) =>
            prev.map((q, i) =>
                i === qIndex
                    ? { ...q, options: q.options.map((o, j) => (j === oIndex ? value : o)) }
                    : q
            )
        )
    }

    function removeOption(qIndex: number, oIndex: number) {
        setQuestions((prev) =>
            prev.map((q, i) =>
                i === qIndex ? { ...q, options: q.options.filter((_, j) => j !== oIndex) } : q
            )
        )
    }

    /* ── Edit / Create Modal ── */
    const editModal = modal === "edit" ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 px-4 py-8 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-xl">
                <div className="flex items-center justify-between border-b border-border px-6 py-4">
                    <div className="flex items-center gap-2">
                        <ClipboardList className="h-5 w-5 text-primary" />
                        <h2 className="text-base font-semibold text-foreground">
                            {editingId ? "Ndrysho Pyetësorin" : "Krijo Pyetësor të Ri"}
                        </h2>
                    </div>
                    <button onClick={resetForm} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="max-h-[80vh] overflow-y-auto px-6 py-5 space-y-4">
                    <div>
                        <label className="text-xs font-medium text-muted-foreground">Titulli</label>
                        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titulli i pyetësorit" />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-muted-foreground">Përshkrimi (opsional)</label>
                        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Përshkrimi..." rows={2} />
                    </div>

                    <div className="flex gap-4">
                        <label className="flex items-center gap-2 text-xs">
                            <input type="checkbox" checked={targetMembers} onChange={(e) => setTargetMembers(e.target.checked)} className="rounded" />
                            Anëtarë
                        </label>
                        <label className="flex items-center gap-2 text-xs">
                            <input type="checkbox" checked={targetStudents} onChange={(e) => setTargetStudents(e.target.checked)} className="rounded" />
                            Studentë
                        </label>
                    </div>

                    {/* Questions builder */}
                    <div className="border-t border-border pt-4">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-semibold text-foreground">Pyetjet</p>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => setQuestions((prev) => [...prev, emptyQuestion(prev.length)])}
                            >
                                <Plus className="h-3.5 w-3.5 mr-1" /> Shto pyetje
                            </Button>
                        </div>

                        <div className="space-y-3">
                            {questions.map((q, qi) => (
                                <div key={qi} className="rounded-lg border border-border bg-muted/20 p-3">
                                    <div className="flex items-start gap-2">
                                        <span className="mt-2 text-xs font-semibold text-muted-foreground">{qi + 1}.</span>
                                        <div className="flex-1 space-y-2">
                                            <Input
                                                value={q.text}
                                                onChange={(e) => updateQuestion(qi, { text: e.target.value })}
                                                placeholder="Teksti i pyetjes..."
                                                className="text-sm"
                                            />
                                            <div className="flex items-center gap-2">
                                                <select
                                                    value={q.type}
                                                    onChange={(e) => updateQuestion(qi, { type: Number(e.target.value), options: Number(e.target.value) === 0 ? (q.options.length > 0 ? q.options : [""]) : [] })}
                                                    className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground"
                                                >
                                                    <option value={0}>Opsione</option>
                                                    <option value={1}>Tekst i lirë</option>
                                                    <option value={2}>Yje (1-5)</option>
                                                </select>
                                                {questions.length > 1 && (
                                                    <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => removeQuestion(qi)}>
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                )}
                                            </div>

                                            {q.type === 0 && (
                                                <div className="space-y-1.5 pl-2">
                                                    {q.options.map((opt, oi) => (
                                                        <div key={oi} className="flex items-center gap-1.5">
                                                            <span className="text-xs text-muted-foreground">{String.fromCharCode(65 + oi)}.</span>
                                                            <Input
                                                                value={opt}
                                                                onChange={(e) => updateOption(qi, oi, e.target.value)}
                                                                placeholder={`Opsioni ${oi + 1}`}
                                                                className="h-7 text-xs"
                                                            />
                                                            {q.options.length > 1 && (
                                                                <button onClick={() => removeOption(qi, oi)} className="text-muted-foreground hover:text-destructive">
                                                                    <X className="h-3 w-3" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                    <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => addOption(qi)}>
                                                        <Plus className="h-3 w-3 mr-1" /> Shto opsion
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {formError && <p className="text-xs text-destructive">{formError}</p>}
                </div>

                <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
                    <Button variant="outline" size="sm" onClick={resetForm}>Anulo</Button>
                    <Button size="sm" onClick={() => void handleSave()} disabled={saving}>
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                        {editingId ? "Ruaj Ndryshimet" : "Krijo"}
                    </Button>
                </div>
            </div>
        </div>
    ) : null

    /* ── Responses Modal ── */
    const responsesModal = modal === "responses" ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 px-4 py-8 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-xl">
                <div className="flex items-center justify-between border-b border-border px-6 py-4">
                    <div className="flex items-center gap-2">
                        <Eye className="h-5 w-5 text-primary" />
                        <h2 className="text-base font-semibold text-foreground">
                            Përgjigjet — {item?.title ?? "Pyetësor"}
                        </h2>
                    </div>
                    <button onClick={() => { setModal(null); setResponses([]) }} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="max-h-[80vh] overflow-y-auto px-6 py-5">
                    {responsesLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                    ) : responses.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4">Nuk ka përgjigje ende.</p>
                    ) : (
                        <div className="space-y-2">
                            {responses.map((r) => (
                                <div key={r.id} className="rounded-lg border border-border">
                                    <button
                                        className="flex w-full items-center justify-between p-3 text-left text-sm"
                                        onClick={() => setExpandedResponse(expandedResponse === r.id ? null : r.id)}
                                    >
                                        <div>
                                            <span className="font-medium">{r.userName ?? "Përdorues"}</span>
                                            {r.userRole && <span className="ml-2 text-xs text-muted-foreground">({r.userRole})</span>}
                                        </div>
                                        <span className="text-xs text-muted-foreground">
                                            {new Date(r.submittedAt).toLocaleDateString("sq-AL")}
                                        </span>
                                    </button>
                                    {expandedResponse === r.id && (
                                        <div className="border-t border-border px-3 pb-3 pt-2 space-y-2">
                                            {r.answers.map((a) => (
                                                <div key={a.id} className="text-xs">
                                                    <p className="font-medium text-muted-foreground">{a.questionText}</p>
                                                    <p className="text-foreground mt-0.5">
                                                        {a.questionType === 2 ? (
                                                            <span className="flex gap-0.5">
                                                                {[1, 2, 3, 4, 5].map((s) => (
                                                                    <Star key={s} className={`h-3.5 w-3.5 ${Number(a.answerText) >= s ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                                                                ))}
                                                            </span>
                                                        ) : a.answerText}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    ) : null

    /* ── Main Section ── */
    return (
        <>
            <div className="rounded-xl border border-border bg-card p-5 mb-4">
                <div className="flex items-center gap-2 mb-4">
                    <ClipboardList className="h-4.5 w-4.5 text-primary" />
                    <h2 className="text-sm font-semibold text-foreground">Pyetësori i Vlerësimit</h2>
                </div>

                {error && <p className="text-xs text-destructive mb-2">{error}</p>}

                {sendResult && (
                    <div className="mb-3 flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-500/20 p-2.5 text-xs text-green-700">
                        <Check className="h-3.5 w-3.5" />
                        U dërgua te {sendResult.count} përdorues
                        <button onClick={() => setSendResult(null)} className="ml-auto"><X className="h-3 w-3" /></button>
                    </div>
                )}

                {loading ? (
                    <div className="flex items-center justify-center py-6">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                ) : !item ? (
                    <div className="flex flex-col items-center gap-3 py-6">
                        <p className="text-sm text-muted-foreground">Nuk ka pyetësor ende.</p>
                        <Button size="sm" className="h-8 text-xs" onClick={() => void openEdit()}>
                            <Plus className="h-3.5 w-3.5 mr-1" /> Krijo Pyetësor
                        </Button>
                    </div>
                ) : (
                    <div className="rounded-lg border border-border p-3">
                        <div className="flex items-center justify-between gap-3">
                            <button
                                className="min-w-0 flex-1 text-left"
                                onClick={() => void openEdit()}
                            >
                                <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                    <span>{item.questionCount} pyetje</span>
                                    <span>·</span>
                                    <span>{item.responseCount} përgjigje</span>
                                    {item.targetMembers && <span className="rounded bg-blue-500/10 text-blue-600 px-1.5 py-0.5">Anëtarë</span>}
                                    {item.targetStudents && <span className="rounded bg-purple-500/10 text-purple-600 px-1.5 py-0.5">Studentë</span>}
                                </div>
                                {item.sendLogs.length > 0 && (
                                    <p className="mt-1 text-[11px] text-muted-foreground">
                                        Dërgimi i fundit: {new Date(item.sendLogs[0].sentAt).toLocaleDateString("sq-AL")} — {item.sendLogs[0].recipientCount} marrës
                                    </p>
                                )}
                            </button>

                            <div className="flex items-center gap-1.5 shrink-0">
                                <Button
                                    size="sm"
                                    className="h-8 text-xs gap-1.5"
                                    disabled={sendingId === item.id}
                                    onClick={() => void handleSend()}
                                >
                                    {sendingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                                    Dërgo pyetësorin
                                </Button>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Përgjigjet" onClick={() => void openResponses()}>
                                    <Eye className="h-4 w-4" />
                                </Button>
                                {confirmDelete ? (
                                    <div className="flex items-center gap-1">
                                        <Button variant="destructive" size="sm" className="h-7 text-[11px] px-2" onClick={() => void handleDelete()}>Po</Button>
                                        <Button variant="ghost" size="sm" className="h-7 text-[11px] px-2" onClick={() => setConfirmDelete(false)}>Jo</Button>
                                    </div>
                                ) : (
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" title="Fshi" onClick={() => setConfirmDelete(true)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {editModal}
            {responsesModal}
        </>
    )
}
