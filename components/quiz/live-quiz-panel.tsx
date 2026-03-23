"use client"

/**
 * LiveQuizPanel — displayed to Lecturers via the QR button in EventDetail.
 * Shows questions one by one with a countdown and a live bar chart of anonymous results.
 */

import { useState, useEffect, useCallback } from "react"
import type { QuizQuestion, QuizAnswer } from "@/lib/data"
import { useEvents } from "@/lib/events-context"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Clock, QrCode, BarChart3, Users, X, ChevronRight, RotateCcw } from "lucide-react"

// ─── simulate participant answers arriving ────────────────────────────────────
function generateFakeAnswers(question: QuizQuestion, participantCount: number): QuizAnswer[] {
    return Array.from({ length: Math.floor(participantCount * (0.7 + Math.random() * 0.25)) }, (_, i) => ({
        participantRegistryNumber: `IEKA-${2000 + i}`,
        questionId: question.id,
        chosenIndex: Math.random() < 0.62
            ? question.correctIndex
            : Math.floor(Math.random() * question.options.length),
        answeredAt: Date.now() - Math.random() * 15000,
    }))
}

interface LiveQuizPanelProps {
    eventId: string
    eventName: string
    questions: QuizQuestion[]
    participantCount: number
    onClose: () => void
}

export function LiveQuizPanel({ eventId, eventName, questions, participantCount, onClose }: LiveQuizPanelProps) {
    const { startQuiz, stopQuiz } = useEvents()
    const [phase, setPhase] = useState<"idle" | "question" | "results" | "summary">("idle")
    const [qIndex, setQIndex] = useState(0)
    const [timeLeft, setTimeLeft] = useState(0)
    const [answers, setAnswers] = useState<QuizAnswer[]>([])
    const [allResults, setAllResults] = useState<{ question: QuizQuestion; answers: QuizAnswer[] }[]>([])

    const currentQ = questions[qIndex]

    // Countdown timer
    useEffect(() => {
        if (phase !== "question" || timeLeft <= 0) return
        const id = setInterval(() => {
            setTimeLeft((t) => {
                if (t <= 1) {
                    clearInterval(id)
                    // Time's up → reveal results with simulated answers
                    setAnswers(generateFakeAnswers(currentQ, participantCount))
                    setPhase("results")
                    return 0
                }
                return t - 1
            })
        }, 1000)
        return () => clearInterval(id)
    }, [phase, timeLeft, currentQ, participantCount])

    function startQuestion() {
        setAnswers([])
        setTimeLeft(currentQ.timeLimitSec)
        setPhase("question")
        // Signal to context that quiz is now live for this event
        startQuiz(eventId)
    }

    function revealResults() {
        setAnswers(generateFakeAnswers(currentQ, participantCount))
        setTimeLeft(0)
        setPhase("results")
    }

    function nextQuestion() {
        setAllResults((prev) => [...prev, { question: currentQ, answers }])
        if (qIndex + 1 >= questions.length) {
            setPhase("summary")
            // Quiz finished, stop it
            stopQuiz(eventId)
        } else {
            setQIndex((i) => i + 1)
            setPhase("idle")
        }
    }

    function reset() {
        setPhase("idle")
        setQIndex(0)
        setAnswers([])
        setAllResults([])
        // Quiz restarted = still live
        startQuiz(eventId)
    }

    function handleClose() {
        stopQuiz(eventId)
        onClose()
    }

    // ── Count answers per option ──────────────────────────────────────────────
    const counts = currentQ?.options.map((_, i) => answers.filter((a) => a.chosenIndex === i).length) ?? []
    const totalAnswered = answers.length
    const correctCount = answers.filter((a) => a.chosenIndex === currentQ?.correctIndex).length
    const correctPct = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0
    const participationPct = Math.round((totalAnswered / Math.max(1, participantCount)) * 100)

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <div className="bg-card w-full max-w-2xl rounded-2xl border border-border shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border px-6 py-4"
                    style={{ background: "linear-gradient(135deg, #0d2347 0%, #1a3a6b 100%)" }}>
                    <div>
                        <p className="text-xs text-white/60 mb-0.5">{eventName}</p>
                        <h2 className="text-base font-bold text-white">Live Quiz — Ligjëruesi</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white">
                            {qIndex + 1} / {questions.length} pyetje
                        </span>
                        <button onClick={handleClose} className="rounded-lg p-1.5 text-white/60 hover:bg-white/10">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                <div className="p-6">
                    {/* IDLE — ready to start current question */}
                    {phase === "idle" && (
                        <div className="flex flex-col items-center gap-6 py-4">
                            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
                                <QrCode className="h-10 w-10 text-primary" />
                            </div>
                            <div className="text-center">
                                <h3 className="text-lg font-bold text-foreground mb-2">Pyetja {qIndex + 1}</h3>
                                <p className="text-foreground font-medium text-base max-w-md">{currentQ?.question}</p>
                                <p className="text-sm text-muted-foreground mt-2">
                                    Koha: {currentQ?.timeLimitSec}s • {participantCount} pjesëmarrës
                                </p>
                            </div>
                            {/* Show QR mock when idle — members scan to join */}
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-32 h-32 bg-white border-4 border-white rounded-xl flex items-center justify-center shadow relative">
                                    <QrCode className="w-full h-full text-black/80 p-2" />
                                    <div className="absolute bottom-0 inset-x-0 h-0.5 bg-primary animate-pulse rounded" />
                                </div>
                                <p className="text-xs text-muted-foreground">Anëtarët skanojnë → Hapin pyetjen</p>
                            </div>
                            <Button onClick={startQuestion} className="gap-2 px-8">
                                <ChevronRight className="h-4 w-4" /> Fillo Pyetjen
                            </Button>
                        </div>
                    )}

                    {/* QUESTION — countdown active */}
                    {phase === "question" && (
                        <div className="flex flex-col gap-5">
                            <div className="flex items-center justify-between">
                                <h3 className="text-base font-bold text-foreground max-w-md">{currentQ.question}</h3>
                                <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-4 text-xl font-bold transition-colors ${timeLeft <= 10 ? "border-red-500 text-red-500 animate-pulse" : "border-primary text-primary"
                                    }`}>
                                    {timeLeft}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {currentQ.options.map((opt, i) => (
                                    <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3">
                                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/10 text-xs font-bold text-primary">
                                            {String.fromCharCode(65 + i)}
                                        </span>
                                        <span className="text-sm text-foreground">{opt}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> {participantCount} pjesëmarrës</span>
                                <Button variant="outline" size="sm" onClick={revealResults}>Trego Rezultatet</Button>
                            </div>
                        </div>
                    )}

                    {/* RESULTS — bar chart + correct answer highlighted */}
                    {phase === "results" && (
                        <div className="flex flex-col gap-5">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-foreground max-w-md">{currentQ.question}</h3>
                                <div className="flex items-center gap-3 text-xs">
                                    <span className="rounded-full bg-green-500/10 px-2.5 py-1 font-medium text-green-500">
                                        ✓ {correctPct}% saktë
                                    </span>
                                    <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                                        {participationPct}% morën pjesë
                                    </span>
                                </div>
                            </div>

                            {/* Answer bars */}
                            <div className="flex flex-col gap-2.5">
                                {currentQ.options.map((opt, i) => {
                                    const pct = totalAnswered > 0 ? Math.round((counts[i] / totalAnswered) * 100) : 0
                                    const isCorrect = i === currentQ.correctIndex
                                    return (
                                        <div key={i} className={`rounded-lg border p-3 ${isCorrect ? "border-green-500/30 bg-green-500/5" : "border-border bg-muted/20"}`}>
                                            <div className="flex items-center justify-between mb-1.5">
                                                <div className="flex items-center gap-2">
                                                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs font-bold ${isCorrect ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"}`}>
                                                        {String.fromCharCode(65 + i)}
                                                    </span>
                                                    <span className="text-sm text-foreground">{opt}</span>
                                                    {isCorrect && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                                                </div>
                                                <span className="text-sm font-semibold text-foreground">{pct}%</span>
                                            </div>
                                            <div className="h-2 rounded-full bg-border overflow-hidden">
                                                <div className={`h-full rounded-full transition-all duration-700 ${isCorrect ? "bg-green-500" : "bg-muted-foreground/40"}`}
                                                    style={{ width: `${pct}%` }} />
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1">{counts[i]} votë</p>
                                        </div>
                                    )
                                })}
                            </div>
                            <div className="flex justify-end">
                                <Button onClick={nextQuestion} className="gap-2">
                                    {qIndex + 1 >= questions.length ? "Shiko Përmbledhjen" : "Pyetja Tjetër"}
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* SUMMARY — all questions overview */}
                    {phase === "summary" && (
                        <div className="flex flex-col gap-4">
                            <div className="text-center mb-2">
                                <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-green-500/15 mb-3">
                                    <BarChart3 className="h-6 w-6 text-green-500" />
                                </div>
                                <h3 className="text-lg font-bold text-foreground">Quiz i Përfunduar</h3>
                                <p className="text-sm text-muted-foreground">{allResults.length} pyetje • {participantCount} pjesëmarrës</p>
                            </div>
                            <div className="flex flex-col gap-2">
                                {allResults.map(({ question: q, answers: ans }, idx) => {
                                    const total = ans.length
                                    const correct = ans.filter((a) => a.chosenIndex === q.correctIndex).length
                                    const pct = total > 0 ? Math.round((correct / total) * 100) : 0
                                    const part = Math.round((total / Math.max(1, participantCount)) * 100)
                                    return (
                                        <div key={q.id} className="rounded-lg border border-border bg-muted/20 p-3">
                                            <div className="flex items-start justify-between gap-3">
                                                <p className="text-sm text-foreground flex-1">
                                                    <span className="font-semibold text-primary mr-2">P{idx + 1}.</span>
                                                    {q.question}
                                                </p>
                                                <div className="flex gap-2 shrink-0 text-xs">
                                                    <span className="rounded bg-green-500/10 px-2 py-0.5 font-medium text-green-500">{pct}% saktë</span>
                                                    <span className="rounded bg-muted px-2 py-0.5 text-muted-foreground">{part}% marrin pjesë</span>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t border-border">
                                <Button variant="ghost" onClick={reset} className="gap-2 text-muted-foreground">
                                    <RotateCcw className="h-4 w-4" /> Rikthe Quiz
                                </Button>
                                <Button onClick={handleClose}>Mbyll</Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
