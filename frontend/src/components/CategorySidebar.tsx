import { cn } from "@/lib/utils"
import type { Cat } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search, Check, X, CheckCheck, RotateCcw, Settings, Home, Compass, Layers, FolderHeart } from "lucide-react"

interface SidebarProps {
  cats: Cat[]
  selected: Set<number>
  query: string
  collapsed?: boolean
  onQuery: (v: string) => void
  onToggle: (id: number) => void
  onAll: () => void
  onClear: () => void
  onOpenSettings?: () => void
  onToggleCollapse?: () => void
}

export function CategorySidebar({
  cats,
  selected,
  query,
  collapsed = false,
  onQuery,
  onToggle,
  onAll,
  onClear,
  onOpenSettings,
}: SidebarProps) {
  const allSelected = cats.length > 0 && selected.size === cats.length

  // Collapsed Mini-Rail YouTube View
  if (collapsed) {
    return (
      <div className="flex h-full flex-col items-center py-4 px-1.5 bg-sidebar text-sidebar-foreground border-e border-sidebar-border gap-6">
        <img src="/logo.png" alt="YT Qahtani" className="h-10 w-10 object-contain shrink-0 rounded-xl" />

        <div className="flex flex-col items-center gap-4 flex-1">
          <button
            onClick={onAll}
            className={cn(
              "flex flex-col items-center justify-center size-12 rounded-xl text-[10px] font-medium transition-all gap-1",
              allSelected ? "bg-primary/15 text-primary font-bold" : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
            title="الكل"
          >
            <Home className="size-5" />
            <span>الرئيسية</span>
          </button>

          <button
            onClick={onAll}
            className="flex flex-col items-center justify-center size-12 rounded-xl text-[10px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all gap-1"
            title="التصنيفات"
          >
            <Compass className="size-5" />
            <span>استكشاف</span>
          </button>

          <button
            onClick={() => onQuery("")}
            className="flex flex-col items-center justify-center size-12 rounded-xl text-[10px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all gap-1"
            title="الأرشيف"
          >
            <Layers className="size-5" />
            <span>الأرشيف</span>
          </button>
        </div>

        {onOpenSettings && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenSettings}
            className="size-10 rounded-xl text-muted-foreground hover:text-foreground"
            title="الإعدادات"
          >
            <Settings className="size-5" />
          </Button>
        )}
      </div>
    )
  }

  // Expanded Full YouTube Sidebar View
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground border-e border-sidebar-border">
      {/* Brand Header */}
      <div className="border-b border-sidebar-border p-8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="YT Qahtani" className="h-11 w-11 object-contain shrink-0 rounded-xl" />
            <div>
              <h2 className="text-lg font-black tracking-wider font-heading">YT Qahtani</h2>
              <p className="text-[11px] text-muted-foreground font-semibold">المكتبة المرئية الرقمية</p>
            </div>
          </div>

          {onOpenSettings && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onOpenSettings}
              className="size-8 text-muted-foreground hover:text-foreground rounded-lg"
              title="الإعدادات والمظهر"
            >
              <Settings className="size-4" />
            </Button>
          )}
        </div>

        {/* Search Field */}
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={e => onQuery(e.target.value)}
            placeholder="البحث في الأرشيف…"
            className="h-9 bg-secondary/80 ps-9 pe-8 text-xs placeholder:text-muted-foreground border-input focus-visible:ring-primary/40 rounded-xl transition-all"
          />
          {query && (
            <button
              onClick={() => onQuery("")}
              className="absolute end-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="مسح البحث"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Quick Action Filters */}
        <div className="mt-3.5 flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5">
            <Button
              variant={allSelected ? "default" : "outline"}
              size="sm"
              onClick={onAll}
              className={cn(
                "h-7 px-2.5 text-xs font-semibold rounded-lg transition-all",
                allSelected
                  ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
                  : "border-border bg-secondary/60 text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <CheckCheck className="size-3.5 me-1" />
              تحديد الكل
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="h-7 px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <RotateCcw className="size-3 me-1" />
              مسح
            </Button>
          </div>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground border border-border">
            {selected.size} / {cats.length}
          </span>
        </div>
      </div>

      {/* Navigation Sections & Categories */}
      <ScrollArea className="flex-1 px-2 py-3">
        <div className="space-y-4">
          {/* Quick Nav Links */}
          <div className="space-y-1 border-b border-sidebar-border/80 pb-3">
            <button
              type="button"
              onClick={onAll}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-start text-xs font-bold text-foreground hover:bg-accent transition-all"
            >
              <Home className="size-4 text-primary" />
              <span>الرئيسية</span>
            </button>
            <button
              type="button"
              onClick={onAll}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-start text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all"
            >
              <Compass className="size-4" />
              <span>أحدث الإضافات</span>
            </button>
          </div>

          {/* Categories Title */}
          <div className="px-3">
            <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground font-heading flex items-center gap-1.5">
              <FolderHeart className="size-3.5 text-primary" />
              التصنيفات المتاحة
            </h3>
          </div>

          {/* Category List */}
          <div className="space-y-1">
            {cats.map(c => {
              const active = selected.has(c.id)
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onToggle(c.id)}
                  className={cn(
                    "group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-start text-xs font-medium transition-all duration-200",
                    active
                      ? "bg-secondary text-foreground font-bold border border-border/80 shadow-xs"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground border border-transparent"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-4.5 shrink-0 items-center justify-center rounded-md border transition-all",
                      active
                        ? "border-primary bg-primary text-primary-foreground shadow-xs"
                        : "border-border bg-background group-hover:border-primary/50"
                    )}
                  >
                    {active && <Check className="size-3 stroke-[3]" />}
                  </span>
                  <span className="flex-1 truncate">{c.name}</span>
                  <span
                    className={cn(
                      "rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums transition-colors",
                      active ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground group-hover:text-foreground"
                    )}
                  >
                    {c.count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}

export function MobileSidebar({ open, onClose, ...props }: SidebarProps & { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} aria-hidden />
      <div className="absolute inset-y-0 end-0 w-80 max-w-[85vw] bg-sidebar text-sidebar-foreground shadow-2xl animate-in slide-in-from-right duration-300 border-s border-sidebar-border">
        <button
          className="absolute start-3 top-3 z-10 rounded-full bg-card p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors border border-border"
          aria-label="إغلاق القائمة"
          onClick={onClose}
        >
          <X className="size-4" />
        </button>
        <CategorySidebar {...props} />
      </div>
    </div>
  )
}