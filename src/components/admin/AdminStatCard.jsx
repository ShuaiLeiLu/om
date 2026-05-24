'use client'

import { cn } from '@/lib/utils'

// 大数字统计卡。tone 控制顶部光晕颜色。
export function AdminStatCard({
  label,
  value,
  hint,
  tone = 'indigo',
  icon: Icon,
  loading = false
}) {
  const toneClass = {
    indigo: 'from-celadon-200/60 to-celadon-200/0',
    fuchsia: 'from-celadon-200/60 to-celadon-200/0',
    emerald: 'from-celadon-200/60 to-celadon-200/0',
    amber: 'from-gold-400/35 to-gold-400/0',
    rose: 'from-verm-400/25 to-verm-400/0',
    sky: 'from-celadon-200/60 to-celadon-200/0',
    violet: 'from-celadon-200/60 to-celadon-200/0',
    slate: 'from-ink-400/10 to-ink-400/0'
  }[tone]
  const iconColor = {
    indigo: 'text-celadon-700',
    fuchsia: 'text-celadon-700',
    emerald: 'text-celadon-700',
    amber: 'text-gold-600',
    rose: 'text-verm-600',
    sky: 'text-celadon-700',
    violet: 'text-celadon-700',
    slate: 'text-ink-500'
  }[tone]

  return (
    <div className="relative overflow-hidden rounded-2xl border border-ink-700/10 bg-rice-50 p-4 shadow-[var(--shadow-paper)] md:p-5">
      <div
        className={cn(
          'pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br blur-2xl opacity-70',
          toneClass
        )}
      />
      <div className="relative">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-ink-500 label-zh">
            {label}
          </span>
          {Icon && <Icon size={14} className={iconColor} />}
        </div>
        {loading ? (
          <div className="mt-2 h-8 w-24 rounded skeleton" />
        ) : (
          <div className="mt-1.5 font-mono text-2xl font-semibold text-ink-900 md:text-3xl">{value}</div>
        )}
        {hint && (
          <p className="mt-1 truncate text-[10px] text-ink-500 md:text-[11px]">{hint}</p>
        )}
      </div>
    </div>
  )
}

export default AdminStatCard
