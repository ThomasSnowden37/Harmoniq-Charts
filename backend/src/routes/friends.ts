import { supabase } from '../lib/supabase.js'

/**
 * Check if two users are friends (have an accepted friend request)
 */
export async function isFriend(userId1: string, userId2: string): Promise<boolean> {
  const { data } = await supabase
    .from('friend_requests')
    .select('id')
    .eq('status', 'accepted')
    .or(`and(requester_id.eq.${userId1},addressee_id.eq.${userId2}),and(requester_id.eq.${userId2},addressee_id.eq.${userId1})`)
    .limit(1)
  return (data?.length ?? 0) > 0
}
