"use client"

import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { usePathname } from "next/navigation"
import { useEffect } from "react"

export function Toaster() {
  const { toasts, dismiss } = useToast()
  const pathname = usePathname()

  // Automatically dismiss all active notifications when the route changes.
  // This ensures that meeting alerts disappear once the user navigates to the chat or elsewhere.
  useEffect(() => {
    dismiss()
  }, [pathname, dismiss])

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
