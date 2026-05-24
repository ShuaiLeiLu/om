'use client'

import { cn } from '@/lib/utils'

export function RemoteMountain({ className, style }) {
  return (
    <svg
      style={style}
      className={cn('pointer-events-none w-full opacity-90', className)}
      viewBox="0 0 600 220"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M0,180 Q60,110 130,140 T260,120 T390,150 T520,110 T600,140 L600,220 L0,220 Z" fill="#A5CCC4" />
      <path d="M0,200 Q80,150 160,170 T320,160 T480,180 T600,160 L600,220 L0,220 Z" fill="#5BA5A0" />
      <path d="M0,215 Q100,190 200,200 T400,210 T600,200 L600,220 L0,220 Z" fill="#1F6B66" />
    </svg>
  )
}

export default RemoteMountain
