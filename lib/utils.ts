import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format as dateFnsFormat, parseISO } from 'date-fns'
import { sq } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Custom Albanian day names: index 0 = Sunday
const sqDayNames = [
  'E diel',
  'E hënë',
  'E martë',
  'E mërkurë',
  'E enjte',
  'E premte',
  'E shtunë',
]

const sqCustom = {
  ...sq,
  localize: {
    ...sq.localize,
    day: (n: number, options?: { width?: string; context?: string }) => {
      // For narrow/short widths keep the default sq locale behaviour
      if (options?.width === 'narrow' || options?.width === 'short') {
        return sq.localize.day(n as 0 | 1 | 2 | 3 | 4 | 5 | 6, options as Parameters<typeof sq.localize.day>[1])
      }
      return sqDayNames[n] ?? sq.localize.day(n as 0 | 1 | 2 | 3 | 4 | 5 | 6, options as Parameters<typeof sq.localize.day>[1])
    },
  },
}

/**
 * Format a Date or ISO string using a customised Albanian locale.
 * Day names use the "E hënë / E martë …" convention.
 */
export function formatDate(date: Date | string, formatStr: string): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return dateFnsFormat(d, formatStr, { locale: sqCustom as typeof sq })
}
