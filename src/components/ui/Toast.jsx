'use client'

import * as React from 'react'
import { toast } from './sonner'

const ToastContext = React.createContext({ toast: () => {} })

function mapVariant(variant) {
  if (variant === 'error') return 'error'
  if (variant === 'success') return 'success'
  if (variant === 'info') return 'info'
  return 'message'
}

export function ToastProvider({ children }) {
  const value = React.useMemo(
    () => ({
      toast: ({ variant, title, description }) => {
        return toast[mapVariant(variant)](title || '', { description })
      }
    }),
    []
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
    </ToastContext.Provider>
  )
}

export function useToast() {
  return React.useContext(ToastContext)
}

export { toast }
