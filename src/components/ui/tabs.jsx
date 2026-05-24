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
        'inline-flex h-10 items-center rounded-xl border border-ink-700/10 bg-rice-200/70 p-1 text-ink-500',
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
          ? 'border border-ink-700/5 bg-rice-50 text-celadon-700 shadow-[var(--shadow-paper)]'
          : 'text-ink-500 hover:text-ink-900',
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
