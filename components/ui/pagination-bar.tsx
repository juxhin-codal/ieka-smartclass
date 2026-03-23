"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"

export type PageSize = 25 | 50 | 100 | 200 | "all"
export const PAGE_SIZE_OPTIONS: { value: PageSize; label: string }[] = [
    { value: 25, label: "25" },
    { value: 50, label: "50" },
    { value: 100, label: "100" },
    { value: 200, label: "200" },
    { value: "all", label: "Të gjitha" },
]

interface PaginationBarProps {
    totalItems: number
    pageSize: PageSize
    currentPage: number
    onPageChange: (page: number) => void
    onPageSizeChange: (size: PageSize) => void
    className?: string
}

export function PaginationBar({
    totalItems,
    pageSize,
    currentPage,
    onPageChange,
    onPageSizeChange,
    className = "",
}: PaginationBarProps) {
    const effectiveSize = pageSize === "all" ? Math.max(totalItems, 1) : pageSize
    const totalPages = pageSize === "all" ? 1 : Math.max(1, Math.ceil(totalItems / effectiveSize))
    const start = totalItems === 0 ? 0 : (currentPage - 1) * effectiveSize + 1
    const end = pageSize === "all" ? totalItems : Math.min(currentPage * effectiveSize, totalItems)

    // Build visible page numbers with ellipsis
    function getPageNumbers(): (number | "…")[] {
        if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
        const pages: (number | "…")[] = [1]
        if (currentPage > 3) pages.push("…")
        for (let p = Math.max(2, currentPage - 1); p <= Math.min(totalPages - 1, currentPage + 1); p++) {
            pages.push(p)
        }
        if (currentPage < totalPages - 2) pages.push("…")
        pages.push(totalPages)
        return pages
    }

    return (
        <div className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${className}`}>
            {/* Record count */}
            <p className="text-xs text-muted-foreground shrink-0">
                {totalItems === 0
                    ? "Nuk ka rekorde"
                    : `${start}–${end} nga ${totalItems} rekorde`}
            </p>

            <div className="flex items-center gap-3 flex-wrap">
                {/* Page size dropdown */}
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">Rreshta për faqe:</span>
                    <select
                        value={pageSize}
                        onChange={(e) => {
                            const val = e.target.value
                            onPageSizeChange(val === "all" ? "all" : (Number(val) as PageSize))
                            onPageChange(1)
                        }}
                        className="h-8 rounded-md border border-border bg-card px-2 pr-7 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer appearance-none"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 6px center" }}
                    >
                        {PAGE_SIZE_OPTIONS.map((opt) => (
                            <option key={String(opt.value)} value={String(opt.value)}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Navigation */}
                <div className="flex items-center gap-1">
                    {/* Prev arrow */}
                    <button
                        onClick={() => onPageChange(currentPage - 1)}
                        disabled={currentPage <= 1 || pageSize === "all"}
                        aria-label="Faqja e mëparshme"
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </button>

                    {/* Page numbers */}
                    {getPageNumbers().map((p, i) =>
                        p === "…" ? (
                            <span
                                key={`ellipsis-${i}`}
                                className="flex h-8 w-8 items-center justify-center text-xs text-muted-foreground"
                            >
                                …
                            </span>
                        ) : (
                            <button
                                key={p}
                                onClick={() => onPageChange(p as number)}
                                disabled={pageSize === "all"}
                                className={`flex h-8 min-w-[32px] items-center justify-center rounded-md border px-2 text-xs font-medium transition-colors disabled:pointer-events-none ${currentPage === p
                                        ? "border-primary bg-primary text-primary-foreground"
                                        : "border-border bg-card text-foreground hover:bg-muted"
                                    }`}
                            >
                                {p}
                            </button>
                        )
                    )}

                    {/* Next arrow */}
                    <button
                        onClick={() => onPageChange(currentPage + 1)}
                        disabled={currentPage >= totalPages || pageSize === "all"}
                        aria-label="Faqja tjetër"
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </div>
    )
}

/** Slice an array based on page state */
export function usePagination<T>(items: T[], pageSize: PageSize, currentPage: number): T[] {
    if (pageSize === "all") return items
    const start = (currentPage - 1) * pageSize
    return items.slice(start, start + pageSize)
}
