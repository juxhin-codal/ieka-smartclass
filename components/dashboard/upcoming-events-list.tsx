"use client"

import { useEvents } from "@/lib/events-context"
import { formatDate } from "@/lib/utils"
import { MapPin, Users, CalendarDays } from "lucide-react"

export function UpcomingEventsList() {
  const { events } = useEvents()
  const upcoming = events
    .filter((e) => e.status === "upcoming")
    .sort((a, b) => {
      const dateA = a.dates[0]?.date ?? ""
      const dateB = b.dates[0]?.date ?? ""
      return dateA.localeCompare(dateB)
    })
    .slice(0, 5)

  if (upcoming.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <CalendarDays className="mb-2 h-8 w-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">No upcoming events</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {upcoming.map((event) => {
        const startDate = event.dates[0]?.date
        const endDate = event.dates[event.dates.length - 1]?.date
        const fillPercent = Math.round((event.currentParticipants / event.maxParticipants) * 100)

        return (
          <div
            key={event.id}
            className="flex flex-col gap-2 rounded-md border border-border bg-muted/20 p-3 hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col gap-0.5 min-w-0">
                <h4 className="text-sm font-medium text-foreground truncate">{event.name}</h4>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{event.place}</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1 rounded bg-primary/8 px-2 py-0.5">
                <Users className="h-3 w-3 text-primary" />
                <span className="text-xs font-medium text-primary">
                  {event.currentParticipants}/{event.maxParticipants}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {startDate && formatDate(startDate, "d MMMM")}
                {endDate && endDate !== startDate && ` - ${formatDate(endDate, "d MMMM")}`}
              </p>
              <div className="flex items-center gap-1.5">
                <div className="h-1 w-14 overflow-hidden rounded-full bg-border">
                  <div
                    className={`h-full rounded-full transition-all ${fillPercent >= 90 ? "bg-destructive" : "bg-primary"}`}
                    style={{ width: `${fillPercent}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">{fillPercent}%</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
