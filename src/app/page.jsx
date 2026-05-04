'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Plus, Send, Check, ChevronRight, AlertCircle, RefreshCw, Paperclip, X, Image as ImageIcon } from 'lucide-react'
import { useChatStore, useUIStore, useModelStore, useConfigStore } from '@/store/useStore'
import Shell from '@/components/layout/Shell'
import Markdown from '@/components/chat/Markdown'
import { providers, apiKeys as fallbackKeys } from '@/lib/config'
import { sendMessage, fileToBase64, fetchModels } from '@/lib/api'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export default function Page() {
  const { 
    activeConversationId, 
    conversations, 
    history, 
    addConversation, 
    addMessage, 
    updateMessage,
    setActiveConversationId 
  } = useChatStore()
  
  const { selectedProvider, selectedModel, setSelectedProvider, setSelectedModel } = useModelStore()
  const { customApiKeys } = useConfigStore()
  
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [pendingImages, setPendingImages] = useState([])
  const [fetchedModels, setFetchedModels] = useState([])
  const [loadingModels, setLoadingModels] = useState(false)
  
  const chatEndRef = useRef(null)
  const fileInputRef = useRef(null)

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history, activeConversationId])

  // If a conversation is active, find its provider/model to keep state in sync
  useEffect(() => {
    if (activeConversationId) {
      const conv = conversations.find(c => c.id === activeConversationId)
      if (conv) {
        const provider = providers.find(p => p.id === conv.providerId)
        const model = provider?.models?.find(m => m.id === conv.modelId) || { id: conv.modelId, name: conv.modelName }
        setSelectedProvider(provider)
        setSelectedModel(model)
      }
    }
  }, [activeConversationId, conversations, setSelectedProvider, setSelectedModel])

  const handleSelectProvider = async (provider) => {
    setSelectedProvider(provider)
    if (provider.models?.length > 0) {
      setFetchedModels(provider.models)
    } else {
      setLoadingModels(true)
      try {
        const key = customApiKeys[provider.id] || fallbackKeys[provider.id]
        const models = await fetchModels(provider.id, provider.modelsUrl, key)
        setFetchedModels(models)
      } catch (err) {
        console.error('Failed to fetch models:', err)
      } finally {
        setLoadingModels(false)
      }
    }
  }

  const handleStartChat = (model) => {
    setSelectedModel(model)
    const convId = `conv_${Date.now()}`
    const newConv = {
      id: convId,
      providerId: selectedProvider.id,
      modelId: model.id,
      modelName: model.name,
      title: '新对话',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messageCount: 0
    }
    addConversation(newConv)
    setActiveConversationId(convId)
  }

  const handleSend = async () => {
    if ((!input.trim() && pendingImages.length === 0) || isLoading) return

    const text = input.trim()
    const convId = activeConversationId
    const providerId = selectedProvider.id
    const modelId = selectedModel.id
    const key = customApiKeys[providerId] || fallbackKeys[providerId]

    const userMsg = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: text,
      images: [...pendingImages],
      timestamp: Date.now()
    }

    const assistantMsgId = `msg_${Date.now() + 1}`
    const assistantMsg = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      loading: true,
      timestamp: Date.now()
    }

    addMessage(convId, userMsg)
    addMessage(convId, assistantMsg)
    
    setInput('')
    setPendingImages([])
    setIsLoading(true)

    try {
      // Build messages for API (including history)
      const currentHistory = history[convId] || []
      const reqMessages = [...currentHistory, userMsg].map(m => ({
        role: m.role,
        content: m.content,
        images: m.images
      }))

      const content = await sendMessage(providerId, selectedProvider.baseUrl, modelId, key, reqMessages)
      updateMessage(convId, assistantMsgId, { content, loading: false })
    } catch (err) {
      updateMessage(convId, assistantMsgId, { 
        error: err.message || '请求失败', 
        loading: false 
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || [])
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue
      try {
        const base64 = await fileToBase64(file)
        setPendingImages(prev => [...prev, base64])
      } catch (err) {
        console.error('Image upload error:', err)
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const activeMessages = history[activeConversationId] || []

  return (
    <Shell>
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
        {!activeConversationId ? (
          /* Landing View: Provider Grid */
          <div className="flex-1 overflow-y-auto p-6 md:p-10">
            <div className="mx-auto max-w-5xl">
              <div className="mb-10 text-center md:text-left">
                <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl">万模AI</h1>
                <p className="mt-4 text-slate-400">选择一个模型开始商业级的智能对话体验</p>
              </div>

              {!selectedProvider ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {providers.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleSelectProvider(p)}
                      className="group relative flex flex-col rounded-2xl border border-slate-800 bg-slate-900/50 p-6 text-left transition-all hover:border-slate-700 hover:bg-slate-800 hover:-translate-y-1"
                    >
                      <div 
                        className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl border border-white/5 shadow-inner"
                        style={{ backgroundColor: `${p.color}15` }}
                      >
                        {p.logo ? (
                          <img src={p.logo} alt={p.name} className="h-7 w-7 object-contain" />
                        ) : (
                          <span className="text-xl font-bold" style={{ color: p.color }}>{p.initial}</span>
                        )}
                      </div>
                      <h3 className="text-lg font-semibold text-white">{p.name}</h3>
                      <p className="mt-2 text-sm text-slate-500 line-clamp-2">{p.description}</p>
                      <ChevronRight size={16} className="absolute bottom-6 right-6 text-slate-700 transition-transform group-hover:translate-x-1" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setSelectedProvider(null)}
                      className="text-sm font-medium text-indigo-400 hover:text-indigo-300"
                    >
                      ← 返回
                    </button>
                    <h2 className="text-xl font-bold text-white">选择 {selectedProvider.name} 的具体模型</h2>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {loadingModels ? (
                      <div className="col-span-full py-20 text-center">
                        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-indigo-500" />
                        <p className="mt-4 text-sm text-slate-500">正在获取可用模型...</p>
                      </div>
                    ) : (
                      fetchedModels.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => handleStartChat(m)}
                          className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/50 px-5 py-4 text-left transition-all hover:border-indigo-500/50 hover:bg-slate-800"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-white">{m.name}</p>
                            <p className="mt-1 truncate text-xs text-slate-500 font-mono">{m.id}</p>
                          </div>
                          <Plus size={16} className="text-slate-600" />
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Chat View */
          <>
            {/* Chat Header */}
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-950/50 px-6 backdrop-blur-md hidden lg:flex">
              <div className="flex items-center gap-3">
                <div 
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg border border-white/5 transition-colors",
                    selectedProvider?.id === 'deepseek' ? "bg-white/90" : "bg-white/5"
                  )}
                  style={{ backgroundColor: selectedProvider?.id === 'deepseek' ? undefined : `${selectedProvider?.color}15` }}
                >
                  <span className="text-[10px] font-bold" style={{ color: selectedProvider?.id === 'deepseek' ? '#4d6bfe' : selectedProvider?.color }}>
                    {selectedProvider?.initial}
                  </span>
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white leading-tight">{selectedModel?.name}</h2>
                  <p className="text-[10px] text-slate-500 font-medium tracking-wide uppercase">{selectedProvider?.name}</p>
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              <div className="mx-auto max-w-3xl space-y-6 pb-20">
                {activeMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                     <div 
                        className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/5 shadow-xl"
                        style={{ backgroundColor: `${selectedProvider?.color}15` }}
                      >
                        {selectedProvider?.logo ? (
                          <img src={selectedProvider.logo} alt="" className="h-10 w-10 object-contain" />
                        ) : (
                          <span className="text-3xl font-bold" style={{ color: selectedProvider?.color }}>
                            {selectedProvider?.initial}
                          </span>
                        )}
                      </div>
                    <h3 className="text-lg font-bold text-white">开始与 {selectedModel?.name} 对话</h3>
                    <p className="mt-2 text-sm text-slate-500 max-w-sm">
                      你可以询问任何问题，或者上传图片进行多模态分析。
                    </p>
                  </div>
                ) : (
                  activeMessages.map((msg, i) => (
                    <div 
                      key={msg.id} 
                      className={cn(
                        "flex w-full animate-in fade-in slide-in-from-bottom-2 duration-300",
                        msg.role === 'user' ? "justify-end" : "justify-start"
                      )}
                    >
                      <div className={cn(
                        "relative max-w-[85%] md:max-w-[80%] rounded-2xl px-4 py-3 shadow-sm",
                        msg.role === 'user' 
                          ? "bg-indigo-600 text-white" 
                          : "bg-slate-900 border border-slate-800 text-slate-200"
                      )}>
                        {/* Provider label for assistant */}
                        {msg.role === 'assistant' && (
                          <div className="mb-2 flex items-center gap-2">
                            <span 
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: selectedProvider?.color }}
                            />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                              {selectedModel?.name}
                            </span>
                          </div>
                        )}

                        {/* User Images */}
                        {msg.images?.length > 0 && (
                          <div className="mb-3 flex flex-wrap gap-2">
                            {msg.images.map((img, idx) => (
                              <img key={idx} src={img} className="max-h-60 rounded-lg object-cover" alt="" />
                            ))}
                          </div>
                        )}

                        {/* Message Content */}
                        {msg.loading ? (
                          <div className="flex items-center gap-1.5 py-1">
                            <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500 [animation-delay:-0.3s]" />
                            <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500 [animation-delay:-0.15s]" />
                            <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500" />
                          </div>
                        ) : msg.error ? (
                          <div className="flex items-center gap-2 text-red-400">
                            <AlertCircle size={14} />
                            <span className="text-sm font-medium">{msg.error}</span>
                          </div>
                        ) : (
                          <Markdown content={msg.content} />
                        )}
                      </div>
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>
            </div>

            {/* Input Area */}
            <div className="shrink-0 border-t border-slate-800 bg-slate-950/50 p-4 backdrop-blur-md">
              <div className="mx-auto max-w-3xl">
                {/* Image Previews */}
                {pendingImages.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {pendingImages.map((img, i) => (
                      <div key={i} className="relative group">
                        <img src={img} className="h-20 w-20 rounded-xl object-cover border border-slate-700" alt="" />
                        <button 
                          onClick={() => setPendingImages(prev => prev.filter((_, idx) => idx !== i))}
                          className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="relative flex items-end gap-2 rounded-2xl border border-slate-700 bg-slate-900/50 p-2 shadow-2xl focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/20 transition-all">
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  >
                    <Paperclip size={20} />
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
                  
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="问点什么..."
                    className="max-h-60 flex-1 bg-transparent px-2 py-2 text-sm text-white placeholder-slate-500 outline-none resize-none"
                    rows={1}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSend()
                      }
                    }}
                    onInput={(e) => {
                      e.target.style.height = 'auto'
                      e.target.style.height = Math.min(e.target.scrollHeight, 240) + 'px'
                    }}
                  />
                  
                  <button
                    onClick={handleSend}
                    disabled={isLoading || (!input.trim() && pendingImages.length === 0)}
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all",
                      isLoading || (!input.trim() && pendingImages.length === 0)
                        ? "bg-slate-800 text-slate-600"
                        : "bg-indigo-600 text-white hover:bg-indigo-500 active:scale-95"
                    )}
                  >
                    <Send size={18} />
                  </button>
                </div>
                <p className="mt-2 text-center text-[10px] text-slate-500 font-medium">
                  AI 可能生成不准确的信息，请核实重要内容。
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </Shell>
  )
}
