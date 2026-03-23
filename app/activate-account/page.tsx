"use client"

import Image from "next/image"
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { API_BASE_URL } from "@/lib/api-client"
import { useI18n } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, BookOpen, Eye, EyeOff, Loader2, Lock, QrCode, Shield } from "lucide-react"

function validatePassword(password: string): string {
  if (password.length < 8) return "Fjalëkalimi duhet të ketë të paktën 8 karaktere."
  if (!/[A-Z]/.test(password)) return "Fjalëkalimi duhet të ketë të paktën një shkronjë të madhe."
  if (!/[a-z]/.test(password)) return "Fjalëkalimi duhet të ketë të paktën një shkronjë të vogël."
  if (!/[0-9]/.test(password)) return "Fjalëkalimi duhet të ketë të paktën një numër."
  return ""
}

function ActivateAccountContent() {
  const { t } = useI18n()
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get("email") ?? ""
  const code = searchParams.get("code") ?? ""

  const [verifying, setVerifying] = useState(true)
  const [verificationError, setVerificationError] = useState("")
  const [resetCode, setResetCode] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resendingConfirmation, setResendingConfirmation] = useState(false)
  const [confirmationNotice, setConfirmationNotice] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    const confirm = async () => {
      if (!email || !code) {
        setVerificationError("Linku i konfirmimit është i pavlefshëm.")
        setVerifying(false)
        return
      }

      try {
        const response = await fetch(`${API_BASE_URL}/Auth/confirm-email-link`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, code }),
        })
        const data = await response.json()
        if (!response.ok || data.success === false || !data.resetCode) {
          setVerificationError(data.message ?? "Konfirmimi i email-it dështoi.")
          setVerifying(false)
          return
        }

        setResetCode(data.resetCode)
      } catch {
        setVerificationError("Gabim gjatë konfirmimit të email-it.")
      } finally {
        setVerifying(false)
      }
    }

    confirm()
  }, [code, email])

  const canResendConfirmation = !!email

  const resendConfirmationEmail = async () => {
    if (!email) return

    setConfirmationNotice("")
    setVerificationError("")
    setResendingConfirmation(true)

    try {
      const response = await fetch(`${API_BASE_URL}/Auth/resend-confirmation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await response.json()
      if (!response.ok || data.success === false) {
        setVerificationError(data.message ?? "Ridërgimi i email-it të konfirmimit dështoi.")
        return
      }

      setConfirmationNotice(data.message ?? "Email-i i konfirmimit u ridërgua.")
    } catch {
      setVerificationError("Ridërgimi i email-it të konfirmimit dështoi.")
    } finally {
      setResendingConfirmation(false)
    }
  }

  const passwordError = useMemo(() => {
    if (!submitted) return ""
    if (!password) return "Fjalëkalimi është i detyrueshëm."
    return validatePassword(password)
  }, [password, submitted])

  const confirmError = useMemo(() => {
    if (!submitted) return ""
    if (!confirmPassword) return "Konfirmimi i fjalëkalimit është i detyrueshëm."
    if (password !== confirmPassword) return "Fjalëkalimet nuk përputhen."
    return ""
  }, [confirmPassword, password, submitted])

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    setError("")

    if (!email || !resetCode) {
      setError("Konfirmimi nuk u përfundua. Hapni përsëri linkun e email-it.")
      return
    }

    if (passwordError || confirmError) return

    setLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/Auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          code: resetCode,
          newPassword: password,
          confirmNewPassword: confirmPassword,
        }),
      })
      const data = await response.json()
      if (!response.ok || data.success === false) {
        setError(data.message ?? "Vendosja e fjalëkalimit dështoi.")
        return
      }

      router.replace("/login")
    } catch {
      setError("Gabim gjatë vendosjes së fjalëkalimit.")
    } finally {
      setLoading(false)
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

            <h1 className="text-xl font-semibold tracking-tight text-foreground mt-2">Aktivizo Llogarinë</h1>
            <p className="text-sm text-muted-foreground">Konfirmimi i email-it dhe vendosja e fjalëkalimit.</p>
          </div>

          {verifying ? (
            <div className="rounded-lg border border-border bg-muted/30 p-4 flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Duke verifikuar linkun...
            </div>
          ) : verificationError ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 p-3">
                <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-destructive">{verificationError}</p>
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
              {confirmationNotice ? (
                <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3 text-sm text-green-600">
                  {confirmationNotice}
                </div>
              ) : null}
              <Link
                href="/login"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors text-center"
              >
                ← Kthehu te hyrja
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password" className="text-sm font-medium text-foreground">
                  Fjalëkalimi i ri
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-10 pl-9 pr-10"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Fsheh fjalëkalimin" : "Shfaq fjalëkalimin"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {passwordError && <p className="text-xs text-destructive">{passwordError}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
                  Konfirmo fjalëkalimin
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="h-10 pl-9 pr-10"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                    aria-label={showConfirmPassword ? "Fsheh fjalëkalimin" : "Shfaq fjalëkalimin"}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {confirmError && <p className="text-xs text-destructive">{confirmError}</p>}
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 p-3">
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                className="h-10 w-full font-medium"
                disabled={loading}
                style={{ background: "linear-gradient(135deg, #0d2347, #2563eb)" }}
              >
                {loading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Duke ruajtur...</>
                ) : "Aktivizo llogarinë"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

function ActivateAccountFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Duke ngarkuar...
      </div>
    </div>
  )
}

export default function ActivateAccountPage() {
  return (
    <Suspense fallback={<ActivateAccountFallback />}>
      <ActivateAccountContent />
    </Suspense>
  )
}
