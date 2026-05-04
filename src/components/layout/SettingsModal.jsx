'use client'

import { X, Shield, Key } from 'lucide-react'
import { providers } from '@/lib/config'
import { useConfigStore } from '@/store/useStore'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export default function SettingsModal({ isOpen, onClose }) {
  const { customApiKeys, setCustomApiKey } = useConfigStore()

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-md scale-in-center overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-2">
            < Shield size={18} className="text-indigo-400" />
            <h2 className="text-lg font-bold text-white">API 设置</h2>
          </div>
          <button 
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="max-h-[70vh] overflow-y-auto p-6 space-y-6">
          <div className="rounded-xl bg-indigo-500/10 border border-indigo-500/20 p-4">
            <p className="text-xs leading-relaxed text-indigo-300">
              设置您的自定义 API Key。这些密钥将安全地保存在您的浏览器本地，并优先于系统默认密钥。
            </p>
          </div>

          <div className="space-y-4">
            {providers.map((p) => (
              <div key={p.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                    <div 
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: p.color }}
                    />
                    {p.name}
                  </label>
                  <span className="text-[10px] font-mono text-slate-500 uppercase">{p.id}</span>
                </div>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                    <Key size={14} />
                  </div>
                  <input
                    type="password"
                    value={customApiKeys[p.id] || ''}
                    onChange={(e) => setCustomApiKey(p.id, e.target.value)}
                    placeholder="输入您的 API Key..."
                    className="w-full rounded-xl border border-slate-700 bg-slate-800/50 py-2.5 pl-9 pr-4 text-sm text-white placeholder-slate-600 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 transition-all"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-800 bg-slate-900/50 px-6 py-4">
          <button 
            onClick={onClose}
            className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-500 active:scale-[0.98]"
          >
            完成并保存
          </button>
        </div>
      </div>
    </div>
  )
}
