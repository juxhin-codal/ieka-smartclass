"use client"

/**
 * MemberQuizPage — shown to Members when they scan the in-class QR code.
 * Time-limited multiple choice answers with immediate confirmation.
 */

import { useState, useEffect } from "react"
import type { QuizQuestion } from "@/lib/data"
import { CheckCircle2, XCircle, Clock, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface MemberQuizPageProps {
    eventName: string
    questions: QuizQuestion[]
    onClose: () => void
}

export function MemberQuizPage({ eventName, questions, onClose }: MemberQuizPageProps) {
    const [qIndex, setQIndex] = useState(0)
    const [selected, setSelected] = useState<number | null>(null)
    const [submitted, setSubmitted] = useState(false)
    const [timeLeft, setTimeLeft] = useState(questions[0]?.timeLimitSec ?? 30)
    const [score, setScore] = useState(0)
    const [done, setDone] = useState(false)

    const currentQ = questions[qIndex]

    // Countdown
    useEffect(() => {
        if (submitted || done) return
        const id = setInterval(() => {
            setTimeLeft((t) => {
                if (t <= 1) {
                    clearInterval(id)
                    setSubmitted(true) // auto-submit on timeout
                    return 0
                }
                return t - 1
            })
        }, 1000)
        return () => clearInterval(id)
    }, [qIndex, submitted, done])

    function handleSelect(i: number) {
        if (submitted) return
        setSelected(i)
    }

    function handleSubmit() {
        if (selected === null) return
        setSubmitted(true)
        if (selected === currentQ.correctIndex) setScore((s) => s + 1)
    }

    function handleNext() {
        if (qIndex + 1 >= questions.length) {
            setDone(true)
        } else {
            setQIndex((i) => i + 1)
            setSelected(null)
            setSubmitted(false)
            setTimeLeft(questions[qIndex + 1]?.timeLimitSec ?? 30)
        }
    }

    const timerPct = (timeLeft / (currentQ?.timeLimitSec ?? 30)) * 100

    if (done) {
        const pct = Math.round((score / questions.length) * 100)
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm p-4">
                <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 flex flex-col items-center gap-4 shadow-2xl">
                    <div className={`flex h-20 w-20 items-center justify-center rounded-full ${pct >= 60 ? "bg-green-500/15" : "bg-amber-500/15"}`}>
                        {pct >= 60 ? <CheckCircle2 className="h-10 w-10 text-green-500" /> : <XCircle className="h-10 w-10 text-amber-500" />}
                    </div>
                    <div className="text-center">
                        <h2 className="text-xl font-bold text-foreground">Quiz i Përfunduar!</h2>
                        <p className="text-3xl font-black text-foreground mt-2">{score}/{questions.length}</p>
                        <p className="text-sm text-muted-foreground mt-1">({pct}% saktë)</p>
                    </div>
                    <p className="text-sm text-muted-foreground text-center">
                        {pct >= 80 ? "Shkëlqyeshëm! Njohuri të forta." : pct >= 60 ? "Mirë! Vazhdoni mësimin." : "Shumë çfarë mësohet — rishikoni materialin."}
                    </p>
                    <Button onClick={onClose} className="w-full mt-2">Mbyll</Button>
                </div>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="px-5 py-4 border-b border-border"
                    style={{ background: "linear-gradient(135deg, #0d2347, #1a3a6b)" }}>
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-xs text-white/60">{eventName}</p>
                        <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-white">
                            {qIndex + 1}/{questions.length}
                        </span>
                    </div>
                    {/* Timer bar */}
                    <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-white/20 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${timeLeft <= 10 ? "bg-red-400" : "bg-white"}`}
                                style={{ width: `${timerPct}%`, transition: "width 1s linear" }} />
                        </div>
                        <div className="flex items-center gap-1 text-white text-sm font-bold">
                            <Clock className="h-3.5 w-3.5" />
                            {timeLeft}s
                        </div>
                    </div>
                </div>

                {/* Question */}
                <div className="p-5">
                    <p className="text-base font-semibold text-foreground mb-5 leading-snug">{currentQ.question}</p>

                    <div className="flex flex-col gap-2.5">
                        {currentQ.options.map((opt, i) => {
                            const isSelected = selected === i
                            const isCorrect = i === currentQ.correctIndex
                            const isWrong = submitted && isSelected && !isCorrect
                            const showCorrect = submitted && isCorrect

                            return (
                                <button
                                    key={i}
                                    onClick={() => handleSelect(i)}
                                    disabled={submitted}
                                    className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all ${showCorrect
                                            ? "border-green-500 bg-green-500/10"
                                            : isWrong
                                                ? "border-red-500 bg-red-500/10"
                                                : isSelected
                                                    ? "border-primary bg-primary/10"
                                                    : "border-border bg-muted/20 hover:border-primary/40"
                                        }`}
                                >
                                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold transition-colors ${showCorrect ? "bg-green-500 text-white" : isWrong ? "bg-red-500 text-white" : isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                        }`}>
                                        {String.fromCharCode(65 + i)}
                                    </span>
                                    <span className="text-sm text-foreground flex-1">{opt}</span>
                                    {showCorrect && <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />}
                                    {isWrong && <XCircle className="h-5 w-5 text-red-500 shrink-0" />}
                                </button>
                            )
                        })}
                    </div>

                    {/* Feedback message after submit */}
                    {submitted && (
                        <div className={`mt-4 rounded-lg px-4 py-3 text-sm font-medium ${selected === currentQ.correctIndex ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"}`}>
                            {timeLeft === 0 && selected === null
                                ? "⏱ Koha mbaroi! Përgjigja e saktë: " + currentQ.options[currentQ.correctIndex]
                                : selected === currentQ.correctIndex
                                    ? "✓ Saktë! Bravo."
                                    : `✗ Gabim. Përgjigja e saktë ishte: ${currentQ.options[currentQ.correctIndex]}`}
                        </div>
                    )}

                    <div className="mt-5 flex gap-2">
                        {!submitted ? (
                            <Button onClick={handleSubmit} disabled={selected === null} className="flex-1">
                                Konfirmo Përgjigjen
                            </Button>
                        ) : (
                            <Button onClick={handleNext} className="flex-1 gap-2">
                                {qIndex + 1 >= questions.length ? "Shiko Rezultatin" : "Pyetja Tjetër"}
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
