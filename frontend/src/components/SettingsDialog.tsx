import { useTheme } from "next-themes"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Moon, Sun, Monitor, Settings, Sparkles, Check, Download } from "lucide-react"
import { cn } from "@/lib/utils"

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultQuality: string
  onDefaultQualityChange: (quality: string) => void
}

export function SettingsDialog({
  open,
  onOpenChange,
  defaultQuality,
  onDefaultQualityChange,
}: SettingsDialogProps) {
  const { theme, setTheme } = useTheme()

  const themeOptions = [
    {
      id: "dark",
      name: "داكن",
      desc: "نمط ليلي فاخر ومريح للعين",
      icon: Moon,
      color: "text-violet-400 border-violet-500/40 bg-violet-950/30",
    },
    {
      id: "light",
      name: "فاتح",
      desc: "نمط نهاري مشرق وعالي التباين",
      icon: Sun,
      color: "text-amber-400 border-amber-500/40 bg-amber-950/20",
    },
    {
      id: "system",
      name: "تلقائي",
      desc: "مطابقة إعدادات الجهاز تلقائياً",
      icon: Monitor,
      color: "text-sky-400 border-sky-500/40 bg-sky-950/20",
    },
  ]

  const qualityOptions = [
    { label: "best", name: "الأفضل (أعلى دقة متاحة)" },
    { label: "1080p", name: "1080p Full HD" },
    { label: "720p", name: "720p HD" },
    { label: "480p", name: "480p متوسطة" },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card/95 border-border text-foreground backdrop-blur-2xl rounded-2xl p-6 shadow-2xl">
        <DialogHeader className="space-y-1.5 border-b border-border/80 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Settings className="size-5" aria-hidden />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold font-heading">
                إعدادات التطبيق والتفضيلات
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                تخصيص المظهر وتسهيل تجربة التصفح والتحميل
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-3">
          {/* Theme Selector Section */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold text-foreground flex items-center gap-1.5 font-heading">
              <Sparkles className="size-3.5 text-primary" aria-hidden />
              مظهر الواجهة (Theme)
            </label>

            <div className="grid grid-cols-3 gap-2.5">
              {themeOptions.map(t => {
                const Icon = t.icon
                const active = theme === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTheme(t.id)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-2 rounded-xl border p-3 text-center transition-all duration-200",
                      active
                        ? "border-primary bg-primary/15 ring-2 ring-primary/40 shadow-sm"
                        : "border-border/80 bg-card/60 hover:border-primary/40 hover:bg-accent/50 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <div className={cn("flex size-8 items-center justify-center rounded-lg border", t.color)}>
                      <Icon className="size-4" aria-hidden />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground font-heading">{t.name}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight hidden sm:block mt-0.5">{t.desc}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Default Quality Preference Section */}
          <div className="space-y-2.5 border-t border-border/80 pt-4">
            <label className="text-xs font-bold text-foreground flex items-center gap-1.5 font-heading">
              <Download className="size-3.5 text-primary" aria-hidden />
              الجودة الافتراضية المفضلة للتحميل
            </label>
            <div className="grid grid-cols-2 gap-2">
              {qualityOptions.map(q => {
                const active = defaultQuality === q.label
                return (
                  <button
                    key={q.label}
                    type="button"
                    onClick={() => onDefaultQualityChange(q.label)}
                    className={cn(
                      "flex items-center justify-between rounded-lg border px-3 py-2 text-start text-xs font-medium transition-all",
                      active
                        ? "border-primary bg-primary/15 text-primary font-bold shadow-sm"
                        : "border-border/80 bg-card/60 text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                    )}
                  >
                    <span>{q.name}</span>
                    {active && <Check className="size-3.5 text-primary" aria-hidden />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-border/80">
          <Button
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs px-4 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg shadow-sm font-medium"
          >
            تم وإغلاق
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
