import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { QueueItem } from "@/lib/types"
import { fmtBytes, pct, STATUS_LABEL } from "@/lib/format"
import { CheckCircle2, XCircle, Trash2, Play, Loader2, Download, Inbox, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  items: QueueItem[]
  running: boolean
  error?: string | null
  onStart: (quality: string) => void
  onRemove: (id: number) => void
  onClearFinished: () => void
}

export function DownloadCenter({
  open,
  onOpenChange,
  items,
  running,
  error,
  onStart,
  onRemove,
  onClearFinished,
}: Props) {
  const [quality, setQuality] = useState("best")
  const completedCount = items.filter(i => i.status === "done").length
  const someFinished = items.some(i => i.status === "done" || i.status === "fail")
  const anyReady = items.some(i => i.status === "queued" || i.status === "fail")

  useEffect(() => {
    if (!running && items.some(i => i.status === "fail")) {
      toast.error("تعذر تحميل بعض الفيديوهات", { description: "يرجى مراجعة القائمة في مركز التحميل" })
    }
  }, [running, items])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-slate-950/95 border-slate-800 text-slate-100 backdrop-blur-2xl rounded-2xl shadow-2xl p-6">
        <DialogHeader className="space-y-1.5 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-violet-600/20 text-violet-400 border border-violet-500/30">
              <Download className="size-5" aria-hidden />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-slate-100 font-heading">
                مركز إدارة التحميلات
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                {items.length > 0
                  ? `تم إنجاز ${completedCount} من أصل ${items.length} ملف`
                  : "قائمة التحميل الجماعي"}
                {error && <span className="text-rose-400 ms-2">({error})</span>}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable Items List */}
        <div className="max-h-[55vh] space-y-3 overflow-y-auto pe-1 my-2">
          {items.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-slate-900 border border-slate-800 text-slate-500 shadow-inner">
                <Inbox className="size-7 stroke-[1.5]" aria-hidden />
              </div>
              <div className="space-y-1 max-w-xs">
                <p className="text-sm font-semibold text-slate-300">القائمة فارغة حالياً</p>
                <p className="text-xs text-slate-500">اختر الجودة المطلوبة وانقر على أيقونة الإضافة إلى القائمة في كروت الفيديوهات</p>
              </div>
            </div>
          )}

          {items.map(it => {
            const p = pct(it.bytes, it.total)
            const status = it.status
            return (
              <div
                key={it.id}
                className={cn(
                  "rounded-xl border p-3.5 transition-all duration-200",
                  status === "dl"
                    ? "bg-slate-900/90 border-violet-500/40 shadow-sm shadow-violet-950/40"
                    : status === "done"
                      ? "bg-slate-900/40 border-emerald-500/30"
                      : status === "fail"
                        ? "bg-slate-900/40 border-rose-500/30"
                        : "bg-slate-900/60 border-slate-800/80"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-xs font-bold text-slate-100 font-heading">{it.title}</p>
                    <p className="text-[11px] text-slate-400 font-mono">
                      الجودة: <span className="text-violet-300 font-semibold">{it.quality}</span> · {fmtBytes(it.bytes)}
                      {it.total ? " / " + fmtBytes(it.total) : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge
                      className={cn(
                        "gap-1.5 px-2.5 py-0.5 text-[10px] font-semibold rounded-lg shadow-sm border",
                        status === "fail"
                          ? "bg-rose-950/80 text-rose-300 border-rose-500/30"
                          : status === "done"
                            ? "bg-emerald-950/80 text-emerald-300 border-emerald-500/30"
                            : status === "dl"
                              ? "bg-violet-950/80 text-violet-300 border-violet-500/40"
                              : "bg-slate-800 text-slate-400 border-slate-700"
                      )}
                    >
                      {status === "done" && <CheckCircle2 className="size-3 text-emerald-400" aria-hidden />}
                      {status === "fail" && <XCircle className="size-3 text-rose-400" aria-hidden />}
                      {status === "dl" && <Loader2 className="size-3 animate-spin text-violet-400" aria-hidden />}
                      {STATUS_LABEL[status] || status}
                    </Badge>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7 text-slate-400 hover:bg-slate-800 hover:text-rose-400 rounded-lg transition-colors"
                      disabled={running}
                      onClick={() => onRemove(it.id)}
                      aria-label="إزالة من القائمة"
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </Button>
                  </div>
                </div>

                {/* Progress Indicator */}
                <div className="mt-3 space-y-1">
                  <Progress
                    value={status === "done" ? 100 : p}
                    aria-label="نسبة التقدم"
                    className="h-1.5 bg-slate-950 rounded-full"
                  />
                  <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono pt-0.5">
                    <span>{status === "dl" ? "جارٍ التحميل…" : status === "done" ? "اكتمل التحميل" : status === "fail" ? "توقف" : "في الانتظار"}</span>
                    <span className="font-bold text-slate-300">
                      {status === "done" ? "100%" : status === "fail" ? "—" : p + "%"}
                    </span>
                  </div>
                </div>

                {status === "fail" && it.err && (
                  <p className="mt-2 truncate text-[11px] text-rose-400 bg-rose-950/40 px-2 py-1 rounded border border-rose-900/30">
                    {it.err}
                  </p>
                )}
              </div>
            )
          })}
        </div>

        {/* Dialog Action Footer */}
        <DialogFooter className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-slate-800/80 pt-4 mt-2">
          <div className="flex items-center gap-2">
            <Select value={quality} onValueChange={v => setQuality(v || "best")}>
              <SelectTrigger className="w-40 h-8 text-xs bg-slate-900 border-slate-800 text-slate-200">
                <SelectValue placeholder="اختر الجودة الموحدة" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                <SelectItem value="best" className="text-xs">الأفضل دائماً</SelectItem>
                {[...new Set(items.map(i => i.quality))].filter(q => q && q !== "best").map(q => (
                  <SelectItem key={q} value={q} className="text-xs">{q}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-[11px] text-slate-400 hidden sm:inline">تأكيد الجودة</span>
          </div>

          <div className="flex items-center gap-2 justify-end">
            {someFinished && (
              <Button
                variant="outline"
                size="sm"
                onClick={onClearFinished}
                className="h-8 text-xs border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"
              >
                <RefreshCw className="size-3.5 me-1.5 text-slate-400" />
                تصفية المكتملة
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => onStart(quality)}
              disabled={running || !anyReady}
              className="h-8 text-xs bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium px-4 shadow-md shadow-violet-950/60"
            >
              {running ? (
                <>
                  <Loader2 className="size-3.5 me-1.5 animate-spin" aria-hidden />
                  جارٍ التنزيل…
                </>
              ) : (
                <>
                  <Play className="size-3.5 me-1.5 fill-current" aria-hidden />
                  بدء التحميل الآن
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}