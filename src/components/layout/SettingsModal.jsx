'use client'

import { X, Shield, Server, ReceiptText } from 'lucide-react'

export default function SettingsModal({ isOpen, onClose }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-indigo-400" />
            <h2 className="text-lg font-bold text-white">服务设置</h2>
          </div>
          <button 
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-indigo-200">
              <Server size={16} />
              <span>模型网关由服务端托管</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-indigo-300">
              浏览器不会保存或发送模型供应商 API Key。所有模型请求统一经过 Chatty 后端，再由后端记录 usage 并扣减 Token。
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <ReceiptText size={16} />
              <span>账单依据</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Token 余额、模型用量和扣费流水以服务端数据库记录为准，本地聊天记录只用于当前设备的界面展示。
            </p>
          </div>
        </div>

        <div className="border-t border-slate-800 bg-slate-900/50 px-6 py-4">
          <button 
            onClick={onClose}
            className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-500 active:scale-[0.98]"
          >
            知道了
          </button>
        </div>
      </div>
    </div>
  )
}
