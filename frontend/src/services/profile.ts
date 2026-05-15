import { supabase } from './supabase'

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
  const row = {
    id: userId,
    username,
    level,
    rating,
    best_rating: rating,
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
