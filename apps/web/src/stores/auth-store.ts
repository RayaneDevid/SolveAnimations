import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Profile } from '@/types/database'
import { supabase } from '@/lib/supabase/client'

interface AuthStore {
  user: Profile | null
  isLoading: boolean
  setUser: (user: Profile) => void
  clearUser: () => void
  setLoading: (loading: boolean) => void
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      isLoading: true,
      setUser: (user) => set({ user, isLoading: false }),
      clearUser: () => set({ user: null, isLoading: false }),
      setLoading: (isLoading) => set({ isLoading }),
      logout: async () => {
        await supabase.auth.signOut()
        set({ user: null, isLoading: false })
      },
    }),
    {
      name: 'solve-auth',
      // Only persist the user profile, not the loading state
      partialize: (state) => ({ user: state.user }),
      // When hydrating from storage, if a user is cached start with isLoading: false
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isLoading = !state.user
        }
      },
    },
  ),
)
