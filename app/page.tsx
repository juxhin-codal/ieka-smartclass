"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"

export default function RootPage() {
    const { isAuthenticated, user } = useAuth()
    const router = useRouter()

    useEffect(() => {
        if (!isAuthenticated) {
            router.replace("/login")
            return
        }

        if (user?.role === "Admin" || user?.role === "Lecturer") {
            router.replace("/dashboard")
        } else if (user?.role === "Mentor" || user?.role === "Student") {
            router.replace("/students")
        } else {
            router.replace("/modules")
        }
    }, [isAuthenticated, user?.role, router])

    return null
}
