/** Formats an elapsed duration between two ISO timestamps as e.g. "2d 4h" or "3h". */
export function formatDuration(fromIso: string, toIso = new Date().toISOString()) {
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime()
  const hours = Math.max(0, Math.floor(ms / (1000 * 60 * 60)))
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`
}
