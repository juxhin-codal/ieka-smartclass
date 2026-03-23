"use client"

/**
 * SettingsView — Notification preferences, data management, and future integrations.
 * Covers Section 9 (communication channels), Section 10 (data protection),
 * and Section 12 (future expansion placeholders).
 */

import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { useI18n } from "@/lib/i18n"
import { API_BASE_URL, fetchApi, fetchWithAuth } from "@/lib/api-client"
import type { NotificationPreferences } from "@/lib/data"
import {
    Bell, Mail, Shield, Globe,
    Link2, Lock, Database, ChevronRight, Check, LogOut
} from "lucide-react"
import { Button } from "@/components/ui/button"

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

    useEffect(() => {
        let cancelled = false

        async function loadPreferences() {
            setPrefsLoading(true)
            try {
                const response = (await fetchApi("/Notifications/preferences")) as NotificationPreferences
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
