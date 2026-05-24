'use client'

import { cn } from '@/lib/utils'

export function InkStroke({ className, style }) {
  return (
    <div
      style={style}
      className={cn('ink-stroke w-full opacity-20 my-4', className)}
    />
  )
}

export default InkStroke
