'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

const Textarea = React.forwardRef(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      className={cn(
        'flex min-h-[80px] w-full rounded-xl border border-ink-700/10 bg-rice-50 px-3 py-2 text-sm text-ink-900 shadow-sm',
        'placeholder:text-ink-400',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celadon-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-rice-100',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'scrollbar-thin',
        className
      )}
      ref={ref}
      {...props}
    />
  )
})

export { Textarea }
