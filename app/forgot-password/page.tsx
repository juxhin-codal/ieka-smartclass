"use client"

import Image from "next/image"
import Link from "next/link"
import { FormEvent, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { API_BASE_URL } from "@/lib/api-client"
import { useI18n } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EmailDomainHints } from "@/components/ui/email-domain-hints"
import { Label } from "@/components/ui/label"
import { AlertCircle, BookOpen, Loader2, Mail, QrCode, Shield } from "lucide-react"

export default function ForgotPasswordPage() {
  const { t } = useI18n()
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resendingConfirmation, setResendingConfirmation] = useState(false)
  const [confirmationNotice, setConfirmationNotice] = useState("")
  const [error, setError] = useState("")

  const emailError = useMemo(() => {
    if (!submitted) return ""
    if (!email.trim()) return t("forgot.errRequired")
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return t("forgot.errInvalid")
    return ""
  }, [email, submitted, t])

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    setError("")
    setConfirmationNotice("")

    if (emailError) return

    setLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/Auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await response.json()
      if (!response.ok || data.success === false) {
        setError(data.message ?? t("forgot.errSend"))
        return
      }

      router.push(`/verify-reset-code?email=${encodeURIComponent(email.trim())}`)
    } catch {
      setError(t("forgot.errSend"))
    } finally {
      setLoading(false)
    }
  }

  const canResendConfirmation =
    !!email.trim() &&
    error.toLowerCase().includes("konfirm")

  const resendConfirmationEmail = async () => {
    setConfirmationNotice("")
    setError("")
    setResendingConfirmation(true)

    try {
      const response = await fetch(`${API_BASE_URL}/Auth/resend-confirmation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await response.json()
      if (!response.ok || data.success === false) {
        setError(data.message ?? "Ridërgimi i email-it të konfirmimit dështoi.")
        return
      }

      setConfirmationNotice(data.message ?? "Email-i i konfirmimit u ridërgua.")
    } catch {
      setError("Ridërgimi i email-it të konfirmimit dështoi.")
    } finally {
      setResendingConfirmation(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      <div
        className="hidden lg:flex lg:w-[500px] flex-col justify-between p-10"
        style={{ background: "linear-gradient(160deg, #0d2347 0%, #1a3a6b 60%, #1e4d8c 100%)" }}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/15">
            <Image src="/logo-transparent.png" alt="IEKA Logo" width={32} height={32} className="h-8 w-8 object-contain drop-shadow-md" />
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-white">IEKA SmartClass</span>
            <p className="text-xs text-white/50">Instituti i Ekspertëve Kontabël të Autorizuar</p>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-3xl font-bold leading-tight tracking-tight text-white text-balance mb-3">
              {t("login.heroTitle")}
            </h2>
            <p className="text-sm leading-relaxed text-white/70">
              {t("login.heroDesc")}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {[
              { icon: QrCode, text: t("login.feat1") },
              { icon: BookOpen, text: t("login.feat2") },
              { icon: Shield, text: t("login.feat3") },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/10">
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <p className="text-sm text-white/80 pt-1">{text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-white/40">
          <Shield className="h-3.5 w-3.5 shrink-0" />
          <span>{t("login.footer")}</span>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center gap-2 lg:items-start">
            <div className="flex items-center gap-2.5 lg:hidden">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg"
                style={{ background: "linear-gradient(160deg, #0d2347, #1a3a6b)" }}>
                <Image src="/logo-transparent.png" alt="IEKA Logo" width={24} height={24} className="h-6 w-6 object-contain" />
              </div>
              <div>
                <span className="text-base font-bold text-foreground">IEKA SmartClass</span>
              </div>
            </div>

            <h1 className="text-xl font-semibold tracking-tight text-foreground mt-2">{t("forgot.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("forgot.subtitle")}</p>
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-foreground">
                {t("forgot.email")}
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-10 pl-9"
                  autoComplete="email"
                  inputMode="email"
                />
              </div>
              <EmailDomainHints value={email} onSelect={setEmail} />
              {emailError && <p className="text-xs text-destructive">{emailError}</p>}
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 p-3">
                <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-destructive">{error}</p>
                  {canResendConfirmation ? (
                    <button
                      type="button"
                      onClick={resendConfirmationEmail}
                      disabled={resendingConfirmation}
                      className="mt-2 text-xs font-medium text-destructive underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {resendingConfirmation ? "Duke ridërguar email-in..." : "Ridërgo emailin e konfirmimit"}
                    </button>
                  ) : null}
                </div>
              </div>
            )}

            {confirmationNotice ? (
              <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3 text-sm text-green-600">
                {confirmationNotice}
              </div>
            ) : null}

            <Button
              type="submit"
              className="h-10 w-full font-medium"
              disabled={loading}
              style={{ background: "linear-gradient(135deg, #0d2347, #2563eb)" }}
            >
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("forgot.sending")}</>
              ) : t("forgot.submit")}
            </Button>

            <Link
              href="/login"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors text-center"
            >
              {t("forgot.backToLogin")}
            </Link>
          </form>
        </div>
      </div>
    </div>
  )
}
