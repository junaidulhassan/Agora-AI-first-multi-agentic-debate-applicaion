import { create } from 'zustand'
import { api } from '../lib/api.js'

export const useApp = create((set, get) => ({
  config: null,
  configError: null,
  history: [],
  historyLoading: false,
  historyOpen: false,

  async loadConfig() {
    try {
      set({ config: await api.config(), configError: null })
    } catch (error) {
      set({ configError: error })
    }
  },

  async loadHistory() {
    set({ historyLoading: true })
    try {
      const { debates } = await api.listDebates()
      set({ history: debates, historyLoading: false })
    } catch {
      set({ historyLoading: false })
    }
  },

  async removeDebate(debateId) {
    await api.deleteDebate(debateId)
    set({ history: get().history.filter((item) => item.id !== debateId) })
  },

  openHistory() {
    set({ historyOpen: true })
    get().loadHistory()
  },

  closeHistory() {
    set({ historyOpen: false })
  },
}))
