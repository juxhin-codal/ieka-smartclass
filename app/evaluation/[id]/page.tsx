"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { fetchApi } from "@/lib/api-client"
import type { EvaluationFillResponse } from "@/lib/data"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { CheckCircle2, AlertCircle, Loader2, Star } from "lucide-react"

export default function EvaluationFillPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const { isAuthenticated, user } = useAuth()

  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [questionnaire, setQuestionnaire] = useState<EvaluationFillResponse | null>(null)
  const [error, setError] = useState("")
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted) return

    if (!isAuthenticated) {
      const redirect = `/evaluation/${id}`
      router.replace(`/login?redirect=${encodeURIComponent(redirect)}`)
      return
    }

    async function load() {
      try {
        const data = (await fetchApi(`/Evaluation/fill/${id}`)) as EvaluationFillResponse
        setQuestionnaire(data)
      } catch (e: any) {
        setError(e?.message ?? "Gabim gjatë ngarkimit të pyetësorit.")
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [mounted, isAuthenticated, id, router])

  function setAnswer(questionId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  const allAnswered = questionnaire
    ? questionnaire.questions.every((q) => {
      const a = answers[q.id]
      return typeof a === "string" && a.trim().length > 0
    })
    : false

  async function handleSubmit() {
    if (!questionnaire || !allAnswered || submitting) return
    setSubmitting(true)
    setError("")
    try {
      await fetchApi(`/Evaluation/fill/${id}`, {
        method: "POST",
        body: JSON.stringify({
          answers: questionnaire.questions.map((q) => ({
            questionId: q.id,
            answer: answers[q.id] ?? "",
          })),
        }),
      })
      setSubmitted(true)
    } catch (e: any) {
      setError(e?.message ?? "Dërgimi i pyetësorit dështoi.")
    } finally {
      setSubmitting(false)
    }
  }

  if (!mounted || (loading && !error)) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-2xl items-center justify-center px-4">
        <div className="w-full rounded-xl border border-border bg-card p-8 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">Duke ngarkuar pyetësorin...</p>
        </div>
      </div>
    )
  }

  if (error && !questionnaire) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-2xl items-center justify-center px-4">
        <div className="w-full rounded-xl border border-border bg-card p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Gabim</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  if (questionnaire?.alreadyAnswered) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-2xl items-center justify-center px-4">
        <div className="w-full rounded-xl border border-border bg-card p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
            <AlertCircle className="h-8 w-8 text-amber-600" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Tashmë i Plotësuar</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Keni plotësuar tashmë pyetësorin &ldquo;{questionnaire.title}&rdquo;.
          </p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-2xl items-center justify-center px-4">
        <div className="w-full rounded-xl border border-border bg-card p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Faleminderit!</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Përgjigjet tuaja u regjistruan me sukses.
          </p>
          <p className="mt-6 text-xs text-muted-foreground">Mund ta mbyllni këtë faqe.</p>
        </div>
      </div>
    )
  }

  if (!questionnaire) return null

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="rounded-xl border border-border bg-card p-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">IEKA SmartClass</p>
        <h1 className="mt-1 text-lg font-semibold text-foreground">{questionnaire.title}</h1>
        {questionnaire.description && (
          <p className="mt-2 text-sm text-muted-foreground">{questionnaire.description}</p>
        )}

        <div className="mt-6 space-y-5">
          {questionnaire.questions.map((question, index) => (
            <div key={question.id} className="rounded-lg border border-border bg-muted/20 p-4">
              <p className="mb-2 text-sm font-medium text-foreground">
                <span className="mr-1.5 text-primary">{index + 1}.</span>
                {question.text}
              </p>

              {/* Stars (type=2) */}
              {question.type === 2 && (
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setAnswer(question.id, String(value))}
                      className={`flex h-10 w-10 items-center justify-center rounded-lg border text-sm font-semibold transition-colors ${answers[question.id] === String(value)
                        ? "border-amber-500 bg-amber-500 text-white"
                        : "border-border bg-card text-muted-foreground hover:border-amber-400"
                        }`}
                    >
                      <Star
                        className={`h-4 w-4 ${answers[question.id] === String(value)
                          ? "fill-white text-white"
                          : "text-amber-400"
                          }`}
                      />
                    </button>
                  ))}
                </div>
              )}

              {/* Options (type=0) */}
              {question.type === 0 && (
                <div className="flex flex-col gap-2">
                  {(question.options ?? []).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setAnswer(question.id, option)}
                      className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${answers[question.id] === option
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-foreground hover:border-primary/50"
                        }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}

              {/* FreeText (type=1) */}
              {question.type === 1 && (
                <Textarea
                  value={answers[question.id] ?? ""}
                  onChange={(e) => setAnswer(question.id, e.target.value)}
                  placeholder="Shkruani përgjigjen tuaj..."
                  className="bg-card"
                  rows={4}
                />
              )}
            </div>
          ))}
        </div>

        {error && (
          <p className="mt-4 flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end">
          <Button
            onClick={() => void handleSubmit()}
            disabled={submitting || !allAnswered}
            className="min-w-[170px]"
          >
            {submitting ? "Duke dërguar..." : "Dërgo pyetësorin"}
          </Button>
        </div>
      </div>
    </main>
  )
}
