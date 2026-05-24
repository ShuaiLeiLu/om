'use client'

import { Coins } from 'lucide-react'
import Seal from './Seal'
import { cn } from '@/lib/utils'

export function WanmoCard({ balance = '0', holderId = 'SYNCING...', expiringSoon = '0', className }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-celadon-700/20 bg-gradient-to-br from-celadon-600 via-celadon-800 to-ink-800 p-5 text-rice-50 shadow-[var(--shadow-ink)] min-h-[180px] flex flex-col justify-between select-none',
        className
      )}
    >
      {/* Dark Cloud Pattern / Dot Grid */}
      <div className="absolute inset-0 bg-dot-grid opacity-25 pointer-events-none" />
      
      {/* 朱砂印章 */}
      <div className="absolute right-5 top-5">
        <Seal size="sm" className="h-11 w-11 shadow-md">
          <span className="font-serif text-xs font-bold leading-tight">万模</span>
        </Seal>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Coins size={16} className="text-gold-400" />
          <span className="text-[10px] tracking-[0.25em] font-serif text-rice-50/80">万 模 卡</span>
        </div>
      </div>

      <div className="my-3">
        <span className="text-[9px] text-rice-50/60 block uppercase tracking-wider font-semibold font-sans">Available Balance</span>
        <span className="text-4xl font-light tracking-tight text-rice-50 font-mono leading-none mt-1 block">{balance}</span>
      </div>

      <div className="flex items-end justify-between text-[9px] font-mono">
        <div>
          <span className="text-[8px] text-rice-50/50 block uppercase tracking-wider font-semibold">Holder ID</span>
          <span className="text-rice-50/80 max-w-[150px] truncate block mt-0.5">{holderId}</span>
        </div>
        <div className="text-right">
          <span className="text-[8px] text-rice-50/50 block uppercase tracking-wider font-semibold">Expiring (7d)</span>
          <span className="text-gold-400 font-bold block mt-0.5">{expiringSoon}</span>
        </div>
      </div>
    </div>
  )
}

export default WanmoCard
