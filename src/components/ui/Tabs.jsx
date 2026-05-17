'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

const TabsContext = React.createContext(null)

export function Tabs({ value, defaultValue, onValueChange, className, children }) {
  const [internalValue, setInternalValue] = React.useState(defaultValue)
  const currentValue = value !== undefined ? value : internalValue

  const setValue = React.useCallback(
    (nextValue) => {
      if (value === undefined) setInternalValue(nextValue)
      onValueChange?.(nextValue)
    },
    [onValueChange, value]
  )

  return (
    <TabsContext.Provider value={{ value: currentValue, setValue }}>
      <div className={cn('space-y-4', className)}>{children}</div>
    </TabsContext.Provider>
  )
}

export function TabsList({ className, children }) {
  return (
    <div
      className={cn(
        'inline-flex h-10 items-center rounded-xl border border-white/8 bg-white/[0.04] p-1 text-slate-400',
        className
      )}
    >
      {children}
    </div>
  )
}

export function TabsTrigger({ value, className, children }) {
  const context = React.useContext(TabsContext)
  const active = context?.value === value

  return (
    <button
      type="button"
      onClick={() => context?.setValue(value)}
      className={cn(
        'inline-flex min-w-0 items-center justify-center rounded-lg px-3 py-1.5 text-sm font-medium transition-all',
        active
          ? 'bg-gradient-to-br from-indigo-500/40 to-fuchsia-500/30 text-white border border-white/12'
          : 'text-slate-400 hover:text-slate-100',
        className
      )}
    >
      {children}
    </button>
  )
}

export function TabsContent({ value, className, children }) {
  const context = React.useContext(TabsContext)
  if (context?.value !== value) return null
  return <div className={cn('outline-none', className)}>{children}</div>
}
