"use client"

import { useMemo, useState } from "react"
import { useEvents } from "@/lib/events-context"
import { AdminPasswordResetCard } from "@/components/admin/admin-password-reset-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MonthYearPicker } from "@/components/ui/month-year-picker"
import { Trash2, X } from "lucide-react"
import type { AppUser } from "@/lib/data"
import { splitPhone } from "@/lib/phone-utils"

interface EditMemberFormProps {
    user: AppUser
    onClose: () => void
}

export function EditMemberForm({ user, onClose }: EditMemberFormProps) {
    const { updateMember, deleteUser, users } = useEvents()

    function getDefaultStudentValidUntilMonth() {
        return `${new Date().getFullYear() + 3}-09`
    }

    const [firstName, setFirstName] = useState(user.firstName)
    const [lastName, setLastName] = useState(user.lastName)
    const [email, setEmail] = useState(user.email)
    const [email2, setEmail2] = useState(user.email2 ?? "")
    const [registryNumber, setRegistryNumber] = useState(user.memberRegistryNumber)
    const { prefix: initPhonePrefix, number: initPhoneNumber } = splitPhone(user.phone)
    const [phonePrefix, setPhonePrefix] = useState(initPhonePrefix)
    const [phoneNumber, setPhoneNumber] = useState(initPhoneNumber)
    const [role, setRole] = useState(user.role)
    const [mentorId, setMentorId] = useState(user.mentorId ?? "")
    const [validUntilMonth, setValidUntilMonth] = useState(user.validUntilMonth ?? "")
    const [cpdHoursRequired, setCpdHoursRequired] = useState(String(user.cpdHoursRequired))
    const [isActive, setIsActive] = useState(user.isActive !== false)

    const [saving, setSaving] = useState(false)
    const [error, setError] = useState("")
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [deleteLoading, setDeleteLoading] = useState(false)
    const [deleteError, setDeleteError] = useState("")
    const mentors = useMemo(() => users.filter((u) => u.role === "Mentor"), [users])
    const showCpdHoursField = role === "Member"

    async function handleUpdate(e: React.FormEvent) {
        e.preventDefault()
        setError("")
        if (!firstName.trim() || !lastName.trim() || !email.trim() || !registryNumber.trim()) {
            setError("Plotësoni të gjitha fushat me *")
            return
        }
        if (role === "Student" && !mentorId) {
            setError("Zgjidhni mentorin për studentin.")
            return
        }
        if (role === "Student" && !validUntilMonth) {
            setError("Zgjidhni fushën 'Valid deri në'.")
            return
        }

        setSaving(true)
        try {
            await updateMember(user.id, {
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                email: email.trim(),
                email2: email2.trim() || null,
                memberRegistryNumber: registryNumber.trim().toUpperCase(),
                phone: phoneNumber.trim() || undefined,
                phonePrefix: phonePrefix.trim() || "+355",
                phoneNumber: phoneNumber.trim() || undefined,
                role: role as any,
                mentorId: role === "Student" ? mentorId : null,
                validUntilMonth: role === "Student" ? validUntilMonth : null,
                cpdHoursRequired: showCpdHoursField ? Number(cpdHoursRequired) || 20 : user.cpdHoursRequired,
                isActive: role === "Member" ? isActive : true,
            })
            onClose()
        } catch (e: any) {
            setError(e?.message ?? "Gabim gjatë ruajtjes. Provo përsëri.")
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete() {
        setDeleteLoading(true)
        setDeleteError("")
        try {
            await deleteUser(user.id)
            setShowDeleteConfirm(false)
            onClose()
        } catch (e: any) {
            setDeleteError(e?.message ?? "Gabim gjatë fshirjes së përdoruesit.")
        } finally {
            setDeleteLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 px-4 py-8 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-lg">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border px-6 py-4">
                    <div>
                        <h2 className="text-lg font-semibold text-foreground">Modifiko Anëtarin</h2>
                        <p className="text-xs text-muted-foreground mt-0.5 font-mono">{user.memberRegistryNumber}</p>
                    </div>
                    <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleUpdate} className="flex flex-col gap-4 p-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="m-fn">Emri *</Label>
                            <Input id="m-fn" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="m-ln">Mbiemri *</Label>
                            <Input id="m-ln" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="m-email">Email *</Label>
                            <Input id="m-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="m-email2">Email 2</Label>
                            <Input id="m-email2" type="email" value={email2} onChange={(e) => setEmail2(e.target.value)} />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="m-reg">Numri i Regjistrit *</Label>
                            <Input id="m-reg" value={registryNumber} onChange={(e) => setRegistryNumber(e.target.value)} className="font-mono" />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="m-phone">Telefon</Label>
                            <div className="flex gap-2">
                                <Input id="m-phone-prefix" value={phonePrefix} onChange={(e) => setPhonePrefix(e.target.value)} className="w-20" placeholder="+355" />
                                <Input id="m-phone" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="69 123 4567" className="flex-1" />
                            </div>
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="m-role">Rol *</Label>
                            <select
                                id="m-role"
                                value={role}
                                onChange={(e) => {
                                    const nextRole = e.target.value as any
                                    setRole(nextRole)
                                    if (nextRole !== "Student") {
                                        setMentorId("")
                                        setValidUntilMonth("")
                                    } else if (!validUntilMonth) {
                                        setValidUntilMonth(getDefaultStudentValidUntilMonth())
                                    }
                                }}
                                className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <option value="Member">Anëtar</option>
                                <option value="Admin">Administrator</option>
                                <option value="Lecturer">Lektor</option>
                                <option value="Mentor">Mentor</option>
                                <option value="Student">Student</option>
                            </select>
                        </div>
                        {role === "Student" && (
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="m-mentor">Mentori *</Label>
                                <select
                                    id="m-mentor"
                                    value={mentorId}
                                    onChange={(e) => setMentorId(e.target.value)}
                                    className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <option value="">Zgjidh mentorin</option>
                                    {mentors.map((mentor) => (
                                        <option key={mentor.id} value={mentor.id}>
                                            {mentor.firstName} {mentor.lastName} ({mentor.memberRegistryNumber})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                        {role === "Student" && (
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="m-valid-until">Valid deri në *</Label>
                                <MonthYearPicker id="m-valid-until" value={validUntilMonth} onChange={setValidUntilMonth} />
                            </div>
                        )}
                        {showCpdHoursField && (
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="m-cpd">Orë CPD Kërkuara *</Label>
                                <Input id="m-cpd" type="number" min="0" value={cpdHoursRequired} onChange={(e) => setCpdHoursRequired(e.target.value)} />
                            </div>
                        )}
                    </div>

                    {role === "Member" && (
                        <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
                            <label className="flex cursor-pointer items-center gap-3">
                                <input
                                    type="checkbox"
                                    checked={isActive}
                                    onChange={(e) => setIsActive(e.target.checked)}
                                    className="h-4 w-4 rounded border-input accent-primary"
                                />
                                <div>
                                    <p className={`text-sm font-medium ${isActive ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
                                        {isActive ? "Anëtar Aktiv" : "Anëtar Jo Aktiv"}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {isActive
                                            ? "Anëtari shfaqet tek lista e anëtarëve aktiv"
                                            : "Anëtari shfaqet tek lista e anëtarëve jo aktiv"}
                                    </p>
                                </div>
                            </label>
                        </div>
                    )}

                    <AdminPasswordResetCard
                        userId={user.id}
                        userLabel={`${firstName.trim()} ${lastName.trim()}`.trim() || user.email}
                    />

                    {error && <p className="text-sm text-destructive font-medium">{error}</p>}

                    <div className="flex flex-col gap-3 border-t border-border pt-4 mt-2 sm:flex-row sm:items-center sm:justify-between">
                        <Button
                            type="button"
                            variant="outline"
                            className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => {
                                setShowDeleteConfirm(true)
                                setDeleteError("")
                            }}
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Fshi Përdoruesin
                        </Button>
                        <div className="flex items-center justify-end gap-3">
                            <Button type="button" variant="ghost" onClick={onClose}>Anulo</Button>
                            <Button type="submit" disabled={saving}>
                                {saving ? "Duke ruajtur..." : "Ruaj Ndryshimet"}
                            </Button>
                        </div>
                    </div>
                </form>
            </div>

            {showDeleteConfirm && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/40 px-4 backdrop-blur-sm">
                    <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl">
                        <h3 className="mb-1 text-base font-semibold text-foreground">Fshi përdoruesin?</h3>
                        <p className="mb-1 text-sm text-muted-foreground">
                            Do të fshihet <strong className="text-foreground">{user.firstName} {user.lastName}</strong>.
                        </p>
                        <p className="mb-5 text-xs text-destructive/80">
                            Ky veprim është përfundimtar dhe heq rezervimet/sesionet e lidhura.
                        </p>
                        {deleteError && (
                            <p className="mb-4 text-sm font-medium text-destructive">{deleteError}</p>
                        )}
                        <div className="flex justify-end gap-2">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => {
                                    if (deleteLoading) return
                                    setShowDeleteConfirm(false)
                                    setDeleteError("")
                                }}
                                disabled={deleteLoading}
                            >
                                Anulo
                            </Button>
                            <Button type="button" variant="destructive" onClick={() => void handleDelete()} disabled={deleteLoading}>
                                {deleteLoading ? "Duke fshirë..." : "Po, Fshi"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
