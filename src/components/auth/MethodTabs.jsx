'use client'

import { cn } from '@/lib/utils'

// Segmented control to switch between login methods.
// Hides itself if there's only one available method.
export function MethodTabs({ methods, value, onChange }) {
  if (!methods || methods.length < 2) return null
  return (
    <div className="flex rounded-2xl border border-ink-700/10 bg-rice-200/70 p-1">
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
                ? 'bg-rice-50 text-celadon-700 shadow-[var(--shadow-paper)] border border-ink-700/5'
                : 'text-ink-500 hover:text-ink-900 border border-transparent',
              m.disabled && 'opacity-40 cursor-not-allowed'
            )}
          >
            {m.icon && <m.icon size={13} />}
            <span>{m.label}</span>
            {m.badge && (
              <span className="rounded-full bg-verm-500/10 px-1.5 py-px text-[9px] font-semibold text-verm-600">
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
