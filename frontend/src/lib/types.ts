export interface Cat {
  id: number
  name: string
  count: number
}

export interface Source {
  label: string
  url?: string
  size?: number | null
  size_h?: string
  platform?: boolean
}

export interface Video {
  id: number
  title: string
  date: string
  category?: string | null
  thumb?: string | null
  sources?: Source[] | null
  status?: string
}

export type QStatus = "queued" | "dl" | "done" | "fail"

export interface QueueItem {
  id: number
  title: string
  quality: string
  status: QStatus
  bytes: number
  total: number
  err: string
}