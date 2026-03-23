"use client"

import { AuthProvider } from "@/lib/auth-context"
import { EventsProvider } from "@/lib/events-context"
import { I18nProvider } from "@/lib/i18n"

export function Providers({ children }: { children: React.ReactNode }) {
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
