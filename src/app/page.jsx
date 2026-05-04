'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Send, ChevronRight, AlertCircle, Paperclip, X, Image as ImageIcon } from 'lucide-react'
import { useChatStore, useModelStore, useAuthStore } from '@/store/useStore'
import Shell from '@/components/layout/Shell'
import Markdown from '@/components/chat/Markdown'
import { decorateProvider, fallbackProviders } from '@/lib/config'
import { sendMessage, generateImage, fileToBase64, fetchModels, fetchMe, fetchQuotaSummary } from '@/lib/api'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs) {
  return twMerge(clsx(inputs))
}

function isLocalConversationId(id) {
  return typeof id === 'string' && id.startsWith('conv_')
}

function isImageGenerationModel(model) {
  const text = `${model.id || ''} ${model.name || ''} ${model.remark || ''}`.toLowerCase()
  return [
    'image',
    'images',
    'gpt-image',
    'dall-e',
    'dalle',
    'imagen',
    'flux',
    'stable-diffusion',
    'stable diffusion',
    'midjourney',
    'cogview',
    'seedream',
    'jimeng',
    'qwen-image',
    'wanx',
    '文生图',
    '生图',
    '绘图',
    '图片'
  ].some((keyword) => text.includes(keyword))
}

export default function Page() {
  const router = useRouter()
  const { 
    activeConversationId, 
    conversations, 
    history, 
    addConversation, 
    addMessage, 
    updateMessage,
    replaceConversationId,
    setActiveConversationId 
  } = useChatStore()
  
  const { selectedProvider, selectedModel, setSelectedProvider, setSelectedModel } = useModelStore()
  const { isAuthenticated, setAuthLoading, setSession, clearSession } = useAuthStore()
  
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [pendingImages, setPendingImages] = useState([])
  const [providers, setProviders] = useState(fallbackProviders)
  const [fetchedModels, setFetchedModels] = useState([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [modelsError, setModelsError] = useState('')
  const [imagePrompt, setImagePrompt] = useState('')
  const [imageModel, setImageModel] = useState(null)
  const [generatedImages, setGeneratedImages] = useState([])
  const [imageError, setImageError] = useState('')
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  
  const chatEndRef = useRef(null)
  const fileInputRef = useRef(null)

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history, activeConversationId])

  useEffect(() => {
    let cancelled = false
    setAuthLoading(true)
    Promise.all([fetchMe(), fetchQuotaSummary()])
      .then(([user, quota]) => {
        if (!cancelled) setSession({ user, quota })
      })
      .catch(() => {
        if (!cancelled) clearSession()
      })
      .finally(() => {
        if (!cancelled) setAuthLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [clearSession, setAuthLoading, setSession])

  useEffect(() => {
    let cancelled = false
    setLoadingModels(true)
    fetchModels()
      .then((groups) => {
        if (cancelled) return
        const decorated = groups.map(decorateProvider).filter(provider => provider.models.length > 0)
        setProviders(decorated.length > 0 ? decorated : fallbackProviders)
        setModelsError('')
      })
      .catch((err) => {
        if (cancelled) return
        setModelsError(err.message || '模型列表加载失败')
        setProviders(fallbackProviders)
      })
      .finally(() => {
        if (!cancelled) setLoadingModels(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

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
  }, [activeConversationId, conversations, providers, setSelectedProvider, setSelectedModel])

  const handleSelectProvider = async (provider) => {
    setSelectedProvider(provider)
    setFetchedModels(provider.models || [])
  }

  const handleStartChat = (model) => {
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
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
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    if (!selectedModel?.id || !activeConversationId) return

    const text = input.trim()
    const convId = activeConversationId
    const modelId = selectedModel.id

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

      let streamedContent = ''
      const result = await sendMessage({
        conversationId: isLocalConversationId(convId) ? undefined : convId,
        modelId,
        messages: reqMessages,
        onDelta: (delta) => {
          streamedContent += delta
          updateMessage(convId, assistantMsgId, { content: streamedContent, loading: false })
        }
      })
      const content = result.content
      updateMessage(convId, assistantMsgId, { content, loading: false })
      const serverConversationId = result.meta?.conversationId || result.done?.conversationId
      if (serverConversationId && serverConversationId !== convId) {
        replaceConversationId(convId, serverConversationId, {
          title: text.slice(0, 24) || '新对话',
          updatedAt: Date.now()
        })
      }
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

  const imageModels = useMemo(() => (
    providers
      .flatMap((provider) => provider.models.map((model) => ({ ...model, provider })))
      .filter((model) => isImageGenerationModel(model))
  ), [providers])

  useEffect(() => {
    if (!imageModel && imageModels.length > 0) setImageModel(imageModels[0])
  }, [imageModel, imageModels])

  const handleGenerateImage = async () => {
    if (!imagePrompt.trim() || isGeneratingImage) return
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    if (!imageModel?.id) return

    setIsGeneratingImage(true)
    setImageError('')
    try {
      const result = await generateImage({
        modelId: imageModel.id,
        prompt: imagePrompt.trim()
      })
      setGeneratedImages((prev) => [
        {
          id: result.requestId || `image_${Date.now()}`,
          prompt: imagePrompt.trim(),
          modelName: imageModel.name,
          images: result.images || [],
          content: result.content || '图片已生成',
          createdAt: Date.now()
        },
        ...prev
      ])
      setImagePrompt('')
    } catch (err) {
      setImageError(err.message || '图片生成失败')
    } finally {
      setIsGeneratingImage(false)
    }
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
                <p className="mt-4 text-slate-400">选择对话模型，或者使用专门的文生图工作区。</p>
                {!isAuthenticated && (
                  <div className="mt-5 inline-flex flex-wrap items-center gap-3 rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-4 py-3 text-sm text-indigo-100">
                    <span>登录后可使用模型并同步 Token 余额。</span>
                    <Link href="/login" className="rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-indigo-400">
                      微信扫码登录
                    </Link>
                  </div>
                )}
              </div>

              {!selectedProvider ? (
                <>
                  {modelsError && (
                    <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                      {modelsError}
                    </div>
                  )}

                  <section className="mb-10 rounded-2xl border border-slate-800 bg-slate-900/50 p-4 md:p-5">
                    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <ImageIcon size={18} className="text-indigo-300" />
                          <h2 className="text-lg font-bold text-white">文生图</h2>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">仅展示名称或备注中标记为图片生成能力的模型。</p>
                      </div>
                      {imageModel && (
                        <select
                          value={imageModel.id}
                          onChange={(e) => setImageModel(imageModels.find((model) => model.id === e.target.value) || null)}
                          className="h-10 rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-200 outline-none transition focus:border-indigo-500"
                        >
                          {imageModels.map((model) => (
                            <option key={model.id} value={model.id}>
                              {model.provider.name} / {model.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    {imageModels.length === 0 ? (
                      <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-8 text-center">
                        <p className="text-sm font-medium text-slate-300">暂无文生图模型</p>
                        <p className="mt-2 text-xs text-slate-500">请在后台启用图片生成模型，并在模型名称或备注中标记 image、gpt-image、dall-e、flux、文生图等关键词。</p>
                      </div>
                    ) : (
                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                          <textarea
                            value={imagePrompt}
                            onChange={(e) => setImagePrompt(e.target.value)}
                            placeholder="描述你想生成的图片..."
                            rows={5}
                            className="min-h-32 w-full resize-none bg-transparent p-2 text-sm text-white placeholder-slate-500 outline-none"
                          />
                          <div className="mt-3 flex items-center justify-between gap-3">
                            <p className="truncate text-xs text-slate-500">
                              当前模型：{imageModel?.name || '未选择'}
                            </p>
                            <button
                              onClick={handleGenerateImage}
                              disabled={isGeneratingImage || !imagePrompt.trim() || !imageModel}
                              className={cn(
                                "flex h-10 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-bold transition",
                                isGeneratingImage || !imagePrompt.trim() || !imageModel
                                  ? "bg-slate-800 text-slate-600"
                                  : "bg-indigo-600 text-white hover:bg-indigo-500 active:scale-95"
                              )}
                            >
                              <ImageIcon size={17} />
                              {isGeneratingImage ? '生成中' : '生成图片'}
                            </button>
                          </div>
                          {imageError && (
                            <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                              <AlertCircle size={15} />
                              <span>{imageError}</span>
                            </div>
                          )}
                        </div>

                        <div className="min-h-52 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                          {generatedImages.length === 0 ? (
                            <div className="flex h-full min-h-48 items-center justify-center text-center text-sm text-slate-500">
                              生成结果会显示在这里
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {generatedImages.slice(0, 3).map((item) => (
                                <div key={item.id} className="rounded-lg border border-slate-800 bg-slate-900/70 p-2">
                                  <div className="grid grid-cols-2 gap-2">
                                    {item.images.map((img, idx) => (
                                      <a key={idx} href={img} target="_blank" rel="noreferrer" className="block">
                                        <img src={img} className="aspect-square w-full rounded-md object-cover" alt="" />
                                      </a>
                                    ))}
                                  </div>
                                  <p className="mt-2 line-clamp-2 text-xs text-slate-400">{item.prompt}</p>
                                  <p className="mt-1 truncate text-[10px] text-slate-600">{item.modelName}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </section>

                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white">对话模型</h2>
                    <span className="text-xs text-slate-500">选择供应商后开始文字对答</span>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {providers.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleSelectProvider(p)}
                      disabled={loadingModels}
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
                </>
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
                    ) : fetchedModels.length === 0 ? (
                      <div className="col-span-full rounded-xl border border-slate-800 bg-slate-900/50 px-5 py-12 text-center">
                        <p className="text-sm font-medium text-slate-300">暂无可用模型</p>
                        <p className="mt-2 text-xs text-slate-500">请在后台启用模型后再开始对话。</p>
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
                              <a key={idx} href={img} target="_blank" rel="noreferrer" className="block">
                                <img src={img} className="max-h-80 rounded-lg border border-white/10 object-cover" alt="" />
                              </a>
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
