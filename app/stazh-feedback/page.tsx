"use client"

import Image from "next/image"
import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Loader2, Star } from "lucide-react"
import { fetchApi } from "@/lib/api-client"
import type { StudentTrainingStazh } from "@/lib/data"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

function StazhFeedbackContent() {
  const searchParams = useSearchParams()
  const token = (searchParams.get("token") ?? "").trim()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [stazh, setStazh] = useState<StudentTrainingStazh | null>(null)

  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState("")
  const [submitLoading, setSubmitLoading] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [submitSuccess, setSubmitSuccess] = useState("")

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }

    let isCancelled = false
    const run = async () => {
      setLoading(true)
      setError("")
      try {
        const data = (await fetchApi(`/StudentTraining/stazh-feedback/${encodeURIComponent(token)}`)) as StudentTrainingStazh
        if (!isCancelled) {
          setStazh(data)
          if (typeof data.studentFeedbackRating === "number") {
            setRating(data.studentFeedbackRating)
          }
          setComment(data.studentFeedbackComment ?? "")
        }
      } catch (e: any) {
        if (!isCancelled) {
          setError(e?.message ?? "Nuk mund të hapet formulari i feedback-ut.")
          setStazh(null)
        }
      } finally {
        if (!isCancelled) {
          setLoading(false)
        }
      }
    }

    void run()
    return () => {
      isCancelled = true
    }
  }, [token])

  async function handleSubmit() {
    if (!token) return

    setSubmitLoading(true)
    setSubmitError("")
    setSubmitSuccess("")

    try {
      const response = (await fetchApi(`/StudentTraining/stazh-feedback/${encodeURIComponent(token)}`, {
        method: "POST",
        body: JSON.stringify({
          studentFeedbackRating: rating,
          studentFeedbackComment: comment.trim() || null,
        }),
      })) as StudentTrainingStazh

      setStazh(response)
      setSubmitSuccess("Vlerësimi u dërgua me sukses.")
    } catch (e: any) {
      setSubmitError(e?.message ?? "Gabim gjatë dërgimit të vlerësimit.")
    } finally {
      setSubmitLoading(false)
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

        <div>
          <h2 className="text-3xl font-bold leading-tight tracking-tight text-white text-balance mb-3">
            Vlerësim për Stazhin
          </h2>
          <p className="text-sm leading-relaxed text-white/70">
            Plotësoni formularin për mentorin pasi stazhi është mbyllur.
          </p>
        </div>

        <p className="text-xs text-white/40">Ky formular lidhet me një sesion të mbyllur stazhi.</p>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
          {!token ? (
            <p className="text-sm text-destructive">Mungon token-i i vlerësimit.</p>
          ) : loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Duke ngarkuar formularin...
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : !stazh ? (
            <p className="text-sm text-muted-foreground">Asnjë të dhënë për vlerësim.</p>
          ) : (
            <div className="space-y-4">
              <div>
                <h1 className="text-lg font-semibold text-foreground">Vlerësim për mentorin</h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Mentori: {stazh.mentorFirstName} {stazh.mentorLastName}
                </p>
                <p className="text-xs text-muted-foreground">Stazhi: {stazh.startedAt} - {stazh.endedAt ?? "—"}</p>
              </div>

              <div className="rounded-md border border-border bg-muted/20 px-3 py-2">
                <p className="text-xs font-medium text-foreground">Vlerësimi nga mentori</p>
                <p className="text-xs text-muted-foreground mt-1">Vlerësim: {stazh.mentorFeedbackRating ?? 0}/5</p>
                <p className="text-xs text-muted-foreground mt-1">{stazh.mentorFeedbackComment ?? "Nuk ka koment."}</p>
              </div>

              {stazh.studentFeedbackSubmittedAt ? (
                <div className="rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-700">
                  Vlerësimi juaj është dërguar më {stazh.studentFeedbackSubmittedAt}.
                </div>
              ) : (
                <>
                  <div>
                    <Label className="text-sm font-medium">Vlerësimi juaj</Label>
                    <div className="mt-2 flex items-center gap-1.5">
                      {[1, 2, 3, 4, 5].map((value) => (
                        <button key={value} type="button" onClick={() => setRating(value)} className="rounded-md p-1">
                          <Star className={`h-5 w-5 ${rating >= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                        </button>
                      ))}
                      <span className="ml-2 text-xs text-muted-foreground">{rating}/5</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Koment</Label>
                    <Textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      className="min-h-[100px]"
                      placeholder="Ndani përvojën tuaj me mentorin (opsionale)"
                    />
                  </div>

                  {submitError && <p className="text-sm text-destructive">{submitError}</p>}
                  {submitSuccess && <p className="text-sm text-green-700">{submitSuccess}</p>}

                  <Button className="w-full" onClick={() => void handleSubmit()} disabled={submitLoading}>
                    {submitLoading ? "Duke dërguar..." : "Dërgo vlerësimin"}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StazhFeedbackFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Duke ngarkuar...
      </div>
    </div>
  )
}

export default function StazhFeedbackPage() {
  return (
    <Suspense fallback={<StazhFeedbackFallback />}>
      <StazhFeedbackContent />
    </Suspense>
  )
}
