"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { useEvents } from "@/lib/events-context"

interface AdminPasswordResetCardProps {
  userId: string
  userLabel: string
}

export function AdminPasswordResetCard({ userId, userLabel }: AdminPasswordResetCardProps) {
  const { sendUserPasswordResetEmail } = useEvents()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  async function handleResetPassword() {
    setError("")
    setSuccess("")

    setSaving(true)
    try {
      await sendUserPasswordResetEmail(userId)
      setSuccess(`Email-i i resetimit të fjalëkalimit iu dërgua përdoruesit ${userLabel}.`)
    } catch (e: any) {
      setError(e?.message ?? "Gabim gjatë dërgimit të email-it të resetimit.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-muted/20 px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-foreground">Reseto fjalëkalimin</p>
          <p className="text-[11px] text-muted-foreground">
            Ju mund t'i dërgojni këtij përdoruesi një email për rivendosjen e fjalëkalimit.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs shrink-0" onClick={handleResetPassword} disabled={saving}>
          {saving ? "Duke dërguar..." : "Dërgo Email Resetimi"}
        </Button>
      </div>

      {success ? (
        <p className="mt-2 rounded-md border border-green-500/20 bg-green-500/5 px-3 py-1.5 text-xs text-green-600">
          {success}
        </p>
      ) : null}

      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
