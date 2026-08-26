"use client"

import { useState } from "react"
import { Mic, Paperclip, SendHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

interface ComposerProps {
  /** Resolves false when the send failed — the text is kept so nothing is lost. */
  onSend: (content: string) => Promise<boolean>
  disabled?: boolean
  className?: string
}

/** Pinned composer: bordered container, textarea, icon actions, send. */
export function Composer({ onSend, disabled, className }: ComposerProps) {
  const [value, setValue] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSend() {
    const trimmed = value.trim()
    if (!trimmed || isSending || disabled) return
    setIsSending(true)
    setError(null)
    const ok = await onSend(trimmed)
    setIsSending(false)
    if (!ok) {
      setError("Could not send. Your message is still here — try again.")
      return
    }
    // Cleared only on a confirmed write, so a failed send never loses text.
    setValue("")
  }

  return (
    <div className={cn("shrink-0 border-t border-border bg-surface p-4", className)}>
      <div className="flex flex-col rounded-xl border border-border bg-canvas">
        <div className="flex items-center justify-end px-3 pt-2">
          <span className="text-[11px] text-muted-foreground">
            Enter to send, Shift+Enter for a new line
          </span>
        </div>
        <Textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            // isComposing / keyCode 229 = an IME (e.g. Japanese, Chinese,
            // Korean input) is mid-composition; that Enter confirms the
            // composition, it isn't a submit.
            if (event.nativeEvent.isComposing || event.keyCode === 229) return
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault()
              void handleSend()
            }
          }}
          placeholder="Message the servicing agent…"
          disabled={disabled || isSending}
          className="min-h-16 resize-none border-none bg-transparent px-3 py-2 shadow-none focus-visible:ring-0"
        />
        <div className="flex items-center justify-between px-3 pb-2">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Attach a file"
              disabled={disabled}
            >
              <Paperclip />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Record a voice message"
              disabled={disabled}
            >
              <Mic />
            </Button>
          </div>
          <Button
            type="button"
            size="icon-sm"
            aria-label="Send message"
            onClick={() => void handleSend()}
            disabled={disabled || isSending || value.trim().length === 0}
          >
            <SendHorizontal />
          </Button>
        </div>
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-center text-[11px] text-state-error">
          {error}
        </p>
      ) : null}
      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        The servicing agent can make mistakes. Verify important details.
      </p>
    </div>
  )
}
