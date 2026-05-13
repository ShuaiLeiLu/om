'use client'

import { cn } from '@/lib/utils'

// Segmented control to switch between login methods.
// Hides itself if there's only one available method.
export function MethodTabs({ methods, value, onChange }) {
  if (!methods || methods.length < 2) return null
  return (
    <div className="flex rounded-2xl border border-white/8 bg-white/[0.04] p-1">
      {methods.map((m) => {
        const active = value === m.value
        return (
          <button
            key={m.value}
            type="button"
            onClick={() => onChange(m.value)}
            disabled={m.disabled}
            className={cn(
              'flex flex-1 min-h-[40px] items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-all tap-transparent',
              active
                ? 'bg-gradient-to-br from-indigo-500/60 to-purple-500/50 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] border border-white/15'
                : 'text-slate-400 hover:text-slate-200 border border-transparent',
              m.disabled && 'opacity-40 cursor-not-allowed'
            )}
          >
            {m.icon && <m.icon size={13} />}
            <span>{m.label}</span>
            {m.badge && (
              <span className="rounded-full bg-fuchsia-500/30 px-1.5 py-px text-[9px] font-semibold text-fuchsia-100">
                {m.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export default MethodTabs
