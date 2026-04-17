"use client"

import { useState } from "react"
import { useEvents } from "@/lib/events-context"
import { useAuth } from "@/lib/auth-context"
import type { EventItem } from "@/lib/data"
import { SeatSelector } from "@/components/events/seat-selector"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { parseISO } from "date-fns"
import { formatDate } from "@/lib/utils"
import {
  CalendarDays,
  MapPin,
  Users,
  CheckCircle2,
  ArrowLeft,
  CalendarRange,
  QrCode,
  X
} from "lucide-react"
import { QRCodeCanvas } from "qrcode.react"

interface EventReservationProps {
  eventId: string
  onBack: () => void
}

export function EventReservation({ eventId, onBack }: EventReservationProps) {
  const { getEvent, reserveSeat } = useEvents()
  const { user } = useAuth()
  const event = getEvent(eventId)

  const [step, setStep] = useState<"date" | "seat" | "info" | "done">("date")
  const [selectedDateId, setSelectedDateId] = useState<string | null>(null)
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null)
  const [isWaitlisted, setIsWaitlisted] = useState(false)
  const [firstName, setFirstName] = useState(user?.name?.split(" ")[0] ?? "")
  const [lastName, setLastName] = useState(user?.name?.split(" ").slice(1).join(" ") ?? "")
  const [email, setEmail] = useState(user?.email ?? "")
  const [memberRegistryNumber, setMemberRegistryNumber] = useState(user?.memberRegistryNumber ?? "")
  const [error, setError] = useState("")
  const [showQrModal, setShowQrModal] = useState(false)

  // Duplicate booking guard
  const alreadyBooked = user && event
    ? event.participants.some((p) => p.memberRegistryNumber === user.memberRegistryNumber)
    : false

  if (!event || event.status === "past") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <p className="text-muted-foreground">Moduli nuk u gjet ose nuk pranon më rezervime.</p>
        <Button variant="ghost" onClick={onBack} className="mt-4 gap-2">
          <ArrowLeft className="h-4 w-4" />Kthehu
        </Button>
      </div>
    )
  }

  if (alreadyBooked) {
    const myParticipant = event.participants.find((p) => p.memberRegistryNumber === user!.memberRegistryNumber)!
    const qrData = JSON.stringify({
      eventId: event.id,
      participantId: myParticipant.id,
      memberRegistryNumber: myParticipant.memberRegistryNumber
    })

    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">Jeni tashmë të regjistruar!</h2>
        <p className="text-sm text-muted-foreground mb-1">
          Keni një rezervim aktiv për <strong>{event.name}</strong>
        </p>
        <p className="text-sm text-muted-foreground mb-6">
          {myParticipant.status === "waitlisted"
            ? "Jeni në listën e pritjes. Do njoftoheni nëse lirohet një vend."
            : `Sedia #${myParticipant.seatNumber} — çdo anëtar mund të rezervojë vetëm një herë për modul.`}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button onClick={onBack} variant="outline" className="gap-2 w-full sm:w-auto">
            <ArrowLeft className="h-4 w-4" />Kthehu tek Modulet
          </Button>
          {!showQrModal ? (
            <Button onClick={() => setShowQrModal(true)} className="gap-2 w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white">
              <QrCode className="h-4 w-4" />Trego QR për Hyrjen
            </Button>
          ) : (
            <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-foreground/40 px-4 py-8 backdrop-blur-sm">
              <div className="relative w-full max-w-sm rounded-xl border border-border bg-card shadow-2xl p-8 flex flex-col items-center">
                <button
                  onClick={() => setShowQrModal(false)}
                  className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10 mb-4">
                  <QrCode className="h-6 w-6 text-blue-500" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-1">Kodi i Hyrjes</h3>
                <p className="text-xs text-muted-foreground text-center mb-6">
                  Tregojani këtë kod stafit në hyrje për t'u skanuar.
                </p>
                <div className="bg-white p-4 rounded-xl shadow-inner border border-border/50">
                  <QRCodeCanvas
                    value={qrData}
                    size={220}
                    level={"Q"}
                    fgColor={"#000000"}
                    bgColor={"#ffffff"}
                  />
                </div>
                <p className="mt-6 text-xs font-mono text-muted-foreground bg-muted px-3 py-1.5 rounded-md">
                  ID: {myParticipant.memberRegistryNumber}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  const selectedDate = event.dates.find((d) => d.id === selectedDateId)
  const participants = event.participants.filter((p) => p.dateId === selectedDateId)

  async function handleConfirm() {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !memberRegistryNumber.trim()) {
      setError("Ju lutem plotësoni të gjitha fushat")
      return
    }
    if (!selectedDateId) return

    const result = await reserveSeat(eventId, selectedDateId, selectedSeat ?? 0, {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      memberRegistryNumber: memberRegistryNumber.trim().toUpperCase(),
    })
    if (!result.ok) {
      if (result.reason === "duplicate")
        setError("Keni tashmë një rezervim për këtë modul. Një rezervim për modul lejohet.")
      else
        setError(result.reason ?? "Gabim gjatë rezervimit")
      return
    }
    setIsWaitlisted(result.status === "waitlisted")
    setStep("done")
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 lg:px-8">
      <Button variant="ghost" onClick={onBack} className="mb-6 gap-2 text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Kthehu
      </Button>

      {/* Event Info */}
      <div className="mb-8 rounded-xl border border-border bg-card p-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">{event.name}</h1>
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4" />
            {event.place}
          </span>
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4" />
            {event.dates.length} ditë
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            {event.currentParticipants}/{event.maxParticipants} të regjistruar
          </span>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="mb-8 flex items-center gap-3">
        {(["date", "seat", "info", "done"] as const).map((s, i) => {
          const labels = ["Zgjidh datën", "Zgjidh vendin", "Të dhënat tuaja", "Konfirmuar"]
          const stepOrder = ["date", "seat", "info", "done"] as const
          const currentIdx = stepOrder.indexOf(step)
          const isActive = i === currentIdx
          const isCompleted = i < currentIdx

          return (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${isCompleted
                  ? "bg-accent text-accent-foreground"
                  : isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                  }`}
              >
                {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={`text-xs font-medium hidden sm:block ${isActive ? "text-foreground" : "text-muted-foreground"
                  }`}
              >
                {labels[i]}
              </span>
              {i < 3 && <div className="flex-1 h-px bg-border" />}
            </div>
          )
        })}
      </div>

      {/* Step: Select Date */}
      {step === "date" && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Cilën datë dëshironi të ndiqni?</h2>
          <div className="flex flex-col gap-3">
            {event.dates.map((d) => {
              const isFull = d.currentParticipants >= d.maxParticipants
              const isSelected = selectedDateId === d.id
              return (
                <button
                  key={d.id}
                  onClick={() => {
                    setSelectedDateId(d.id)
                    setSelectedSeat(isFull ? 0 : null)
                    if (isFull) setStep("info")   // skip seat selector for full sessions → waitlist
                    else setStep("seat")
                  }}
                  className={`flex items-center justify-between rounded-xl border-2 p-4 text-left transition-all ${isSelected
                    ? isFull ? "border-amber-500 bg-amber-500/5" : "border-primary bg-primary/5 shadow-sm"
                    : "border-border bg-card hover:border-primary/40 hover:shadow-sm"
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <CalendarRange className={`h-5 w-5 ${isSelected ? (isFull ? "text-amber-500" : "text-primary") : "text-muted-foreground"}`} />
                    <div>
                      <p className={`text-sm font-semibold ${isSelected ? (isFull ? "text-amber-500" : "text-primary") : "text-foreground"}`}>
                        {formatDate(d.date, "EEEE, d MMMM yyyy")}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {d.currentParticipants}/{d.maxParticipants} vende të zëna
                      </p>
                    </div>
                  </div>
                  {isFull ? (
                    <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-500">⏳ Listë Pritjeje</span>
                  ) : isSelected ? (
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  ) : null}
                </button>
              )
            })}
          </div>
          <div className="mt-6 flex justify-end">
            <Button disabled={!selectedDateId} onClick={() => {
              const d = event.dates.find(d => d.id === selectedDateId)
              if (d && d.currentParticipants >= d.maxParticipants) setStep("info")
              else setStep("seat")
            }}>
              Vazhdo
            </Button>
          </div>
        </div>
      )}

      {/* Step: Choose Seat */}
      {step === "seat" && selectedDate && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground mb-1">Zgjidhni vendin tuaj</h2>
          <p className="text-sm text-muted-foreground mb-6">
            {formatDate(selectedDate.date, "EEEE, d MMMM yyyy")}
          </p>
          <SeatSelector
            eventDate={selectedDate}
            participants={participants}
            selectedSeat={selectedSeat}
            onSelect={setSelectedSeat}
          />
          <div className="mt-6 flex items-center justify-between">
            <Button variant="ghost" onClick={() => setStep("date")}>
              Kthehu
            </Button>
            <Button disabled={!selectedSeat} onClick={() => setStep("info")}>
              Vazhdo te regjistrimi
            </Button>
          </div>
        </div>
      )}

      {/* Step: Info */}
      {step === "info" && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground mb-1">Informacioni Juaj</h2>
          <p className="text-sm text-muted-foreground mb-6">
            {selectedSeat === -1
              ? `Listë pritjeje për ${selectedDate && formatDate(selectedDate.date, "d MMMM yyyy")}`
              : `Sedia #${selectedSeat} — ${selectedDate && formatDate(selectedDate.date, "d MMMM yyyy")}`}
          </p>
          <div className="flex flex-col gap-4 max-w-md">
            <div className="flex flex-col gap-2">
              <Label htmlFor="reg-num">Numri i Regjistrit IEKA *</Label>
              <Input id="reg-num" value={memberRegistryNumber} onChange={(e) => setMemberRegistryNumber(e.target.value)}
                placeholder="IEKA-2045" className="font-mono tracking-wider" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="first-name">Emri</Label>
                <Input id="first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Artan" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="last-name">Mbiemri</Label>
                <Input id="last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Hoxha" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="antar@ieka.al" />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <div className="mt-6 flex items-center justify-between">
            <Button variant="ghost" onClick={() => {
              if (selectedSeat === -1) {
                setStep("date")
                setSelectedSeat(null)
              } else {
                setStep("seat")
              }
            }}>
              Kthehu
            </Button>
            <Button variant="secondary" onClick={() => handleConfirm()}>Konfirmo Rezervimin</Button>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${isWaitlisted ? "bg-amber-500/15" : "bg-green-500/15"}`}>
            <CheckCircle2 className={`h-8 w-8 ${isWaitlisted ? "text-amber-500" : "text-green-500"}`} />
          </div>
          {isWaitlisted ? (
            <>
              <h2 className="text-xl font-bold text-foreground mb-2">Jeni në Listën e Pritjes!</h2>
              <p className="text-sm text-muted-foreground mb-1">
                Sesioni për <strong>{event.name}</strong> ishte i plotë.
              </p>
              <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
                Jeni shtuar automatikisht në listën e pritjes.
                Do të njoftoheni dhe konfirmoheni automatikisht nëse lirohet një vend.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-foreground mb-2">Rezervimi u Konfirmua!</h2>
              <p className="text-sm text-muted-foreground mb-1">
                Jeni regjistruar për <strong>{event.name}</strong>
              </p>
              {selectedSeat && selectedSeat > 0 && (
                <p className="text-sm text-muted-foreground">
                  Sedia #{selectedSeat} — {selectedDate && formatDate(selectedDate.date, "d MMMM yyyy")}
                </p>
              )}
            </>
          )}
          <Button onClick={onBack} className="mt-6">Kthehu tek Modulet</Button>
        </div>
      )}
    </div>
  )
}
