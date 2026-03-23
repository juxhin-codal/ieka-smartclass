"use client"
import { MemberBrowseView } from "@/components/members/member-browse-view"
import { useRouter } from "next/navigation"

export default function BrowsePage() {
    const router = useRouter()
    return (
        <MemberBrowseView
            onBack={() => router.push("/modules")}
            onOpenModule={(id) => router.push(`/modules/reserve/${id}`)}
        />
    )
}
