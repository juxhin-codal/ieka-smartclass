"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { MyHistoryView } from "@/components/members/my-history-view"

export default function MyHistoryPage() {
    const { user } = useAuth()
    const router = useRouter()
    const isStaff = user?.role === "Admin" || user?.role === "Lecturer"

    useEffect(() => {
        if (isStaff) {
            router.replace("/modules")
        }
    }, [isStaff, router])

    if (isStaff) {
        return null
    }

    return <MyHistoryView onOpenModule={(id) => router.push(`/modules/${id}`)} />
}
