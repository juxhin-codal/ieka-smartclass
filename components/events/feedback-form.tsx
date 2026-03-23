"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Star } from "lucide-react"
import { fetchApi } from "@/lib/api-client"

interface FeedbackFormProps {
    eventId: string
    dateId?: string
    open: boolean
    onClose: () => void
}

export function FeedbackForm({ eventId, dateId, open, onClose }: FeedbackFormProps) {
    const [step, setStep] = useState(1)
    const [sessionRating, setSessionRating] = useState(0)
    const [sessionComments, setSessionComments] = useState("")
    const [lecturerRating, setLecturerRating] = useState(0)
    const [lecturerComments, setLecturerComments] = useState("")
    const [suggestions, setSuggestions] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async () => {
        setIsSubmitting(true)
        setError(null)
        try {
            await fetchApi(`/Events/${eventId}/feedback`, {
                method: "POST",
                body: JSON.stringify({
                    dateId,
                    sessionRating,
                    sessionComments,
                    lecturerRating,
                    lecturerComments,
                    suggestions
                })
            })
            onClose()
        } catch (e: any) {
            setError(e.message || "Failed to submit feedback. You might have already submitted.")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={isSubmitting ? undefined : onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Vlerësimi i Sesionit</DialogTitle>
                    <DialogDescription>Ju lutem ndani mendimin tuaj për këtë sesion. Hapi {step} nga 3.</DialogDescription>
                </DialogHeader>

                {error && <p className="text-sm text-destructive font-medium">{error}</p>}

                <div className="py-4">
                    {step === 1 && (
                        <div className="space-y-4">
                            <h3 className="font-medium text-foreground">1. Sesioni, Temat dhe Klasa</h3>
                            <div>
                                <Label>Vlerësimi (1-5)</Label>
                                <div className="flex gap-2 mt-2">
                                    {[1, 2, 3, 4, 5].map((r) => (
                                        <button
                                            key={r}
                                            onClick={() => setSessionRating(r)}
                                            className="p-1"
                                        >
                                            <Star className={`h-8 w-8 ${sessionRating >= r ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Komente shtesë (Opsionale)</Label>
                                <Textarea value={sessionComments} onChange={(e) => setSessionComments(e.target.value)} placeholder="Mendimi juaj për ambientin, temat..." />
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-4">
                            <h3 className="font-medium text-foreground">2. Vlerësimi për Ligjëruesin</h3>
                            <div>
                                <Label>Vlerësimi (1-5)</Label>
                                <div className="flex gap-2 mt-2">
                                    {[1, 2, 3, 4, 5].map((r) => (
                                        <button
                                            key={r}
                                            onClick={() => setLecturerRating(r)}
                                            className="p-1"
                                        >
                                            <Star className={`h-8 w-8 ${lecturerRating >= r ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Komente shtesë (Opsionale)</Label>
                                <Textarea value={lecturerComments} onChange={(e) => setLecturerComments(e.target.value)} placeholder="Si ishte kualiteti i shpjegimit?" />
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-4">
                            <h3 className="font-medium text-foreground">3. Sugjerime</h3>
                            <div className="space-y-2">
                                <Label>Si mund të përmirësohemi?</Label>
                                <Textarea value={suggestions} onChange={(e) => setSuggestions(e.target.value)} placeholder="Çfarë do dëshironit të shtohej..." className="min-h-[100px]" />
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-2">
                    {step > 1 && (
                        <Button variant="outline" onClick={() => setStep(s => s - 1)} disabled={isSubmitting}>
                            Mbrapa
                        </Button>
                    )}
                    {step < 3 ? (
                        <Button onClick={() => setStep(s => s + 1)}>
                            Vazhdo
                        </Button>
                    ) : (
                        <Button onClick={handleSubmit} disabled={isSubmitting || !sessionRating || !lecturerRating}>
                            {isSubmitting ? "Po Dërgohet..." : "Dërgo Vlerësimin"}
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
