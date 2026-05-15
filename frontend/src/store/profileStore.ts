import { create } from 'zustand'
import type { Profile, Level } from '../services/profile'
import {
  createProfile,
  fetchProfile,
  recordGameResult,
  updateProfile,
} from '../services/profile'

interface ProfileState {
  profile: Profile | null
  loading: boolean
  needsOnboarding: boolean
  load: (userId: string) => Promise<void>
  onboard: (userId: string, username: string, level: Level) => Promise<boolean>
  applyResult: (result: 'win' | 'loss' | 'draw', newRating: number) => Promise<void>
  update: (
    patch: Partial<Pick<Profile, 'username' | 'bio' | 'avatar_url'>>,
  ) => Promise<boolean>
  clear: () => void
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: null,
  loading: false,
  needsOnboarding: false,

  load: async (userId) => {
    if (userId.startsWith('guest-')) {
      set({ profile: null, needsOnboarding: false, loading: false })
      return
    }
    set({ loading: true })
    const p = await fetchProfile(userId)
    set({ profile: p, needsOnboarding: !p, loading: false })
  },

  onboard: async (userId, username, level) => {
    const p = await createProfile(userId, username, level)
    set({ profile: p, needsOnboarding: !p })
    return !!p
  },

  applyResult: async (result, newRating) => {
    const p = get().profile
    if (!p) return
    const updated = await recordGameResult(p, result, newRating)
    if (updated) set({ profile: updated })
  },

  update: async (patch) => {
    const p = get().profile
    if (!p) return false
    const updated = await updateProfile(p.id, patch)
    if (updated) {
      set({ profile: updated })
      return true
    }
    return false
  },

  clear: () => set({ profile: null, needsOnboarding: false }),
}))
