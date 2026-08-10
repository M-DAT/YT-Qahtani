import { useRef } from "react"
import type { Cat } from "@/lib/types"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight, Sparkles, CheckCheck } from "lucide-react"

interface Props {
  cats: Cat[]
  selected: Set<number>
  onToggle: (id: number) => void
  onAll: () => void
  onClear: () => void
}

export function CategoryChips({ cats, selected, onToggle, onAll, onClear }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const allSelected = cats.length > 0 && selected.size === cats.length
  const noneSelected = selected.size === 0

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const amount = direction === "left" ? -280 : 280
      scrollRef.current.scrollBy({ left: amount, behavior: "smooth" })
    }
  }

  return (
    <div className="relative flex items-center w-full border-b border-border/80 bg-background/95 px-3 py-2.5 backdrop-blur-md z-20">
      {/* Right Scroll Arrow (RTL direction) */}
      <button
        type="button"
        onClick={() => scroll("right")}
        className="hidden md:flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary/80 text-foreground hover:bg-accent border border-border/60 transition-all me-1.5 shadow-sm"
        title="التمرير لليمين"
      >
        <ChevronRight className="size-4" />
      </button>

      {/* Scrollable Container */}
      <div
        ref={scrollRef}
        className="no-scrollbar flex flex-1 items-center gap-2 overflow-x-auto scroll-smooth py-0.5 px-1"
      >
        {/* "All" Chip */}
        <button
          type="button"
          onClick={onAll}
          className={cn(
            "yt-chip flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all border shadow-xs",
            allSelected
              ? "bg-foreground text-background border-foreground font-bold shadow-md"
              : "bg-secondary/70 text-foreground border-border/80 hover:bg-secondary hover:border-border"
          )}
        >
          <CheckCheck className="size-3.5 text-primary" />
          <span>كل التصنيفات</span>
          {cats.length > 0 && (
            <span
              className={cn(
                "ms-1 rounded-md px-1.5 py-0.2 text-[10px]",
                allSelected ? "bg-background/20 text-background" : "bg-muted-foreground/15 text-muted-foreground"
              )}
            >
              {cats.length}
            </span>
          )}
        </button>

        {/* Clear Chip if filter active */}
        {!allSelected && !noneSelected && (
          <button
            type="button"
            onClick={onClear}
            className="yt-chip flex shrink-0 items-center gap-1 rounded-xl bg-destructive/15 text-destructive border border-destructive/30 px-3 py-1.5 text-xs font-semibold hover:bg-destructive/25 transition-all"
          >
            <Sparkles className="size-3.5" />
            <span>إعادة ضبط</span>
          </button>
        )}

        {/* Category Chips */}
        {cats.map(c => {
          const active = selected.has(c.id)
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onToggle(c.id)}
              className={cn(
                "yt-chip flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-medium transition-all border shadow-xs",
                active
                  ? "bg-foreground text-background border-foreground font-bold shadow-sm"
                  : "bg-secondary/60 text-muted-foreground border-border/70 hover:bg-secondary hover:text-foreground"
              )}
            >
              <span>{c.name}</span>
              <span
                className={cn(
                  "rounded-md px-1.5 py-0.2 text-[10px] tabular-nums font-semibold",
                  active ? "bg-background/20 text-background" : "bg-muted-foreground/15 text-muted-foreground"
                )}
              >
                {c.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Left Scroll Arrow (RTL direction) */}
      <button
        type="button"
        onClick={() => scroll("left")}
        className="hidden md:flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary/80 text-foreground hover:bg-accent border border-border/60 transition-all ms-1.5 shadow-sm"
        title="التمرير لليسار"
      >
        <ChevronLeft className="size-4" />
      </button>
    </div>
  )
}
