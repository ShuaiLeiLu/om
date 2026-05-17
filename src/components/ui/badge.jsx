'use client'

import * as React from 'react'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80',
        outline: 'text-foreground',
        success:
          'border-emerald-400/30 bg-emerald-500/10 text-emerald-300',
        warning:
          'border-amber-400/30 bg-amber-500/10 text-amber-300',
        info:
          'border-sky-400/30 bg-sky-500/10 text-sky-300',
        rose:
          'border-rose-400/30 bg-rose-500/10 text-rose-300',
        indigo:
          'border-indigo-400/30 bg-indigo-500/10 text-indigo-300',
        fuchsia:
          'border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-300'
      }
    },
    defaultVariants: { variant: 'default' }
  }
)

function Badge({ className, variant, ...props }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
