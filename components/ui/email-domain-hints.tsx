"use client"

const DOMAINS = ["gmail.com", "yahoo.com", "outlook.com", "ieka.al"]

interface EmailDomainHintsProps {
  value: string
  onSelect: (email: string) => void
}

export function EmailDomainHints({ value, onSelect }: EmailDomainHintsProps) {
  const trimmed = value.trim()
  if (!trimmed || trimmed.includes("@")) return null

  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {DOMAINS.map((domain) => (
        <button
          key={domain}
          type="button"
          onClick={() => onSelect(`${trimmed}@${domain}`)}
          className="rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary hover:border-primary/30"
        >
          @{domain}
        </button>
      ))}
    </div>
  )
}
