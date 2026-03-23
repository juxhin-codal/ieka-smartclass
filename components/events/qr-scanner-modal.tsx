"use client"

import { useState } from "react"
import { useRef } from "react"
import { Scanner } from "@yudiel/react-qr-scanner"
import { X, CheckCircle2, AlertCircle } from "lucide-react"

interface QrScannerModalProps {
    eventId: string
    onClose: () => void
    onScanSuccess: (participantId: string, memberRegistry: string) => Promise<void> | void
}

export function QrScannerModal({ eventId, onClose, onScanSuccess }: QrScannerModalProps) {
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const scanInFlightRef = useRef(false)
    const lastRawValueRef = useRef<{ value: string; at: number } | null>(null)

    async function handleScan(result: any) {
        if (!result) return

        const rawValue = extractScanRawValue(result)
        if (!rawValue) return

        const now = Date.now()
        const previous = lastRawValueRef.current
        if (scanInFlightRef.current) return
        if (previous && previous.value === rawValue && now - previous.at < 2500) {
            return
        }

        scanInFlightRef.current = true
        try {
            const data = parseEventPayload(rawValue)
            if (!data) {
                throw new Error("invalid_qr")
            }

            const scannedEventId = `${data.eventId ?? ""}`.trim().toLowerCase()
            const currentEventId = `${eventId}`.trim().toLowerCase()

            // Ensure this QR is for this specific event
            if (!scannedEventId || scannedEventId !== currentEventId) {
                setError("Kodi QR nuk është për këtë modul!")
                setSuccess(null)
                setTimeout(() => setError(null), 3000)
                return
            }

            if (data.participantId) {
                await onScanSuccess(data.participantId, data.memberRegistryNumber ?? "")
                lastRawValueRef.current = { value: rawValue, at: Date.now() }
                setSuccess(`Skanim i suksesshëm: ${data.memberRegistryNumber || data.participantId}`)
                setError(null)

                // Auto-close after short delay
                setTimeout(() => {
                    onClose()
                }, 1500)
                return
            }

            setError("Kodi QR nuk ka të dhëna të vlefshme për pjesëmarrësin.")
            setSuccess(null)
            setTimeout(() => setError(null), 3000)
        } catch {
            setError("Kod QR i pavlefshëm ose skanimi dështoi.")
            setSuccess(null)
            setTimeout(() => setError(null), 3000)
        } finally {
            scanInFlightRef.current = false
        }
    }

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/60 p-4 backdrop-blur-sm">
            <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
                <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3">
                    <h2 className="text-sm font-semibold text-foreground">Skano QR Kodin e Anëtarit</h2>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-4 flex flex-col items-center">
                    <div className="w-full aspect-square overflow-hidden rounded-xl border-2 border-dashed border-primary/50 bg-black relative">
                        <Scanner
                            onScan={(result) => { void handleScan(result) }}
                            components={{
                                onOff: true,
                                torch: true,
                                zoom: false,
                                finder: true,
                            }}
                            styles={{
                                container: { width: "100%", height: "100%" }
                            }}
                        />
                    </div>

                    <div className="h-12 w-full mt-4 flex items-center justify-center text-center">
                        {error && (
                            <p className="flex items-center gap-1.5 text-sm font-medium text-destructive">
                                <AlertCircle className="h-4 w-4" /> {error}
                            </p>
                        )}
                        {success && (
                            <p className="flex items-center gap-1.5 text-sm font-medium text-green-500">
                                <CheckCircle2 className="h-4 w-4" /> {success}
                            </p>
                        )}
                        {!error && !success && (
                            <p className="text-xs text-muted-foreground">Vendosni kodin QR brenda kornizës</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

function extractScanRawValue(result: any): string | null {
    if (!result) return null

    if (Array.isArray(result)) {
        const first = result[0]
        const arrayValue = first?.rawValue ?? first?.text ?? first?.value
        return typeof arrayValue === "string" ? arrayValue.trim() : null
    }

    if (typeof result === "string") {
        return result.trim()
    }

    const objectValue = result.rawValue ?? result.text ?? result.value
    return typeof objectValue === "string" ? objectValue.trim() : null
}

function parseEventPayload(rawValue: string): {
    eventId?: string
    participantId?: string
    memberRegistryNumber?: string
} | null {
    if (!rawValue) return null

    const trimmed = rawValue.trim()

    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
        try {
            return JSON.parse(trimmed)
        } catch {
            return null
        }
    }

    try {
        const uri = new URL(trimmed)
        const eventId = uri.searchParams.get("eventId") ?? undefined
        const participantId = uri.searchParams.get("participantId") ?? undefined
        const memberRegistryNumber = uri.searchParams.get("memberRegistryNumber") ?? undefined
        if (!eventId && !participantId) {
            return null
        }
        return {
            eventId,
            participantId,
            memberRegistryNumber,
        }
    } catch {
        return null
    }
}
