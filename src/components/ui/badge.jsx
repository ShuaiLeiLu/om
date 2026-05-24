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
          'border-celadon-600/30 bg-celadon-50 text-celadon-700',
        warning:
          'border-gold-500/30 bg-gold-500/10 text-gold-600',
        info:
          'border-celadon-600/20 bg-celadon-50 text-celadon-700',
        rose:
          'border-verm-500/30 bg-verm-500/10 text-verm-600',
        indigo:
          'border-celadon-600/30 bg-celadon-50 text-celadon-700',
        fuchsia:
          'border-verm-500/30 bg-verm-500/10 text-verm-600'
      }
    },
    defaultVariants: { variant: 'default' }
  }
)

function Badge({ className, variant, ...props }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
