import { useState, useEffect } from "react"
import type { Video } from "@/lib/types"
import { useQuality } from "@/hooks/useQuality"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Download,
  ListPlus,
  Share2,
  Calendar,
  Film,
  CheckCircle2,
  XCircle,
  Play,
  Sparkles,
  ArrowRight,
  ThumbsUp,
  Bookmark,
  Check,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface Props {
  video: Video
  relatedVideos: Video[]
  onBack: () => void
  onSelectVideo: (v: Video) => void
  onQueue: (id: number, title: string, quality: string) => void
  onDownload: (id: number, title: string, quality: string) => void
}

export function WatchPage({
  video,
  relatedVideos,
  onBack,
  onSelectVideo,
  onQueue,
  onDownload,
}: Props) {
  const q = useQuality(video)
  const [quality, setQuality] = useState(video.sources?.length ? video.sources[0].label : "best")
  const [copied, setCopied] = useState(false)
  const [liked, setLiked] = useState(false)
  const [saved, setSaved] = useState(false)
  const [sideFilter, setSideFilter] = useState<"all" | "cat" | "recent">("all")

  // Auto-fetch video stream sources on mount or video change
  useEffect(() => {
    void q.ensure()
  }, [video.id, q.ensure])

  // Scroll to top when video changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [video.id])

  // Determine active media URL (stream/local file URL)
  const selectedOpt = q.options.find(o => o.label === quality)
  const mediaSource =
    selectedOpt?.url ||
    q.sources.find(s => s.url && !s.platform)?.url ||
    video.sources?.find(s => s.url && !s.platform)?.url

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    toast.success("تم نسخ رابط المقطع إلى الحافظة")
    setTimeout(() => setCopied(false), 2000)
  }

  // Filter side column videos
  const filteredSideItems = relatedVideos
    .filter(v => v.id !== video.id)
    .filter(v => {
      if (sideFilter === "cat" && video.category) {
        return v.category === video.category
      }
      return true
    })
    .slice(0, 15)

  return (
    <div className="flex-1 w-full min-h-screen bg-background text-foreground pb-20 animate-in fade-in duration-300">
      {/* Main YouTube 2-Column Watch Page Container */}
      <div className="max-w-[1700px] mx-auto p-3 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start relative">
        {/* Main Sticky Video Column (Right Side in RTL - 8 Cols) */}
        <div className="lg:col-span-8 space-y-4 lg:sticky lg:top-16 self-start z-10">
          {/* 16:9 Cinema Video Player Container */}
          <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black shadow-2xl border border-border/80 group">
            {q.loading && !mediaSource ? (
              <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-slate-950 text-slate-400">
                <Loader2 className="size-10 text-primary animate-spin" />
                <p className="text-xs font-bold text-slate-300">جاري تجهيز بث الفيديو والمرئيات…</p>
              </div>
            ) : mediaSource ? (
              <video
                src={mediaSource}
                controls
                autoPlay
                poster={video.thumb || undefined}
                className="h-full w-full object-contain"
              >
                متصفحك لا يدعم تشغيل الفيديو المباشر.
              </video>
            ) : video.thumb ? (
              <div className="relative h-full w-full">
                <img src={video.thumb} alt={video.title} className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-xs flex flex-col items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => void q.ensure()}
                    className="flex size-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2xl shadow-red-600/60 scale-100 hover:scale-110 transition-transform duration-200 cursor-pointer"
                  >
                    <Play className="size-10 ms-1 fill-current" />
                  </button>
                  <span className="text-xs font-bold text-white bg-slate-950/80 px-4 py-1.5 rounded-full border border-slate-700 shadow-md">
                    انقر لبدء البث المباشر أو التنزيل
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-b from-slate-900 to-slate-950 text-slate-400">
                <Film className="size-16 text-primary/80 animate-pulse" />
                <p className="text-sm font-bold text-slate-200">YT Qahtani</p>
              </div>
            )}

            {/* Status Overlay Pill */}
            {video.status && (
              <div className="absolute top-3 end-3 z-10">
                {video.status === "done" && (
                  <Badge className="bg-emerald-950/90 text-emerald-300 border border-emerald-500/40 backdrop-blur-md px-3 py-1 text-xs font-bold">
                    <CheckCircle2 className="size-3.5 me-1 text-emerald-400" /> تم التنزيل بنجاح (تشغيل بدون إنترنت)
                  </Badge>
                )}
                {video.status === "fail" && (
                  <Badge variant="destructive" className="bg-rose-950/90 text-rose-300 border border-rose-500/40 backdrop-blur-md px-3 py-1 text-xs font-bold">
                    <XCircle className="size-3.5 me-1 text-rose-400" /> فشل التنزيل
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Video Title & Back Button */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <h1 className="text-lg md:text-2xl font-black leading-snug text-foreground font-heading">
              {video.title}
            </h1>
            <button
              type="button"
              onClick={onBack}
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-accent transition-all border border-border/60"
              title="العودة للأرشيف"
            >
              <ArrowRight className="size-4" />
              <span className="hidden sm:inline">العودة</span>
            </button>
          </div>

          {/* Channel Info & Action Buttons Pill Bar (YouTube Watch Style) */}
          <div className="flex flex-wrap items-center justify-between gap-4 py-2 border-b border-border/80">
            {/* Channel / Category Info */}
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="YT Qahtani" className="h-11 w-11 object-contain shrink-0 rounded-xl" />
              <div>
                <h3 className="text-base font-black text-foreground font-heading">
                  YT Qahtani
                </h3>
                <p className="text-[11px] text-muted-foreground font-medium">
                  {video.category || "المكتبة الرقمية"} • أحدث والمرئيات
                </p>
              </div>
            </div>

            {/* YouTube Pill Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Quality Dropdown Select Pill */}
              <Select
                value={quality}
                onValueChange={v => setQuality(v || "best")}
                onOpenChange={open => {
                  if (open) q.ensure()
                }}
              >
                <SelectTrigger className="h-9 w-32 text-xs bg-secondary border-border text-foreground rounded-full px-3 font-semibold">
                  <SelectValue placeholder={q.loading ? "جاري…" : "الدقة"} />
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

              {/* Like Pill */}
              <button
                type="button"
                onClick={() => setLiked(!liked)}
                className={cn(
                  "flex h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-bold transition-all border",
                  liked
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-secondary text-foreground border-border/80 hover:bg-accent"
                )}
              >
                <ThumbsUp className={cn("size-4", liked && "fill-current")} />
                <span>إعجاب</span>
              </button>

              {/* Add to Queue Pill */}
              <button
                type="button"
                onClick={() => onQueue(video.id, video.title, quality)}
                className="flex h-9 items-center gap-1.5 rounded-full bg-secondary px-3.5 text-xs font-bold text-foreground border border-border/80 hover:bg-accent transition-all"
              >
                <ListPlus className="size-4 text-primary" />
                <span className="hidden sm:inline">إضافة للقائمة</span>
              </button>

              {/* Download Pill */}
              <button
                type="button"
                onClick={() => onDownload(video.id, video.title, quality)}
                className="flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-black text-primary-foreground hover:bg-primary/90 transition-all shadow-md active:scale-95"
              >
                <Download className="size-4" />
                <span>تحميل الآن</span>
              </button>

              {/* Save / Bookmark Pill */}
              <button
                type="button"
                onClick={() => {
                  setSaved(!saved)
                  toast.success(saved ? "تمت الإزالة من المحفوظات" : "تم الحفظ في المكتبة")
                }}
                className={cn(
                  "flex size-9 items-center justify-center rounded-full transition-all border",
                  saved
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-secondary text-muted-foreground border-border/80 hover:text-foreground hover:bg-accent"
                )}
                title="حفظ"
              >
                {saved ? <Check className="size-4" /> : <Bookmark className="size-4" />}
              </button>

              {/* Share Pill */}
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex size-9 items-center justify-center rounded-full bg-secondary text-muted-foreground hover:text-foreground border border-border/80 hover:bg-accent transition-all"
                title="مشاركة"
              >
                {copied ? <Check className="size-4 text-emerald-400" /> : <Share2 className="size-4" />}
              </button>
            </div>
          </div>

          {/* YouTube Dark Description Box */}
          <div className="rounded-2xl bg-secondary/60 p-4 border border-border/80 space-y-2 text-xs leading-relaxed text-foreground">
            <div className="flex flex-wrap items-center gap-2 font-bold text-muted-foreground">
              {video.date && (
                <span className="flex items-center gap-1 text-foreground">
                  <Calendar className="size-3.5 text-primary" />
                  <span>تاريخ النشر: {video.date}</span>
                </span>
              )}
              <span>•</span>
              <span className="text-primary font-bold flex items-center gap-1">
                <Sparkles className="size-3.5" />
                جودة عالية HD
              </span>
              <span>•</span>
              <span className="rounded-md bg-background/80 px-2 py-0.5 border border-border font-semibold">
                {video.category || "عام"}
              </span>
            </div>

            <p className="text-foreground/90 font-medium whitespace-pre-line">
              مقطع مرئي رقمي مفهرس ضمن مكتبة YT Qahtani الرقمية. متاح للعرض بدقات متعددة والتحميل المباشر بطلب الجودة الأصلية.
            </p>

            <div className="pt-2 flex flex-wrap gap-2 text-[11px] font-bold text-primary">
              <span>#YT_Qahtani</span>
              <span>#{video.category ? video.category.replace(/\s+/g, "_") : "مرئيات"}</span>
            </div>
          </div>
        </div>

        {/* Sidebar Playlist Column (Left Side in RTL - 4 Cols) - Scrollable Beside Sticky Player */}
        <div className="lg:col-span-4 space-y-3">
          {/* Top Filter Chips for Sidebar */}
          <div className="flex items-center gap-1.5 pb-1 border-b border-border/70 overflow-x-auto">
            <button
              type="button"
              onClick={() => setSideFilter("all")}
              className={cn(
                "rounded-xl px-3 py-1 text-xs font-bold transition-all border",
                sideFilter === "all"
                  ? "bg-foreground text-background border-foreground shadow-xs"
                  : "bg-secondary text-muted-foreground border-border/60 hover:text-foreground"
              )}
            >
              الكل
            </button>
            {video.category && (
              <button
                type="button"
                onClick={() => setSideFilter("cat")}
                className={cn(
                  "rounded-xl px-3 py-1 text-xs font-bold transition-all border truncate max-w-[140px]",
                  sideFilter === "cat"
                    ? "bg-foreground text-background border-foreground shadow-xs"
                    : "bg-secondary text-muted-foreground border-border/60 hover:text-foreground"
                )}
              >
                من {video.category}
              </button>
            )}
            <span className="ms-auto text-[11px] text-muted-foreground font-semibold">
              {filteredSideItems.length} مقطع
            </span>
          </div>

          {/* Related Video Cards Vertical List */}
          <div className="space-y-2.5">
            {filteredSideItems.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectVideo(item)}
                className={cn(
                  "group flex w-full gap-3 p-2 rounded-2xl text-start transition-all bg-card hover:bg-secondary border border-border/60 hover:border-border shadow-xs",
                  item.id === video.id && "bg-primary/10 border-primary/40"
                )}
              >
                {/* 16:9 Micro Thumbnail */}
                <div className="relative aspect-video w-36 shrink-0 rounded-xl overflow-hidden bg-slate-950 border border-slate-800">
                  {item.thumb ? (
                    <img
                      src={item.thumb}
                      alt={item.title}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-slate-950 text-slate-600">
                      <Film className="size-5" />
                    </div>
                  )}

                  {/* Play Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex size-8 items-center justify-center rounded-full bg-primary text-white shadow-md">
                      <Play className="size-4 ms-0.5 fill-current" />
                    </div>
                  </div>

                  {/* HD Duration Badge */}
                  <div className="absolute bottom-1.5 end-1.5 z-10 rounded-md bg-black/80 px-1.5 py-0.2 text-[9px] font-bold text-white backdrop-blur-xs">
                    HD
                  </div>
                </div>

                {/* Details */}
                <div className="min-w-0 flex-1 space-y-1 py-0.5">
                  <h4 className="line-clamp-2 text-xs font-bold leading-snug text-foreground group-hover:text-primary transition-colors font-heading">
                    {item.title}
                  </h4>
                  <p className="text-[11px] font-semibold text-muted-foreground truncate">
                    YT Qahtani
                  </p>
                  <p className="text-[10px] text-muted-foreground/80 truncate font-medium">
                    {item.category || "مرئيات"} {item.date && `• ${item.date}`}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
