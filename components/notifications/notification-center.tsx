"use client"

/**
 * NotificationCenter — Bell icon dropdown with categorized alerts.
 * Covers: booking confirmations, session reminders, survey reminders, CPD deadline alerts.
 */

import { useState, useMemo, useRef, useEffect, useCallback } from "react"
import { Bell, Star, AlertTriangle, BookOpen, Clock, Check, X, Inbox } from "lucide-react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { useI18n } from "@/lib/i18n"
import { fetchApi } from "@/lib/api-client"
import type { NotificationType, UserNotification } from "@/lib/data"

interface NotificationListResponse {
    unreadCount: number
    items: UserNotification[]
}

function formatTimeAgo(date: Date): string {
    if (Number.isNaN(date.getTime())) return ""
    const mins = Math.floor((Date.now() - date.getTime()) / 60000)
    if (mins < 60) return `${mins} min më parë`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h më parë`
    const days = Math.floor(hrs / 24)
    return `${days}d më parë`
}

const typeConfig: Record<NotificationType, { icon: typeof Bell; color: string; bg: string }> = {
    "booking": { icon: BookOpen, color: "text-blue-500", bg: "bg-blue-500/10" },
    "reminder": { icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" },
    "survey": { icon: Star, color: "text-purple-500", bg: "bg-purple-500/10" },
    "cpd-deadline": { icon: AlertTriangle, color: "text-red-500", bg: "bg-red-500/10" },
}

export function NotificationCenter() {
    const { user } = useAuth()
    const { t } = useI18n()
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [notifications, setNotifications] = useState<UserNotification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const ref = useRef<HTMLDivElement>(null)
    const lastFetchRef = useRef<number>(0)

    const loadNotifications = useCallback(async (showLoader = false, force = false) => {
        if (!user) {
            setNotifications([])
            setUnreadCount(0)
            return
        }

        // Skip if fetched within the last 60 seconds (unless forced)
        const now = Date.now()
        if (!force && now - lastFetchRef.current < 60_000) return
        lastFetchRef.current = now

        if (showLoader) {
            setLoading(true)
        }

        try {
            const response = (await fetchApi("/Notifications?take=20")) as NotificationListResponse
            setNotifications(response.items ?? [])
            setUnreadCount(typeof response.unreadCount === "number" ? response.unreadCount : 0)
            setError("")
        } catch (e: any) {
            if (e?.status === 404) {
                setNotifications([])
                setUnreadCount(0)
                setError("")
            } else {
                setError(e?.message ?? "Nuk u ngarkuan njoftimet.")
            }
        } finally {
            if (showLoader) {
                setLoading(false)
            }
        }
    }, [user])

    // Close on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
        }
        if (open) document.addEventListener("mousedown", handleClick)
        return () => document.removeEventListener("mousedown", handleClick)
    }, [open])

    useEffect(() => {
        if (!user) return
        void loadNotifications(true)
    }, [user, loadNotifications])

    useEffect(() => {
        if (open) {
            void loadNotifications(true, true)
        }
    }, [open, loadNotifications])

    const visibleUnreadCount = useMemo(
        () => notifications.filter((notification) => !notification.isRead).length,
        [notifications]
    )

    async function markAllRead() {
        const previous = notifications
        setNotifications((prev) => prev.map((notification) => ({ ...notification, isRead: true })))
        setUnreadCount(0)
        try {
            await fetchApi("/Notifications/read-all", { method: "POST" })
        } catch (e: any) {
            if (e?.status === 404) {
                return
            }
            setNotifications(previous)
            setUnreadCount(previous.filter((notification) => !notification.isRead).length)
        }
    }

    async function markOneRead(id: string) {
        const existing = notifications.find((notification) => notification.id === id)
        if (!existing || existing.isRead) {
            return
        }

        setNotifications((prev) =>
            prev.map((notification) =>
                notification.id === id ? { ...notification, isRead: true } : notification
            )
        )
        setUnreadCount((prev) => Math.max(0, prev - 1))

        try {
            await fetchApi(`/Notifications/${id}/read`, { method: "POST" })
        } catch (e: any) {
            if (e?.status === 404) {
                return
            }
            setNotifications((prev) =>
                prev.map((notification) =>
                    notification.id === id ? existing : notification
                )
            )
            setUnreadCount((prev) => prev + 1)
        }
    }

    async function dismissNotif(id: string) {
        const previous = notifications
        const removed = notifications.find((notification) => notification.id === id)
        setNotifications((prev) => prev.filter((notification) => notification.id !== id))
        if (removed && !removed.isRead) {
            setUnreadCount((prev) => Math.max(0, prev - 1))
        }

        try {
            await fetchApi(`/Notifications/${id}`, { method: "DELETE" })
        } catch (e: any) {
            if (e?.status === 404) {
                return
            }
            setNotifications(previous)
            setUnreadCount(previous.filter((notification) => !notification.isRead).length)
        }
    }

    async function openNotification(notification: UserNotification) {
        if (!notification.isRead) {
            await markOneRead(notification.id)
        }

        if (notification.link) {
            setOpen(false)
            router.push(notification.link)
        }
    }

    if (!user) {
        return null
    }

    return (
        <div ref={ref} className="relative">
            {/* Bell button */}
            <button
                onClick={() => setOpen(!open)}
                className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                aria-label={t("notif.title")}
            >
                <Bell className="h-4.5 w-4.5" />
                {unreadCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white animate-pulse">
                        {unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown panel */}
            {open && (
                <div className="absolute right-0 top-11 z-50 w-80 sm:w-96 rounded-xl border border-border bg-card shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-border px-4 py-3">
                        <div className="flex items-center gap-2">
                            <Bell className="h-4 w-4 text-foreground" />
                            <h3 className="text-sm font-semibold text-foreground">{t("notif.title")}</h3>
                            {unreadCount > 0 && (
                                <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-500">
                                    {unreadCount}
                                </span>
                            )}
                        </div>
                        {unreadCount > 0 && (
                            <button onClick={markAllRead} className="text-xs text-primary hover:underline">
                                {t("notif.markRead")}
                            </button>
                        )}
                    </div>

                    {/* Notification list */}
                    <div className="max-h-80 overflow-y-auto">
                        {loading ? (
                            <div className="flex flex-col items-center py-10 text-center">
                                <Bell className="mb-2 h-8 w-8 animate-pulse text-muted-foreground/30" />
                                <p className="text-sm text-muted-foreground">Duke ngarkuar njoftimet...</p>
                            </div>
                        ) : error ? (
                            <div className="flex flex-col items-center py-10 text-center">
                                <AlertTriangle className="mb-2 h-8 w-8 text-destructive/70" />
                                <p className="max-w-[16rem] text-sm text-destructive">{error}</p>
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="flex flex-col items-center py-10 text-center">
                                <Inbox className="h-8 w-8 text-muted-foreground/30 mb-2" />
                                <p className="text-sm text-muted-foreground">{t("notif.empty")}</p>
                            </div>
                        ) : (
                            notifications.map((notif) => {
                                const cfg = typeConfig[notif.type]
                                const Icon = cfg.icon
                                return (
                                    <button
                                        key={notif.id}
                                        type="button"
                                        onClick={() => void openNotification(notif)}
                                        className={`flex w-full gap-3 px-4 py-3 border-b border-border text-left last:border-0 transition-colors ${notif.isRead ? "opacity-60" : "bg-primary/3"
                                            }`}
                                    >
                                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${cfg.bg}`}>
                                            <Icon className={`h-4 w-4 ${cfg.color}`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-1">
                                                <p className="text-[13px] font-semibold text-foreground leading-tight">{notif.title}</p>
                                                <button
                                                    type="button"
                                                    onClick={(event) => {
                                                        event.stopPropagation()
                                                        void dismissNotif(notif.id)
                                                    }}
                                                    className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground">
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{notif.body}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] text-muted-foreground">{formatTimeAgo(new Date(notif.createdAtUtc))}</span>
                                                {!notif.isRead && (
                                                    <span className="flex h-1.5 w-1.5 rounded-full bg-blue-500" />
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                )
                            })
                        )}
                    </div>

                    {/* Footer — notification preferences hint */}
                    <div className="border-t border-border px-4 py-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-1"><span className="flex h-2 w-2 rounded-full bg-purple-500/50" />Email</span>
                            <span className="flex items-center gap-1"><span className="flex h-2 w-2 rounded-full bg-blue-500/50" />Në aplikacion</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">{visibleUnreadCount > 0 ? `${visibleUnreadCount} të reja` : "Kanale aktive"}</span>
                    </div>
                </div>
            )}
        </div>
    )
}
