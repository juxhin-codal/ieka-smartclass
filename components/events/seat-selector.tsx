"use client"

import { useState, useEffect } from "react"
import type { EventDate, Participant } from "@/lib/data"

interface SeatSelectorProps {
  eventDate: EventDate
  participants: Participant[]
  onSelect: (seatNumber: number) => void
  selectedSeat: number | null
}

export function SeatSelector({ eventDate, participants, onSelect, selectedSeat }: SeatSelectorProps) {
  const [mounted, setMounted] = useState(false)
  const takenSeats = new Set(
    participants.filter((p) => p.dateId === eventDate.id).map((p) => p.seatNumber)
  )

  useEffect(() => {
    setMounted(true)
  }, [])

  const totalSeats = eventDate.maxParticipants
  const columns = Math.min(Math.ceil(Math.sqrt(totalSeats)), 12)
  const rows = Math.ceil(totalSeats / columns)

  // Only show up to 120 seats in the visual grid, beyond that use a simpler view
  const showFullGrid = totalSeats <= 120

  if (!showFullGrid) {
    const available = totalSeats - takenSeats.size
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded-sm bg-accent/70" />
            <span className="text-xs text-muted-foreground">Të lira ({available})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded-sm bg-destructive/70" />
            <span className="text-xs text-muted-foreground">Të zëna ({takenSeats.size})</span>
          </div>
          {selectedSeat && (
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded-sm bg-chart-3" />
              <span className="text-xs text-muted-foreground">Vendi juaj (#{selectedSeat})</span>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="seat-number" className="text-sm font-medium text-foreground">
            Zgjidh numrin e vendit (1-{totalSeats})
          </label>
          <div className="flex items-center gap-3">
            <input
              id="seat-number"
              type="number"
              min={1}
              max={totalSeats}
              value={selectedSeat ?? ""}
              onChange={(e) => {
                const num = Number(e.target.value)
                if (num >= 1 && num <= totalSeats && !takenSeats.has(num)) {
                  onSelect(num)
                }
              }}
              className="h-10 w-32 rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Vendi #"
            />
            {selectedSeat && takenSeats.has(selectedSeat) && (
              <span className="text-xs text-destructive">Ky vend është i zënë</span>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Stage/Front */}
      <div className="flex items-center justify-center rounded-lg bg-muted py-2">
        <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">Skena / Pjesa e përparme</span>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded-sm bg-accent/70" />
          <span className="text-xs text-muted-foreground">Të lira</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded-sm bg-destructive/70" />
          <span className="text-xs text-muted-foreground">Të zëna</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded-sm bg-chart-3" />
          <span className="text-xs text-muted-foreground">E zgjedhur</span>
        </div>
      </div>

      {/* Seat Grid */}
      <div className="overflow-x-auto rounded-xl border border-border bg-muted/30 p-4">
        <div
          className="mx-auto grid gap-1.5"
          style={{
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            maxWidth: `${columns * 36}px`,
          }}
        >
          {Array.from({ length: totalSeats }, (_, i) => {
            const seatNum = i + 1
            const isTaken = takenSeats.has(seatNum)
            const isSelected = selectedSeat === seatNum

            return (
              <button
                key={seatNum}
                disabled={isTaken}
                onClick={() => onSelect(seatNum)}
                className={`flex h-7 w-7 items-center justify-center rounded-sm text-[10px] font-medium transition-all ${
                  mounted ? "animate-in fade-in duration-300" : ""
                } ${
                  isTaken
                    ? "cursor-not-allowed bg-destructive/70 text-destructive-foreground"
                    : isSelected
                    ? "bg-chart-3 text-foreground ring-2 ring-chart-3/50 scale-110"
                    : "bg-accent/70 text-accent-foreground hover:bg-accent hover:scale-105 cursor-pointer"
                }`}
                style={{
                  animationDelay: mounted ? `${i * 8}ms` : "0ms",
                }}
                aria-label={`Vendi ${seatNum}${isTaken ? ", i zënë" : isSelected ? ", i zgjedhur" : ", i lirë"}`}
                title={`Vendi ${seatNum}`}
              >
                {seatNum}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
