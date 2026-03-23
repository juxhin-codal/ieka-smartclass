"use client"

/**
 * GDPRBanner — Sticky bottom banner for GDPR/data protection consent.
 * Shows once, remembers acceptance in localStorage.
 */

import { useState, useEffect } from "react"
import { Shield, X } from "lucide-react"
import { useI18n } from "@/lib/i18n"
import { Button } from "@/components/ui/button"

export function GDPRBanner() {
    const { t } = useI18n()
    const [visible, setVisible] = useState(false)

    useEffect(() => {
        const accepted = typeof window !== "undefined" && localStorage.getItem("ieka-gdpr-accepted")
        if (!accepted) setVisible(true)
    }, [])

    function accept() {
        localStorage.setItem("ieka-gdpr-accepted", "1")
        setVisible(false)
    }

    if (!visible) return null

    return (
        <div className="fixed bottom-0 inset-x-0 z-50 p-4">
            <div className="mx-auto max-w-2xl rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
                <div className="flex items-start gap-4 p-5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                        <Shield className="h-5 w-5 text-blue-500" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-sm font-semibold text-foreground mb-1">{t("gdpr.title")}</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">{t("gdpr.desc")}</p>
                        <div className="flex items-center gap-3 mt-3">
                            <Button size="sm" onClick={accept} className="text-xs h-8 px-4">
                                {t("gdpr.accept")}
                            </Button>
                            <button className="text-xs font-medium text-primary hover:underline">
                                {t("gdpr.learnMore")}
                            </button>
                        </div>
                    </div>
                    <button onClick={() => setVisible(false)} className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground">
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </div>
    )
}
