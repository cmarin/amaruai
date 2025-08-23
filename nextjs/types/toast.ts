import type { ReactNode, ReactElement } from "react"

export interface Toast {
  id: string
  title?: ReactNode
  description?: ReactNode
  action?: ReactElement
  variant?: "default" | "destructive"
  open?: boolean
  onOpenChange?: (open: boolean) => void
  duration?: number
}

export type ToastActionElement = ReactElement 