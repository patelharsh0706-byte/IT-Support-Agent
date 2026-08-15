"use client"

import type * as React from "react"

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface EditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: React.ReactNode
  /** Dialog body. Omit for a confirm-style dialog that is title + actions. */
  children?: React.ReactNode
  /**
   * Footer actions, rendered right-aligned after the cancel control. Omit to
   * get a dialog whose only action is dismissing it.
   */
  actions?: React.ReactNode
  cancelLabel?: string
  className?: string
}

/**
 * Shared shape for every editor dialog: title, optional description, optional
 * body, and a footer action row. Colours come from the `globals.css` tokens
 * via the shadcn semantic variables — no hardcoded values.
 *
 * This is the pattern only; concrete dialogs are built in later units.
 */
export function EditorDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  actions,
  cancelLabel = "Cancel",
  className,
}: EditorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn("rounded-2xl bg-surface text-foreground", className)}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>

        {children}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              {cancelLabel}
            </Button>
          </DialogClose>
          {actions}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
