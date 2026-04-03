import { Suspense } from "react"
import { StudentsView } from "@/components/students/students-view"

export default function StudentsPage() {
    return (
        <Suspense>
            <StudentsView />
        </Suspense>
    )
}
