"use client"

/**
 * LanguageToggle — Small toggle button for Albanian / English.
 * Used in the header next to the notification bell.
 */

import { useI18n, type Lang } from "@/lib/i18n"

const LANGUAGE_SWITCHER_ENABLED = false

export function LanguageToggle() {
    const { lang, setLang } = useI18n()

    if (!LANGUAGE_SWITCHER_ENABLED) {
        return null
    }

    return (
        <div className="flex items-center rounded-lg bg-muted p-0.5">
            {(["sq", "en"] as Lang[]).map((l) => (
                <button
                    key={l}
                    onClick={() => setLang(l)}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${lang === l
                            ? "bg-card text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                    aria-label={l === "sq" ? "Shqip" : "English"}
                >
                    {l === "sq" ? "SQ" : "EN"}
                </button>
            ))}
        </div>
    )
}
