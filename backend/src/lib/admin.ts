import { supabase } from './supabase.js'

export async function getUserPrivilegeLevel(userId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from('user_privileges')
    .select('privilege_level')
    .eq('user_id', userId)
    .order('privilege_level', { ascending: false })
    .limit(1)

  if (error) {
    throw new Error('Failed to load user privileges')
  }

  if (!Array.isArray(data) || data.length === 0) {
    return null
  }

  const privilegeLevel = Number(data[0]?.privilege_level)
  return Number.isFinite(privilegeLevel) ? privilegeLevel : null
}

export async function isAdminUser(userId: string): Promise<boolean> {
  const privilegeLevel = await getUserPrivilegeLevel(userId)
  return privilegeLevel === 1 || privilegeLevel === 2
}