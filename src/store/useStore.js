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

      replaceConversationId: (oldId, newId, updates = {}) => set((state) => {
        if (!oldId || !newId || oldId === newId) return state
        const oldMessages = state.history[oldId] || []
        const { [oldId]: _, ...remainingHistory } = state.history
        return {
          conversations: state.conversations.map((conversation) => (
            conversation.id === oldId ? { ...conversation, ...updates, id: newId } : conversation
          )),
          history: {
            ...remainingHistory,
            [newId]: oldMessages
          },
          activeConversationId: state.activeConversationId === oldId ? newId : state.activeConversationId
        }
      }),
      
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

export const useUIStore = create(
  persist(
    (set) => ({
      // mobile overlay open/close
      isSidebarOpen: true,
      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),

      // desktop rail collapse
      isSidebarCollapsed: false,
      toggleSidebarCollapsed: () =>
        set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ isSidebarCollapsed: collapsed })
    }),
    {
      name: 'chatty-ui',
      partialize: (state) => ({ isSidebarCollapsed: state.isSidebarCollapsed })
    }
  )
)

export const useModelStore = create((set) => ({
  selectedProvider: null,
  selectedModel: null,
  setSelectedProvider: (provider) => set({ selectedProvider: provider }),
  setSelectedModel: (model) => set({ selectedModel: model }),
}))

export const useAuthStore = create((set) => ({
  user: null,
  quota: null,
  isLoading: false,
  isAuthenticated: false,
  setAuthLoading: (isLoading) => set({ isLoading }),
  setSession: ({ user, quota }) => set({
    user: user || null,
    quota: quota || null,
    isAuthenticated: Boolean(user),
    isLoading: false
  }),
  clearSession: () => set({
    user: null,
    quota: null,
    isAuthenticated: false,
    isLoading: false
  })
}))
