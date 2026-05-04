import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useChatStore = create(
  persist(
    (set, get) => ({
      conversations: [],
      activeConversationId: null,
      history: {}, // convId -> messages[]

      // Actions
      addConversation: (conv) => set((state) => ({
        conversations: [conv, ...state.conversations]
      })),
      
      deleteConversation: (id) => set((state) => {
        const { [id]: _, ...remainingHistory } = state.history
        return {
          conversations: state.conversations.filter((c) => c.id !== id),
          history: remainingHistory,
          activeConversationId: state.activeConversationId === id ? null : state.activeConversationId
        }
      }),

      setActiveConversationId: (id) => set({ activeConversationId: id }),

      addMessage: (convId, message) => set((state) => {
        const convMessages = state.history[convId] || []
        const newHistory = {
          ...state.history,
          [convId]: [...convMessages, message]
        }
        
        // Update conversation's updatedAt and messageCount
        const newConversations = state.conversations.map(c => 
          c.id === convId ? { ...c, updatedAt: Date.now(), messageCount: (c.messageCount || 0) + 1 } : c
        )

        return {
          history: newHistory,
          conversations: newConversations
        }
      }),

      updateMessage: (convId, msgId, updates) => set((state) => {
        const convMessages = state.history[convId] || []
        const newHistory = {
          ...state.history,
          [convId]: convMessages.map(m => m.id === msgId ? { ...m, ...updates } : m)
        }
        return { history: newHistory }
      }),

      clearHistory: (convId) => set((state) => {
        const newHistory = { ...state.history }
        delete newHistory[convId]
        return { history: newHistory }
      })
    }),
    {
      name: 'chatty-storage',
    }
  )
)

export const useUIStore = create((set) => ({
  isSidebarOpen: true,
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
}))

export const useModelStore = create((set) => ({
  selectedProvider: null,
  selectedModel: null,
  setSelectedProvider: (provider) => set({ selectedProvider: provider }),
  setSelectedModel: (model) => set({ selectedModel: model }),
}))

export const useConfigStore = create(
  persist(
    (set) => ({
      customApiKeys: {}, // providerId -> apiKey
      setCustomApiKey: (providerId, key) => set((state) => ({
        customApiKeys: { ...state.customApiKeys, [providerId]: key }
      })),
    }),
    {
      name: 'chatty-config',
    }
  )
)
