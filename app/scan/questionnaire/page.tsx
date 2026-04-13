"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { fetchApi } from "@/lib/api-client"
import type { QuestionnaireByTokenResponse, SubmitQuestionnaireResponse } from "@/lib/data"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { CheckCircle2, AlertCircle, ChevronLeft, ChevronRight, Loader2, Star } from "lucide-react"

function ScanQuestionnaireContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? ""
  const { isAuthenticated, user } = useAuth()

  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [questionnaire, setQuestionnaire] = useState<QuestionnaireByTokenResponse | null>(null)
  const [error, setError] = useState("")
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submissionReview, setSubmissionReview] = useState<SubmitQuestionnaireResponse | null>(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted) return

    if (!token) {
      setError("Link i pavlefshëm — mungon kodi QR.")
      setLoading(false)
      return
    }

    if (!isAuthenticated) {
      const redirect = `/scan/questionnaire?token=${encodeURIComponent(token)}`
      router.replace(`/login?redirect=${encodeURIComponent(redirect)}`)
      return
    }

    if (user?.role !== "Student" && user?.role !== "Member") {
      setError("Vetëm studentët ose anëtarët mund të plotësojnë pyetësorin.")
      setLoading(false)
      return
    }

    const isEventToken = token.startsWith("IEKA-EQ:") || token.startsWith("IEKA-EQ%3A")
    const fetchEndpoint = isEventToken
      ? `/Events/questionnaires/by-token?token=${encodeURIComponent(token)}`
      : `/StudentModules/questionnaires/by-token?token=${encodeURIComponent(token)}`

    async function loadQuestionnaire() {
      try {
        const data = (await fetchApi(fetchEndpoint)) as QuestionnaireByTokenResponse
        setQuestionnaire(data)
        setCurrentQuestionIndex(0)
      } catch (e: any) {
        setError(e?.message ?? "Gabim gjatë ngarkimit të pyetësorit.")
      } finally {
        setLoading(false)
      }
    }

    void loadQuestionnaire()
  }, [mounted, isAuthenticated, user, token, router])

  function setAnswer(questionId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  const answeredCount = questionnaire
    ? questionnaire.questions.filter((q) => {
      const answer = answers[q.id]
      return typeof answer === "string" && answer.trim().length > 0
    }).length
    : 0

  const currentQuestion = questionnaire?.questions[currentQuestionIndex] ?? null
  const isFirstQuestion = currentQuestionIndex === 0
  const isLastQuestion = questionnaire ? currentQuestionIndex === questionnaire.questions.length - 1 : true

  async function handleSubmit() {
    if (!questionnaire || answeredCount === 0 || submitting) return
    setSubmitting(true)
    setError("")
    const isEventToken = token.startsWith("IEKA-EQ:") || token.startsWith("IEKA-EQ%3A")
    const submitEndpoint = isEventToken ? "/Events/questionnaires/submit" : "/StudentModules/questionnaires/submit"
    try {
      const result = (await fetchApi(submitEndpoint, {
        method: "POST",
        body: JSON.stringify({
          qrToken: token,
          answers: questionnaire.questions.map((q) => ({
            questionId: q.id,
            answer: answers[q.id] ?? "",
          })),
        }),
      })) as SubmitQuestionnaireResponse
      setSubmissionReview(result)
      setSubmitted(true)
    } catch (e: any) {
      setError(e?.message ?? "Dërgimi i pyetësorit dështoi.")
    } finally {
      setSubmitting(false)
    }
  }

  // Loading state
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

  // Error without questionnaire
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

  // Already answered
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

  // Submitted successfully
  if (submitted) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-2xl items-center justify-center px-4">
        <div className="w-full rounded-xl border border-border bg-card p-8">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="text-xl font-semibold text-foreground">Faleminderit!</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Përgjigjet tuaja u regjistruan me sukses.
            </p>
          </div>

          {submissionReview && submissionReview.answers.length > 0 && (
            <div className="mt-6 space-y-3 border-t border-border pt-6">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Përmbledhja e përgjigjeve</h2>
                <p className="mt-1 text-xs text-muted-foreground">Për pyetjet me opsione shfaqet edhe përgjigjja e saktë.</p>
              </div>

              {submissionReview.answers.map((answer, index) => (
                <div key={answer.questionId} className="rounded-lg border border-border bg-muted/20 p-4">
                  <p className="mb-2 text-sm font-medium text-foreground">
                    <span className="mr-1.5 text-primary">{index + 1}.</span>
                    {answer.questionText}
                  </p>

                  {answer.questionType === "Stars" ? (
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((value) => (
                        <Star
                          key={value}
                          className={value <= Number(answer.answer) ? "h-4 w-4 fill-amber-400 text-amber-400" : "h-4 w-4 text-muted-foreground/30"}
                        />
                      ))}
                      <span className="ml-1 text-xs text-muted-foreground">({answer.answer}/5)</span>
                    </div>
                  ) : (
                    <p className="text-sm text-foreground">{answer.answer}</p>
                  )}

                  {answer.questionType === "Options" && answer.correctAnswer && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                      <span className={answer.isCorrect ? "rounded-full bg-green-500/10 px-2 py-0.5 font-medium text-green-600" : "rounded-full bg-red-500/10 px-2 py-0.5 font-medium text-red-600"}>
                        {answer.isCorrect ? "Përgjigje e saktë" : "Përgjigje jo e saktë"}
                      </span>
                      <span className="text-muted-foreground">Përgjigjja e saktë: {answer.correctAnswer}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <p className="mt-6 text-center text-xs text-muted-foreground">Mund ta mbyllni këtë faqe.</p>
        </div>
      </div>
    )
  }

  if (!questionnaire) return null

  // Questionnaire form
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="rounded-xl border border-border bg-card p-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">IEKA SmartClass</p>
        <h1 className="mt-1 text-lg font-semibold text-foreground">{questionnaire.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Mund të lëvizni mes pyetjeve dhe të lini bosh ato që nuk dëshironi t’i përgjigjeni.
        </p>

        <div className="mt-6 flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm">
          <div>
            <p className="font-medium text-foreground">Pyetja {currentQuestionIndex + 1} nga {questionnaire.questions.length}</p>
            <p className="text-xs text-muted-foreground">{answeredCount} të përgjigjura</p>
          </div>
          <div className="h-2 w-32 overflow-hidden rounded-full bg-border">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${((currentQuestionIndex + 1) / questionnaire.questions.length) * 100}%` }} />
          </div>
        </div>

        {currentQuestion && (
          <div className="mt-6 rounded-lg border border-border bg-muted/20 p-4">
            <p className="mb-2 text-sm font-medium text-foreground">
              <span className="mr-1.5 text-primary">{currentQuestionIndex + 1}.</span>
              {currentQuestion.text}
            </p>

            {currentQuestion.type === "Stars" && (
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setAnswer(currentQuestion.id, String(value))}
                    className={`flex h-10 w-10 items-center justify-center rounded-lg border text-sm font-semibold transition-colors ${answers[currentQuestion.id] === String(value)
                      ? "border-amber-500 bg-amber-500 text-white"
                      : "border-border bg-card text-muted-foreground hover:border-amber-400"
                      }`}
                  >
                    <Star
                      className={`h-4 w-4 ${answers[currentQuestion.id] === String(value)
                        ? "fill-white text-white"
                        : "text-amber-400"
                        }`}
                    />
                  </button>
                ))}
              </div>
            )}

            {currentQuestion.type === "Options" && (
              <div className="flex flex-col gap-2">
                {(currentQuestion.options ?? []).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setAnswer(currentQuestion.id, option)}
                    className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${answers[currentQuestion.id] === option
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-foreground hover:border-primary/50"
                      }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}

            {currentQuestion.type === "FreeText" && (
              <Textarea
                value={answers[currentQuestion.id] ?? ""}
                onChange={(e) => setAnswer(currentQuestion.id, e.target.value)}
                placeholder="Shkruani përgjigjen tuaj..."
                className="bg-card"
                rows={4}
              />
            )}
          </div>
        )}

        {error && (
          <p className="mt-4 flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrentQuestionIndex((index) => Math.max(0, index - 1))}
              disabled={isFirstQuestion}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Prapa
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrentQuestionIndex((index) => Math.min(questionnaire.questions.length - 1, index + 1))}
              disabled={isLastQuestion}
            >
              Tjetra
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>

          <Button
            onClick={() => void handleSubmit()}
            disabled={submitting || answeredCount === 0}
            className="min-w-[190px]"
          >
            {submitting ? "Duke dërguar..." : "Dërgo pyetësorin"}
          </Button>
        </div>
      </div>
    </main>
  )
}

export default function ScanQuestionnairePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-screen w-full max-w-2xl items-center justify-center px-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <ScanQuestionnaireContent />
    </Suspense>
  )
}
