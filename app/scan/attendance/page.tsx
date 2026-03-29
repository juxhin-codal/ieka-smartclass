"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { fetchApi } from "@/lib/api-client"
import { CheckCircle2, AlertCircle, Loader2, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

function ScanAttendanceContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? ""
  const { isAuthenticated, user } = useAuth()

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [message, setMessage] = useState("")
  const [mounted, setMounted] = useState(false)
  const submittedRef = useRef(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted) return

    if (!token) {
      setStatus("error")
      setMessage("Link i pavlefshëm — mungon kodi QR.")
      return
    }

    if (!isAuthenticated) {
      const redirect = `/scan/attendance?token=${encodeURIComponent(token)}`
      router.replace(`/login?redirect=${encodeURIComponent(redirect)}`)
      return
    }

    if (user?.role !== "Student") {
      setStatus("error")
      setMessage("Vetëm studentët mund të regjistrojnë prezencën.")
      return
    }

    if (submittedRef.current) return
    submittedRef.current = true

    async function markAttendance() {
      try {
        await fetchApi("/StudentModules/scan", {
          method: "POST",
          body: JSON.stringify({ qrToken: token }),
        })
        setStatus("success")
        setMessage("Prezenca u regjistrua me sukses!")
      } catch (e: any) {
        setStatus("error")
        setMessage(e?.message ?? "Gabim gjatë regjistrimit të prezencës.")
      }
    }

    void markAttendance()
  }, [mounted, isAuthenticated, user, token, router])

  if (!mounted || (!token && status === "loading")) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center px-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (status === "loading") {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center px-4">
        <div className="w-full rounded-xl border border-border bg-card p-8 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">Duke regjistruar prezencën...</p>
        </div>
      </div>
    )
  }

  if (status === "success") {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center px-4">
        <div className="w-full rounded-xl border border-border bg-card p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Prezenca u Regjistrua!</h1>
          <p className="mt-2 text-sm text-muted-foreground">{message}</p>
          <Button
            className="mt-6 gap-2"
            onClick={() => router.push("/students")}
          >
            <ArrowLeft className="h-4 w-4" />
            Kthehu në panel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center px-4">
      <div className="w-full rounded-xl border border-border bg-card p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
          <AlertCircle className="h-8 w-8 text-red-600" />
        </div>
        <h1 className="text-xl font-semibold text-foreground">Gabim</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <Button
          className="mt-6 gap-2"
          variant="outline"
          onClick={() => router.push("/students")}
        >
          <ArrowLeft className="h-4 w-4" />
          Kthehu në panel
        </Button>
      </div>
    </div>
  )
}

export default function ScanAttendancePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center px-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <ScanAttendanceContent />
    </Suspense>
  )
}
