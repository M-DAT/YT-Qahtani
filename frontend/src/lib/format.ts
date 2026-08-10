export function fmtBytes(n: number | null | undefined): string {
  const v = n || 0
  if (!v) return "0 B"
  const u = ["B", "KB", "MB", "GB"]
  let i = 0
  let x = v
  while (x >= 1024 && i < u.length - 1) {
    x /= 1024
    i++
  }
  return (i ? x.toFixed(1) : String(Math.round(x))) + " " + u[i]
}

export function sizeOf(s: { size?: number | null; size_h?: string }): string {
  return s.size_h || fmtBytes(s.size ?? 0)
}

export function pct(bytes: number, total: number): number {
  if (!total) return bytes > 0 ? 100 : 0
  return Math.min(100, Math.round((bytes / total) * 100))
}

export const STATUS_LABEL: Record<string, string> = {
  queued: "بانتظار",
  dl: "جارٍ التحميل",
  done: "مكتمل",
  fail: "فشل",
}