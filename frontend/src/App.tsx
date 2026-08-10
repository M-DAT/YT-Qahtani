import { useCallback, useEffect, useRef, useState } from "react"
import { browse, fetchCats, queue as apiQueue, startPlaylist } from "@/lib/api"
import type { Cat, QueueItem, Video } from "@/lib/types"
import { CategorySidebar, MobileSidebar } from "@/components/CategorySidebar"
import { CategoryChips } from "@/components/CategoryChips"
import { VideoCard } from "@/components/VideoCard"
import { WatchPage } from "@/components/WatchPage"
import { DownloadCenter } from "@/components/DownloadCenter"
import { SettingsDialog } from "@/components/SettingsDialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Loader2,
  Menu,
  Search,
  Download,
  Layers,
  CheckSquare,
  ListPlus,
  X,
  CheckCheck,
  Play,
  Settings,
  LayoutGrid,
  List,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export default function App() {
  const [cats, setCats] = useState<Cat[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [query, setQuery] = useState("")
  const debounced = useDebounced(query, 400)

  const [items, setItems] = useState<Video[]>([])
  const [page, setPage] = useState(1)
  const [more, setMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadMoreBusy, setLoadMoreBusy] = useState(false)

  // Layout & Sidebar View State
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [activeWatchVideo, setActiveWatchVideo] = useState<Video | null>(() => {
    try {
      const saved = sessionStorage.getItem("yt_qahtani_watch_video")
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })

  // Sync activeWatchVideo with sessionStorage and URL search params
  useEffect(() => {
    try {
      if (activeWatchVideo) {
        sessionStorage.setItem("yt_qahtani_watch_video", JSON.stringify(activeWatchVideo))
        const url = new URL(window.location.href)
        url.searchParams.set("v", String(activeWatchVideo.id))
        window.history.replaceState({}, "", url.toString())
      } else {
        sessionStorage.removeItem("yt_qahtani_watch_video")
        const url = new URL(window.location.href)
        url.searchParams.delete("v")
        window.history.replaceState({}, "", url.toString())
      }
    } catch {
      /* ignore session errors */
    }
  }, [activeWatchVideo])

  // Handle browser navigation (back/forward)
  useEffect(() => {
    const handlePopState = () => {
      try {
        const saved = sessionStorage.getItem("yt_qahtani_watch_video")
        if (saved) {
          setActiveWatchVideo(JSON.parse(saved))
        } else {
          setActiveWatchVideo(null)
        }
      } catch {
        setActiveWatchVideo(null)
      }
    }
    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  // Batch video selection state
  const [selectedVideos, setSelectedVideos] = useState<Set<number>>(new Set())
  const [batchQuality, setBatchQuality] = useState("best")

  // Settings & Theme Dialog state
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [defaultQuality, setDefaultQuality] = useState("best")

  const [queue, setQueue] = useState<QueueItem[]>([])
  const [running, setRunning] = useState(false)
  const [jobError, setJobError] = useState<string | null>(null)
  const [dlOpen, setDlOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const pollRef = useRef<number | null>(null)

  // Load Metadata categories
  useEffect(() => {
    fetchCats()
      .then(r => {
        setCats(r.categories)
        setSelected(new Set(r.categories.map(c => c.id)))
      })
      .catch(() => toast.error("تعذر تحميل التصنيفات"))
  }, [])

  const doFetch = useCallback(
    async (reset: boolean) => {
      const p = reset ? 1 : page
      if (!reset && loadMoreBusy) return
      reset ? setLoading(true) : setLoadMoreBusy(true)
      try {
        const r = await browse({ cat: [...selected], q: debounced, page: p })
        setItems(prev => (reset ? r.items : [...prev, ...r.items]))
        setPage(p + 1)
        setMore(r.more)
      } catch {
        toast.error("تعذر تحميل القائمة")
      } finally {
        setLoading(false)
        setLoadMoreBusy(false)
      }
    },
    [selected, debounced, page, loadMoreBusy]
  )

  // fetch on filters change
  const firstRun = useRef(true)
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    void doFetch(true)
  }, [doFetch])

  const selectAll = () => setSelected(new Set(cats.map(c => c.id)))
  const clearAll = () => setSelected(new Set())
  const toggle = (id: number) =>
    setSelected(prev => {
      const s = new Set(prev)
      if (s.has(id)) s.delete(id)
      else s.add(id)
      return s
    })

  // Multi-select video handlers
  const toggleSelectVideo = (id: number) => {
    setSelectedVideos(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllVisible = () => {
    const allIds = items.map(v => v.id)
    const allSelected = allIds.length > 0 && allIds.every(id => selectedVideos.has(id))
    if (allSelected) {
      setSelectedVideos(new Set())
    } else {
      setSelectedVideos(new Set(allIds))
    }
  }

  const upsert = (id: number, title: string, quality: string) => {
    setQueue(prev => {
      const i = prev.findIndex(x => x.id === id)
      if (i >= 0) {
        const n = [...prev]
        n[i] = { ...n[i], quality, status: n[i].status === "fail" ? "queued" : n[i].status }
        return n
      }
      return [...prev, { id, title, quality, status: "queued", bytes: 0, total: 0, err: "" }]
    })
  }

  const addToQueue = (id: number, title: string, quality: string) => {
    upsert(id, title, quality || defaultQuality)
    toast.success("أُضيف إلى قائمة التحميل", { description: title })
  }

  const downloadNow = (id: number, title: string, quality: string) => {
    upsert(id, title, quality || defaultQuality)
    setDlOpen(true)
  }

  const addBatchToQueue = (q: string) => {
    const selectedList = items.filter(v => selectedVideos.has(v.id))
    if (!selectedList.length) return
    selectedList.forEach(v => {
      upsert(v.id, v.title, q || defaultQuality)
    })
    toast.success(`تمت إضافة ${selectedList.length} مقطع إلى مركز التحميل`)
    setSelectedVideos(new Set())
  }

  const downloadBatchNow = (q: string) => {
    const selectedList = items.filter(v => selectedVideos.has(v.id))
    if (!selectedList.length) return
    selectedList.forEach(v => {
      upsert(v.id, v.title, q || defaultQuality)
    })
    setSelectedVideos(new Set())
    setDlOpen(true)
  }

  const removeFromQueue = (id: number) => {
    if (running) return
    setQueue(prev => prev.filter(x => x.id !== id))
  }

  const start = async (qualityGlobal: string) => {
    const ready = queue.filter(i => i.status === "queued" || i.status === "fail")
    if (!ready.length) return
    setRunning(true)
    setJobError(null)
    try {
      const body = ready.map(i => ({ id: i.id, quality: qualityGlobal === "best" ? i.quality : qualityGlobal }))
      const { job_id } = await startPlaylist(qualityGlobal === "best" ? "best" : qualityGlobal, body)
      pollRef.current = window.setInterval(() => poll(job_id), 1500)
    } catch (e) {
      setRunning(false)
      setJobError((e as Error).message)
      toast.error("فشل بدء المهمة")
    }
  }

  const poll = async (jobId: string) => {
    try {
      const r = await apiQueue(jobId)
      const byId = new Map(r.items.map(i => [i.id, i]))
      setQueue(prev =>
        prev.map(x => {
          const ji = byId.get(x.id)
          if (!ji) return x
          return {
            ...x,
            status: (ji.status as QueueItem["status"]) || x.status,
            bytes: ji.bytes ?? 0,
            total: ji.total ?? 0,
            err: ji.error || "",
          }
        })
      )
      const doneIds: number[] = []
      r.items.forEach(ji => {
        if (ji.status === "done") doneIds.push(ji.id)
      })
      setItems(prev => prev.map(v => (doneIds.includes(v.id) ? { ...v, status: "done" } : v)))
      if (r.items.every(ji => ji.status === "done" || ji.status === "fail")) {
        stopPolling()
        setRunning(false)
        toast.success("انتهت عملية التحميل بنجاح")
        setDlOpen(true)
      }
    } catch {
      /* keep polling */
    }
  }

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  useEffect(() => () => stopPolling(), [])

  const activeQueueCount = queue.filter(i => i.status === "queued" || i.status === "dl" || i.status === "fail").length
  const allVisibleSelected = items.length > 0 && items.every(v => selectedVideos.has(v.id))

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground antialiased selection:bg-red-600/30 selection:text-white">
      {/* Desktop Sidebar (Full Expandable or Collapsed Rail) */}
      <aside
        className={cn(
          "hidden shrink-0 transition-all duration-300 md:block",
          sidebarCollapsed ? "w-18" : "w-72"
        )}
      >
        <CategorySidebar
          cats={cats}
          selected={selected}
          query={query}
          collapsed={sidebarCollapsed}
          onQuery={v => {
            setQuery(v)
            setActiveWatchVideo(null)
          }}
          onToggle={v => {
            toggle(v)
            setActiveWatchVideo(null)
          }}
          onAll={() => {
            selectAll()
            setActiveWatchVideo(null)
          }}
          onClear={clearAll}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      </aside>

      {/* Mobile Drawer */}
      <MobileSidebar
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        cats={cats}
        selected={selected}
        query={query}
        onQuery={v => {
          setQuery(v)
          setActiveWatchVideo(null)
        }}
        onToggle={v => {
          toggle(v)
          setActiveWatchVideo(null)
        }}
        onAll={() => {
          selectAll()
          setActiveWatchVideo(null)
        }}
        onClear={clearAll}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex min-w-0 flex-1 flex-col relative bg-background">
        {/* YouTube Topbar Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/80 bg-background/95 px-4 py-2.5 backdrop-blur-xl md:px-6">
          {/* Left: Menu & Brand Logo */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="size-9 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full"
              onClick={() => {
                if (window.innerWidth < 768) {
                  setMenuOpen(true)
                } else {
                  setSidebarCollapsed(prev => !prev)
                }
              }}
              aria-label="القائمة الرئيسية"
            >
              <Menu className="size-5" />
            </Button>

            <div
              className="flex items-center gap-2.5 cursor-pointer"
              onClick={() => {
                setActiveWatchVideo(null)
                selectAll()
              }}
            >
              <h1 className="text-lg font-black tracking-wider text-foreground font-heading">
                YT Qahtani
              </h1>
            </div>
          </div>

          {/* Center: YouTube Pill Search Bar */}
          <div className="hidden md:flex flex-1 max-w-xl mx-6 items-center">
            <div className="relative flex items-center w-full">
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="ابحث في الأرشيف والمرئيات…"
                className="h-10 bg-secondary/60 ps-4 pe-10 text-xs placeholder:text-muted-foreground border-input focus-visible:ring-primary/50 rounded-s-full rounded-e-none focus:bg-background transition-all"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute end-14 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
              <Button
                type="button"
                onClick={() => {
                  setActiveWatchVideo(null)
                  void doFetch(true)
                }}
                className="h-10 px-5 bg-secondary text-foreground hover:bg-accent border border-s-0 border-input rounded-s-none rounded-e-full"
                title="بحث"
              >
                <Search className="size-4" />
              </Button>
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2">
            {/* View Mode Switcher (Grid vs List) */}
            {!activeWatchVideo && (
              <div className="hidden sm:flex items-center bg-secondary p-0.5 rounded-xl border border-border/60">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setViewMode("grid")}
                  className={cn(
                    "size-7 rounded-lg transition-all",
                    viewMode === "grid" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                  )}
                  title="عرض شبكي"
                >
                  <LayoutGrid className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setViewMode("list")}
                  className={cn(
                    "size-7 rounded-lg transition-all",
                    viewMode === "list" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                  )}
                  title="عرض قائمة"
                >
                  <List className="size-3.5" />
                </Button>
              </div>
            )}

            {!activeWatchVideo && items.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={selectAllVisible}
                className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground rounded-xl"
              >
                <CheckCheck className="size-3.5 me-1 text-primary" />
                <span className="hidden md:inline">{allVisibleSelected ? "إلغاء تحديد المعروض" : "تحديد المعروض"}</span>
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSettingsOpen(true)}
              className="size-9 text-muted-foreground hover:text-foreground rounded-xl"
              title="الإعدادات"
            >
              <Settings className="size-4" />
            </Button>

            {/* Downloads Center Button */}
            <Button
              onClick={() => setDlOpen(true)}
              className="relative h-9 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-bold px-3.5 rounded-xl shadow-sm active:scale-95 transition-all"
            >
              <Download className="size-4" />
              <span className="hidden sm:inline text-xs">مركز التحميل</span>
              {activeQueueCount > 0 && (
                <span className="flex size-5 items-center justify-center rounded-full bg-background text-primary font-bold text-[10px]">
                  {activeQueueCount}
                </span>
              )}
            </Button>
          </div>
        </header>

        {/* View Switcher: Full YouTube Watch Page vs Archive Home Feed */}
        {activeWatchVideo ? (
          <div className="flex-1 overflow-y-auto">
            <WatchPage
              video={activeWatchVideo}
              relatedVideos={items}
              onBack={() => setActiveWatchVideo(null)}
              onSelectVideo={v => setActiveWatchVideo(v)}
              onQueue={addToQueue}
              onDownload={downloadNow}
            />
          </div>
        ) : (
          <>
            {/* YouTube Category Chips Filter Carousel */}
            <CategoryChips
              cats={cats}
              selected={selected}
              onToggle={toggle}
              onAll={selectAll}
              onClear={clearAll}
            />

            {/* Main Feed Content Area */}
            <div className="relative flex-1 overflow-y-auto p-4 md:p-6 pb-24">
              {loading && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-xs">
                  <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-2xl shadow-red-600/40">
                    <Loader2 className="size-7 animate-spin" />
                  </div>
                  <p className="text-xs font-bold text-foreground animate-pulse">جاري جلب الأرشيف المرئي…</p>
                </div>
              )}

              {/* Cards Container (Grid or List Mode) */}
              {viewMode === "grid" ? (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                  {items.map(v => (
                    <VideoCard
                      key={v.id}
                      video={v}
                      viewMode="grid"
                      selected={selectedVideos.has(v.id)}
                      onToggleSelect={toggleSelectVideo}
                      onOpenWatch={setActiveWatchVideo}
                      onQueue={addToQueue}
                      onDownload={downloadNow}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-3 max-w-5xl mx-auto">
                  {items.map(v => (
                    <VideoCard
                      key={v.id}
                      video={v}
                      viewMode="list"
                      selected={selectedVideos.has(v.id)}
                      onToggleSelect={toggleSelectVideo}
                      onOpenWatch={setActiveWatchVideo}
                      onQueue={addToQueue}
                      onDownload={downloadNow}
                    />
                  ))}
                </div>
              )}

              {/* Empty Search / Filter State */}
              {items.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
                  <div className="flex size-16 items-center justify-center rounded-3xl bg-secondary border border-border text-muted-foreground shadow-xs">
                    <Search className="size-8 stroke-[1.5]" />
                  </div>
                  <div className="space-y-1 max-w-sm">
                    <h3 className="text-sm font-bold text-foreground">لا توجد مرئيات مطابقة للبحث</h3>
                    <p className="text-xs text-muted-foreground">جرّب كلمة بحث أعمّ أو تفعيل تصنيفات إضافية من الشرائح العلمية</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectAll}
                    className="mt-2 text-xs border-border bg-card text-primary hover:bg-accent font-semibold rounded-xl"
                  >
                    عرض كل التصنيفات
                  </Button>
                </div>
              )}

              {/* Load More Videos Button */}
              {more && (
                <div className="mt-8 flex justify-center pb-8">
                  <Button
                    variant="outline"
                    disabled={loadMoreBusy}
                    onClick={() => void doFetch(false)}
                    className="h-10 px-6 border-border bg-card text-foreground hover:bg-accent rounded-xl shadow-xs transition-all font-semibold text-xs gap-2"
                  >
                    {loadMoreBusy ? <Loader2 className="size-4 animate-spin text-primary" /> : <Layers className="size-4 text-primary" />}
                    {loadMoreBusy ? "جارٍ التحميل…" : "عرض المزيد من مرئيات الأرشيف"}
                  </Button>
                </div>
              )}
            </div>
          </>
        )}

        {/* Floating Batch Actions Bar (YouTube Pill overlay) */}
        {!activeWatchVideo && selectedVideos.size > 0 && (
          <div className="fixed bottom-6 start-1/2 -translate-x-1/2 z-40 flex flex-wrap items-center justify-center gap-2.5 rounded-2xl border border-primary/40 bg-card/95 text-card-foreground px-4 py-2.5 shadow-2xl backdrop-blur-2xl animate-in slide-in-from-bottom duration-300 ring-1 ring-primary/20 max-w-[92vw]">
            <span className="flex items-center gap-1.5 text-xs font-bold text-primary font-heading">
              <CheckSquare className="size-4" />
              {selectedVideos.size} مقطع محدد
            </span>

            <div className="h-4 w-px bg-border hidden sm:block" />

            <Select value={batchQuality} onValueChange={v => setBatchQuality(v || defaultQuality)}>
              <SelectTrigger className="h-8 w-28 text-xs bg-secondary border-border text-foreground rounded-lg">
                <SelectValue placeholder="الدقة" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border text-popover-foreground">
                <SelectItem value="best" className="text-xs">الأفضل</SelectItem>
                <SelectItem value="1080p" className="text-xs">1080p</SelectItem>
                <SelectItem value="720p" className="text-xs">720p</SelectItem>
                <SelectItem value="480p" className="text-xs">480p</SelectItem>
                <SelectItem value="360p" className="text-xs">360p</SelectItem>
              </SelectContent>
            </Select>

            <Button
              size="sm"
              variant="outline"
              onClick={() => addBatchToQueue(batchQuality)}
              className="h-8 px-3 text-xs border-border bg-secondary text-foreground hover:bg-accent rounded-lg"
            >
              <ListPlus className="size-3.5 me-1 text-primary" />
              إضافة للقائمة
            </Button>

            <Button
              size="sm"
              onClick={() => downloadBatchNow(batchQuality)}
              className="h-8 px-3 text-xs bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-lg shadow-xs active:scale-95"
            >
              <Play className="size-3.5 me-1 fill-current" />
              تحميل المحددة الآن
            </Button>

            <Button
              size="icon"
              variant="ghost"
              onClick={() => setSelectedVideos(new Set())}
              className="h-8 size-8 text-muted-foreground hover:bg-accent rounded-lg"
              title="إلغاء التحديد"
            >
              <X className="size-4" />
            </Button>
          </div>
        )}
      </main>

      {/* Download Center Manager */}
      <DownloadCenter
        open={dlOpen}
        onOpenChange={setDlOpen}
        items={queue}
        running={running}
        error={jobError}
        onStart={start}
        onRemove={removeFromQueue}
        onClearFinished={() => setQueue(prev => prev.filter(i => i.status !== "done" && i.status !== "fail"))}
      />

      {/* Settings & Appearance Dialog */}
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        defaultQuality={defaultQuality}
        onDefaultQualityChange={setDefaultQuality}
      />
    </div>
  )
}

function useDebounced(value: string, ms: number) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms)
    return () => window.clearTimeout(t)
  }, [value, ms])
  return v
}