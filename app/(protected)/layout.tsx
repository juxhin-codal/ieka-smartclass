"use client"

import { useAuth } from "@/lib/auth-context"
import { AppHeader, type TabKey } from "@/components/app-header"
import { GDPRBanner } from "@/components/gdpr/gdpr-banner"
import { useRouter, usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, user } = useAuth()
    const router = useRouter()
    const pathname = usePathname()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        if (!mounted) return

        if (!isAuthenticated) {
            router.replace("/login")
            return
        }

        // Role-based route guarding
        if (user) {
            if (user.role === "Member") {
                // Members only allowed in /modules, /my-history and /settings
                if (!pathname.startsWith("/modules") && !pathname.startsWith("/my-history") && !pathname.startsWith("/settings")) {
                    router.replace("/modules")
                }
            } else if (user.role === "Lecturer") {
                // Lecturers allowed in /dashboard, /modules, /settings
                if (pathname.startsWith("/members") || pathname.startsWith("/reports") || pathname.startsWith("/students") || pathname.startsWith("/my-history") || pathname.startsWith("/my-documents")) {
                    router.replace("/dashboard")
                }
            } else if (user.role === "Mentor") {
                // Mentors are limited to students, attendance and own documents.
                if (!pathname.startsWith("/students") && !pathname.startsWith("/attendance") && !pathname.startsWith("/my-documents")) {
                    router.replace("/students")
                }
            } else if (user.role === "Student") {
                // Students are limited to studies, own documents and evaluations.
                if (!pathname.startsWith("/students") && !pathname.startsWith("/my-documents") && !pathname.startsWith("/my-evaluations")) {
                    router.replace("/students")
                }
            }
        }
    }, [mounted, isAuthenticated, user, pathname, router])

    if (!mounted || !isAuthenticated) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    const activeTab: TabKey = pathname.startsWith("/my-evaluations")
        ? "myEvaluations"
        : pathname.startsWith("/attendance")
        ? "attendance"
        : pathname.startsWith("/my-documents")
        ? "myDocuments"
        : pathname.startsWith("/my-history")
        ? "myHistory"
        : pathname.startsWith("/modules")
            ? (user?.role === "Member" ? "myModules" : "events")
            : pathname.startsWith("/members")
                ? "members"
                : pathname.startsWith("/students")
                    ? (user?.role === "Mentor" || user?.role === "Student" ? "studies" : "students")
                    : pathname.startsWith("/reports")
                        ? "reports"
                        : pathname.startsWith("/settings")
                            ? "settings"
                            : "dashboard"

    function navigateTab(tab: TabKey) {
        if (tab === "events" || tab === "myModules") {
            router.push("/modules")
            return
        }

        if (tab === "students" || tab === "studies") {
            router.push("/students")
            return
        }

        if (tab === "attendance") {
            router.push("/attendance")
            return
        }

        if (tab === "myHistory") {
            router.push("/my-history")
            return
        }

        if (tab === "myDocuments") {
            router.push("/my-documents")
            return
        }

        if (tab === "myEvaluations") {
            router.push("/my-evaluations")
            return
        }

        router.push(`/${tab}`)
    }

    return (
        <div className="flex min-h-screen flex-col bg-background">
            <AppHeader activeTab={activeTab} onTabChange={navigateTab} />
            <main className="flex-1">
                {children}
            </main>
            <GDPRBanner />
        </div>
    )
}
