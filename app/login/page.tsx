import { Suspense } from "react"
import { LoginForm } from "@/components/login-form"

function LoginFallback() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
            <p className="text-sm text-muted-foreground">Duke ngarkuar...</p>
        </div>
    )
}

export default function LoginPage() {
    return (
        <Suspense fallback={<LoginFallback />}>
            <LoginForm />
        </Suspense>
    )
}
