"use client"
import { EventDetail } from "@/components/events/event-detail"
import { MemberModuleDetail } from "@/components/members/member-module-detail"
import { useAuth } from "@/lib/auth-context"
import { useRouter, useParams } from "next/navigation"

export default function EventDetailPage() {
    const router = useRouter()
    const { id } = useParams()
    const { user } = useAuth()
    const isStaff = user?.role === "Admin" || user?.role === "Lecturer"

    if (!isStaff) {
        return <MemberModuleDetail eventId={id as string} onBack={() => router.push("/modules")} />
    }

    return <EventDetail eventId={id as string} onBack={() => router.push("/modules")} />
}
