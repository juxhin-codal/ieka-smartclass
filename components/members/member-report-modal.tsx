"use client"

import { useState, useRef } from "react"
import { useEvents } from "@/lib/events-context"
import type { AppUser } from "@/lib/data"
import { Button } from "@/components/ui/button"
import { X, Download, Mail, FileText, CheckCircle2, Clock, Calendar } from "lucide-react"

interface MemberReportModalProps {
    user: AppUser
    onClose: () => void
}

export function MemberReportModal({ user, onClose }: MemberReportModalProps) {
    const { events } = useEvents()
    const [sending, setSending] = useState(false)
    const [sent, setSent] = useState(false)
    const reportRef = useRef<HTMLDivElement>(null)

    // Gather module participation info
    const participation = events
        .filter(e => e.participants?.some(p => p.memberRegistryNumber === user.memberRegistryNumber))
        .map(e => {
            const p = e.participants.find(p => p.memberRegistryNumber === user.memberRegistryNumber)!
            return {
                moduleName: e.name,
                status: p.attendance ?? p.status,
                cpdHours: e.cpdHours,
                date: e.dates[0]?.date ?? "—",
                seatNumber: p.seatNumber,
            }
        })

    const totalCpdEarned = participation.filter(p => p.status === "attended").reduce((sum, p) => sum + p.cpdHours, 0)
    const totalModules = participation.length
    const attendedModules = participation.filter(p => p.status === "attended").length

    function handleDownload() {
        const lines = [
            `Raport i Anëtarit — ${user.firstName} ${user.lastName}`,
            `Numri i Regjistrit: ${user.memberRegistryNumber}`,
            `Email: ${user.email}`,
            `Telefon: ${user.phone ?? "—"}`,
            ``,
            `Orë CPD: ${user.cpdHoursCompleted + totalCpdEarned} / ${user.cpdHoursRequired}`,
            `Module të Regjistruara: ${totalModules}`,
            `Module të Ndjekura: ${attendedModules}`,
            ``,
            `--- Detajet e Moduleve ---`,
            ...participation.map((p, i) => `${i + 1}. ${p.moduleName} — ${p.status === "attended" ? "✓ Ndjekur" : p.status === "absent" ? "✗ Munguar" : "⏳ Regjistruar"} — ${p.cpdHours} orë CPD — Data: ${p.date}`),
        ]
        const blob = new Blob([lines.join("\n")], { type: "text/plain" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url; a.download = `raport-${user.memberRegistryNumber}.txt`; a.click()
        URL.revokeObjectURL(url)
    }

    async function handleSendEmail() {
        setSending(true)
        // Simulate sending email
        await new Promise(r => setTimeout(r, 1500))
        setSending(false)
        setSent(true)
        setTimeout(() => setSent(false), 3000)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 px-4 py-8 backdrop-blur-sm overflow-y-auto">
            <div className="relative w-full max-w-xl rounded-2xl border border-border bg-card shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                            {user.firstName[0]}{user.lastName[0]}
                        </div>
                        <div>
                            <h2 className="text-base font-semibold text-foreground">{user.firstName} {user.lastName}</h2>
                            <p className="text-xs text-muted-foreground">{user.memberRegistryNumber} · {user.email}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div ref={reportRef} className="p-6 space-y-5">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-xl border border-border bg-muted/30 p-3 text-center">
                            <Calendar className="mx-auto h-5 w-5 text-blue-400 mb-1" />
                            <p className="text-xl font-bold text-foreground">{totalModules}</p>
                            <p className="text-[10px] text-muted-foreground">Module</p>
                        </div>
                        <div className="rounded-xl border border-border bg-muted/30 p-3 text-center">
                            <CheckCircle2 className="mx-auto h-5 w-5 text-green-400 mb-1" />
                            <p className="text-xl font-bold text-foreground">{attendedModules}</p>
                            <p className="text-[10px] text-muted-foreground">Ndjekura</p>
                        </div>
                        <div className="rounded-xl border border-border bg-muted/30 p-3 text-center">
                            <Clock className="mx-auto h-5 w-5 text-amber-400 mb-1" />
                            <p className="text-xl font-bold text-foreground">{user.cpdHoursCompleted + totalCpdEarned}/{user.cpdHoursRequired}</p>
                            <p className="text-[10px] text-muted-foreground">Orë CPD</p>
                        </div>
                    </div>

                    {/* Module List */}
                    <div>
                        <h3 className="text-sm font-semibold text-foreground mb-3">Modulet e Regjistruara</h3>
                        {participation.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">Nuk ka module të regjistruara</p>
                        ) : (
                            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                                {participation.map((p, i) => (
                                    <div key={i} className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2.5">
                                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                            <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${p.status === "attended" ? "bg-green-500/15 text-green-500" :
                                                    p.status === "absent" ? "bg-red-500/15 text-red-500" :
                                                        "bg-amber-500/15 text-amber-500"
                                                }`}>
                                                {p.status === "attended" ? "✓" : p.status === "absent" ? "✗" : "⏳"}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium text-foreground truncate">{p.moduleName}</p>
                                                <p className="text-[10px] text-muted-foreground">{p.date}</p>
                                            </div>
                                        </div>
                                        <span className="text-xs font-medium text-muted-foreground shrink-0 ml-2">{p.cpdHours} CPD</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
                    <Button variant="outline" size="sm" className="gap-2" onClick={handleDownload}>
                        <Download className="h-4 w-4" /> Shkarko Raportin
                    </Button>
                    <Button size="sm" className="gap-2" onClick={handleSendEmail} disabled={sending || sent}>
                        {sent ? <CheckCircle2 className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                        {sent ? "Dërguar!" : sending ? "Duke dërguar..." : "Dërgo me Email"}
                    </Button>
                </div>
            </div>
        </div>
    )
}
