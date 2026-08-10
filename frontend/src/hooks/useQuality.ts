import { useCallback, useRef, useState } from "react"
import type { Video, Source } from "@/lib/types"
import { postSources } from "@/lib/api"

export interface QualityOption {
  label: string
  text: string
  url?: string
}

/** Lazy-load a video's quality options and stream URLs. */
export function useQuality(video: Video) {
  const [sources, setSources] = useState<Source[]>(video.sources || [])
  const [options, setOptions] = useState<QualityOption[]>(() => {
    const srcs = video.sources || []
    if (!srcs.length) return []
    return srcs.map(s =>
      s.platform
        ? { label: "embed", text: "منصة خارجية (مشغّل)", url: s.url }
        : { label: s.label, text: `${s.label}${s.size_h ? " — " + s.size_h : ""}`, url: s.url }
    )
  })
  const [ready, setReady] = useState(Boolean(video.sources && video.sources.length))
  const [loading, setLoading] = useState(false)
  const fetching = useRef(false)

  const ensure = useCallback(async () => {
    if (ready || fetching.current) return
    fetching.current = true
    setLoading(true)
    try {
      const p = await postSources(video.id)
      const list = p.sources || []
      setSources(list)
      const opts: QualityOption[] = [{ label: "best", text: "الأفضل" }]
      const firstStream = list.find(s => s.url && !s.platform)?.url
      if (firstStream) {
        opts[0].url = firstStream
      }
      for (const s of list) {
        if (!s.platform) {
          opts.push({ label: s.label, text: `${s.label}${s.size_h ? " — " + s.size_h : ""}`, url: s.url })
        }
      }
      if (list.some(s => s.platform)) {
        const embedUrl = list.find(s => s.platform)?.url
        opts.push({ label: "embed", text: "منصة خارجية (مشغّل)", url: embedUrl })
      }
      setOptions(opts)
      setReady(true)
    } catch {
      /* keep previous options */
    } finally {
      setLoading(false)
      fetching.current = false
    }
  }, [video.id, ready])

  return { sources, options, loading, ready, ensure }
}