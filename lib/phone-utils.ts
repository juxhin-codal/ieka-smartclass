export const DEFAULT_PHONE_PREFIX = "+355"

export function splitPhone(fullPhone?: string | null): { prefix: string; number: string } {
  if (!fullPhone?.trim()) return { prefix: DEFAULT_PHONE_PREFIX, number: "" }
  const trimmed = fullPhone.trim()

  if (trimmed.startsWith("+355")) return { prefix: "+355", number: trimmed.slice(4).trim() }
  if (trimmed.startsWith("+") && trimmed.length > 4) return { prefix: trimmed.slice(0, 4), number: trimmed.slice(4).trim() }
  if (trimmed.startsWith("+")) return { prefix: trimmed, number: "" }
  return { prefix: DEFAULT_PHONE_PREFIX, number: trimmed }
}

export function combinePhone(prefix?: string, number?: string): string | undefined {
  const n = number?.trim().replace(/\s+/g, "")
  if (!n) return undefined
  const p = prefix?.trim() || DEFAULT_PHONE_PREFIX
  return p + n
}
