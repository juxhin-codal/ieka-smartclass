"use client"

import * as React from "react"
import { CalendarDays } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const MONTH_OPTIONS = [
  { value: "01", label: "Janar" },
  { value: "02", label: "Shkurt" },
  { value: "03", label: "Mars" },
  { value: "04", label: "Prill" },
  { value: "05", label: "Maj" },
  { value: "06", label: "Qershor" },
  { value: "07", label: "Korrik" },
  { value: "08", label: "Gusht" },
  { value: "09", label: "Shtator" },
  { value: "10", label: "Tetor" },
  { value: "11", label: "Nentor" },
  { value: "12", label: "Dhjetor" },
] as const

function parseMonthYear(value?: string | null) {
  const match = value?.match(/^(\d{4})-(\d{2})$/)
  if (!match) {
    return { year: undefined, month: undefined }
  }

  return {
    year: match[1],
    month: match[2],
  }
}

function getDisplayValue(month?: string, year?: string) {
  if (!month || !year) {
    return null
  }

  const monthLabel = MONTH_OPTIONS.find((option) => option.value === month)?.label
  if (!monthLabel) {
    return null
  }

  return `${monthLabel} ${year}`
}

interface MonthYearPickerProps {
  id?: string
  value?: string | null
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
  layout?: "default" | "compact"
}

export function MonthYearPicker({
  id,
  value,
  onChange,
  disabled = false,
  className,
  layout = "default",
}: MonthYearPickerProps) {
  const parsedValue = React.useMemo(() => parseMonthYear(value), [value])
  const [draftMonth, setDraftMonth] = React.useState<string | undefined>(parsedValue.month)
  const [draftYear, setDraftYear] = React.useState<string | undefined>(parsedValue.year)

  React.useEffect(() => {
    setDraftMonth(parsedValue.month)
    setDraftYear(parsedValue.year)
  }, [parsedValue.month, parsedValue.year])

  const currentYear = new Date().getFullYear()
  const selectedYearNumber = draftYear ? Number(draftYear) : undefined
  const firstYear = Math.min(currentYear - 1, selectedYearNumber ?? currentYear)
  const lastYear = Math.max(currentYear + 10, selectedYearNumber ?? currentYear)
  const yearOptions = Array.from({ length: lastYear - firstYear + 1 }, (_, index) => String(firstYear + index))
  const displayValue = getDisplayValue(draftMonth, draftYear)

  function handleMonthChange(nextMonth: string) {
    setDraftMonth(nextMonth)
    if (draftYear) {
      onChange(`${draftYear}-${nextMonth}`)
    }
  }

  function handleYearChange(nextYear: string) {
    setDraftYear(nextYear)
    if (draftMonth) {
      onChange(`${nextYear}-${draftMonth}`)
    }
  }

  if (layout === "compact") {
    return (
      <div className={cn("rounded-lg border border-border/60 bg-muted/15 p-2.5", className)}>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1.35fr)_minmax(0,0.85fr)]">
          <Select value={draftMonth} onValueChange={handleMonthChange} disabled={disabled}>
            <SelectTrigger id={id} className="w-full bg-background">
              <SelectValue placeholder="Muaji" />
            </SelectTrigger>
            <SelectContent>
              {MONTH_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={draftYear} onValueChange={handleYearChange} disabled={disabled}>
            <SelectTrigger id={id ? `${id}-year` : undefined} className="w-full bg-background">
              <SelectValue placeholder="Viti" />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((year) => (
                <SelectItem key={year} value={year}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5 shrink-0 text-primary" />
          {displayValue ? (
            <span>
              Skadon në fund të <span className="font-medium text-foreground">{displayValue}</span>
            </span>
          ) : (
            <span>Zgjidh muajin dhe vitin.</span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={cn("rounded-xl border border-border/70 bg-muted/20 p-3", className)}>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)]">
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Muaji</p>
          <Select value={draftMonth} onValueChange={handleMonthChange} disabled={disabled}>
            <SelectTrigger id={id} className="w-full bg-background">
              <SelectValue placeholder="Zgjidh muajin" />
            </SelectTrigger>
            <SelectContent>
              {MONTH_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Viti</p>
          <Select value={draftYear} onValueChange={handleYearChange} disabled={disabled}>
            <SelectTrigger id={id ? `${id}-year` : undefined} className="w-full bg-background">
              <SelectValue placeholder="Zgjidh vitin" />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((year) => (
                <SelectItem key={year} value={year}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-lg border border-border/60 bg-background px-3 py-2 text-xs text-muted-foreground">
        <CalendarDays className="h-3.5 w-3.5 shrink-0 text-primary" />
        {displayValue ? (
          <span>
            Skadon në fund të <span className="font-medium text-foreground">{displayValue}</span>
          </span>
        ) : (
          <span>Zgjidhni muajin dhe vitin e vlefshmërisë.</span>
        )}
      </div>
    </div>
  )
}
