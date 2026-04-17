"use client"

import { useRef, useState } from "react"
import { Scanner } from "@yudiel/react-qr-scanner"
import { AlertCircle, CheckCircle2, QrCode, X } from "lucide-react"

interface QuickQrScannerModalProps {
  onClose: () => void
  onResolved: (route: string) => void
}

export function QuickQrScannerModal({ onClose, onResolved }: QuickQrScannerModalProps) {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const scanInFlightRef = useRef(false)
  const lastRawValueRef = useRef<{ value: string; at: number } | null>(null)

  async function handleScan(result: unknown) {
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
      const route = resolveScanRoute(rawValue)
      if (!route) {
        throw new Error("unsupported_qr")
      }

      lastRawValueRef.current = { value: rawValue, at: Date.now() }
      setSuccess("Kodi QR u njoh. Po hapet skanimi...")
      setError(null)

      window.setTimeout(() => {
        onClose()
        onResolved(route)
      }, 250)
    } catch {
      setError("Ky QR nuk mbështetet këtu. Përdorni kodet e prezencës ose të pyetësorit.")
      setSuccess(null)
      window.setTimeout(() => setError(null), 3000)
    } finally {
      scanInFlightRef.current = false
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-foreground/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3">
          <div className="flex items-center gap-2">
            <QrCode className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Skano QR</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Mbyll skanerin"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4">
          <div className="relative aspect-square overflow-hidden rounded-xl border-2 border-dashed border-primary/50 bg-black">
            <Scanner
              onScan={(result) => {
                void handleScan(result)
              }}
              components={{
                onOff: true,
                torch: true,
                zoom: false,
                finder: true,
              }}
              styles={{
                container: { width: "100%", height: "100%" },
              }}
            />
          </div>

          <div className="mt-4 min-h-12 text-center">
            {error && (
              <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-destructive">
                <AlertCircle className="h-4 w-4" />
                {error}
              </p>
            )}
            {success && (
              <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                {success}
              </p>
            )}
            {!error && !success && (
              <p className="text-xs text-muted-foreground">
                Skano kodet e prezencës ose të pyetësorit pa dalë nga platforma.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function extractScanRawValue(result: unknown): string | null {
  if (!result) return null

  if (Array.isArray(result)) {
    const first = result[0] as { rawValue?: string; text?: string; value?: string } | undefined
    const arrayValue = first?.rawValue ?? first?.text ?? first?.value
    return typeof arrayValue === "string" ? arrayValue.trim() : null
  }

  if (typeof result === "string") {
    return result.trim()
  }

  const objectValue = (result as { rawValue?: string; text?: string; value?: string }).rawValue
    ?? (result as { rawValue?: string; text?: string; value?: string }).text
    ?? (result as { rawValue?: string; text?: string; value?: string }).value
  return typeof objectValue === "string" ? objectValue.trim() : null
}

function resolveScanRoute(rawValue: string): string | null {
  const candidates = [rawValue.trim()]

  try {
    const decoded = decodeURIComponent(rawValue.trim())
    if (decoded && !candidates.includes(decoded)) {
      candidates.push(decoded)
    }
  } catch {
    // Keep original value.
  }

  for (const candidate of candidates) {
    if (candidate.startsWith("IEKA-SM:") || candidate.startsWith("IEKA-EV:")) {
      return `/scan/attendance?token=${encodeURIComponent(candidate)}`
    }

    if (candidate.startsWith("IEKA-EQ:")) {
      return `/scan/questionnaire?token=${encodeURIComponent(candidate)}`
    }

    const resolvedUrl = tryParseUrl(candidate)
    if (!resolvedUrl) continue

    const pathname = resolvedUrl.pathname.toLowerCase()
    const token = resolvedUrl.searchParams.get("token") ?? resolvedUrl.searchParams.get("qrToken")
    if (!token) continue

    if (pathname.endsWith("/scan/attendance")) {
      return `/scan/attendance?token=${encodeURIComponent(token)}`
    }

    if (pathname.endsWith("/scan/questionnaire")) {
      return `/scan/questionnaire?token=${encodeURIComponent(token)}`
    }
  }

  return null
}

function tryParseUrl(value: string): URL | null {
  try {
    if (value.startsWith("http://") || value.startsWith("https://")) {
      return new URL(value)
    }

    return new URL(value, "https://iekasmartclass.local")
  } catch {
    return null
  }
}
