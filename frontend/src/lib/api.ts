import type { Cat, Source, Video } from "./types"

async function j<T>(path: string, opts?: RequestInit): Promise<T> {
  const r = await fetch(path, opts)
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error((data as { error?: string }).error || "خطأ " + r.status)
  return data as T
}

export function fetchCats(): Promise<{ categories: Cat[] }> {
  return j("/api/meta")
}

export interface BrowseResult {
  items: Video[]
  more: boolean
  page: number
}

export function browse(params: {
  cat: number[]
  q?: string
  page?: number
}): Promise<BrowseResult> {
  const p = new URLSearchParams({
    cat: params.cat.join(","),
    page: String(params.page ?? 1),
  })
  if (params.q) p.set("q", params.q)
  return j("/api/browse?" + p.toString())
}

export function postSources(id: number): Promise<{ sources: Source[] }> {
  return j("/api/post/" + id)
}

export function startPlaylist(
  quality: string,
  items: { id: number; quality: string }[]
): Promise<{ job_id: string }> {
  return j("/api/playlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quality, items }),
  })
}

export interface JobItem {
  id: number
  status: string
  bytes: number
  total: number
  error?: string | null
  title?: string
  out?: string | null
}

export function queue(jobId: string): Promise<{
  done: boolean
  items: JobItem[]
}> {
  return j("/api/queue/" + jobId)
}