"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useParams, useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { fetchApi } from "@/lib/api-client"
import type { ModuleFeedbackFillResponse, ModuleFeedbackSection, ModuleFeedbackTopicInfo } from "@/lib/data"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { CheckCircle2, AlertCircle, Loader2, Star, ChevronLeft, ChevronRight, Lock, ShieldX } from "lucide-react"

type StepInfo = {
  section: ModuleFeedbackSection
  topic?: ModuleFeedbackTopicInfo
}

export default function ModuleFeedbackPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const moduleId = params.moduleId as string
  const { isAuthenticated, user } = useAuth()

  // Read section filter, scope, and required role from URL
  const sectionFilter = searchParams.get("sections")?.split(",") ?? null
  const scope = searchParams.get("scope") ?? "all"
  const requiredRole = searchParams.get("role") // e.g. "Student" or "Member"

  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ModuleFeedbackFillResponse | null>(null)
  const [error, setError] = useState("")
  const [currentStep, setCurrentStep] = useState(0)
  // answers keyed by "questionId" or "questionId:topicId"
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted) return
    if (!isAuthenticated) {
      router.replace(`/login?redirect=${encodeURIComponent(`/module-feedback/${moduleId}`)}`)
      return
    }
    // Role gate: if the link specifies a required role, reject mismatching users immediately
    if (requiredRole && user?.role && user.role !== requiredRole) {
      setLoading(false)
      return
    }
    async function load() {
      try {
        const sectionsParam = sectionFilter ? `?sections=${sectionFilter.join(",")}` : ""
        const res = (await fetchApi(`/ModuleFeedback/fill/${moduleId}${sectionsParam}`)) as ModuleFeedbackFillResponse
        setData(res)
      } catch (e: any) {
        setError(e?.message ?? "Gabim gjatë ngarkimit.")
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [mounted, isAuthenticated, moduleId, router, sectionFilter?.join(",")])

  // Build step list: non-repeating sections = 1 step, repeating = 1 step per topic
  const steps: StepInfo[] = useMemo(() => {
    if (!data) return []
    const result: StepInfo[] = []
    for (const section of data.template.sections) {
      if (section.repeatsPerTopic && data.topics.length > 0) {
        for (const topic of data.topics) {
          result.push({ section, topic })
        }
      } else {
        result.push({ section })
      }
    }
    return result
  }, [data])

  const step = steps[currentStep]
  const isLastStep = currentStep === steps.length - 1

  function answerKey(questionId: string, topicId?: string) {
    return topicId ? `${questionId}:${topicId}` : questionId
  }

  function setAnswer(questionId: string, topicId: string | undefined, value: string) {
    setAnswers((prev) => ({ ...prev, [answerKey(questionId, topicId)]: value }))
  }

  function getAnswer(questionId: string, topicId?: string): string {
    return answers[answerKey(questionId, topicId)] ?? ""
  }

  // All star questions must be answered for this step; freetext is optional
  const currentStepValid = step
    ? step.section.questions
      .filter((q) => q.type === 2) // Stars required
      .every((q) => getAnswer(q.id, step.topic?.id).trim().length > 0)
    : false

  async function handleSubmit() {
    if (!data || submitting) return
    setSubmitting(true)
    setError("")

    // Flatten answers
    const payload: { questionId: string; topicId: string | null; answer: string }[] = []
    for (const s of steps) {
      for (const q of s.section.questions) {
        const val = getAnswer(q.id, s.topic?.id)
        if (val.trim()) {
          payload.push({
            questionId: q.id,
            topicId: s.topic?.id ?? null,
            answer: val,
          })
        }
      }
    }

    try {
      await fetchApi(`/ModuleFeedback/fill/${moduleId}`, {
        method: "POST",
        body: JSON.stringify({ answers: payload, sectionScope: scope, isAnonymous, requiredRole: requiredRole ?? null }),
      })
      setSubmitted(true)
    } catch (e: any) {
      setError(e?.message ?? "Dërgimi dështoi.")
    } finally {
      setSubmitting(false)
    }
  }

  // -- Render states --
  if (!mounted || (loading && !error)) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-2xl items-center justify-center px-4">
        <div className="w-full rounded-xl border border-border bg-card p-8 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">Duke ngarkuar formularin...</p>
        </div>
      </div>
    )
  }

  // Role gate: reject if the link was intended for a different role
  if (requiredRole && user?.role && user.role !== requiredRole) {
    const roleLabel = requiredRole === "Student" ? "Student" : "Anëtar"
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-2xl items-center justify-center px-4">
        <div className="w-full rounded-xl border border-border bg-card p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
            <ShieldX className="h-8 w-8 text-amber-600" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Qasje e ndaluar</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ky formular është vetëm për rolin <strong>{roleLabel}</strong>. Llogaria juaj nuk ka leje për ta plotësuar.
          </p>
        </div>
      </div>
    )
  }

  if (error && !data) {
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

  if (data?.alreadyAnswered) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-2xl items-center justify-center px-4">
        <div className="w-full rounded-xl border border-border bg-card p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
            <AlertCircle className="h-8 w-8 text-amber-600" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Tashmë i Plotësuar</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Keni plotësuar tashmë vlerësimin për këtë modul.
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
            Vlerësimi juaj u regjistrua me sukses.
          </p>
          <p className="mt-6 text-xs text-muted-foreground">Mund ta mbyllni këtë faqe.</p>
        </div>
      </div>
    )
  }

  if (!data || !step) return null

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="rounded-xl border border-border bg-card p-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">IEKA SmartClass</p>
        <h1 className="mt-1 text-lg font-semibold text-foreground">{data.template.title}</h1>

        {/* Step indicator */}
        <div className="mt-4 flex items-center justify-center gap-2">
          {steps.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => i < currentStep ? setCurrentStep(i) : undefined}
              className={`h-2.5 w-2.5 rounded-full transition-colors ${i === currentStep
                ? "bg-primary"
                : i < currentStep
                  ? "bg-primary/50 cursor-pointer"
                  : "bg-muted-foreground/20"
                }`}
              aria-label={`Hapi ${i + 1}`}
            />
          ))}
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Hapi {currentStep + 1} nga {steps.length}
        </p>

        {/* Section title */}
        <div className="mt-5 mb-4">
          <h2 className="text-sm font-bold text-foreground">{step.section.title}</h2>
          {step.topic && (
            <p className="mt-1 text-xs text-muted-foreground">
              Tema: <span className="font-medium text-foreground">{step.topic.name}</span>
              {step.topic.lecturer && (
                <> | Lektor: <span className="font-medium text-foreground">{step.topic.lecturer}</span></>
              )}
            </p>
          )}
          {(step.section.ratingLabelLow || step.section.ratingLabelHigh) && (
            <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
              {step.section.ratingLabelLow && (
                <span>1 = {step.section.ratingLabelLow}</span>
              )}
              {step.section.ratingLabelLow && step.section.ratingLabelHigh && <span>·</span>}
              {step.section.ratingLabelHigh && (
                <span>5 = {step.section.ratingLabelHigh}</span>
              )}
            </div>
          )}
        </div>

        {/* Questions */}
        <div className="space-y-5">
          {step.section.questions.map((question, index) => (
            <div key={question.id} className="rounded-lg border border-border bg-muted/20 p-4">
              <p className="mb-2 text-sm font-medium text-foreground">
                <span className="mr-1.5 text-primary">{index + 1}.</span>
                {question.text}
              </p>

              {/* Stars (type=2) */}
              {question.type === 2 && (
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5].map((value) => {
                    const selected = getAnswer(question.id, step.topic?.id) === String(value)
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setAnswer(question.id, step.topic?.id, String(value))}
                        className={`flex h-10 w-10 items-center justify-center rounded-lg border text-sm font-semibold transition-colors ${selected
                          ? "border-amber-500 bg-amber-500 text-white"
                          : "border-border bg-card text-muted-foreground hover:border-amber-400"
                          }`}
                      >
                        <Star className={`h-4 w-4 ${selected ? "fill-white text-white" : "text-amber-400"}`} />
                      </button>
                    )
                  })}
                </div>
              )}

              {/* FreeText (type=1) */}
              {question.type === 1 && (
                <Textarea
                  value={getAnswer(question.id, step.topic?.id)}
                  onChange={(e) => setAnswer(question.id, step.topic?.id, e.target.value)}
                  placeholder="Shkruani komentimin tuaj (opsionale)..."
                  className="bg-card"
                  rows={3}
                />
              )}
            </div>
          ))}
        </div>

        {/* Privacy / Anonymous toggle — last step only */}
        {isLastStep && (
          <div className="mt-5 rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex items-start gap-2.5 mb-3">
              <Lock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-foreground">Privatësia</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Mund të zgjidhni të dërgoni feedback-un tuaj anonim — emri juaj nuk do të shfaqet.
                </p>
              </div>
            </div>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div
                role="checkbox"
                aria-checked={isAnonymous}
                tabIndex={0}
                onClick={() => setIsAnonymous((v) => !v)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setIsAnonymous((v) => !v) }}
                className={`h-5 w-5 shrink-0 rounded border-2 flex items-center justify-center transition-colors cursor-pointer ${isAnonymous ? "border-primary bg-primary" : "border-border bg-background"
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
          </div>
        )}

        {error && (
          <p className="mt-4 flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {error}
          </p>
        )}

        {/* Navigation */}
        <div className="mt-6 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
            disabled={currentStep === 0}
            className="gap-1.5"
          >
            <ChevronLeft className="h-4 w-4" />
            Mbrapa
          </Button>

          {isLastStep ? (
            <Button
              onClick={() => void handleSubmit()}
              disabled={submitting || !currentStepValid}
              className="min-w-[180px]"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  Duke dërguar...
                </>
              ) : (
                "Dërgo Vlerësimin"
              )}
            </Button>
          ) : (
            <Button
              onClick={() => setCurrentStep((prev) => Math.min(steps.length - 1, prev + 1))}
              disabled={!currentStepValid}
              className="gap-1.5"
            >
              Vazhdo
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </main>
  )
}
