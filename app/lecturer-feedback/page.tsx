"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { fetchApi } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { CheckCircle2, Star, AlertCircle, Loader2 } from "lucide-react"

type FeedbackInfo = {
  eventName: string
  sessionDate: string
  lecturerName: string
  alreadySubmitted: boolean
}

function LecturerFeedbackContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? ""

  const [info, setInfo] = useState<FeedbackInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState("")
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!token) {
      setError("Linku është i pavlefshëm.")
      setLoading(false)
      return
    }
    fetchApi(`/Events/lecturer-feedback/info?token=${encodeURIComponent(token)}`)
      .then((data) => setInfo(data as FeedbackInfo))
      .catch(() => setError("Linku është i pavlefshëm ose ka skaduar."))
      .finally(() => setLoading(false))
  }, [token])

  async function handleSubmit() {
    if (rating === 0) return
    setSubmitting(true)
    try {
      await fetchApi(`/Events/lecturer-feedback/submit?token=${encodeURIComponent(token)}`, {
        method: "POST",
        body: JSON.stringify({ rating, comment: comment.trim() || null, isAnonymous }),
      })
      setSubmitted(true)
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status
      if (status === 409) {
        setInfo(prev => prev ? { ...prev, alreadySubmitted: true } : prev)
      } else {
        setError("Ndodhi një gabim. Ju lutemi provoni përsëri.")
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        {/* Header */}
        <div className="bg-[#0f2138] px-6 py-5">
          <p className="text-xs font-medium text-[#c6d2e3] uppercase tracking-wider mb-1">IEKA SmartClass</p>
          <h1 className="text-xl font-bold text-white">Vlerësoni Lektorin</h1>
        </div>

        <div className="px-6 py-6">
          {loading && (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Duke ngarkuar...
            </div>
          )}

          {!loading && error && (
            <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {!loading && !error && info?.alreadySubmitted && !submitted && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <p className="text-sm font-medium text-foreground">Ju keni dërguar tashmë feedback për këtë sesion.</p>
              <p className="text-xs text-muted-foreground">Faleminderit për kontributin tuaj!</p>
            </div>
          )}

          {submitted && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <p className="text-sm font-semibold text-foreground">Faleminderit për feedback-un tuaj!</p>
              <p className="text-xs text-muted-foreground">Vlerësimi juaj u regjistrua me sukses.</p>
            </div>
          )}

          {!loading && !error && info && !info.alreadySubmitted && !submitted && (
            <div className="flex flex-col gap-5">
              {/* Event info */}
              <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm space-y-1">
                <p><span className="text-muted-foreground">Moduli:</span> <span className="font-medium">{info.eventName}</span></p>
                <p><span className="text-muted-foreground">Data:</span> <span className="font-medium">{info.sessionDate}</span></p>
                <p><span className="text-muted-foreground">Lektori:</span> <span className="font-medium">{info.lecturerName}</span></p>
              </div>

              {/* Star rating */}
              <div>
                <p className="text-sm font-medium text-foreground mb-2">Vlerësimi i lektorit <span className="text-destructive">*</span></p>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setRating(s)}
                      onMouseEnter={() => setHovered(s)}
                      onMouseLeave={() => setHovered(0)}
                      className="rounded p-0.5 transition-transform hover:scale-110"
                    >
                      <Star
                        className={`h-7 w-7 transition-colors ${s <= (hovered || rating)
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground"
                          }`}
                      />
                    </button>
                  ))}
                  {rating > 0 && (
                    <span className="ml-2 text-sm text-muted-foreground">{rating}/5</span>
                  )}
                </div>
              </div>

              {/* Comment */}
              <div>
                <p className="text-sm font-medium text-foreground mb-2">Koment <span className="text-xs text-muted-foreground">(opsionale)</span></p>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Ndani mendimin tuaj për lektorin..."
                  className="min-h-[100px] resize-none"
                />
              </div>

              {/* Anonymous checkbox */}
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div
                  role="checkbox"
                  aria-checked={isAnonymous}
                  onClick={() => setIsAnonymous(!isAnonymous)}
                  className={`h-5 w-5 rounded border-2 flex items-center justify-center transition-colors cursor-pointer ${isAnonymous ? "border-primary bg-primary" : "border-border bg-background"
                    }`}
                >
                  {isAnonymous && (
                    <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Dërgoni anonim</p>
                  <p className="text-xs text-muted-foreground">Emri juaj nuk do të shfaqet te vlerësimet</p>
                </div>
              </label>

              <Button
                onClick={handleSubmit}
                disabled={rating === 0 || submitting}
                className="w-full"
              >
                {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Duke dërguar...</> : "Dërgo Vlerësimin"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function LecturerFeedbackPage() {
  return (
    <Suspense>
      <LecturerFeedbackContent />
    </Suspense>
  )
}
