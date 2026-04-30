import { supabase } from './supabase.js'

export interface ActiveBan {
  id: string
  created_at: string
  end_time: string
  user_id: string
}

export async function getActiveBan(userId: string): Promise<ActiveBan | null> {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('banned_users')
    .select('id, created_at, end_time, user_id')
    .eq('user_id', userId)
    .gt('end_time', now)
    .order('end_time', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function createBan(userId: string, endTime: string): Promise<ActiveBan> {
  const { data, error } = await supabase
    .from('banned_users')
    .insert({ user_id: userId, end_time: endTime })
    .select('id, created_at, end_time, user_id')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function banUser(userId: string, options: { endTime?: string; durationMinutes?: number }): Promise<ActiveBan> {
  const now = Date.now()
  let endTime = options.endTime

  if (!endTime) {
    const minutes = options.durationMinutes ?? 0
    if (minutes <= 0) {
      throw new Error('Ban duration must be a positive number of minutes')
    }
    endTime = new Date(now + minutes * 60 * 1000).toISOString()
  }

  const parsedEndTime = new Date(endTime)
  if (Number.isNaN(parsedEndTime.getTime()) || parsedEndTime.getTime() <= now) {
    throw new Error('Ban end time must be in the future')
  }

  return createBan(userId, parsedEndTime.toISOString())
}

export async function unbanUser(userId: string): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('banned_users')
    .delete()
    .eq('user_id', userId)
    .gt('end_time', now)

  if (error) {
    throw new Error(error.message)
  }
}

export async function isUserBanned(userId: string): Promise<boolean> {
  return !!(await getActiveBan(userId))
}

export async function rejectIfBanned(res: any, userId: string): Promise<boolean> {
  const ban = await getActiveBan(userId)
  if (!ban) return false

  res.status(403).json({
    error: `Your account is temporarily banned until ${new Date(ban.end_time).toISOString()}`,
    ban_end_time: ban.end_time,
  })
  return true
}
