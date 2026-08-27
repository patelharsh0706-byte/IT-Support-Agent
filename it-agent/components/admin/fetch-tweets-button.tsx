"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * The trigger. Nothing runs on a timer — invariant 7.
 *
 * Reports what actually came back, and surfaces the server's real error text
 * rather than a generic toast: when a live session cookie has expired, that
 * message is precisely what the operator needs to read.
 */
export function FetchTweetsButton() {
  const [isFetching, setIsFetching] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleFetch() {
    setIsFetching(true)
    setResult(null)
    setError(null)

    const response = await fetch("/api/social/tweets/fetch", { method: "POST" }).catch(() => null)

    if (!response) {
      setIsFetching(false)
      setError("Could not reach the server.")
      return
    }

    const payload = await response.json().catch(() => ({}))
    setIsFetching(false)

    if (!response.ok) {
      setError(payload.error ?? `Fetch failed (${response.status}).`)
      return
    }

    setResult(
      `${payload.fetched} fetched, ${payload.inserted} new` +
        (payload.skipped > 0 ? `, ${payload.skipped} already seen` : "") +
        ` · ${payload.source}`,
    )
    router.refresh()
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" onClick={() => void handleFetch()} disabled={isFetching}>
        <RefreshCw data-icon="inline-start" className={cn(isFetching && "animate-spin")} />
        {isFetching ? "Fetching…" : "Fetch tweets"}
      </Button>
      {result ? <p className="text-[12px] text-muted-foreground">{result}</p> : null}
      {error ? (
        <p role="alert" className="max-w-md text-right text-[12px] text-state-error">
          {error}
        </p>
      ) : null}
    </div>
  )
}
