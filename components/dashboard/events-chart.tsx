"use client"

import { useState, useMemo } from "react"
import { useEvents } from "@/lib/events-context"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"

type ViewMode = "year" | "month"

export function EventsChart() {
  const { events } = useEvents()
  const [viewMode, setViewMode] = useState<ViewMode>("year")

  const ALBANIAN_MONTHS = ["Jan", "Shk", "Mar", "Pri", "Mai", "Qer", "Kor", "Gus", "Sht", "Tet", "Nën", "Dhj"]

  const monthlyData = useMemo(() => {
    const buckets: Record<string, { modules: Set<string>; participants: number }> = {}
    ALBANIAN_MONTHS.forEach((m) => { buckets[m] = { modules: new Set(), participants: 0 } })
    events.forEach((e) => {
      e.dates.forEach((d) => {
        const label = ALBANIAN_MONTHS[new Date(d.date).getMonth()]
        if (label) { buckets[label].modules.add(e.id); buckets[label].participants += d.currentParticipants }
      })
    })
    return ALBANIAN_MONTHS.map((m) => ({ month: m, modules: buckets[m].modules.size, participants: buckets[m].participants }))
  }, [events])

  const currentMonthData = monthlyData.slice(0, 3)
  const chartData = viewMode === "year" ? monthlyData : currentMonthData

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1">
        <button
          onClick={() => setViewMode("year")}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${viewMode === "year"
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
        >
          Yearly
        </button>
        <button
          onClick={() => setViewMode("month")}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${viewMode === "month"
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
        >
          Monthly
        </button>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="oklch(0.90 0.005 260)"
              vertical={false}
            />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: "oklch(0.45 0.02 260)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11, fill: "oklch(0.45 0.02 260)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 11, fill: "oklch(0.45 0.02 260)" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "oklch(1 0 0)",
                border: "1px solid oklch(0.90 0.005 260)",
                borderRadius: "6px",
                fontSize: "12px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              }}
            />
            <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "6px" }} />
            <Bar
              yAxisId="left"
              dataKey="modules"
              name="Module CPD"
              fill="oklch(0.40 0.12 260)"
              radius={[3, 3, 0, 0]}
              barSize={viewMode === "year" ? 18 : 36}
            />
            <Bar
              yAxisId="right"
              dataKey="participants"
              name="Participants"
              fill="oklch(0.52 0.10 165)"
              radius={[3, 3, 0, 0]}
              barSize={viewMode === "year" ? 18 : 36}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
