"use client"

import { useState, useMemo } from "react"
import { useEvents } from "@/lib/events-context"
import { useAuth } from "@/lib/auth-context"
import { EventCard } from "@/components/events/event-card"
import { CreateEventForm } from "@/components/events/create-event-form"
import { EditEventForm } from "@/components/events/edit-event-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PaginationBar, usePagination, type PageSize } from "@/components/ui/pagination-bar"
import { Plus, Search, BookOpen, Pencil, Trash2, AlertTriangle } from "lucide-react"
import type { EventItem } from "@/lib/data"

type FilterTab = "all" | "upcoming" | "past"

interface EventsViewProps {
  onOpenEvent: (eventId: string) => void
}

export function EventsView({ onOpenEvent }: EventsViewProps) {
  const { events, deleteEvent } = useEvents()
  const { user } = useAuth()
  const [filter, setFilter] = useState<FilterTab>("upcoming")
  const [search, setSearch] = useState("")
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null)
  const [deletingEvent, setDeletingEvent] = useState<EventItem | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState<PageSize>(25)

  const isAdmin = user?.role === "Admin"
  const isMember = user?.role === "Member"

  const filteredEvents = useMemo(() => {
    let result = events
    if (filter !== "all") result = result.filter((e) => e.status === filter)
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.place.toLowerCase().includes(q) ||
          (e.topics || []).some((t) => t.toLowerCase().includes(q))
      )
    }
    return result.sort((a, b) => {
      if (a.status === "upcoming" && b.status === "past") return -1
      if (a.status === "past" && b.status === "upcoming") return 1
      return (a.dates[0]?.date ?? "").localeCompare(b.dates[0]?.date ?? "")
    })
  }, [events, filter, search])

  const handleFilterChange = (f: FilterTab) => { setFilter(f); setCurrentPage(1) }
  const handleSearchChange = (v: string) => { setSearch(v); setCurrentPage(1) }
  const pagedEvents = usePagination(filteredEvents, pageSize, currentPage)

  const upcomingCount = events.filter((e) => e.status === "upcoming").length
  const pastCount = events.filter((e) => e.status === "past").length

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: "all", label: "Të Gjitha", count: events.length },
    { key: "upcoming", label: "Aktive", count: upcomingCount },
    { key: "past", label: "Të Kaluara", count: pastCount },
  ]

  async function handleDeleteConfirm() {
    if (!deletingEvent) return
    setDeleteLoading(true)
    try {
      await deleteEvent(deletingEvent.id)
    } finally {
      setDeleteLoading(false)
      setDeletingEvent(null)
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {isMember ? "Modulet CPD në Dispozicion" : "Module CPD"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isMember
              ? "Zgjidhni sesionin dhe rezervoni vendin tuaj"
              : "Krijoni dhe menaxhoni modulet e trajnimit CPD"}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowCreateForm(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Krijo Modul të Ri
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 rounded-lg bg-muted p-1 w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleFilterChange(tab.key)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${filter === tab.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
            >
              {tab.label}
              <span className={`rounded-full px-1.5 py-0.5 text-xs ${filter === tab.key ? "bg-primary/10 text-primary" : "bg-muted-foreground/10 text-muted-foreground"
                }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Kërko module..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Event Grid */}
      {filteredEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <BookOpen className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">
            {search ? "Asnjë modul nuk përputhet me kërkimin" : "Nuk ka module akoma"}
          </p>
          {!search && isAdmin && (
            <Button variant="link" className="mt-2" onClick={() => setShowCreateForm(true)}>
              Krijo modulin e parë
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {pagedEvents.map((event) => (
              <div key={event.id} className="relative group/card">
                <EventCard event={event} onClick={() => onOpenEvent(event.id)} />
                {/* Admin action buttons — appear on hover */}
                {isAdmin && (
                  <div className="absolute top-3 right-10 flex gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity z-10">
                    {event.status !== "past" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingEvent(event) }}
                        title="Modifiko modulin"
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-card border border-border shadow-sm text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeletingEvent(event) }}
                      title="Fshi modulin"
                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-card border border-border shadow-sm text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <PaginationBar
            totalItems={filteredEvents.length}
            pageSize={pageSize}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1) }}
            className="mt-4 border-t border-border"
          />
        </>
      )}

      {/* Create Modal */}
      {showCreateForm && <CreateEventForm onClose={() => setShowCreateForm(false)} />}

      {/* Edit Modal */}
      {editingEvent && editingEvent.status !== "past" && <EditEventForm event={editingEvent} onClose={() => setEditingEvent(null)} />}

      {/* Delete Confirm Dialog */}
      {deletingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 mb-4">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1">Fshi Modulin?</h3>
            <p className="text-sm text-muted-foreground mb-1">
              Jeni gati të fshini <strong className="text-foreground">{deletingEvent.name}</strong>?
            </p>
            <p className="text-xs text-destructive/80 mb-5">
              Kjo do të fshijë të gjitha sesionet dhe rezervimet e lidhura. Kjo veprim nuk mund të kthehet.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setDeletingEvent(null)} disabled={deleteLoading}>Anulo</Button>
              <Button variant="destructive" onClick={handleDeleteConfirm} disabled={deleteLoading}>
                {deleteLoading ? "Duke fshirë..." : "Po, Fshi"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
