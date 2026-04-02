"use client"

import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { useI18n } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EmailDomainHints } from "@/components/ui/email-domain-hints"
import { Label } from "@/components/ui/label"
import { AlertCircle, BookOpen, Eye, EyeOff, KeyRound, Loader2, Lock, QrCode, Shield } from "lucide-react"

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { requestLoginOtp, verifyLoginOtp, resendLoginOtp } = useAuth()
  const { t } = useI18n()
  const redirectTo = searchParams.get("redirect")

  const [registryNumber, setRegistryNumber] = useState("")
  const [passcode, setPasscode] = useState("")
  const [showPasscode, setShowPasscode] = useState(false)
  const [otpCode, setOtpCode] = useState("")
  const [challengeId, setChallengeId] = useState("")
  const [emailHint, setEmailHint] = useState("")
  const [phoneHint, setPhoneHint] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false)
  const [isResendingOtp, setIsResendingOtp] = useState(false)
  const [error, setError] = useState("")
  const [step, setStep] = useState<"credentials" | "otp">("credentials")

  async function handleCredentials(event: React.FormEvent) {
    event.preventDefault()
    setError("")

    if (!registryNumber.trim()) {
      setError(t("login.errRegistry"))
      return
    }

    if (!passcode.trim()) {
      setError(t("login.errPasscode"))
      return
    }

    setIsLoading(true)
    try {
      const result = await requestLoginOtp(registryNumber.trim(), passcode.trim())
      if (!result.success || !result.challenge) {
        setError(result.error ?? t("login.errNotFound"))
        return
      }

      setChallengeId(result.challenge.challengeId)
      setEmailHint(result.challenge.emailHint ?? "")
      setPhoneHint(result.challenge.phoneHint ?? "")
      setOtpCode("")
      setStep("otp")
    } catch {
      setError(t("login.errServer"))
    } finally {
      setIsLoading(false)
    }
  }

  async function handleOtpSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError("")

    if (!otpCode.trim() || otpCode.trim().length < 6) {
      setError(t("login.errOtp"))
      return
    }

    setIsVerifyingOtp(true)
    try {
      const result = await verifyLoginOtp(challengeId, otpCode.trim())
      if (!result.success) {
        setError(result.error ?? t("login.errOtp"))
        return
      }

      router.push(redirectTo && redirectTo.startsWith("/") ? redirectTo : "/")
    } catch {
      setError(t("login.errServer"))
    } finally {
      setIsVerifyingOtp(false)
    }
  }

  async function handleResendOtp() {
    if (!challengeId) {
      return
    }

    setError("")
    setIsResendingOtp(true)
    try {
      const result = await resendLoginOtp(challengeId)
      if (!result.success) {
        setError(result.error ?? t("login.errServer"))
        return
      }
    } finally {
      setIsResendingOtp(false)
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

            {step === "credentials" ? (
              <>
                <h1 className="text-xl font-semibold tracking-tight text-foreground mt-2">{t("login.title")}</h1>
                <p className="text-sm text-muted-foreground">{t("login.subtitle")}</p>
              </>
            ) : (
              <>
                <h1 className="text-xl font-semibold tracking-tight text-foreground mt-2">{t("login.otpTitle")}</h1>
                <p className="text-sm text-muted-foreground">{t("login.otpSubtitle")}</p>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 mb-6">
            {[1, 2].map((stepNumber) => (
              <div key={stepNumber} className="flex items-center gap-2 flex-1">
                <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${(step === "credentials" && stepNumber === 1) || (step === "otp" && stepNumber <= 2)
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
                  }`}>
                  {step === "otp" && stepNumber === 1 ? "✓" : stepNumber}
                </div>
                <span className="text-xs text-muted-foreground">
                  {stepNumber === 1 ? t("login.step1") : t("login.stepOtp")}
                </span>
                {stepNumber < 2 && <div className="flex-1 h-px bg-border" />}
              </div>
            ))}
          </div>

          {step === "credentials" && (
            <form onSubmit={handleCredentials} className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="registry" className="text-sm font-medium text-foreground">
                  {t("login.registry")}
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="registry"
                    type="text"
                    placeholder="p.sh. IEKA-2045 ose email"
                    value={registryNumber}
                    onChange={(event) => setRegistryNumber(event.target.value)}
                    className="h-10 pl-9 font-mono tracking-wider"
                    autoComplete="username"
                  />
                </div>
                <EmailDomainHints value={registryNumber} onSelect={setRegistryNumber} />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="passcode" className="text-sm font-medium text-foreground">
                  {t("login.passcode")}
                </Label>
                <div className="relative">
                  <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="passcode"
                    type={showPasscode ? "text" : "password"}
                    placeholder="Shkruani fjalëkalimin"
                    value={passcode}
                    onChange={(event) => setPasscode(event.target.value)}
                    className="h-10 pl-9 pr-10"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasscode((prev) => !prev)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                    aria-label={showPasscode ? "Fsheh fjalëkalimin" : "Shfaq fjalëkalimin"}
                  >
                    {showPasscode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 p-3">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <Button type="submit" className="h-10 w-full font-medium" disabled={isLoading}
          style={{ background: "linear-gradient(135deg, #0d2347, #2563eb)" }}>
          {isLoading ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("login.errWait")}</>
          ) : t("login.continue")}
        </Button>

        <div className="text-center">
          <Link
            href="/forgot-password"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
          >
            {t("login.forgotPassword")}
          </Link>
        </div>
      </form>
          )}

      {step === "otp" && (
        <form onSubmit={handleOtpSubmit} className="flex flex-col gap-5">
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">
              {t("login.otpSentTo")}
            </p>
            <p className="text-xs font-medium text-foreground mt-1">
              {emailHint || "email i regjistruar"}
              {phoneHint ? ` • ${phoneHint}` : ""}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="otpCode" className="text-sm font-medium text-foreground">
              {t("login.otp")}
            </Label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="otpCode"
                type="text"
                inputMode="numeric"
                placeholder="000000"
                value={otpCode}
                onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                className="h-10 pl-9 tracking-[0.35em] font-mono"
                autoComplete="one-time-code"
                autoFocus
              />
            </div>
            <p className="text-xs text-muted-foreground">{t("login.otpHelp")}</p>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 p-3">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <Button type="submit" className="h-10 w-full font-medium" disabled={isVerifyingOtp}
            style={{ background: "linear-gradient(135deg, #0d2347, #2563eb)" }}>
            {isVerifyingOtp ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("login.errWait")}</>
            ) : t("login.submit")}
          </Button>

          <button
            type="button"
            onClick={handleResendOtp}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors text-center"
            disabled={isResendingOtp}
          >
            {isResendingOtp ? `${t("login.otpResend")}...` : t("login.otpResend")}
          </button>

          <button type="button" onClick={() => { setStep("credentials"); setError("") }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors text-center">
            {t("login.back")}
          </button>
        </form>
      )}
    </div>
      </div >
    </div >
  )
}
