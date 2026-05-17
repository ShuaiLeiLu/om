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
    indigo: 'from-indigo-500/30 to-indigo-500/0',
    fuchsia: 'from-fuchsia-500/30 to-fuchsia-500/0',
    emerald: 'from-emerald-500/30 to-emerald-500/0',
    amber: 'from-amber-500/30 to-amber-500/0',
    rose: 'from-rose-500/30 to-rose-500/0',
    sky: 'from-sky-500/30 to-sky-500/0',
    violet: 'from-violet-500/30 to-violet-500/0',
    slate: 'from-slate-500/20 to-slate-500/0'
  }[tone]
  const iconColor = {
    indigo: 'text-indigo-300',
    fuchsia: 'text-fuchsia-300',
    emerald: 'text-emerald-300',
    amber: 'text-amber-300',
    rose: 'text-rose-300',
    sky: 'text-sky-300',
    violet: 'text-violet-300',
    slate: 'text-slate-300'
  }[tone]

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03] p-4 backdrop-blur-xl md:p-5">
      <div
        className={cn(
          'pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br blur-2xl opacity-70',
          toneClass
        )}
      />
      <div className="relative">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            {label}
          </span>
          {Icon && <Icon size={14} className={iconColor} />}
        </div>
        {loading ? (
          <div className="mt-2 h-8 w-24 rounded skeleton" />
        ) : (
          <div className="mt-1.5 text-2xl font-bold text-white md:text-3xl">{value}</div>
        )}
        {hint && (
          <p className="mt-1 truncate text-[10px] text-slate-400 md:text-[11px]">{hint}</p>
        )}
      </div>
    </div>
  )
}

export default AdminStatCard
