"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { MyDocumentsView } from "@/components/documents/my-documents-view"

function fallbackRoute(role?: string) {
  if (role === "Admin" || role === "Lecturer") return "/dashboard"
  if (role === "Member") return "/modules"
  return "/students"
}

export default function MyDocumentsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const isAllowed = user?.role === "Mentor" || user?.role === "Student"

  useEffect(() => {
    if (!user) return
    if (!isAllowed) {
      router.replace(fallbackRoute(user.role))
    }
  }, [isAllowed, router, user])

  if (!isAllowed) {
    return null
  }

  return <MyDocumentsView />
}

