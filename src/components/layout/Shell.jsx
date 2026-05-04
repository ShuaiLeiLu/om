'use client'

import { useState, useEffect } from 'react'
import { Menu, X, Plus, MessageSquare, Trash2, Settings, User } from 'lucide-react'
import { useUIStore, useChatStore, useModelStore } from '@/store/useStore'
import SettingsModal from './SettingsModal'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export default function Shell({ children }) {
  const { isSidebarOpen, toggleSidebar, setSidebarOpen } = useUIStore()
  const { conversations, activeConversationId, setActiveConversationId, deleteConversation, addConversation } = useChatStore()
  const { setSelectedModel, setSelectedProvider } = useModelStore()
  const [isMobile, setIsMobile] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  // Handle responsive behavior
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024
      setIsMobile(mobile)
      if (mobile) setSidebarOpen(false)
      else setSidebarOpen(true)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [setSidebarOpen])

  const createNewChat = () => {
    setActiveConversationId(null)
    setSelectedModel(null)
    setSelectedProvider(null)
    if (isMobile) setSidebarOpen(false)
  }

  const handleSelectConversation = (id) => {
    setActiveConversationId(id)
    if (isMobile) setSidebarOpen(false)
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-950 text-slate-50">
      {/* Sidebar Overlay (Mobile) */}
      {isMobile && isSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 transform border-r border-slate-800 bg-slate-900 transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0",
          !isSidebarOpen && "-translate-x-full lg:hidden"
        )}
      >
        <div className="flex h-full flex-col p-4">
          {/* New Chat Button */}
          <button 
            onClick={createNewChat}
            className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm font-medium transition-all hover:bg-slate-700 hover:border-slate-600 active:scale-[0.98]"
          >
            <Plus size={18} className="text-indigo-400" />
            <span>开启新对话</span>
          </button>

          {/* Conversation List */}
          <div className="mt-6 flex-1 overflow-y-auto space-y-1">
            <p className="px-2 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">最近对话</p>
            {conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center opacity-40">
                <MessageSquare size={32} strokeWidth={1.5} />
                <p className="mt-2 text-xs">暂无对话历史</p>
              </div>
            ) : (
              conversations.map((conv) => (
                <div 
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv.id)}
                  className={cn(
                    "group relative flex cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 transition-colors",
                    activeConversationId === conv.id ? "bg-indigo-500/10 text-indigo-100" : "hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <MessageSquare size={16} className={cn(activeConversationId === conv.id ? "text-indigo-400" : "text-slate-500")} />
                    <span className="truncate text-sm font-medium">{conv.title}</span>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteConversation(conv.id)
                    }}
                    className="flex h-6 w-6 items-center justify-center rounded-md text-slate-500 opacity-0 transition-all hover:bg-red-500/20 hover:text-red-400 group-hover:opacity-100"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* User Section */}
          <div className="mt-auto border-t border-slate-800 pt-4 space-y-1">
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
            >
              <Settings size={18} />
              <span>设置</span>
            </button>
            <div className="flex items-center gap-3 rounded-xl bg-slate-800/30 px-3 py-2.5 border border-slate-800/50">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400">
                <User size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold">演示用户</p>
                <p className="truncate text-[10px] text-slate-500">免费计划</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex flex-1 flex-col relative">
        {/* Mobile Header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-950/80 px-4 backdrop-blur-md lg:hidden">
          <button 
            onClick={toggleSidebar}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-900"
          >
            <Menu size={20} />
          </button>
          <span className="text-sm font-bold tracking-tight">万模AI</span>
          <button 
            onClick={createNewChat}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-indigo-400 hover:bg-slate-900"
          >
            <Plus size={20} />
          </button>
        </header>

        {children}
      </main>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />
    </div>
  )
}
