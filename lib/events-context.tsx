"use client"

import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from "react"
import { type EventItem, type AppUser, type Participant } from "@/lib/data"
import { fetchApi } from "./api-client"
import { useAuth } from "./auth-context"

interface ReservePayload {
  firstName: string
  lastName: string
  email: string
  memberRegistryNumber: string
}

interface EventsContextType {
  events: EventItem[]
  users: AppUser[]
  isLoading: boolean
  addEvent: (event: Omit<EventItem, "id" | "createdAt" | "currentParticipants" | "participants" | "maxParticipants">) => Promise<void>
  updateEvent: (id: string, updates: Partial<EventItem>) => Promise<void>
  deleteEvent: (id: string) => Promise<void>
  getEvent: (id: string) => EventItem | undefined
  reserveSeat: (eventId: string, dateId: string, seatNumber: number, user: ReservePayload) => Promise<{ ok: boolean; status?: string; reason?: string }>
  cancelBooking: (eventId: string, participantId: string) => Promise<void>
  updateParticipant: (eventId: string, participantId: string, updates: Partial<Participant>) => Promise<void>
  markAttendance: (eventId: string, participantId: string, status: string) => Promise<void>
  markAsNotified: (eventId: string) => Promise<void>
  endSession: (eventId: string, dateId: string) => Promise<void>
  addEventDocument: (eventId: string, file: File, fileName?: string) => Promise<void>
  deleteEventDocument: (eventId: string, documentId: string) => Promise<void>
  getBookingsForMember: (registryNumber: string) => { event: EventItem; participant: Participant }[]
  fetchEvents: () => Promise<void>
  addUser: (user: Omit<AppUser, "id">) => Promise<void>
  addUsers: (newUsers: Omit<AppUser, "id">[]) => Promise<void>
  updateMember: (id: string, updates: Partial<AppUser>) => Promise<void>
  sendUserPasswordResetEmail: (id: string) => Promise<void>
  deleteUser: (id: string) => Promise<void>
  setMemberYearlyPayment: (id: string, isPaid: boolean) => Promise<void>
  fetchUsers: () => Promise<void>
  startQuiz: (eventId: string) => void
  stopQuiz: (eventId: string) => void
  isQuizLive: (eventId: string) => boolean
}

const EventsContext = createContext<EventsContextType | undefined>(undefined)

function shouldSuppressBootstrapError(error: unknown) {
  const status = typeof error === "object" && error !== null && "status" in error ? Number((error as any).status) : undefined
  const message = typeof error === "object" && error !== null && "message" in error ? String((error as any).message ?? "") : ""

  return (
    status === 404 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    message.includes("API po niset pas gjumit")
  )
}

export function EventsProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<EventItem[]>([])
  const [users, setUsers] = useState<AppUser[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const { isAuthenticated, user } = useAuth()

  // Track which events currently have a live quiz running
  const [liveQuizzes, setLiveQuizzes] = useState<Set<string>>(new Set())

  const fetchEvents = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetchApi("/Events?pageNumber=1&pageSize=100")
      setEvents(response.items || response) // Handle PaginatedList or raw array
    } catch (e: any) {
      setEvents([])
      if (!shouldSuppressBootstrapError(e)) {
        console.warn("Failed to load events:", e?.message ?? "Unknown error")
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetchApi("/Members?pageNumber=1&pageSize=500")
      setUsers(response.items || [])
    } catch (e: any) {
      setUsers([])
      if (!e?.message?.includes("403") && !shouldSuppressBootstrapError(e)) {
        console.warn("Failed to load users:", e?.message ?? "Unknown error")
      }
    }
  }, [])

  // Once authenticated, fetch real data
  useEffect(() => {
    if (isAuthenticated) {
      fetchEvents()
      fetchUsers()
    }
  }, [isAuthenticated, fetchEvents, fetchUsers])

  const addEvent = useCallback(async (event: Omit<EventItem, "id" | "createdAt" | "currentParticipants" | "participants" | "maxParticipants">) => {
    try {
      await fetchApi("/Events", {
        method: "POST",
        body: JSON.stringify(event)
      })
      await fetchEvents()
    } catch (e) {
      console.error("Failed to add event", e)
      throw e
    }
  }, [fetchEvents])

  const updateEvent = useCallback(async (id: string, updates: Partial<EventItem>) => {
    try {
      await fetchApi(`/Events/${id}`, {
        method: "PUT",
        body: JSON.stringify(updates)
      })
      await fetchEvents()
    } catch (e) {
      console.error("Failed to update event", e)
      throw e
    }
  }, [fetchEvents])

  const deleteEvent = useCallback(async (id: string) => {
    try {
      await fetchApi(`/Events/${id}`, { method: "DELETE" })
      await fetchEvents()
    } catch (e) {
      console.error("Failed to delete event", e)
      throw e
    }
  }, [fetchEvents])

  const getEvent = useCallback(
    (id: string) => events.find((e) => e.id === id),
    [events]
  )

  const reserveSeat = useCallback(async (eventId: string, dateId: string, seatNumber: number, user: ReservePayload): Promise<{ ok: boolean; status?: string; reason?: string }> => {
    try {
      const res = await fetchApi(`/Events/${eventId}/reserve/${dateId}`, { method: "POST" })
      await fetchEvents()
      return { ok: true, status: res?.status ?? "registered" }
    } catch (e: any) {
      const message = `${e?.message ?? ""}`.toLowerCase()
      if (message.includes("already reserved")) {
        return { ok: false, reason: "Ky sesion është tashmë i rezervuar nga ju." }
      }
      if (message.includes("maximum 2") || message.includes("max 2")) {
        return { ok: false, reason: "Maksimumi 2 rezervime seancash për modul. Anuloni një për të rezervuar një tjetër." }
      }
      return { ok: false, reason: e?.message || "Gabim gjatë rezervimit." }
    }
  }, [fetchEvents])

  const cancelBooking = useCallback(async (eventId: string, participantId: string) => {
    try {
      await fetchApi(`/Events/${eventId}/participants/${participantId}`, { method: "DELETE" })
      await fetchEvents()
    } catch (e) {
      console.error("Failed to cancel booking", e)
    }
  }, [fetchEvents])

  const markAttendance = useCallback(async (eventId: string, participantId: string, status: string) => {
    try {
      await fetchApi(`/Events/${eventId}/participants/${participantId}/attendance`, {
        method: "PUT",
        body: JSON.stringify({ status })
      })
      await fetchEvents()
    } catch (e) {
      console.error("Failed to mark attendance", e)
      throw e
    }
  }, [fetchEvents])

  const markAsNotified = useCallback(async (eventId: string) => {
    try {
      await fetchApi(`/Events/${eventId}/notify`, { method: "POST" })
      await fetchEvents()
    } catch (e) {
      console.error("Failed to mark as notified", e)
      throw e
    }
  }, [fetchEvents])

  const endSession = useCallback(async (eventId: string, dateId: string) => {
    try {
      await fetchApi(`/Events/${eventId}/sessions/${dateId}/end`, { method: "POST" })
      await fetchEvents()
    } catch (e) {
      console.error("Failed to end session", e)
      throw e
    }
  }, [fetchEvents])

  const addEventDocument = useCallback(async (eventId: string, file: File, fileName?: string) => {
    try {
      const body = new FormData()
      body.append("file", file)
      if (fileName?.trim()) {
        body.append("fileName", fileName.trim())
      }

      await fetchApi(`/Events/${eventId}/documents/upload`, {
        method: "POST",
        body
      })
      await fetchEvents()
    } catch (e) {
      console.error("Failed to add event document", e)
      throw e
    }
  }, [fetchEvents])

  const deleteEventDocument = useCallback(async (eventId: string, documentId: string) => {
    try {
      await fetchApi(`/Events/${eventId}/documents/${documentId}`, { method: "DELETE" })
      await fetchEvents()
    } catch (e) {
      console.error("Failed to delete event document", e)
      throw e
    }
  }, [fetchEvents])

  const updateParticipant = useCallback(async (eventId: string, participantId: string, updates: Partial<Participant>) => {
    // API logic for updating participant
    console.warn("Update participant not fully implemented on backend.")
  }, [])

  const getBookingsForMember = useCallback(
    (registryNumber: string) => {
      const normalizedRegistry = registryNumber.trim().toUpperCase()
      const results: { event: EventItem; participant: Participant }[] = []
      for (const e of events) {
        if (!e.participants || !e.participants.length) continue;
        for (const p of e.participants) {
          if ((p.memberRegistryNumber ?? "").trim().toUpperCase() !== normalizedRegistry) continue
          results.push({ event: e, participant: p })
        }
      }
      return results
    },
    [events]
  )

  const addUser = useCallback(async (user: Omit<AppUser, "id">) => {
    try {
      await fetchApi("/Members", {
        method: "POST",
        body: JSON.stringify({
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          email2: user.email2 ?? null,
          registryNumber: user.memberRegistryNumber,
          role: user.role,
          cpdHoursRequired: user.cpdHoursRequired,
          phone: user.phone ?? null,
          mentorId: user.mentorId ?? null,
          isActive: user.isActive !== false,
          validUntilMonth: user.validUntilMonth ?? null,
          studentTrackingNumber: user.studentTrackingNumber ?? null,
          studentNumber: user.studentNumber ?? null,
          studentStartYear: user.studentStartYear ?? null,
          studentEndYear: user.studentEndYear ?? null,
          company: user.company ?? null,
          district: user.district ?? null,
        })
      })
      await fetchUsers()
    } catch (e) {
      console.error("Failed to add user", e)
      throw e
    }
  }, [fetchUsers])

  const addUsers = useCallback(async (newUsers: Omit<AppUser, "id">[]) => {
    // Bulk add API not implemented yet, so loop it
    for (const u of newUsers) {
      try {
        await fetchApi("/Members", {
          method: "POST",
          body: JSON.stringify({
            firstName: u.firstName,
            lastName: u.lastName,
            email: u.email,
            email2: u.email2 ?? null,
            registryNumber: u.memberRegistryNumber,
            role: u.role,
            cpdHoursRequired: u.cpdHoursRequired,
            phone: u.phone ?? null,
            isActive: true,
            validUntilMonth: u.validUntilMonth ?? null,
            studentTrackingNumber: u.studentTrackingNumber ?? null,
            studentNumber: u.studentNumber ?? null,
            studentStartYear: u.studentStartYear ?? null,
            studentEndYear: u.studentEndYear ?? null,
            company: u.company ?? null,
            district: u.district ?? null,
          })
        })
      } catch (e) { }
    }
    await fetchUsers()
  }, [fetchUsers])

  const updateMember = useCallback(async (id: string, updates: Partial<AppUser>) => {
    try {
      await fetchApi(`/Members/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          firstName: updates.firstName,
          lastName: updates.lastName,
          email: updates.email,
          email2: updates.email2 ?? null,
          registryNumber: updates.memberRegistryNumber,
          phone: updates.phone ?? null,
          role: updates.role,
          cpdHoursRequired: updates.cpdHoursRequired,
          mentorId: updates.mentorId ?? null,
          isActive: updates.isActive !== false,
          validUntilMonth: updates.validUntilMonth ?? null,
          studentTrackingNumber: updates.studentTrackingNumber ?? null,
          studentNumber: updates.studentNumber ?? null,
          studentStartYear: updates.studentStartYear ?? null,
          studentEndYear: updates.studentEndYear ?? null,
          company: updates.company ?? null,
          district: updates.district ?? null,
        })
      });
      await fetchUsers();
    } catch (e) {
      console.error("Failed to update user", e);
      throw e;
    }
  }, [fetchUsers])

  const sendUserPasswordResetEmail = useCallback(async (id: string) => {
    try {
      await fetchApi(`/Members/${id}/send-reset-email`, {
        method: "POST",
        body: JSON.stringify({}),
      })
    } catch (e: any) {
      if (e?.status === 404) {
        await fetchApi(`/Members/${id}/reset-password`, {
          method: "POST",
          body: JSON.stringify({}),
        })
        return
      }
      console.error("Failed to send password reset email", e)
      throw e
    }
  }, [])

  const deleteUser = useCallback(async (id: string) => {
    try {
      await fetchApi(`/Members/${id}/permanent`, { method: "DELETE" })
      await Promise.all([fetchUsers(), fetchEvents()])
    } catch (e) {
      console.error("Failed to delete user", e)
      throw e
    }
  }, [fetchEvents, fetchUsers])

  const setMemberYearlyPayment = useCallback(async (id: string, isPaid: boolean) => {
    try {
      await fetchApi(`/Members/${id}/yearly-payment`, {
        method: "PUT",
        body: JSON.stringify({ isPaid })
      });
      await fetchUsers();
    } catch (e) {
      console.error("Failed to update yearly payment status", e);
      throw e;
    }
  }, [fetchUsers])

  // ── Live quiz controls ──────────────────────────────────────────────────
  const startQuiz = useCallback((eventId: string) => {
    setLiveQuizzes((prev) => new Set(prev).add(eventId))
  }, [])

  const stopQuiz = useCallback((eventId: string) => {
    setLiveQuizzes((prev) => {
      const next = new Set(prev)
      next.delete(eventId)
      return next
    })
  }, [])

  const isQuizLive = useCallback(
    (eventId: string) => liveQuizzes.has(eventId),
    [liveQuizzes]
  )

  const visibleEvents = useMemo(() => {
    if (user?.role === "Lecturer") {
      return events.filter(e => e.lecturerIds?.includes(user.id))
    }
    return events
  }, [events, user])

  return (
    <EventsContext.Provider
      value={{
        events: visibleEvents, users, isLoading, fetchEvents, fetchUsers,
        addEvent, updateEvent, deleteEvent, getEvent,
        reserveSeat, cancelBooking, updateParticipant, markAttendance, markAsNotified,
        endSession, addEventDocument, deleteEventDocument,
        getBookingsForMember,
        addUser, addUsers, updateMember, sendUserPasswordResetEmail, deleteUser, setMemberYearlyPayment,
        startQuiz, stopQuiz, isQuizLive,
      }}
    >
      {children}
    </EventsContext.Provider>
  )
}

export function useEvents() {
  const context = useContext(EventsContext)
  if (context === undefined) throw new Error("useEvents must be used within an EventsProvider")
  return context
}
