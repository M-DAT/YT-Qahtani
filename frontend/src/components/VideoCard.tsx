import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useQuality } from "@/hooks/useQuality"
import type { Video } from "@/lib/types"
import { ListPlus, Download, CheckCircle2, XCircle, Film, Check, Play, Eye } from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
  video: Video
  viewMode?: "grid" | "list"
  selected?: boolean
  onToggleSelect?: (id: number) => void
  onOpenWatch?: (v: Video) => void
  onQueue: (id: number, title: string, quality: string) => void
  onDownload: (id: number, title: string, quality: string) => void
}

export function VideoCard({
  video,
  viewMode = "grid",
  selected = false,
  onToggleSelect,
  onOpenWatch,
  onQueue,
  onDownload,
}: Props) {
  const q = useQuality(video)
  const [quality, setQuality] = useState(video.sources?.length ? video.sources[0].label : "best")
  const done = video.status === "done"
  const failed = video.status === "fail"

  // First letter of category for avatar
  const categoryInitial = video.category ? video.category.charAt(0) : "أ"

  if (viewMode === "list") {
    return (
      <Card
        className={cn(
          "group yt-card flex flex-col md:flex-row overflow-hidden rounded-2xl border transition-all duration-200 p-2.5 gap-3",
          selected
            ? "border-primary/80 bg-secondary ring-2 ring-primary/40 shadow-lg"
            : "border-border/80 bg-card hover:border-border hover:shadow-md"
        )}
      >
        {/* Thumbnail area (List view) */}
        <div
          onClick={() => onOpenWatch?.(video)}
          className="relative aspect-video w-full md:w-64 shrink-0 overflow-hidden rounded-xl bg-slate-950 cursor-pointer group/thumb"
        >
          {video.thumb ? (
            <img
              src={video.thumb}
              alt={video.title}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover/thumb:scale-105"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-gradient-to-b from-slate-900 to-slate-950 text-slate-500">
              <Film className="size-8 opacity-50" aria-hidden />
            </div>
          )}

          {/* Hover Play Icon Overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity duration-200">
            <div className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl shadow-red-600/40 scale-90 group-hover/thumb:scale-100 transition-transform duration-200">
              <Play className="size-5 ms-0.5 fill-current" />
            </div>
          </div>

          {/* Duration / Quality Badge */}
          <div className="absolute bottom-2 end-2 z-10 rounded-md bg-black/80 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-xs">
            HD
          </div>
        </div>

        {/* Content Details (List view) */}
        <div className="flex flex-1 flex-col justify-between space-y-2">
          <div className="space-y-1">
            <div className="flex items-start justify-between gap-2">
              <h3
                onClick={() => onOpenWatch?.(video)}
                className="line-clamp-2 text-sm md:text-base font-bold text-foreground hover:text-primary transition-colors cursor-pointer font-heading leading-snug"
              >
                {video.title}
              </h3>

              {onToggleSelect && (
                <button
                  type="button"
                  onClick={() => onToggleSelect(video.id)}
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-lg border transition-all",
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-secondary text-muted-foreground hover:text-foreground"
                  )}
                  aria-label="تحديد"
                >
                  <Check className={cn("size-3.5 stroke-[3]", selected ? "opacity-100" : "opacity-0")} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
              <span className="font-semibold text-foreground">{video.category || "أرشيف المرئيات"}</span>
              <span>•</span>
              {video.date && <span>{video.date}</span>}
            </div>
          </div>

          {/* Quick Controls */}
          <div className="flex items-center gap-2 pt-2 border-t border-border/60">
            <Select
              value={quality}
              onValueChange={v => setQuality(v || "best")}
              onOpenChange={open => {
                if (open) q.ensure()
              }}
            >
              <SelectTrigger className="h-8 w-32 text-xs bg-secondary border-border text-foreground rounded-lg">
                <SelectValue placeholder={q.loading ? "جاري…" : "الدقة"} />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border text-popover-foreground">
                {q.options.map(o => (
                  <SelectItem key={o.label} value={o.label} className="text-xs">
                    {o.text}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              size="sm"
              variant="outline"
              onClick={() => onQueue(video.id, video.title, quality)}
              className="h-8 px-3 text-xs bg-secondary border-border text-foreground hover:bg-accent rounded-lg"
            >
              <ListPlus className="size-3.5 me-1 text-primary" />
              إضافة للقائمة
            </Button>

            <Button
              size="sm"
              onClick={() => onDownload(video.id, video.title, quality)}
              className="h-8 px-3 text-xs bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-lg shadow-xs"
            >
              <Download className="size-3.5 me-1" />
              تحميل
            </Button>
          </div>
        </div>
      </Card>
    )
  }

  // Standard YouTube Grid Card Layout
  return (
    <Card
      className={cn(
        "group yt-card flex h-full flex-col overflow-hidden rounded-2xl border transition-all duration-300",
        selected
          ? "border-primary/80 bg-secondary/90 ring-2 ring-primary/40 shadow-xl"
          : "border-border/70 bg-card hover:border-border"
      )}
    >
      {/* 16:9 YouTube Thumbnail Container */}
      <div className="relative aspect-video w-full overflow-hidden bg-slate-950">
        {video.thumb ? (
          <img
            src={video.thumb}
            alt={video.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-gradient-to-b from-slate-900 to-slate-950 text-slate-500">
            <Film className="size-9 opacity-40 group-hover:scale-110 transition-transform duration-300" aria-hidden />
            <span className="text-[10px] font-medium tracking-wide">أرشيف مرئي</span>
          </div>
        )}

        {/* Hover Center Play Button */}
        <button
          type="button"
          onClick={() => onOpenWatch?.(video)}
          className="absolute inset-0 flex items-center justify-center bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity duration-250 cursor-pointer"
          title="مشاهدة المقطع"
        >
          <div className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2xl shadow-red-600/50 scale-90 group-hover:scale-105 transition-transform duration-200">
            <Play className="size-6 ms-0.5 fill-current" />
          </div>
        </button>

        {/* Batch Selection Checkbox Button */}
        {onToggleSelect && (
          <button
            type="button"
            onClick={() => onToggleSelect(video.id)}
            className={cn(
              "absolute start-2.5 top-2.5 z-20 flex size-6 items-center justify-center rounded-lg border transition-all shadow-sm backdrop-blur-md",
              selected
                ? "border-primary bg-primary text-primary-foreground ring-2 ring-primary/30"
                : "border-slate-700/80 bg-slate-950/70 text-transparent hover:border-primary/80 group-hover:text-slate-400"
            )}
            title={selected ? "إلغاء التحديد" : "تحديد المقارنة والتحميل"}
          >
            <Check className={cn("size-3.5 stroke-[3]", selected ? "opacity-100" : "opacity-0 group-hover:opacity-70")} />
          </button>
        )}

        {/* Status Badges Overlay */}
        <div className="absolute end-2.5 top-2.5 flex items-center gap-1.5 z-10">
          {done && (
            <Badge className="bg-emerald-950/90 text-emerald-300 border border-emerald-500/40 backdrop-blur-md px-2 py-0.5 text-[10px] font-semibold gap-1 shadow-sm">
              <CheckCircle2 className="size-3 text-emerald-400" /> محمّل
            </Badge>
          )}
          {failed && (
            <Badge variant="destructive" className="bg-rose-950/90 text-rose-300 border border-rose-500/40 backdrop-blur-md px-2 py-0.5 text-[10px] font-semibold gap-1 shadow-sm">
              <XCircle className="size-3 text-rose-400" /> فشل
            </Badge>
          )}
        </div>

        {/* YouTube HD Pill Badge */}
        <div className="absolute bottom-2.5 end-2.5 z-10 rounded-md bg-black/80 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-xs border border-white/10">
          HD
        </div>
      </div>

      {/* Card Content & Action Bar */}
      <CardContent className="flex flex-1 flex-col justify-between p-3.5 gap-3">
        <div className="flex items-start gap-2.5">
          {/* Category Avatar Circle (YouTube Channel Style) */}
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary border border-border text-foreground font-bold text-xs shadow-xs">
            {categoryInitial}
          </div>

          <div className="space-y-1 min-w-0 flex-1">
            <h3
              onClick={() => onOpenWatch?.(video)}
              className="line-clamp-2 text-xs md:text-sm font-bold leading-snug text-foreground hover:text-primary transition-colors cursor-pointer font-heading"
            >
              {video.title}
            </h3>

            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
              <span className="truncate max-w-[120px] font-semibold text-foreground/80">{video.category || "أرشيف"}</span>
              {video.date && (
                <>
                  <span>•</span>
                  <span>{video.date}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Quality selector and quick action buttons */}
        <div className="pt-2 border-t border-border/60 mt-auto">
          <div className="flex items-center gap-1.5">
            <Select
              value={quality}
              onValueChange={v => setQuality(v || "best")}
              onOpenChange={open => {
                if (open) q.ensure()
              }}
            >
              <SelectTrigger className="h-8 flex-1 text-[11px] bg-secondary border-border text-foreground rounded-lg">
                <SelectValue placeholder={q.loading ? "جاري الجلب…" : "الدقة"} />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border text-popover-foreground">
                {q.loading && <span className="px-2 py-1.5 text-xs text-muted-foreground">جاري فحص الجودات…</span>}
                {q.options.map(o => (
                  <SelectItem key={o.label} value={o.label} className="text-xs">
                    {o.text}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Quick Watch Button */}
            <Button
              size="icon"
              variant="outline"
              onClick={() => onOpenWatch?.(video)}
              className="h-8 size-8 border-border bg-secondary text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg"
              title="معاينة ومشاهدة سينمائية"
            >
              <Eye className="size-4" />
            </Button>

            {/* Queue Button */}
            <Button
              size="icon"
              variant="outline"
              onClick={() => onQueue(video.id, video.title, quality)}
              className="h-8 size-8 border-border bg-secondary text-foreground hover:bg-accent hover:border-primary/40 rounded-lg transition-all"
              title="إضافة إلى قائمة التحميل"
            >
              <ListPlus className="size-4 text-primary" />
            </Button>

            {/* Immediate Download Button */}
            <Button
              size="icon"
              onClick={() => onDownload(video.id, video.title, quality)}
              className="h-8 size-8 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg shadow-xs transition-all active:scale-95"
              title="بدء التحميل المباشر"
            >
              <Download className="size-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}