"use client"

interface ActivityTimestampProps {
  iso: string
  className?: string
}

/**
 * A timestamp in the viewer's own timezone.
 *
 * `suppressHydrationWarning` is deliberate and is the idiomatic answer here:
 * the server formats in its timezone and the browser in the viewer's, so the
 * two strings legitimately differ. React is told to keep the client's value
 * rather than treating the difference as a bug. The alternative — rendering
 * UTC — would show a CSR a time that is not the time they are working in.
 */
export function ActivityTimestamp({ iso, className }: ActivityTimestampProps) {
  const date = new Date(iso)
  const label = Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
      })

  return (
    <time dateTime={iso} className={className} suppressHydrationWarning>
      {label}
    </time>
  )
}
