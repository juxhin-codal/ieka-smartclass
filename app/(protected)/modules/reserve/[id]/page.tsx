"use client"
import { MemberModuleDetail } from "@/components/members/member-module-detail"
import { useRouter, useParams } from "next/navigation"

export default function ReservePage() {
    const router = useRouter()
    const { id } = useParams()
    return (
        <MemberModuleDetail
            eventId={id as string}
            onBack={() => router.push("/modules")}
        />
    )
}
