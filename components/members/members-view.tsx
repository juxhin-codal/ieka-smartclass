"use client"

// Members Listing with Subtabs & Compliance Stats
import { useState, useMemo, useRef } from "react"
import { useEvents } from "@/lib/events-context"
import { EditMemberForm } from "@/components/members/edit-member-form"
import { MemberReportModal } from "@/components/members/member-report-modal"
import type { AppUser } from "@/lib/data"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
    Upload, Download, Search, X, Users, UserPlus, CheckCircle2, AlertCircle,
    ChevronUp, ChevronDown, ChevronsUpDown, Pencil, FileText, Shield, BookOpen, Handshake
} from "lucide-react"
import { PaginationBar, usePagination, type PageSize } from "@/components/ui/pagination-bar"

type MemberSubTab = "aktiv" | "jo-aktiv" | "administrator" | "lecturer" | "mentor"
type SortKey = "name" | "attendance" | "cpd" | "role" | "status"
type SortDir = "asc" | "desc"

const subTabs: {
    key: MemberSubTab
    label: string
    icon: typeof Users
    accentClassName: string
    iconClassName: string
    badgeClassName: string
}[] = [
        {
            key: "aktiv",
            label: "Anëtarë Aktiv",
            icon: Users,
            accentClassName: "from-emerald-500/20 via-emerald-500/5 to-transparent",
            iconClassName: "border-emerald-500/20 bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
            badgeClassName: "bg-emerald-500 text-white shadow-sm shadow-emerald-500/30",
        },
        {
            key: "jo-aktiv",
            label: "Anëtarë Jo Aktiv",
            icon: AlertCircle,
            accentClassName: "from-amber-500/20 via-amber-500/5 to-transparent",
            iconClassName: "border-amber-500/20 bg-amber-500/12 text-amber-600 dark:text-amber-400",
            badgeClassName: "bg-amber-500 text-white shadow-sm shadow-amber-500/30",
        },
        {
            key: "administrator",
            label: "Administrator",
            icon: Shield,
            accentClassName: "from-sky-500/20 via-sky-500/5 to-transparent",
            iconClassName: "border-sky-500/20 bg-sky-500/12 text-sky-600 dark:text-sky-400",
            badgeClassName: "bg-sky-500 text-white shadow-sm shadow-sky-500/30",
        },
        {
            key: "lecturer",
            label: "Lektor",
            icon: BookOpen,
            accentClassName: "from-violet-500/20 via-violet-500/5 to-transparent",
            iconClassName: "border-violet-500/20 bg-violet-500/12 text-violet-600 dark:text-violet-400",
            badgeClassName: "bg-violet-500 text-white shadow-sm shadow-violet-500/30",
        },
        {
            key: "mentor",
            label: "Mentor",
            icon: Handshake,
            accentClassName: "from-rose-500/20 via-rose-500/5 to-transparent",
            iconClassName: "border-rose-500/20 bg-rose-500/12 text-rose-600 dark:text-rose-400",
            badgeClassName: "bg-rose-500 text-white shadow-sm shadow-rose-500/30",
        },
    ]

export function MembersView() {
    const { users, addUser, addUsers, events, setMemberYearlyPayment } = useEvents()
    const [activeSubTab, setActiveSubTab] = useState<MemberSubTab>("aktiv")
    const [search, setSearch] = useState("")
    const [sortKey, setSortKey] = useState<SortKey>("name")
    const [sortDir, setSortDir] = useState<SortDir>("asc")
    const [showAddForm, setShowAddForm] = useState(false)
    const [editingUser, setEditingUser] = useState<AppUser | null>(null)
    const [reportUser, setReportUser] = useState<AppUser | null>(null)
    const [updatingPaymentUserId, setUpdatingPaymentUserId] = useState<string | null>(null)
    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize, setPageSize] = useState<PageSize>(25)

    const [newFirstName, setNewFirstName] = useState("")
    const [newLastName, setNewLastName] = useState("")
    const [newEmail, setNewEmail] = useState("")
    const [newEmail2, setNewEmail2] = useState("")
    const [newRegistry, setNewRegistry] = useState("")
    const [newPhone, setNewPhone] = useState("")
    const [newPhonePrefix, setNewPhonePrefix] = useState("+355")
    const [newRole, setNewRole] = useState<string>("Member")
    const [newIsActive, setNewIsActive] = useState(true)
    const [error, setError] = useState("")
    const fileInputRef = useRef<HTMLInputElement>(null)
    const currentYear = new Date().getFullYear()
    const subTabCounts = useMemo<Record<MemberSubTab, number>>(
        () => ({
            aktiv: users.filter((u) => u.role === "Member" && (u as any).isActive !== false).length,
            "jo-aktiv": users.filter((u) => u.role === "Member" && (u as any).isActive === false).length,
            administrator: users.filter((u) => u.role === "Admin").length,
            lecturer: users.filter((u) => u.role === "Lecturer").length,
            mentor: users.filter((u) => u.role === "Mentor").length,
        }),
        [users]
    )

    // Compute per-member attendance stats from events
    const memberStats = useMemo(() => {
        const stats: Record<string, { attended: number; absent: number; waitlisted: number; modulesBooked: number; cpdHoursEarned: number }> = {}
        events.forEach((e) => {
            (e.participants ?? []).forEach((p) => {
                if (!stats[p.memberRegistryNumber]) {
                    stats[p.memberRegistryNumber] = { attended: 0, absent: 0, waitlisted: 0, modulesBooked: 0, cpdHoursEarned: 0 }
                }
                const s = stats[p.memberRegistryNumber]
                const isRegistered = p.status === "registered"
                const isConfirmedAttendance = isRegistered && p.attendance === "attended"
                const isRejectedAttendance = isRegistered && p.attendance === "absent"

                if (isRegistered) s.modulesBooked++
                if (isConfirmedAttendance) {
                    s.attended++
                    s.cpdHoursEarned += e.cpdHours
                } else if (isRejectedAttendance) {
                    s.absent++
                }
                if (p.status === "waitlisted") s.waitlisted++
            })
        })
        return stats
    }, [events])

    // Helper to compute derived values for a user
    function deriveUser(u: AppUser) {
        const st = memberStats[u.memberRegistryNumber]
        const totalBooked = st?.modulesBooked ?? 0
        const attended = st?.attended ?? 0
        const attendanceRate = totalBooked > 0 ? Math.round((attended / totalBooked) * 100) : null
        // Show hours from confirmed attendance only ("Konfirmuar"), excluding rejected.
        const cpdDone = st?.cpdHoursEarned ?? 0
        const cpdPct = Math.min(100, Math.round((cpdDone / (u.cpdHoursRequired || 1)) * 100))
        const isCompliant = cpdDone >= u.cpdHoursRequired
        const isAtRisk = !isCompliant && cpdPct >= 50
        return { attendanceRate, cpdDone, cpdPct, isCompliant, isAtRisk }
    }

    // Filter users by subtab
    const tabFilteredUsers = useMemo(() => {
        switch (activeSubTab) {
            case "aktiv":
                return users.filter(u => u.role === "Member" && (u as any).isActive !== false)
            case "jo-aktiv":
                return users.filter(u => u.role === "Member" && (u as any).isActive === false)
            case "administrator":
                return users.filter(u => u.role === "Admin")
            case "lecturer":
                return users.filter(u => u.role === "Lecturer")
            case "mentor":
                return users.filter(u => u.role === "Mentor")
            default:
                return users
        }
    }, [users, activeSubTab])

    const filteredAndSortedUsers = useMemo(() => {
        let result = tabFilteredUsers

        // Search
        if (search.trim()) {
            const q = search.toLowerCase()
            result = result.filter(
                (u) =>
                    u.firstName.toLowerCase().includes(q) ||
                    u.lastName.toLowerCase().includes(q) ||
                    u.email.toLowerCase().includes(q) ||
                    (u.email2 ?? "").toLowerCase().includes(q) ||
                    u.memberRegistryNumber.toLowerCase().includes(q)
            )
        }

        // Sort
        result = [...result].sort((a, b) => {
            let cmp = 0
            if (sortKey === "name") {
                cmp = `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
            } else if (sortKey === "role") {
                cmp = a.role.localeCompare(b.role)
            } else if (sortKey === "attendance") {
                const { attendanceRate: ar } = deriveUser(a)
                const { attendanceRate: br } = deriveUser(b)
                cmp = (ar ?? -1) - (br ?? -1)
            } else if (sortKey === "cpd") {
                const { cpdDone: ac } = deriveUser(a)
                const { cpdDone: bc } = deriveUser(b)
                cmp = ac - bc
            }
            return sortDir === "asc" ? cmp : -cmp
        })

        return result
    }, [tabFilteredUsers, search, sortKey, sortDir, memberStats])

    function handleSort(key: SortKey) {
        if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
        else { setSortKey(key); setSortDir("asc") }
        setCurrentPage(1)
    }

    const pagedUsers = usePagination(filteredAndSortedUsers, pageSize, currentPage)
    const handleSearchChange = (v: string) => { setSearch(v); setCurrentPage(1) }
    const isMentorSubTab = activeSubTab === "mentor"
    const isLecturerSubTab = activeSubTab === "lecturer"
    const isAdministratorSubTab = activeSubTab === "administrator"
    const mentorStudentCountById = useMemo(() => {
        const counts = new Map<string, number>()
        users
            .filter((u) => u.role === "Student")
            .forEach((student) => {
                const mentorId = student.mentorId ?? null
                if (!mentorId) return
                counts.set(mentorId, (counts.get(mentorId) ?? 0) + 1)
            })
        return counts
    }, [users])
    const lecturerModuleCountById = useMemo(() => {
        const counts = new Map<string, number>()
        const lecturers = users.filter((u) => u.role === "Lecturer")
        const lecturerByName = new Map(
            lecturers.map((lecturer) => [`${lecturer.firstName} ${lecturer.lastName}`.trim().toLowerCase(), lecturer.id])
        )

        events.forEach((event) => {
            const assignedIds = (event.lecturerIds ?? []).filter(Boolean)
            if (assignedIds.length > 0) {
                assignedIds.forEach((lecturerId) => {
                    counts.set(lecturerId, (counts.get(lecturerId) ?? 0) + 1)
                })
                return
            }

            const lecturerNameKey = (event.lecturerName ?? "").trim().toLowerCase()
            if (!lecturerNameKey) return
            const lecturerId = lecturerByName.get(lecturerNameKey)
            if (!lecturerId) return
            counts.set(lecturerId, (counts.get(lecturerId) ?? 0) + 1)
        })

        return counts
    }, [events, users])

    const showCsvButtons = activeSubTab === "aktiv"
    const showReportButton = activeSubTab === "aktiv" || activeSubTab === "jo-aktiv"

    async function handleToggleYearlyPayment(u: AppUser, markAsPaid: boolean) {
        setUpdatingPaymentUserId(u.id)
        try {
            await setMemberYearlyPayment(u.id, markAsPaid)
        } catch {
            setError("Gabim gjatë përditësimit të pagesës vjetore")
        } finally {
            setUpdatingPaymentUserId(null)
        }
    }

    async function handleAdd() {
        if (!newFirstName.trim() || !newLastName.trim() || !newEmail.trim() || !newRegistry.trim()) {
            setError("Ju lutem plotësoni të gjitha fushat e detyrueshme")
            return
        }
        try {
            await addUser({
                firstName: newFirstName.trim(),
                lastName: newLastName.trim(),
                email: newEmail.trim(),
                email2: newEmail2.trim() || null,
                memberRegistryNumber: newRegistry.trim().toUpperCase(),
                role: newRole as any,
                phone: newPhone.trim() || undefined,
                phonePrefix: newPhonePrefix.trim() || "+355",
                phoneNumber: newPhone.trim() || undefined,
                mentorId: null,
                validUntilMonth: null,
                cpdHoursCompleted: 0,
                cpdHoursRequired: 20,
                isActive: newRole === "Member" ? newIsActive : true,
            })
            setNewFirstName(""); setNewLastName(""); setNewEmail(""); setNewEmail2("")
            setNewRegistry(""); setNewPhone(""); setNewPhonePrefix("+355"); setNewRole("Member"); setNewIsActive(true); setError("")
            setShowAddForm(false)
        } catch (e: any) {
            setError(e?.message ?? "Gabim gjatë shtimit të anëtarit")
        }
    }

    function handleDownload() {
        const csv = [
            "Numri Regjistrit,Emri,Mbiemri,Email,Telefon,Orë CPD Kryer,Orë CPD Kërkuar,Rol",
            ...tabFilteredUsers.map((u) =>
                `${u.memberRegistryNumber},${u.firstName},${u.lastName},${u.email},${u.phone ?? ""},${u.cpdHoursCompleted},${u.cpdHoursRequired},${u.role}`
            ),
        ].join("\n")
        const blob = new Blob([csv], { type: "text/csv" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a"); a.href = url; a.download = `anetaret-ieka-${activeSubTab}.csv`; a.click()
        URL.revokeObjectURL(url)
    }

    function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = (ev) => {
            const text = ev.target?.result as string
            const lines = text.split("\n").filter(Boolean).slice(1)
            const newUsers: Omit<AppUser, "id">[] = []
            for (const line of lines) {
                const [reg, fn, ln, email, phone, cpdDone, cpdReq, role] = line.split(",").map((s) => s.trim())
                if (reg && fn && ln && email) {
                    newUsers.push({
                        memberRegistryNumber: reg,
                        firstName: fn,
                        lastName: ln,
                        email,
                        phone: phone || undefined,
                        role: (role as any) || "Member",
                        cpdHoursCompleted: Number(cpdDone) || 0,
                        cpdHoursRequired: Number(cpdReq) || 20,
                    })
                }
            }
            if (newUsers.length > 0) addUsers(newUsers).catch(console.error)
        }
        reader.readAsText(file)
        if (fileInputRef.current) fileInputRef.current.value = ""
    }

    return (
        <>
            <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
                {/* Header */}
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-xl font-semibold tracking-tight text-foreground">Anëtarë IEKA</h1>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                            Regjistri i anëtarëve dhe orët CPD
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {showCsvButtons && (
                            <>
                                <input ref={fileInputRef} type="file" accept=".csv" onChange={handleUpload} className="hidden" aria-label="Ngarko CSV" />
                                <Button variant="outline" size="sm" className="gap-2 shrink-0" onClick={() => fileInputRef.current?.click()}>
                                    <Upload className="h-4 w-4" /> <span className="hidden sm:inline">Ngarko CSV</span>
                                </Button>
                            </>
                        )}
                        <Button variant="outline" size="sm" className="gap-2 shrink-0" onClick={handleDownload}>
                            <Download className="h-4 w-4" /> <span className="hidden sm:inline">Shkarko</span>
                        </Button>
                        <Button size="sm" className="gap-2 shrink-0" onClick={() => {
                            setNewIsActive(activeSubTab !== "jo-aktiv")
                            const roleMap: Record<MemberSubTab, string> = { aktiv: "Member", "jo-aktiv": "Member", administrator: "Admin", lecturer: "Lecturer", mentor: "Mentor" }
                            setNewRole(roleMap[activeSubTab] || "Member")
                            setShowAddForm(true)
                        }}>
                            <UserPlus className="h-4 w-4" /> Shto Anëtar
                        </Button>
                    </div>
                </div>

                {/* Subtabs */}
                <div className="mb-6 grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-5">
                    {subTabs.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => { setActiveSubTab(tab.key); setCurrentPage(1); setSearch("") }}
                            className={cn(
                                "group relative overflow-hidden rounded-xl border px-3 py-2.5 text-left transition-all",
                                activeSubTab === tab.key
                                    ? "border-primary/30 bg-card text-foreground shadow-md"
                                    : "border-border bg-card/90 text-foreground hover:-translate-y-0.5 hover:border-primary/20 hover:bg-card hover:shadow-sm"
                            )}
                        >
                            <div
                                className={cn(
                                    "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity",
                                    tab.accentClassName,
                                    activeSubTab === tab.key ? "opacity-100" : "group-hover:opacity-100/70"
                                )}
                            />
                            <div className="relative flex items-center gap-3">
                                <div className={cn(
                                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                                    activeSubTab === tab.key
                                        ? tab.iconClassName
                                        : "border-border bg-muted/60 text-muted-foreground"
                                )}>
                                    <tab.icon className="h-4 w-4" />
                                </div>

                                <p className="min-w-0 flex-1 text-[13px] font-semibold leading-tight text-foreground">
                                    {tab.label}
                                </p>

                                <span className={cn(
                                    "inline-flex min-w-[2rem] items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
                                    activeSubTab === tab.key ? tab.badgeClassName : "bg-muted text-foreground"
                                )}>
                                    {subTabCounts[tab.key]}
                                </span>
                            </div>
                        </button>
                    ))}
                </div>

                {/* Search bar */}
                <div className="mb-5 flex flex-wrap items-center gap-3">
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input id="member-search" placeholder="Kërko anëtarë..." value={search}
                            onChange={(e) => handleSearchChange(e.target.value)} className="pl-9 h-9" />
                    </div>
                    <span className="w-full text-xs text-muted-foreground sm:ml-auto sm:w-auto">
                        {filteredAndSortedUsers.length} nga {tabFilteredUsers.length} anëtarë
                    </span>
                </div>
                {error && !showAddForm && (
                    <p className="mb-4 text-sm text-destructive">{error}</p>
                )}

                {/* Add Member Modal */}
                {showAddForm && (
                    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 px-4 py-8 backdrop-blur-sm">
                        <div className="w-full max-w-3xl rounded-xl border border-border bg-card shadow-xl">
                            <div className="flex items-center justify-between border-b border-border px-6 py-4">
                                <h3 className="text-base font-semibold text-foreground">Shto Anëtar të Ri</h3>
                                <button onClick={() => { setShowAddForm(false); setError("") }} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                            <div className="flex flex-col gap-4 p-6">
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div className="flex flex-col gap-2">
                                        <Label htmlFor="m-reg">Numri i Regjistrit *</Label>
                                        <Input id="m-reg" value={newRegistry} onChange={(e) => setNewRegistry(e.target.value)} placeholder="IEKA-2270" className="font-mono" />
                                        {newRole === "Student" && (
                                            <p className="text-xs text-muted-foreground">Plotësohet automatikisht nga emri, por mund ta ndryshoni nëse duhet.</p>
                                        )}
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <Label htmlFor="m-fn">Emri *</Label>
                                        <Input id="m-fn" value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)} placeholder="Artan" />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <Label htmlFor="m-ln">Mbiemri *</Label>
                                        <Input id="m-ln" value={newLastName} onChange={(e) => setNewLastName(e.target.value)} placeholder="Hoxha" />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <Label htmlFor="m-email">Email *</Label>
                                        <Input id="m-email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="artan.hoxha@ieka.al" />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <Label htmlFor="m-email2">Email 2</Label>
                                        <Input id="m-email2" type="email" value={newEmail2} onChange={(e) => setNewEmail2(e.target.value)} placeholder="artan.personal@example.com" />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <Label htmlFor="m-phone">Telefon</Label>
                                        <div className="flex gap-2">
                                            <Input id="m-phone-prefix" value={newPhonePrefix} onChange={(e) => setNewPhonePrefix(e.target.value)} className="w-20" placeholder="+355" />
                                            <Input id="m-phone" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="69 123 4567" className="flex-1" />
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <Label htmlFor="m-role">Roli *</Label>
                                        <select
                                            id="m-role"
                                            value={newRole}
                                            onChange={(e) => {
                                                const nextRole = e.target.value
                                                setNewRole(nextRole)
                                                if (nextRole !== "Member") {
                                                    setNewIsActive(true)
                                                }
                                            }}
                                            className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            <option value="Member">Anëtar</option>
                                            <option value="Admin">Administrator</option>
                                            <option value="Lecturer">Lektor</option>
                                            <option value="Mentor">Mentor</option>
                                        </select>
                                    </div>
                                    {newRole === "Member" && (
                                        <div className="flex flex-col gap-2">
                                            <Label htmlFor="m-is-active">Statusi *</Label>
                                            <select
                                                id="m-is-active"
                                                value={newIsActive ? "active" : "inactive"}
                                                onChange={(e) => setNewIsActive(e.target.value === "active")}
                                                className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                <option value="active">Anëtar Aktiv</option>
                                                <option value="inactive">Anëtar Jo Aktiv</option>
                                            </select>
                                        </div>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Anëtari do krijohet si <strong>në pritje të konfirmimit</strong> dhe do marrë email për konfirmim dhe vendosje fjalëkalimi.
                                </p>
                                {error && <p className="text-sm text-destructive">{error}</p>}
                                <div className="flex justify-end gap-2 border-t border-border pt-4">
                                    <Button variant="ghost" onClick={() => { setShowAddForm(false); setError("") }}>Anulo</Button>
                                    <Button onClick={handleAdd}>Shto Anëtarin</Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Members Table */}
                {filteredAndSortedUsers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
                        <Users className="mb-3 h-10 w-10 text-muted-foreground/40" />
                        <p className="text-sm text-muted-foreground">
                            {search ? "Asnjë anëtar nuk përputhet me kërkimin" : "Asnjë anëtar në këtë kategori"}
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="space-y-3 md:hidden">
                            {pagedUsers.map((u) => {
                                const { attendanceRate, cpdDone, cpdPct, isCompliant } = deriveUser(u)
                                const isInactiveMember = activeSubTab === "jo-aktiv" && u.role === "Member" && (u as any).isActive === false
                                const isPaidForCurrentYear = (u.yearlyPaymentPaidYear ?? null) === currentYear
                                const mentorStudentsCount = mentorStudentCountById.get(u.id) ?? 0
                                const lecturerModulesCount = lecturerModuleCountById.get(u.id) ?? 0

                                return (
                                    <div key={u.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                                        <div className="flex items-start gap-3">
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                                                {u.firstName[0]}{u.lastName[0]}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="truncate font-semibold text-foreground">{u.firstName} {u.lastName}</p>
                                                        <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                                                    </div>
                                                    <code className="rounded-full bg-muted px-2 py-1 text-[10px] font-mono text-foreground">
                                                        {u.memberRegistryNumber}
                                                    </code>
                                                </div>

                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    {u.phone && (
                                                        <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                                                            {u.phone}
                                                        </span>
                                                    )}
                                                    {u.isPendingConfirmation && (
                                                        <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-[11px] font-medium text-blue-600">
                                                            Pending Confirmation
                                                        </span>
                                                    )}
                                                    {isInactiveMember && (
                                                        <span className={cn(
                                                            "rounded-full px-2.5 py-1 text-[11px] font-medium",
                                                            isPaidForCurrentYear
                                                                ? "bg-green-500/10 text-green-600"
                                                                : "bg-amber-500/10 text-amber-600"
                                                        )}>
                                                            {isPaidForCurrentYear ? `Paguar ${currentYear}` : "Pa paguar"}
                                                        </span>
                                                    )}
                                                    {isMentorSubTab && (
                                                        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                                                            {mentorStudentsCount} studentë
                                                        </span>
                                                    )}
                                                    {isLecturerSubTab && (
                                                        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                                                            {lecturerModulesCount} module
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {!isMentorSubTab && !isLecturerSubTab && !isAdministratorSubTab && (
                                            <div className="mt-4 grid gap-2 sm:grid-cols-2">
                                                <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                                                            Prezenca
                                                        </span>
                                                        <span className="text-xs font-semibold text-foreground">
                                                            {attendanceRate !== null ? `${attendanceRate}%` : "—"}
                                                        </span>
                                                    </div>
                                                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
                                                        <div
                                                            className={cn(
                                                                "h-full rounded-full",
                                                                attendanceRate === null
                                                                    ? "bg-border"
                                                                    : attendanceRate >= 80
                                                                        ? "bg-green-500"
                                                                        : attendanceRate >= 50
                                                                            ? "bg-amber-500"
                                                                            : "bg-red-500"
                                                            )}
                                                            style={{ width: `${attendanceRate ?? 0}%` }}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                                                            CPD
                                                        </span>
                                                        <span className="text-xs font-semibold text-foreground">
                                                            {cpdDone}/{u.cpdHoursRequired}
                                                        </span>
                                                    </div>
                                                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
                                                        <div
                                                            className={cn(
                                                                "h-full rounded-full",
                                                                isCompliant ? "bg-green-500" : cpdPct >= 50 ? "bg-amber-500" : "bg-red-500"
                                                            )}
                                                            style={{ width: `${cpdPct}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="mt-4 flex flex-wrap gap-2">
                                            {showReportButton && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="min-w-[5.5rem] flex-1 gap-1.5"
                                                    onClick={() => setReportUser(u)}
                                                >
                                                    <FileText className="h-3.5 w-3.5" />
                                                    Raport
                                                </Button>
                                            )}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="min-w-[5.5rem] flex-1 gap-1.5"
                                                onClick={() => setEditingUser(u)}
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                                Modifiko
                                            </Button>
                                        </div>

                                        {isInactiveMember && (
                                            <button
                                                onClick={() => handleToggleYearlyPayment(u, !isPaidForCurrentYear)}
                                                title={isPaidForCurrentYear ? "Anulo" : "Paguaj"}
                                                disabled={updatingPaymentUserId === u.id}
                                                className={cn(
                                                    "mt-3 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                                                    isPaidForCurrentYear
                                                        ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-400 dark:hover:bg-green-950/50"
                                                        : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-400 dark:hover:bg-amber-950/50"
                                                )}
                                            >
                                                {isPaidForCurrentYear ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                                                {isPaidForCurrentYear ? "Anulo pagesën" : "Shëno si paguar"}
                                            </button>
                                        )}
                                    </div>
                                )
                            })}
                            <PaginationBar
                                totalItems={filteredAndSortedUsers.length}
                                pageSize={pageSize}
                                currentPage={currentPage}
                                onPageChange={setCurrentPage}
                                onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1) }}
                                className="rounded-2xl border border-border bg-card px-4 py-4"
                            />
                        </div>

                        <div className="hidden overflow-x-auto rounded-xl border border-border bg-card md:block">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="border-b border-border bg-muted/50">
                                        <SortableTh label="Anëtari" sortKey="name" current={sortKey} dir={sortDir} onSort={handleSort} />
                                        <th className="hidden px-4 py-3 text-xs font-medium text-muted-foreground lg:table-cell">Regjistri</th>
                                        <th className="hidden px-4 py-3 text-xs font-medium text-muted-foreground md:table-cell">Telefon</th>
                                        {isMentorSubTab ? (
                                            <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Nr. Studentësh</th>
                                        ) : isLecturerSubTab ? (
                                            <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Nr. Modulesh</th>
                                        ) : isAdministratorSubTab ? null : (
                                            <>
                                                <SortableTh label="Prezenca" sortKey="attendance" current={sortKey} dir={sortDir} onSort={handleSort} />
                                                <SortableTh label="Orë" sortKey="cpd" current={sortKey} dir={sortDir} onSort={handleSort} />
                                            </>
                                        )}
                                        <th className="w-[200px] px-4 py-3"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedUsers.map((u) => {
                                        const { attendanceRate, cpdDone, cpdPct, isCompliant } = deriveUser(u)
                                        const isInactiveMember = activeSubTab === "jo-aktiv" && u.role === "Member" && (u as any).isActive === false
                                        const isPaidForCurrentYear = (u.yearlyPaymentPaidYear ?? null) === currentYear
                                        const mentorStudentsCount = mentorStudentCountById.get(u.id) ?? 0
                                        const lecturerModulesCount = lecturerModuleCountById.get(u.id) ?? 0

                                        return (
                                            <tr key={u.id} className="border-b border-border transition-colors last:border-0 hover:bg-muted/20">
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                                                            {u.firstName[0]}{u.lastName[0]}
                                                        </div>
                                                        <div>
                                                            <p className="font-medium text-foreground">{u.firstName} {u.lastName}</p>
                                                            <div className="flex flex-wrap items-center gap-1.5">
                                                                <p className="text-xs text-muted-foreground">{u.email}</p>
                                                                <code className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono lg:hidden">{u.memberRegistryNumber}</code>
                                                                {u.isPendingConfirmation && (
                                                                    <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-600">
                                                                        Pending Confirmation
                                                                    </span>
                                                                )}
                                                                {isInactiveMember && (
                                                                    <span className={cn(
                                                                        "rounded-full px-2 py-0.5 text-[10px] font-medium",
                                                                        isPaidForCurrentYear
                                                                            ? "bg-green-500/10 text-green-600"
                                                                            : "bg-amber-500/10 text-amber-600"
                                                                    )}>
                                                                        {isPaidForCurrentYear ? `Paguar ${currentYear}` : "Pa paguar"}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="hidden px-4 py-3 lg:table-cell">
                                                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{u.memberRegistryNumber}</code>
                                                </td>
                                                <td className="hidden px-4 py-3 text-xs text-muted-foreground md:table-cell">{u.phone ?? "—"}</td>
                                                {isMentorSubTab ? (
                                                    <td className="px-4 py-3">
                                                        <span className="inline-flex min-w-[2rem] items-center justify-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                                                            {mentorStudentsCount}
                                                        </span>
                                                    </td>
                                                ) : isLecturerSubTab ? (
                                                    <td className="px-4 py-3">
                                                        <span className="inline-flex min-w-[2rem] items-center justify-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                                                            {lecturerModulesCount}
                                                        </span>
                                                    </td>
                                                ) : isAdministratorSubTab ? null : (
                                                    <>
                                                        <td className="px-4 py-3">
                                                            {attendanceRate !== null ? (
                                                                <div className="flex items-center gap-2">
                                                                    <div className="h-1.5 w-12 overflow-hidden rounded-full bg-border sm:w-16">
                                                                        <div
                                                                            className={cn(
                                                                                "h-full rounded-full",
                                                                                attendanceRate >= 80 ? "bg-green-500" : attendanceRate >= 50 ? "bg-amber-500" : "bg-red-500"
                                                                            )}
                                                                            style={{ width: `${attendanceRate}%` }}
                                                                        />
                                                                    </div>
                                                                    <span className="whitespace-nowrap text-xs text-muted-foreground">{attendanceRate}%</span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-xs text-muted-foreground">—</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-2">
                                                                <div className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-border sm:block sm:w-16">
                                                                    <div
                                                                        className={cn(
                                                                            "h-full rounded-full transition-all",
                                                                            isCompliant ? "bg-green-500" : cpdPct >= 50 ? "bg-amber-500" : "bg-red-500"
                                                                        )}
                                                                        style={{ width: `${cpdPct}%` }}
                                                                    />
                                                                </div>
                                                                <span className="whitespace-nowrap text-xs font-medium text-foreground">{cpdDone}/{u.cpdHoursRequired}</span>
                                                            </div>
                                                        </td>
                                                    </>
                                                )}
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        {showReportButton && (
                                                            <button
                                                                onClick={() => setReportUser(u)}
                                                                title="Raport"
                                                                className="flex h-7 w-7 items-center justify-center rounded-lg bg-transparent text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                                            >
                                                                <FileText className="h-3.5 w-3.5" />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => setEditingUser(u)}
                                                            title="Modifiko Anëtarin"
                                                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-transparent text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                                        >
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </button>
                                                        {isInactiveMember && (
                                                            <button
                                                                onClick={() => handleToggleYearlyPayment(u, !isPaidForCurrentYear)}
                                                                title={isPaidForCurrentYear ? "Anulo" : "Paguaj"}
                                                                disabled={updatingPaymentUserId === u.id}
                                                                className={cn(
                                                                    "inline-flex h-8 min-w-[120px] items-center justify-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                                                                    isPaidForCurrentYear
                                                                        ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-400 dark:hover:bg-green-950/50"
                                                                        : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-400 dark:hover:bg-amber-950/50"
                                                                )}
                                                            >
                                                                {isPaidForCurrentYear ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                                                                {isPaidForCurrentYear ? "Anulo" : "Paguaj"}
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                            <PaginationBar
                                totalItems={filteredAndSortedUsers.length}
                                pageSize={pageSize}
                                currentPage={currentPage}
                                onPageChange={setCurrentPage}
                                onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1) }}
                                className="border-t border-border px-4"
                            />
                        </div>
                    </>
                )}
            </div>

            {editingUser && (
                <EditMemberForm user={editingUser} onClose={() => setEditingUser(null)} />
            )}
            {reportUser && (
                <MemberReportModal user={reportUser} onClose={() => setReportUser(null)} />
            )}
        </>
    )
}

// Sortable column header
function SortableTh({
    label, sortKey, current, dir, onSort, className = ""
}: {
    label: string; sortKey: SortKey; current: SortKey; dir: SortDir
    onSort: (k: SortKey) => void; className?: string
}) {
    const isActive = current === sortKey
    return (
        <th className={`px-4 py-3 text-xs font-medium text-muted-foreground ${className}`}>
            <button
                onClick={() => onSort(sortKey)}
                className={`flex items-center gap-1 hover:text-foreground transition-colors ${isActive ? "text-foreground" : ""}`}
            >
                {label}
                {isActive ? (
                    dir === "asc"
                        ? <ChevronUp className="h-3 w-3 text-primary" />
                        : <ChevronDown className="h-3 w-3 text-primary" />
                ) : (
                    <ChevronsUpDown className="h-3 w-3 opacity-40" />
                )}
            </button>
        </th>
    )
}
