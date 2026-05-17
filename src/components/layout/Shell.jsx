'use client'

import { useState, useEffect } from 'react'
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

  const switchWorkspace = (target) => {
    if (target === 'chat' && pathname !== '/chat') router.push('/chat')
    if (target === 'image' && pathname !== '/image') router.push('/image')
    if (isMobile) setSidebarOpen(false)
  }

  const createNewItem = () => {
    if (workspace === 'chat') {
      setActiveConversationId(null)
      setSelectedModel(null)
      setSelectedProvider(null)
    } else {
      setActiveTaskId(null)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    if (isMobile) setSidebarOpen(false)
  }

  const handleSelectConversation = (id) => {
    setActiveConversationId(id)
    if (isMobile) setSidebarOpen(false)
  }

  const handleSelectTask = (id) => {
    setActiveTaskId(id)
    if (isMobile) setSidebarOpen(false)
  }

  const handleDeleteTask = async (id) => {
    try {
      await deleteTask(id)
      removeTaskFromIndex(id)
    } catch (err) {
      console.warn('[shell] delete task failed', err)
    }
  }

  return (
    <div className="relative flex h-screen-dvh w-full overflow-hidden text-slate-50">
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
          'border-r border-white/8 bg-slate-950/75 backdrop-blur-2xl pl-safe',
          collapsed ? 'w-16' : 'w-[84vw] max-w-[300px] lg:w-72',
          !isSidebarOpen && '-translate-x-full lg:hidden'
        )}
      >
        <div className="flex h-full flex-col p-3 pt-safe">
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
              <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-indigo-500 to-fuchsia-500">
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles className="text-white" size={18} />
                </div>
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold tracking-tight text-slate-100">
                    万模 AI
                  </p>
                  <p className="truncate text-[10px] text-slate-500">多模型智能工作台</p>
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
            <div className="mb-3 flex rounded-xl border border-white/8 bg-white/[0.04] p-1">
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

          {/* New button */}
          {collapsed ? (
            <Tip label={workspace === 'chat' ? '开启新对话' : '回到生成入口'} placement="right">
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
              className="mb-4 flex min-h-[44px] items-center gap-3 rounded-xl border border-white/10 bg-gradient-to-br from-indigo-500/15 to-purple-500/10 px-4 py-2.5 text-sm font-medium text-slate-100 transition-all hover:from-indigo-500/25 hover:to-purple-500/20 active:scale-[0.98] tap-transparent"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-400 to-fuchsia-400">
                <Plus size={14} className="text-white" />
              </div>
              <span>{workspace === 'chat' ? '开启新对话' : '回到生成入口'}</span>
            </button>
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
                        )} Token`
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
            <div className="mt-auto space-y-1 border-t border-white/5 pt-3 pb-safe">
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="flex w-full min-h-[44px] items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200 tap-transparent"
              >
                <Settings size={16} />
                <span>设置</span>
              </button>
              <Link
                href={isAuthenticated ? '/profile' : '/login'}
                className="flex min-h-[52px] items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5 transition-colors hover:bg-white/[0.06] tap-transparent"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-400 to-fuchsia-400">
                  <User size={15} className="text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-slate-100">
                    {isAuthLoading && !isAuthenticated
                      ? '同步登录中'
                      : isAuthenticated
                        ? user?.displayName || '微信用户'
                        : '未登录'}
                  </p>
                  <p className="flex items-center gap-1 truncate text-[10px] text-slate-400">
                    {isAuthLoading && !isAuthenticated ? (
                      '正在读取本地会话'
                    ) : isAuthenticated ? (
                      <>
                        <Coins size={9} />
                        {formatNumber(quota?.tokenBalance || 0)} Token
                      </>
                    ) : (
                      '点击进入登录'
                    )}
                  </p>
                </div>
              </Link>
            </div>
          )}
        </div>
      </aside>

      {/* Main */}
      <main className="relative flex flex-1 flex-col min-w-0">
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

function MobileHeader({
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
                {formatNumber(quota.tokenBalance)} Token
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
}

function WorkspaceTab({ icon: Icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-1 min-h-[36px] items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-all tap-transparent',
        active
          ? 'bg-gradient-to-br from-indigo-500/60 to-purple-500/50 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] border border-white/15'
          : 'text-slate-400 hover:text-slate-200 border border-transparent'
      )}
    >
      <Icon size={14} />
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
          'flex h-10 w-10 mx-auto items-center justify-center rounded-xl transition-all tap-transparent',
          active
            ? 'bg-gradient-to-br from-indigo-500/60 to-purple-500/50 text-white border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]'
            : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent'
        )}
      >
        <Icon size={16} />
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

function ChatList({ conversations, activeId, onSelect, onDelete }) {
  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center opacity-40">
        <MessageSquare size={26} strokeWidth={1.5} />
        <p className="mt-2 text-xs">暂无对话历史</p>
      </div>
    )
  }
  return (
    <>
      <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
        最近对话
      </p>
      {conversations.map((conv) => (
        <div
          key={conv.id}
          onClick={() => onSelect(conv.id)}
          className={cn(
            'group relative flex min-h-[44px] cursor-pointer items-center justify-between rounded-xl px-3 py-2 transition-colors tap-transparent',
            activeId === conv.id
              ? 'bg-indigo-500/15 text-indigo-100 border border-indigo-400/25'
              : 'border border-transparent hover:bg-white/5 text-slate-300'
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            <MessageSquare
              size={13}
              className={cn(activeId === conv.id ? 'text-indigo-400' : 'text-slate-500')}
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
}

function ImageList({ tasks, onSelect, onDelete }) {
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center opacity-40">
        <ImageIcon size={26} strokeWidth={1.5} />
        <p className="mt-2 text-xs">还没有图片任务</p>
      </div>
    )
  }
  return (
    <>
      <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
        最近任务
      </p>
      {tasks.slice(0, 50).map((task) => {
        const statusColor =
          task.status === 'done'
            ? 'text-emerald-300'
            : task.status === 'failed'
              ? 'text-rose-300'
              : 'text-indigo-300'
        return (
          <div
            key={task.id}
            onClick={() => onSelect(task.id)}
            className="group relative flex min-h-[48px] cursor-pointer items-start gap-2 rounded-xl border border-transparent px-3 py-2 transition-colors hover:bg-white/5 tap-transparent"
          >
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/5">
              <ImageIcon size={12} className={statusColor} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-slate-200">
                {task.prompt || '未命名任务'}
              </p>
              <p className="text-[10px] text-slate-500">
                {formatRelativeTime(task.createdAt)} ·{' '}
                {task.status === 'done' ? '完成' : task.status === 'failed' ? '失败' : '生成中'}
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
}
