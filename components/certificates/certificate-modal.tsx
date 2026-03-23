"use client"

/**
 * CertificateGenerator — Generates a visual digital certificate for
 * completed CPD modules. Can be "downloaded" (prints window).
 */

import { useRef } from "react"
import { useI18n } from "@/lib/i18n"
import { Award, Download, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface CertificateProps {
    memberName: string
    registryNumber: string
    moduleName: string
    cpdHours: number
    completionDate: string
    lecturerName?: string
    onClose: () => void
}

export function CertificateModal({
    memberName, registryNumber, moduleName, cpdHours, completionDate, lecturerName, onClose,
}: CertificateProps) {
    const { t } = useI18n()
    const certRef = useRef<HTMLDivElement>(null)

    function handleDownload() {
        // Open print dialog for the certificate
        const w = window.open("", "_blank", "width=900,height=650")
        if (!w || !certRef.current) return
        w.document.write(`
      <html>
        <head><title>IEKA SmartClass Certificate – ${memberName}</title></head>
        <body style="margin:0; display:flex; align-items:center; justify-content:center; min-height:100vh; background:#f8f9fa;">
          ${certRef.current.outerHTML}
        </body>
      </html>
    `)
        w.document.close()
        setTimeout(() => { w.print(); w.close() }, 400)
    }

    const year = completionDate.split("-")[0]

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-3xl rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border px-6 py-4">
                    <div className="flex items-center gap-2">
                        <Award className="h-5 w-5 text-amber-500" />
                        <h2 className="text-base font-bold text-foreground">{t("cert.title")}</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button size="sm" onClick={handleDownload} className="gap-2 h-8 text-xs">
                            <Download className="h-3.5 w-3.5" /> {t("cert.download")}
                        </Button>
                        <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* Certificate visual */}
                <div className="p-6 flex justify-center">
                    <div
                        ref={certRef}
                        style={{
                            width: "800px",
                            padding: "48px 56px",
                            background: "linear-gradient(145deg, #ffffff 0%, #f0f4ff 100%)",
                            border: "3px solid #1a3a6b",
                            borderRadius: "12px",
                            fontFamily: "'Georgia', serif",
                            position: "relative",
                            overflow: "hidden",
                        }}
                    >
                        {/* Corner accents */}
                        <div style={{
                            position: "absolute", top: 0, left: 0, width: 80, height: 80,
                            borderTop: "4px solid #d4af37", borderLeft: "4px solid #d4af37",
                            borderTopLeftRadius: 12,
                        }} />
                        <div style={{
                            position: "absolute", top: 0, right: 0, width: 80, height: 80,
                            borderTop: "4px solid #d4af37", borderRight: "4px solid #d4af37",
                            borderTopRightRadius: 12,
                        }} />
                        <div style={{
                            position: "absolute", bottom: 0, left: 0, width: 80, height: 80,
                            borderBottom: "4px solid #d4af37", borderLeft: "4px solid #d4af37",
                            borderBottomLeftRadius: 12,
                        }} />
                        <div style={{
                            position: "absolute", bottom: 0, right: 0, width: 80, height: 80,
                            borderBottom: "4px solid #d4af37", borderRight: "4px solid #d4af37",
                            borderBottomRightRadius: 12,
                        }} />

                        {/* Content */}
                        <div style={{ textAlign: "center" }}>
                            {/* IEKA Logo area */}
                            <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                                <div style={{
                                    width: 56, height: 56, borderRadius: 12,
                                    background: "linear-gradient(135deg, #1a3a6b, #2563eb)",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    color: "white", fontSize: 24, fontWeight: "bold",
                                }}>
                                    I
                                </div>
                            </div>
                            <p style={{ fontSize: 13, letterSpacing: 3, color: "#666", textTransform: "uppercase", marginBottom: 4 }}>
                                Instituti i Ekspertëve Kontabël të Autorizuar
                            </p>
                            <p style={{ fontSize: 11, color: "#999", marginBottom: 24 }}>
                                Institute of Authorized Chartered Auditors of Albania
                            </p>

                            <div style={{ width: 100, height: 2, background: "#d4af37", margin: "0 auto 24px" }} />

                            <p style={{ fontSize: 14, color: "#1a3a6b", letterSpacing: 4, textTransform: "uppercase", marginBottom: 16, fontWeight: "bold" }}>
                                CERTIFIKATË
                            </p>

                            <p style={{ fontSize: 13, color: "#555", lineHeight: 1.7, marginBottom: 20 }}>
                                {t("cert.body")}
                            </p>

                            <p style={{ fontSize: 28, color: "#1a3a6b", fontWeight: "bold", marginBottom: 8 }}>
                                {memberName}
                            </p>
                            <p style={{ fontSize: 12, color: "#888", marginBottom: 24 }}>
                                Nr. Regjistri: {registryNumber}
                            </p>

                            <div style={{
                                background: "#f8f9fa", borderRadius: 8, padding: "12px 24px", margin: "0 auto 24px",
                                display: "inline-block", border: "1px solid #e5e7eb",
                            }}>
                                <p style={{ fontSize: 16, fontWeight: "bold", color: "#1a3a6b", margin: 0 }}>{moduleName}</p>
                                <p style={{ fontSize: 12, color: "#666", margin: "4px 0 0" }}>{cpdHours} Orë CPD / CPD Hours</p>
                            </div>

                            <div style={{ width: 60, height: 2, background: "#d4af37", margin: "0 auto 20px" }} />

                            {/* Signatures area */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 24 }}>
                                <div style={{ textAlign: "center", flex: 1 }}>
                                    <div style={{ width: 120, height: 1, background: "#ccc", margin: "0 auto 8px" }} />
                                    <p style={{ fontSize: 11, color: "#666", margin: 0 }}>{lecturerName || "Ligjëruesi"}</p>
                                    <p style={{ fontSize: 10, color: "#999", margin: 0 }}>Ligjëruesi / Lecturer</p>
                                </div>
                                <div style={{ textAlign: "center", flex: 1 }}>
                                    <p style={{ fontSize: 11, color: "#1a3a6b", fontWeight: "bold", margin: "0 0 4px" }}>
                                        {completionDate}
                                    </p>
                                    <p style={{ fontSize: 10, color: "#999", margin: 0 }}>Data / Date</p>
                                </div>
                                <div style={{ textAlign: "center", flex: 1 }}>
                                    <div style={{ width: 120, height: 1, background: "#ccc", margin: "0 auto 8px" }} />
                                    <p style={{ fontSize: 11, color: "#666", margin: 0 }}>Kryetari IEKA</p>
                                    <p style={{ fontSize: 10, color: "#999", margin: 0 }}>IEKA President</p>
                                </div>
                            </div>

                            <p style={{ fontSize: 9, color: "#bbb", marginTop: 24 }}>
                                Ref: IEKA/CPD/{year}/{registryNumber} • Kjo certifikatë gjenerohet automatikisht nga sistemi IEKA SmartClass.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
