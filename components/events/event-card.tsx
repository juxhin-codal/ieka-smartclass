"use client"

import type { EventItem } from "@/lib/data"
import { formatDate } from "@/lib/utils"
import { MapPin, Users, Tag, CalendarRange, ArrowRight } from "lucide-react"

interface EventCardProps {
  event: EventItem
  onClick: () => void
}

export function EventCard({ event, onClick }: EventCardProps) {
  const sortedDates = [...event.dates].sort((a, b) => a.date.localeCompare(b.date))
  const startDate = sortedDates[0]?.date
  const endDate = sortedDates[sortedDates.length - 1]?.date
  const fillPercent = Math.round(
    (event.currentParticipants / event.maxParticipants) * 100
  )
  const isAlmostFull = fillPercent >= 90
  const isPast = event.status === "past"

  return (
    <button
      onClick={onClick}
      className={`group flex flex-col rounded-xl border bg-card text-left transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isPast ? "border-border/60 opacity-80" : "border-border"
        }`}
    >
      <div className="flex flex-col gap-4 p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1 min-w-0">
            <h3 className="text-base font-semibold text-foreground truncate group-hover:text-primary transition-colors">
              {event.name}
            </h3>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{event.place}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${isPast
                ? "bg-muted text-muted-foreground"
                : "bg-accent/15 text-accent"
                }`}
            >
              {isPast ? "Përfunduar" : "Në vazhdim"}
            </span>
            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* Dates */}
        <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
          <CalendarRange className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-foreground">
            {startDate && formatDate(startDate, "d MMMM")}
            {endDate && endDate !== startDate && ` — ${formatDate(endDate, "d MMMM")}`}
            {startDate && `, ${formatDate(startDate, "yyyy")}`}
          </span>
          <span className="ml-auto text-xs text-muted-foreground">
            {event.dates.length} sesione • {event.cpdHours}h CPD
          </span>
        </div>

        {/* Topics */}
        <div className="flex flex-wrap gap-1.5">
          {(event.topics || []).slice(0, 3).map((topic) => (
            <span
              key={topic}
              className="inline-flex items-center gap-1 rounded-md bg-primary/8 px-2 py-0.5 text-xs font-medium text-primary"
            >
              <Tag className="h-2.5 w-2.5" />
              {topic}
            </span>
          ))}
          {(event.topics?.length || 0) > 3 && (
            <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              +{(event.topics?.length || 0) - 3} më shumë
            </span>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground leading-tight">
              {event.currentParticipants}
              <span className="text-muted-foreground font-normal"> / {event.sessionCapacity * event.totalSessions} vende</span>
            </span>
            <span className="text-[11px] text-muted-foreground leading-tight">
              {event.sessionCapacity} vende/sesion · {event.totalSessions} sesione
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-20 overflow-hidden rounded-full bg-border">
            <div
              className={`h-full rounded-full transition-all ${isAlmostFull ? "bg-destructive" : "bg-primary"
                }`}
              style={{ width: `${fillPercent}%` }}
            />
          </div>
          <span
            className={`text-xs font-medium ${isAlmostFull ? "text-destructive" : "text-muted-foreground"
              }`}
          >
            {fillPercent}%
          </span>
        </div>
      </div>
    </button>
  )
}
