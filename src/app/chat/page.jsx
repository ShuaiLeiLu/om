'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useChatStore, useModelStore, useAuthStore } from '@/store/useStore'
import Shell from '@/components/layout/Shell'
import ChatHeader from '@/components/chat/ChatHeader'
import ChatComposer from '@/components/chat/ChatComposer'
import MessageBubble from '@/components/chat/MessageBubble'
import ChatLanding from '@/components/chat/ChatLanding'
import StarterPrompts from '@/components/chat/StarterPrompts'
import { decorateProvider } from '@/lib/config'
import { isImageGenerationModel } from '@/lib/model-badges'
import { sendMessage, fileToBase64, fetchModels, fetchMe, fetchQuotaSummary } from '@/lib/api'
import { ToastProvider, useToast } from '@/components/ui/toast'

function isLocalConversationId(id) {
  return typeof id === 'string' && id.startsWith('conv_')
}

function ChatPageInner() {
  const router = useRouter()
  const {
    activeConversationId,
    conversations,
    history,
    addConversation,
    addMessage,
    updateMessage,
    replaceConversationId,
    setActiveConversationId,
    clearHistory
  } = useChatStore()
  const { selectedProvider, selectedModel, setSelectedProvider, setSelectedModel } = useModelStore()
  const { isAuthenticated, user, quota, setAuthLoading, setSession, clearSession } = useAuthStore()
  const { toast } = useToast()

  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [pendingImages, setPendingImages] = useState([])
  const [providers, setProviders] = useState([])
  const [loadingModels, setLoadingModels] = useState(true)
  const [modelsError, setModelsError] = useState('')

  const chatEndRef = useRef(null)

  // auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history, activeConversationId])

  // session
  useEffect(() => {
    let cancelled = false
    setAuthLoading(true)
    fetchMe()
      .then(async (user) => {
        if (cancelled) return
        setSession({ user, quota: null })
        try {
          const quota = await fetchQuotaSummary()
          if (!cancelled) setSession({ user, quota })
        } catch (err) {
          console.warn('[chat] quota refresh failed', err)
        }
      })
      .catch(() => !cancelled && clearSession())
      .finally(() => !cancelled && setAuthLoading(false))
    return () => {
      cancelled = true
    }
  }, [setAuthLoading, setSession, clearSession])

  // models
  const loadModels = useCallback(() => {
    let cancelled = false
    setLoadingModels(true)
    setModelsError('')
    fetchModels()
      .then((groups) => {
        if (cancelled) return
        const decorated = groups
          .map(decorateProvider)
          .map((provider) => ({
            ...provider,
            models: (provider.models || []).filter((model) => !isImageGenerationModel(model)).slice(0, 1)
          }))
          .filter((p) => p.models.length > 0)
        setProviders(decorated)
      })
      .catch((err) => {
        if (cancelled) return
        setModelsError(err.message || '模型列表加载失败')
        setProviders([])
      })
      .finally(() => !cancelled && setLoadingModels(false))
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const cleanup = loadModels()
    return cleanup
  }, [loadModels])

  // restore provider/model when switching conversations
  useEffect(() => {
    if (!activeConversationId) return
    const conv = conversations.find((c) => c.id === activeConversationId)
    if (!conv) return
    const provider = providers.find((p) => p.id === conv.providerId)
    const model =
      provider?.models?.find((m) => m.id === conv.modelId) || {
        id: conv.modelId,
        name: conv.modelName
      }
    setSelectedProvider(provider)
    setSelectedModel(model)
  }, [activeConversationId, conversations, providers, setSelectedProvider, setSelectedModel])

  const handleSelectProvider = (provider) => {
    if (!isAuthenticated) {
      router.push('/login?next=/chat')
      return
    }
    const model = provider?.models?.[0]
    if (!model) return
    setSelectedProvider(provider)
    setSelectedModel(model)
    const convId = `conv_${Date.now()}`
    addConversation({
      id: convId,
      providerId: provider.id,
      modelId: model.id,
      modelName: model.name,
      title: '新对话',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messageCount: 0
    })
    setActiveConversationId(convId)
  }

  const handleSend = async (overrideText) => {
    const text = (typeof overrideText === 'string' ? overrideText : input).trim()
    if (!text && pendingImages.length === 0) return
    if (isLoading) return
    if (!isAuthenticated) {
      router.push('/login?next=/chat')
      return
    }
    if (!selectedModel?.id || !activeConversationId) return

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
      const currentHistory = history[convId] || []
      const reqMessages = [...currentHistory, userMsg].map((m) => ({
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
          updateMessage(convId, assistantMsgId, {
            content: streamedContent,
            loading: false
          })
        }
      })
      updateMessage(convId, assistantMsgId, { content: result.content, loading: false })
      const serverConvId = result.meta?.conversationId || result.done?.conversationId
      if (serverConvId && serverConvId !== convId) {
        replaceConversationId(convId, serverConvId, {
          title: text.slice(0, 24) || '新对话',
          updatedAt: Date.now()
        })
      }
    } catch (err) {
      updateMessage(convId, assistantMsgId, {
        error: err.message || '请求失败',
        loading: false
      })
      toast({ variant: 'error', title: '对话失败', description: err.message || '请求失败' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddImages = async (files) => {
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue
      try {
        const base64 = await fileToBase64(file)
        setPendingImages((prev) => [...prev, base64])
      } catch (err) {
        console.error(err)
      }
    }
  }

  const handleClearHistory = () => {
    if (!activeConversationId) return
    if (!confirm('清空当前对话的所有消息？')) return
    clearHistory(activeConversationId)
  }

  const handleRegenerate = async () => {
    const messages = history[activeConversationId] || []
    let lastUser = null
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        lastUser = messages[i]
        break
      }
    }
    if (!lastUser) return
    setInput('')
    await handleSend(lastUser.content)
  }

  const activeMessages = history[activeConversationId] || []
  const canRegenerate = activeMessages.some((m) => m.role === 'user')

  return (
    <Shell workspace="chat">
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
        {!activeConversationId ? (
          /* ====== Landing ====== */
          <div className="flex-1 overflow-y-auto scrollbar-thin pl-safe pr-safe">
            <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 md:px-10 md:py-14">
              <ChatLanding
                providers={providers}
                loadingModels={loadingModels}
                modelsError={modelsError}
                isAuthenticated={isAuthenticated}
                user={user}
                onSelectProvider={handleSelectProvider}
                onRetry={loadModels}
              />
            </div>
          </div>
        ) : (
          /* ====== Chat ====== */
          <>
            <ChatHeader
              provider={selectedProvider}
              model={selectedModel}
              tokenBalance={quota?.tokenBalance}
              isStreaming={isLoading}
              onChangeModel={() => {
                setActiveConversationId(null)
                setSelectedProvider(null)
                setSelectedModel(null)
              }}
              onClearHistory={handleClearHistory}
              onRegenerate={handleRegenerate}
              canRegenerate={canRegenerate}
            />

            <div className="flex-1 overflow-y-auto scrollbar-thin pl-safe pr-safe">
              {activeMessages.length === 0 ? (
                <div className="flex min-h-full items-center justify-center px-3 py-8 sm:px-4 sm:py-10">
                  <StarterPrompts
                    modelName={selectedModel?.name}
                    providerColor={selectedProvider?.color}
                    providerLogo={selectedProvider?.logo}
                    providerInitial={selectedProvider?.initial}
                    onPick={(p) => handleSend(p)}
                  />
                </div>
              ) : (
                <div className="mx-auto max-w-3xl space-y-4 px-3 py-4 sm:space-y-5 sm:px-4 sm:py-6 md:px-6">
                  {activeMessages.map((msg, idx) => {
                    const isLastAssistant =
                      msg.role === 'assistant' && idx === activeMessages.length - 1
                    return (
                      <MessageBubble
                        key={msg.id}
                        message={msg}
                        provider={selectedProvider}
                        model={selectedModel}
                        onRetry={
                          isLastAssistant && !msg.loading
                            ? () => handleRegenerate()
                            : undefined
                        }
                      />
                    )
                  })}
                  <div ref={chatEndRef} className="h-2" />
                </div>
              )}
            </div>

            <ChatComposer
              value={input}
              onChange={setInput}
              onSend={() => handleSend()}
              isLoading={isLoading}
              pendingImages={pendingImages}
              onAddImages={handleAddImages}
              onRemoveImage={(i) => setPendingImages((prev) => prev.filter((_, idx) => idx !== i))}
              modelName={selectedModel?.name}
            />
          </>
        )}
      </div>
    </Shell>
  )
}

export default function ChatPage() {
  return (
    <ToastProvider>
      <ChatPageInner />
    </ToastProvider>
  )
}
