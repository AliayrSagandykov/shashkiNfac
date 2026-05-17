import { supabase } from './supabase'
import { getLang } from '../i18n'
import { getTheme } from '../theme'

export type Level = 'beginner' | 'amateur' | 'experienced' | 'expert'

export const LEVEL_STARTING_RATING: Record<Level, number> = {
  beginner: 800,
  amateur: 1200,
  experienced: 1500,
  expert: 1800,
}

export interface Profile {
  id: string
  username: string | null
  level: Level
  rating: number
  best_rating: number
  games_played: number
  wins: number
  losses: number
  draws: number
  win_streak: number
  best_win_streak: number
  avatar_url: string | null
  bio: string | null
  daily_streak: number
  best_daily_streak: number
  last_active_on: string | null
  language: 'en' | 'ru'
  theme: 'dark' | 'light'
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  if (error) {
    console.error('fetchProfile error', error)
    return null
  }
  return (data as Profile | null) ?? null
}

export async function createProfile(
  userId: string,
  username: string,
  level: Level,
): Promise<Profile | null> {
  const rating = LEVEL_STARTING_RATING[level]
  const today = new Date().toISOString().slice(0, 10)
  const row = {
    id: userId,
    username,
    level,
    rating,
    best_rating: rating,
    daily_streak: 1,
    best_daily_streak: 1,
    last_active_on: today,
    language: getLang(),
    theme: getTheme(),
  }
  const { data, error } = await supabase
    .from('profiles')
    .insert(row)
    .select()
    .single()
  if (error) {
    console.error('createProfile error', error)
    return null
  }
  return data as Profile
}

export async function updateProfile(
  userId: string,
  patch: Partial<Pick<Profile, 'username' | 'bio' | 'avatar_url' | 'language' | 'theme'>>,
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select()
    .single()
  if (error) {
    console.error('updateProfile error', error)
    return null
  }
  return data as Profile
}

export async function recordGameResult(
  profile: Profile,
  result: 'win' | 'loss' | 'draw',
  newRating: number,
): Promise<Profile | null> {
  const next: Partial<Profile> = {
    rating: newRating,
    best_rating: Math.max(profile.best_rating, newRating),
    games_played: profile.games_played + 1,
    wins: profile.wins + (result === 'win' ? 1 : 0),
    losses: profile.losses + (result === 'loss' ? 1 : 0),
    draws: profile.draws + (result === 'draw' ? 1 : 0),
    win_streak: result === 'win' ? profile.win_streak + 1 : 0,
    best_win_streak: Math.max(
      profile.best_win_streak,
      result === 'win' ? profile.win_streak + 1 : profile.win_streak,
    ),
  }
  const { data, error } = await supabase
    .from('profiles')
    .update(next)
    .eq('id', profile.id)
    .select()
    .single()
  if (error) {
    console.error('recordGameResult error', error)
    return null
  }
  return data as Profile
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/**
 * Bumps the daily login streak based on the calendar gap to `last_active_on`.
 * Same day: no-op. Yesterday: +1. Older or never: reset to 1.
 */
export async function touchDailyStreak(profile: Profile): Promise<Profile> {
  const today = isoDay(new Date())
  if (profile.last_active_on === today) return profile

  const yesterday = isoDay(new Date(Date.now() - 86_400_000))
  const newStreak = profile.last_active_on === yesterday ? profile.daily_streak + 1 : 1
  const newBest = Math.max(profile.best_daily_streak, newStreak)

  const { data, error } = await supabase
    .from('profiles')
    .update({
      daily_streak: newStreak,
      best_daily_streak: newBest,
      last_active_on: today,
    })
    .eq('id', profile.id)
    .select()
    .single()
  if (error) {
    console.error('touchDailyStreak error', error)
    return profile
  }
  return data as Profile
}

export async function fetchTopProfiles(limit = 30): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('rating', { ascending: false })
    .limit(limit)
  if (error) {
    console.error('fetchTopProfiles error', error)
    return []
  }
  return (data as Profile[]) ?? []
}

export async function uploadAvatar(
  userId: string,
  file: File,
): Promise<string | null> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png'
  const path = `${userId}/avatar.${ext}`
  const { error: upErr } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, cacheControl: '3600' })
  if (upErr) {
    console.error('uploadAvatar error', upErr)
    return null
  }
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  // Bust browser cache so the new image shows immediately.
  return `${data.publicUrl}?v=${Date.now()}`
}
