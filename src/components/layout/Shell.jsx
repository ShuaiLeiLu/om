'use client'

import { memo, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import {
  Menu,
  PanelLeftClose,
  PanelLeft,
  Plus,
  MessageSquare,
  Trash2,
  Settings,
  User,
  Sparkles,
  Image as ImageIcon,
  Coins
} from 'lucide-react'
import { useUIStore, useChatStore, useModelStore, useAuthStore } from '@/store/useStore'
import { useImageStore } from '@/store/useImageStore'
import SettingsModal from './SettingsModal'
import { cn, formatNumber, formatRelativeTime } from '@/lib/utils'
import { deleteTask } from '@/lib/image/db'

export default function Shell({ children, workspace = 'chat' }) {
  const router = useRouter()
  const pathname = usePathname()
  const {
    isSidebarOpen,
    toggleSidebar,
    setSidebarOpen,
    isSidebarCollapsed,
    toggleSidebarCollapsed
  } = useUIStore()
  const {
    conversations,
    activeConversationId,
    setActiveConversationId,
    deleteConversation
  } = useChatStore()
  const { selectedProvider, selectedModel, setSelectedModel, setSelectedProvider } = useModelStore()
  const { user, quota, isAuthenticated, isLoading: isAuthLoading } = useAuthStore()
  const imageTaskIndex = useImageStore((s) => s.taskIndex)
  const activeTaskId = useImageStore((s) => s.activeTaskId)
  const setActiveTaskId = useImageStore((s) => s.setActiveTaskId)
  const removeTaskFromIndex = useImageStore((s) => s.removeTaskFromIndex)

  const [isMobile, setIsMobile] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

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

  const collapsed = !isMobile && isSidebarCollapsed
  const inActiveChat = workspace === 'chat' && activeConversationId

  const switchWorkspace = useCallback((target) => {
    if (target === 'chat' && pathname !== '/chat') router.push('/chat')
    if (target === 'image' && pathname !== '/image') router.push('/image')
    if (isMobile) setSidebarOpen(false)
  }, [isMobile, pathname, router, setSidebarOpen])

  const createNewItem = useCallback(() => {
    if (workspace === 'chat') {
      setActiveConversationId(null)
      setSelectedModel(null)
      setSelectedProvider(null)
    } else {
      setActiveTaskId(null)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    if (isMobile) setSidebarOpen(false)
  }, [
    workspace,
    isMobile,
    setActiveConversationId,
    setSelectedModel,
    setSelectedProvider,
    setActiveTaskId,
    setSidebarOpen
  ])

  const handleSelectConversation = useCallback((id) => {
    setActiveConversationId(id)
    if (isMobile) setSidebarOpen(false)
  }, [isMobile, setActiveConversationId, setSidebarOpen])

  const handleSelectTask = useCallback((id) => {
    setActiveTaskId(id)
    if (isMobile) setSidebarOpen(false)
  }, [isMobile, setActiveTaskId, setSidebarOpen])

  const handleDeleteTask = useCallback(async (id) => {
    try {
      await deleteTask(id)
      removeTaskFromIndex(id)
    } catch (err) {
      console.warn('[shell] delete task failed', err)
    }
  }, [removeTaskFromIndex])

  return (
    <div className="relative flex h-screen-dvh w-full overflow-hidden text-slate-50 bg-[#030712]">
      {/* Dot Grid Background Overlay */}
      <div className="absolute inset-0 bg-dot-grid pointer-events-none opacity-40 z-0" />

      {/* Rotating background glow blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-indigo-500/10 blur-[120px] animate-orbit-1" />
        <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full bg-fuchsia-500/10 blur-[120px] animate-orbit-2" />
        <div className="absolute top-1/2 left-1/3 w-[500px] h-[500px] rounded-full bg-cyan-500/5 blur-[100px] animate-orbit-1" />
      </div>

      {/* Mobile overlay */}
      {isMobile && isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm transition-opacity animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 transform transition-[width,transform] duration-300 ease-in-out lg:relative lg:translate-x-0',
          'border-r border-white/5 bg-slate-950/40 backdrop-blur-3xl pl-safe shadow-[8px_0_32px_rgba(0,0,0,0.5)]',
          collapsed ? 'w-16' : 'w-[84vw] max-w-[300px] lg:w-72',
          !isSidebarOpen && '-translate-x-full lg:hidden'
        )}
      >
        <div className="flex h-full flex-col p-3 pt-safe z-10 relative">
          {/* Brand + collapse */}
          <div
            className={cn(
              'mb-3 flex items-center gap-2',
              collapsed ? 'flex-col' : 'justify-between'
            )}
          >
            <Link
              href="/image"
              className={cn(
                'flex items-center gap-2 rounded-xl py-1.5 tap-transparent',
                collapsed ? 'justify-center w-full' : 'flex-1 min-w-0'
              )}
              title={collapsed ? '万模 AI' : undefined}
            >
              <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 shadow-[0_0_12px_rgba(139,92,246,0.5)]">
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles className="text-white animate-pulse" size={18} />
                </div>
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold tracking-tight text-gradient-brand text-glow-purple">
                    万模 AI
                  </p>
                  <p className="truncate text-[10px] text-slate-400 font-medium">多模型智能工作台</p>
                </div>
              )}
            </Link>

            {!isMobile && (
              <Tip label={collapsed ? '展开侧边栏' : '收起侧边栏'} placement="right">
                <button
                  onClick={toggleSidebarCollapsed}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/5 hover:text-slate-100 tap-transparent"
                >
                  {collapsed ? <PanelLeft size={15} /> : <PanelLeftClose size={15} />}
                </button>
              </Tip>
            )}
          </div>

          {/* Workspace switcher */}
          {collapsed ? (
            <div className="mb-2 flex flex-col gap-1">
              <RailButton
                icon={MessageSquare}
                label="对话"
                active={workspace === 'chat'}
                onClick={() => switchWorkspace('chat')}
              />
              <RailButton
                icon={ImageIcon}
                label="图片"
                active={workspace === 'image'}
                onClick={() => switchWorkspace('image')}
              />
            </div>
          ) : (
            <div className="mb-3 flex rounded-xl border border-white/5 bg-slate-900/40 p-1 backdrop-blur-md shadow-inner shadow-black/40">
              <WorkspaceTab
                icon={MessageSquare}
                label="对话"
                active={workspace === 'chat'}
                onClick={() => switchWorkspace('chat')}
              />
              <WorkspaceTab
                icon={ImageIcon}
                label="图片"
                active={workspace === 'image'}
                onClick={() => switchWorkspace('image')}
              />
            </div>
          )}

          {/* New button — only shown in chat workspace */}
          {workspace === 'chat' && (
            collapsed ? (
              <Tip label="开启新对话" placement="right">
                <button
                  onClick={createNewItem}
                  className="mb-3 flex h-10 w-10 mx-auto items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-indigo-500/30 to-fuchsia-500/20 text-white transition-all hover:from-indigo-500/40 hover:to-fuchsia-500/30 active:scale-95 tap-transparent"
                >
                  <Plus size={16} />
                </button>
              </Tip>
            ) : (
              <button
                onClick={createNewItem}
                className="mb-4 flex min-h-[44px] items-center gap-3 rounded-xl border border-white/10 bg-gradient-to-r from-indigo-500/20 to-fuchsia-500/20 px-4 py-2.5 text-sm font-medium text-slate-100 transition-all duration-300 hover:from-indigo-500/35 hover:to-fuchsia-500/35 active:scale-[0.97] hover:shadow-[0_0_15px_rgba(99,102,241,0.25)] tap-transparent relative overflow-hidden group"
              >
                {/* Shining border effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-0 group-hover:opacity-10 transition-opacity duration-300 pointer-events-none" />
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 shadow-[0_2px_8px_rgba(168,85,247,0.4)]">
                  <Plus size={14} className="text-white animate-pulse" />
                </div>
                <span>开启新对话</span>
              </button>
            )
          )}

          {/* List */}
          {!collapsed && (
            <div className="flex-1 overflow-y-auto space-y-1 -mx-1 px-1 scrollbar-thin">
              {workspace === 'chat' ? (
                <ChatList
                  conversations={conversations}
                  activeId={activeConversationId}
                  onSelect={handleSelectConversation}
                  onDelete={deleteConversation}
                />
              ) : (
                <ImageList
                  tasks={imageTaskIndex}
                  activeTaskId={activeTaskId}
                  onSelect={handleSelectTask}
                  onDelete={handleDeleteTask}
                />
              )}
            </div>
          )}

          {collapsed && <div className="flex-1" />}

          {/* Footer */}
          {collapsed ? (
            <div className="mt-auto flex flex-col items-center gap-1 border-t border-white/5 pt-3 pb-safe">
              <Tip label="设置" placement="right">
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-white/5 hover:text-slate-100 tap-transparent"
                >
                  <Settings size={16} />
                </button>
              </Tip>
              <Tip
                label={
                  isAuthLoading
                    ? '同步登录状态中'
                    : isAuthenticated
                      ? `${user?.displayName || '微信用户'}\n${formatNumber(
                          quota?.tokenBalance || 0
                        )} 算力点`
                      : '未登录'
                }
                placement="right"
              >
                <Link
                  href={isAuthenticated ? '/profile' : '/login'}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-400 to-fuchsia-400 text-white transition hover:brightness-110 tap-transparent"
                >
                  <User size={15} />
                </Link>
              </Tip>
            </div>
          ) : (
            <div className="mt-auto space-y-1.5 border-t border-white/5 pt-3 pb-safe">
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="flex w-full min-h-[44px] items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200 tap-transparent"
              >
                <Settings size={16} />
                <span>设置</span>
              </button>
              <Link
                href={isAuthenticated ? '/profile' : '/login'}
                className="flex min-h-[56px] items-center gap-3 rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/60 to-purple-950/20 px-3 py-2.5 transition-all duration-300 hover:border-purple-500/30 hover:shadow-[0_0_15px_rgba(168,85,247,0.15)] tap-transparent group relative overflow-hidden"
              >
                {/* Card glow shimmer */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out" />
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 shadow-[0_2px_8px_rgba(139,92,246,0.3)]">
                  <User size={15} className="text-white group-hover:scale-110 transition-transform" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-slate-100 group-hover:text-purple-300 transition-colors">
                    {isAuthLoading && !isAuthenticated
                      ? '同步登录中'
                      : isAuthenticated
                        ? user?.displayName || '微信用户'
                        : '未登录'}
                  </p>
                  <p className="flex items-center gap-1 truncate text-[10px] text-slate-400 mt-0.5">
                    {isAuthLoading && !isAuthenticated ? (
                      <span className="inline-block h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
                    ) : isAuthenticated ? (
                      <>
                        <Coins size={9} className="text-amber-400 animate-pulse" />
                        <span className="text-amber-300/90 font-medium">{formatNumber(quota?.tokenBalance || 0)}</span> <span className="text-[9px] text-slate-500">算力点</span>
                      </>
                    ) : (
                      <span className="text-indigo-400 font-medium">点击进入登录</span>
                    )}
                  </p>
                </div>
              </Link>
            </div>
          )}
        </div>
      </aside>

      {/* Main */}
      <main className="relative flex flex-1 flex-col min-w-0 z-10">
        {/* Mobile header */}
        <MobileHeader
          workspace={workspace}
          inActiveChat={!!inActiveChat}
          provider={selectedProvider}
          model={selectedModel}
          quota={quota}
          isAuthenticated={isAuthenticated}
          onMenu={toggleSidebar}
          onCreate={createNewItem}
        />

        {children}
      </main>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  )
}

const MobileHeader = memo(function MobileHeader({
  workspace,
  inActiveChat,
  provider,
  model,
  quota,
  isAuthenticated,
  onMenu,
  onCreate
}) {
  const isDeepseek = provider?.id === 'deepseek'
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-white/8 bg-slate-950/70 px-3 backdrop-blur-2xl pl-safe pr-safe lg:hidden">
      <button
        onClick={onMenu}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-300 hover:bg-white/5 active:scale-95 tap-transparent"
        aria-label="打开菜单"
      >
        <Menu size={18} />
      </button>

      {inActiveChat && model ? (
        <div className="flex flex-1 min-w-0 items-center gap-2">
          <div
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10',
              isDeepseek ? 'bg-white' : ''
            )}
            style={!isDeepseek ? { backgroundColor: `${provider?.color}25` } : undefined}
          >
            {provider?.logo ? (
              <img src={provider.logo} alt="" className="h-4 w-4 object-contain" />
            ) : (
              <span className="text-[10px] font-bold" style={{ color: provider?.color }}>
                {provider?.initial}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-white leading-tight">
              {model?.name}
            </p>
            {isAuthenticated && quota?.tokenBalance != null && (
              <p className="flex items-center gap-1 text-[9px] text-slate-500 leading-tight">
                <Coins size={8} className="text-amber-300" />
                {formatNumber(quota.tokenBalance)} 算力点
              </p>
            )}
          </div>
        </div>
      ) : (
        <Link
          href={workspace === 'chat' ? '/chat' : '/image'}
          className="flex flex-1 items-center justify-center gap-2 tap-transparent"
        >
          <Sparkles size={15} className="text-fuchsia-300" />
          <span className="text-sm font-bold tracking-tight text-white">万模 AI</span>
        </Link>
      )}

      <button
        onClick={onCreate}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-fuchsia-500/20 text-white active:scale-95 tap-transparent"
        aria-label={workspace === 'chat' ? '新对话' : '新任务'}
      >
        <Plus size={18} />
      </button>
    </header>
  )
})

function WorkspaceTab({ icon: Icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-1 min-h-[36px] items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold transition-all duration-300 tap-transparent active:scale-95 group',
        active
          ? 'bg-gradient-to-r from-indigo-500/80 via-purple-500/80 to-pink-500/80 text-white shadow-[0_0_15px_rgba(168,85,247,0.3)] border border-white/20'
          : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent'
      )}
    >
      <Icon size={14} className={cn(active ? 'text-white' : 'text-slate-400 group-hover:text-slate-200 group-hover:scale-110 transition-all duration-200')} />
      <span>{label}</span>
    </button>
  )
}

function RailButton({ icon: Icon, label, active, onClick }) {
  return (
    <Tip label={label} placement="right">
      <button
        onClick={onClick}
        className={cn(
          'flex h-10 w-10 mx-auto items-center justify-center rounded-xl transition-all duration-300 tap-transparent active:scale-95 group',
          active
            ? 'bg-gradient-to-r from-indigo-500/80 via-purple-500/80 to-pink-500/80 text-white border border-white/20 shadow-[0_0_15px_rgba(168,85,247,0.3)]'
            : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200 border border-transparent'
        )}
      >
        <Icon size={16} className={cn(active ? 'text-white' : 'text-slate-400 group-hover:text-slate-200 group-hover:scale-115 transition-all duration-200')} />
      </button>
    </Tip>
  )
}

function Tip({ label, placement = 'right', children }) {
  return (
    <span className="group/tip relative inline-block">
      {children}
      <span
        className={cn(
          'pointer-events-none absolute z-50 whitespace-pre rounded-md border border-white/10 bg-slate-950/95 px-2 py-1 text-[11px] font-medium text-slate-100 shadow-lg backdrop-blur-sm opacity-0 transition-opacity group-hover/tip:opacity-100 hidden lg:block',
          placement === 'right' && 'left-full top-1/2 ml-2 -translate-y-1/2',
          placement === 'left' && 'right-full top-1/2 mr-2 -translate-y-1/2',
          placement === 'top' && 'bottom-full left-1/2 mb-2 -translate-x-1/2',
          placement === 'bottom' && 'top-full left-1/2 mt-2 -translate-x-1/2'
        )}
      >
        {label}
      </span>
    </span>
  )
}

const ChatList = memo(function ChatList({ conversations, activeId, onSelect, onDelete }) {
  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center opacity-30">
        <MessageSquare size={24} strokeWidth={1.5} className="text-slate-400 animate-pulse" />
        <p className="mt-2 text-xs font-medium">暂无对话历史</p>
      </div>
    )
  }
  return (
    <>
      <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500/80">
        最近对话
      </p>
      {conversations.map((conv) => (
        <div
          key={conv.id}
          onClick={() => onSelect(conv.id)}
          className={cn(
            'group relative flex min-h-[44px] cursor-pointer items-center justify-between rounded-xl px-3 py-2 transition-all duration-300 tap-transparent active:scale-[0.98]',
            activeId === conv.id
              ? 'bg-indigo-500/10 text-indigo-200 border border-indigo-500/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_12px_rgba(99,102,241,0.15)]'
              : 'border border-transparent hover:bg-white/[0.04] hover:border-white/5 text-slate-400 hover:text-slate-200'
          )}
        >
          {/* Active side indicator */}
          {activeId === conv.id && (
            <div className="absolute left-0 top-1/4 bottom-1/4 w-1 rounded-r bg-gradient-to-b from-indigo-500 to-pink-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
          )}
          <div className="flex min-w-0 items-center gap-2">
            <MessageSquare
              size={13}
              className={cn(activeId === conv.id ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-400 transition-colors')}
            />
            <span className="truncate text-xs font-medium">{conv.title}</span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete(conv.id)
            }}
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-all hover:bg-rose-500/20 hover:text-rose-300 lg:h-6 lg:w-6 lg:opacity-0 lg:group-hover:opacity-100 tap-transparent"
            aria-label="删除"
          >
            <Trash2 size={11} />
          </button>
        </div>
      ))}
    </>
  )
})

const ImageList = memo(function ImageList({ tasks, activeTaskId, onSelect, onDelete }) {
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center opacity-30">
        <ImageIcon size={24} strokeWidth={1.5} className="text-slate-400 animate-pulse" />
        <p className="mt-2 text-xs font-medium">还没有图片任务</p>
      </div>
    )
  }
  return (
    <>
      <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500/80">
        最近任务
      </p>
      {tasks.slice(0, 50).map((task) => {
        const isRunning = task.status === 'running'
        const statusColor =
          task.status === 'done'
            ? 'text-emerald-400'
            : task.status === 'failed'
              ? 'text-rose-400'
              : 'text-indigo-400'
        return (
          <div
            key={task.id}
            onClick={() => onSelect(task.id)}
            className={cn(
              'group relative flex min-h-[48px] cursor-pointer items-start gap-2 rounded-xl border transition-all duration-300 px-3 py-2 tap-transparent active:scale-[0.98]',
              activeTaskId === task.id
                ? 'bg-fuchsia-500/10 text-fuchsia-100 border-fuchsia-500/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_12px_rgba(236,72,153,0.15)]'
                : 'border-transparent hover:bg-white/[0.04] hover:border-white/5 text-slate-400 hover:text-slate-200'
            )}
          >
            {/* Active side indicator */}
            {activeTaskId === task.id && (
              <div className="absolute left-0 top-1/4 bottom-1/4 w-1 rounded-r bg-gradient-to-b from-fuchsia-500 to-purple-500 shadow-[0_0_8px_rgba(236,72,153,0.8)]" />
            )}
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/5 border border-white/5">
              <ImageIcon size={12} className={cn(statusColor, isRunning && 'animate-spin')} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-slate-200">
                {task.prompt || '未命名任务'}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {formatRelativeTime(task.createdAt)} ·{' '}
                <span className={statusColor}>
                  {task.status === 'done' ? '完成' : task.status === 'failed' ? '失败' : '生成中'}
                </span>
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete(task.id)
              }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 transition-all hover:bg-rose-500/20 hover:text-rose-300 lg:h-6 lg:w-6 lg:opacity-0 lg:group-hover:opacity-100 tap-transparent"
              aria-label="删除"
            >
              <Trash2 size={10} />
            </button>
          </div>
        )
      })}
    </>
  )
})
