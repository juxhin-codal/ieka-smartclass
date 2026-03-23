"use client"
import { useAuth } from "@/lib/auth-context"
import { EventsView } from "@/components/events/events-view"
import { MyModulesView } from "@/components/members/my-modules-view"
import { useRouter } from "next/navigation"

export default function ModulesPage() {
    const { user } = useAuth()
    const router = useRouter()
    const isStaff = user?.role === "Admin" || user?.role === "Lecturer"

    if (!isStaff) {
        return (
            <MyModulesView
                onBrowse={() => router.push("/modules/browse")}
                onOpenModule={(id) => router.push(`/modules/${id}`)}
            />
        )
    }

    return <EventsView onOpenEvent={(id) => router.push(`/modules/${id}`)} />
}
