"use client"

import type { LucideIcon } from "lucide-react"
import { TrendingUp, TrendingDown } from "lucide-react"

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  trend?: { value: number; label: string }
}

export function StatCard({ title, value, subtitle, icon: Icon, trend }: StatCardProps) {
  const isPositive = trend && trend.value >= 0

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/8">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </div>
      <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      <div className="flex items-center gap-2">
        {trend && (
          <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${isPositive ? "text-accent" : "text-destructive"}`}>
            {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {isPositive ? "+" : ""}{trend.value}%
          </span>
        )}
        {subtitle && (
          <span className="text-xs text-muted-foreground">{subtitle}</span>
        )}
      </div>
    </div>
  )
}
