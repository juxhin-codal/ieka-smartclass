"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { fetchApi } from "@/lib/api-client"
import type { EventItem, FeedbackQuestionnaire } from "@/lib/data"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { AlertCircle, CheckCircle2, Star } from "lucide-react"

function normalizeFeedbackQuestionnaires(event: EventItem): FeedbackQuestionnaire[] {
  if (event.feedbackQuestionnaires && event.feedbackQuestionnaires.length > 0) {
    return event.feedbackQuestionnaires
  }

  if (event.feedbackQuestions && event.feedbackQuestions.length > 0) {
    return [
      {
        id: "legacy-default",
        title: "Pyetësori i Feedback-ut",
        questions: event.feedbackQuestions,
      },
    ]
  }

  return []
}

function QuestionnaireContent() {
  const searchParams = useSearchParams()
  const eventId = searchParams.get("eventId") ?? ""
  const questionnaireId = searchParams.get("questionnaireId") ?? ""
  const dateId = searchParams.get("dateId")

  const [eventItem, setEventItem] = useState<EventItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState("")
  const [answers, setAnswers] = useState<Record<string, string>>({})

  useEffect(() => {
    async function loadEvent() {
      if (!eventId) {
        setError("Mungon eventId në link.")
        setLoading(false)
        return
      }

      try {
        const data = (await fetchApi(`/Events/${eventId}`)) as EventItem
        setEventItem(data)
      } catch (e: any) {
        setError(e?.message ?? "Nuk u ngarkua pyetësori.")
      } finally {
        setLoading(false)
      }
    }

    void loadEvent()
  }, [eventId])

  const questionnaire = useMemo(() => {
    if (!eventItem || !questionnaireId) return null
    const questionnaires = normalizeFeedbackQuestionnaires(eventItem)
    return questionnaires.find((item) => item.id === questionnaireId) ?? null
  }, [eventItem, questionnaireId])

  const isReadyToSubmit = useMemo(() => {
    if (!questionnaire || questionnaire.questions.length === 0) return false
    return questionnaire.questions.every((question) => {
      const answer = answers[question.id]
      return typeof answer === "string" && answer.trim().length > 0
    })
  }, [questionnaire, answers])

  function setAnswer(questionId: string, value: string) {
    setAnswers((previous) => ({ ...previous, [questionId]: value }))
  }

  async function handleSubmit() {
    if (!questionnaire) return
    if (!isReadyToSubmit) {
      setError("Plotësoni të gjitha pyetjet para dërgimit.")
      return
    }

    setSubmitting(true)
    setError("")
    try {
      await fetchApi(`/Events/${eventId}/feedback`, {
        method: "POST",
        body: JSON.stringify({
          dateId: dateId || null,
          questionnaireId: questionnaire.id,
          questionnaireTitle: questionnaire.title,
          answers: questionnaire.questions.map((question) => ({
            questionId: question.id,
            answer: answers[question.id] ?? "",
          })),
          sessionRating: null,
          sessionComments: null,
          lecturerRating: null,
          lecturerComments: null,
          suggestions: null,
        }),
      })
      setSubmitted(true)
    } catch (e: any) {
      setError(e?.message ?? "Dërgimi i pyetësorit dështoi.")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-2xl items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">Duke ngarkuar pyetësorin...</p>
      </div>
    )
  }

  if (error && !eventItem) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-2xl items-center justify-center px-4">
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-5 text-center">
          <p className="flex items-center justify-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {error}
          </p>
        </div>
      </div>
    )
  }

  if (!questionnaire) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-2xl items-center justify-center px-4">
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-5 text-center">
          <p className="flex items-center justify-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            Pyetësori nuk u gjet.
          </p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-2xl items-center justify-center px-4">
        <div className="w-full rounded-xl border border-border bg-card p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          </div>
          <h1 className="text-lg font-semibold text-foreground">Faleminderit!</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Përgjigjet tuaja u regjistruan me sukses.
          </p>
        </div>
      </div>
    )
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="rounded-xl border border-border bg-card p-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">IEKA SmartClass</p>
        <h1 className="mt-1 text-lg font-semibold text-foreground">{questionnaire.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{eventItem?.name}</p>

        <div className="mt-6 space-y-5">
          {questionnaire.questions.map((question, index) => (
            <div key={question.id} className="rounded-lg border border-border bg-muted/20 p-4">
              <p className="mb-2 text-sm font-medium text-foreground">
                <span className="mr-1.5 text-primary">{index + 1}.</span>
                {question.question}
              </p>

              {question.type === "rating" && (
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
                      <Star className={`h-4 w-4 ${answers[question.id] === String(value) ? "fill-white text-white" : "text-amber-400"}`} />
                    </button>
                  ))}
                </div>
              )}

              {question.type === "multiple-choice" && (
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

              {question.type === "text" && (
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
          <Button onClick={() => void handleSubmit()} disabled={submitting || !isReadyToSubmit} className="min-w-[170px]">
            {submitting ? "Duke dërguar..." : "Dërgo pyetësorin"}
          </Button>
        </div>
      </div>
    </main>
  )
}

function QuestionnaireFallback() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl items-center justify-center px-4">
      <p className="text-sm text-muted-foreground">Duke ngarkuar pyetësorin...</p>
    </div>
  )
}

export default function QuestionnairePage() {
  return (
    <Suspense fallback={<QuestionnaireFallback />}>
      <QuestionnaireContent />
    </Suspense>
  )
}
