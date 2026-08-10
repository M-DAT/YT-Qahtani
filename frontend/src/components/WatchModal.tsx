import { useState } from "react"
import type { Video } from "@/lib/types"
import { useQuality } from "@/hooks/useQuality"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
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
  Copy,
  Sparkles,
  Layers,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface Props {
  video: Video | null
  relatedVideos: Video[]
  onClose: () => void
  onSelectVideo: (v: Video) => void
  onQueue: (id: number, title: string, quality: string) => void
  onDownload: (id: number, title: string, quality: string) => void
}

export function WatchModal({
  video,
  relatedVideos,
  onClose,
  onSelectVideo,
  onQueue,
  onDownload,
}: Props) {
  if (!video) return null

  const q = useQuality(video)
  const [quality, setQuality] = useState(video.sources?.length ? video.sources[0].label : "best")
  const [copied, setCopied] = useState(false)

  const mediaSource = video.sources?.find(s => s.url && !s.platform)?.url

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    toast.success("تم نسخ رابط المقطع إلى الحافظة")
    setTimeout(() => setCopied(false), 2000)
  }

  const otherItems = relatedVideos.filter(v => v.id !== video.id).slice(0, 6)

  return (
    <Dialog open={Boolean(video)} onOpenChange={open => !open && onClose()}>
      <DialogContent className="w-[94vw] max-w-4xl sm:max-w-4xl md:max-w-4xl lg:max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-card text-card-foreground border-border shadow-2xl rounded-2xl">
        <DialogTitle className="sr-only">{video.title}</DialogTitle>
        <DialogDescription className="sr-only">مشغّل يوتيوب السينمائي للتطبيقات والمرئيات</DialogDescription>

        {/* Scrollable Container */}
        <div className="flex-1 overflow-y-auto max-h-[90vh] p-4 md:p-6 space-y-6">
          {/* 16:9 Video Player Screen */}
          <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-slate-950 shadow-2xl border border-slate-800/80 group">
            {mediaSource ? (
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
                <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs flex flex-col items-center justify-center gap-3">
                  <div className="flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2xl shadow-red-600/50 animate-pulse">
                    <Play className="size-8 ms-1 fill-current" />
                  </div>
                  <span className="text-xs font-semibold text-white bg-slate-900/80 px-3.5 py-1 rounded-full border border-slate-700">
                    معاينة مرئية جاهزة للتحميل
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-b from-slate-900 to-slate-950 text-slate-400">
                <Film className="size-14 text-primary/70 animate-bounce" />
                <p className="text-xs font-medium text-slate-300">أرشيف القحطاني | YT Qahtani</p>
              </div>
            )}

            {/* Status Overlay Pill */}
            {video.status && (
              <div className="absolute top-3 end-3 z-10">
                {video.status === "done" && (
                  <Badge className="bg-emerald-950/90 text-emerald-300 border border-emerald-500/40 backdrop-blur-md px-2.5 py-1 text-xs">
                    <CheckCircle2 className="size-3.5 me-1 text-emerald-400" /> تم التنزيل
                  </Badge>
                )}
                {video.status === "fail" && (
                  <Badge variant="destructive" className="bg-rose-950/90 text-rose-300 border border-rose-500/40 backdrop-blur-md px-2.5 py-1 text-xs">
                    <XCircle className="size-3.5 me-1 text-rose-400" /> فشل التنزيل
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Video Title & Primary Meta */}
          <div className="space-y-3">
            <div className="space-y-2">
              <h2 className="text-lg md:text-xl font-extrabold leading-snug text-foreground font-heading">
                {video.title}
              </h2>
              <div className="flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground">
                {video.category && (
                  <span className="rounded-lg bg-secondary px-3 py-1 font-bold text-foreground border border-border">
                    {video.category}
                  </span>
                )}
                {video.date && (
                  <span className="flex items-center gap-1 font-medium">
                    <Calendar className="size-3.5 text-primary" />
                    <span>{video.date}</span>
                  </span>
                )}
                <span className="text-border">•</span>
                <span className="text-primary font-semibold flex items-center gap-1">
                  <Sparkles className="size-3.5" />
                  جودة عالية HD
                </span>
              </div>
            </div>

            {/* Action Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/80">
              {/* Quality Dropdown Selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">الجودة:</span>
                <Select
                  value={quality}
                  onValueChange={v => setQuality(v || "best")}
                  onOpenChange={open => {
                    if (open) q.ensure()
                  }}
                >
                  <SelectTrigger className="h-9 w-36 text-xs bg-secondary border-border text-foreground rounded-xl">
                    <SelectValue placeholder={q.loading ? "جاري الجلب…" : "اختر الجودة"} />
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
              </div>

              {/* Download & Action Buttons */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onQueue(video.id, video.title, quality)}
                  className="h-9 px-3.5 text-xs bg-secondary hover:bg-accent text-foreground border-border rounded-xl transition-all font-semibold"
                >
                  <ListPlus className="size-4 me-1.5 text-primary" />
                  <span>إضافة للقائمة</span>
                </Button>

                <Button
                  size="sm"
                  onClick={() => onDownload(video.id, video.title, quality)}
                  className="h-9 px-4 text-xs bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-xl shadow-md transition-all active:scale-95"
                >
                  <Download className="size-4 me-1.5" />
                  <span>تحميل الآن</span>
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCopyLink}
                  className="size-9 text-muted-foreground hover:text-foreground rounded-xl border border-border/60"
                  title="مشاركة رابط المقطع"
                >
                  {copied ? <Copy className="size-4 text-emerald-400" /> : <Share2 className="size-4" />}
                </Button>
              </div>
            </div>
          </div>

          {/* Related / Suggested Videos Grid Section */}
          {otherItems.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-border/80">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-foreground font-heading flex items-center gap-1.5">
                  <Layers className="size-4 text-primary" />
                  <span>مقاطع ذات صلة من الأرشيف</span>
                </h3>
                <span className="text-[11px] text-muted-foreground font-medium">{otherItems.length} مقطع</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {otherItems.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectVideo(item)}
                    className={cn(
                      "group flex gap-2.5 p-2 rounded-xl text-start transition-all bg-secondary/40 hover:bg-secondary border border-border/60 hover:border-border",
                      item.id === video.id && "bg-primary/10 border-primary/40"
                    )}
                  >
                    {/* Thumbnail micro */}
                    <div className="relative aspect-video w-24 shrink-0 rounded-lg overflow-hidden bg-slate-900 border border-slate-800">
                      {item.thumb ? (
                        <img src={item.thumb} alt={item.title} className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-slate-950 text-slate-600">
                          <Film className="size-4" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-slate-950/20 group-hover:bg-slate-950/0 transition-colors" />
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <h4 className="line-clamp-2 text-xs font-bold leading-tight text-foreground group-hover:text-primary transition-colors">
                        {item.title}
                      </h4>
                      <p className="text-[10px] text-muted-foreground truncate font-medium">
                        {item.category || "أرشيف"} {item.date && `• ${item.date}`}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
