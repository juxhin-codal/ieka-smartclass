"use client"

import { useEffect } from "react"
import { AuthProvider } from "@/lib/auth-context"
import { EventsProvider } from "@/lib/events-context"
import { I18nProvider } from "@/lib/i18n"

export function Providers({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(() => { })
        }
    }, [])

    return (
        <I18nProvider>
            <AuthProvider>
                <EventsProvider>
                    {children}
                </EventsProvider>
            </AuthProvider>
        </I18nProvider>
    )
}
