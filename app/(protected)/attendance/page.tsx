"use client"

import { Suspense, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { MentorAttendanceView } from "@/components/students/students-view"

function fallbackRoute(role?: string) {
  if (role === "Admin" || role === "Lecturer") return "/dashboard"
  if (role === "Member") return "/modules"
  return "/students"
}

function AttendanceInner() {
  const { user } = useAuth()
  const router = useRouter()
  const isAllowed = user?.role === "Mentor"

  useEffect(() => {
    if (!user) return
    if (!isAllowed) {
      router.replace(fallbackRoute(user.role))
    }
  }, [isAllowed, router, user])

  if (!isAllowed) {
    return null
  }

  return <MentorAttendanceView />
}

export default function AttendancePage() {
  return (
    <Suspense>
      <AttendanceInner />
    </Suspense>
  )
}
