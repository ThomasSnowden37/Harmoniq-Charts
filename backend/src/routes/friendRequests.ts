import { Router } from 'express'
import { supabase } from '../lib/supabase.js'

/**
 * friendRequest.ts
 *
 * Description:
 * Defines the backend routes for accessing friend information
 *  
 * Author: Tristan Sze
 * 
 */

const router = Router()

// TODO: once auth is up we can use the JWT 
function getUserId(req: any): string | null {
  return req.headers['x-user-id'] as string || null
}

// Send a friend request
router.post('/', async (req, res) => {
  const requesterId = getUserId(req)
  const { addressee_id } = req.body

  if (!requesterId) return res.status(401).json({ error: 'Missing x-user-id header' })
  if (!addressee_id) return res.status(400).json({ error: 'addressee_id is required' })
  if (requesterId === addressee_id) return res.status(400).json({ error: 'Cannot send a friend request to yourself' })

  // Check if a request already exists in either direction
  const { data: existing } = await supabase
    .from('friend_requests')
    .select('*')
    .or(`and(requester_id.eq.${requesterId},addressee_id.eq.${addressee_id}),and(requester_id.eq.${addressee_id},addressee_id.eq.${requesterId})`)
    .in('status', ['pending', 'accepted', 'rejected'])
    .maybeSingle()

  if (existing) {
    if (existing.status === 'pending' || existing.status === 'accepted') {
      return res.status(409).json({ error: 'A friend request already exists between these users' })
    }

    // Rejected — reset it to pending so the user can retry
    const { data, error } = await supabase
      .from('friend_requests')
      .update({ status: 'pending', requester_id: requesterId, addressee_id })
      .eq('id', existing.id)
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json(data)
  }

  const { data, error } = await supabase
    .from('friend_requests')
    .insert({ requester_id: requesterId, addressee_id })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
})

// Get incoming friend requests (pending)
router.get('/incoming', async (req, res) => {
  const userId = getUserId(req)
  if (!userId) return res.status(401).json({ error: 'Missing x-user-id header' })

  const { data, error } = await supabase
    .from('friend_requests')
    .select('*, requester:users!requester_id(id, username)')
    .eq('addressee_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false }) // I guess if these queries become too big we could use an ORM like prisma

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// Get outgoing friend requests (pending)
router.get('/outgoing', async (req, res) => {
  const userId = getUserId(req)
  if (!userId) return res.status(401).json({ error: 'Missing x-user-id header' })

  const { data, error } = await supabase
    .from('friend_requests')
    .select('*, addressee:users!addressee_id(id, username)')
    .eq('requester_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// Get friends list (accepted requests in either direction)
router.get('/friends', async (req, res) => {
  const userId = getUserId(req)
  if (!userId) return res.status(401).json({ error: 'Missing x-user-id header' })

  const { data, error } = await supabase
    .from('friend_requests')
    .select('*, requester:users!requester_id(id, username), addressee:users!addressee_id(id, username)')
    .eq('status', 'accepted')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)

  if (error) return res.status(500).json({ error: error.message })

  // Map to a flat list of friend users
  const friends = data.map((row: any) => {
    return row.requester_id === userId ? row.addressee : row.requester
  })

  res.json(friends)
})

// Get relationship status between current user and another user
router.get('/status/:otherUserId', async (req, res) => {
  const userId = getUserId(req)
  const { otherUserId } = req.params
  if (!userId) return res.status(401).json({ error: 'Missing x-user-id header' })

  const { data, error } = await supabase
    .from('friend_requests')
    .select('*')
    .or(`and(requester_id.eq.${userId},addressee_id.eq.${otherUserId}),and(requester_id.eq.${otherUserId},addressee_id.eq.${userId})`)
    .in('status', ['pending', 'accepted'])
    .maybeSingle()

  if (error) return res.status(500).json({ error: error.message })

  if (!data) {
    return res.json({ status: 'none' })
  }

  if (data.status === 'accepted') {
    return res.json({ status: 'friends', request: data })
  }

  // It's pending, so we need to determine the direction
  if (data.requester_id === userId) {
    return res.json({ status: 'outgoing_pending', request: data })
  } else {
    return res.json({ status: 'incoming_pending', request: data })
  }
})

// Accept a friend request
router.patch('/:id/accept', async (req, res) => {
  const userId = getUserId(req)
  if (!userId) return res.status(401).json({ error: 'Missing x-user-id header' })

  const { data, error } = await supabase
    .from('friend_requests')
    .update({ status: 'accepted' })
    .eq('id', req.params.id)
    .eq('addressee_id', userId) // Only the addressee can accept
    .eq('status', 'pending')
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  if (!data) return res.status(404).json({ error: 'Request not found or not yours to accept' })
  res.json(data)
})

// Reject a friend request
router.patch('/:id/reject', async (req, res) => {
  const userId = getUserId(req)
  if (!userId) return res.status(401).json({ error: 'Missing x-user-id header' })

  const { data, error } = await supabase
    .from('friend_requests')
    .update({ status: 'rejected' })
    .eq('id', req.params.id)
    .eq('addressee_id', userId)
    .eq('status', 'pending')
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  if (!data) return res.status(404).json({ error: 'Request not found or not yours to reject' })
  res.json(data)
})

// Cancel a pending friend request (requester cancels their own)
router.delete('/:id', async (req, res) => {
  const userId = getUserId(req)
  if (!userId) return res.status(401).json({ error: 'Missing x-user-id header' })

  const { error } = await supabase
    .from('friend_requests')
    .delete()
    .eq('id', req.params.id)
    .eq('requester_id', userId)
    .eq('status', 'pending')

  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true })
})

// Unfollow / remove friend (delete an accepted request)
router.delete('/unfriend/:otherUserId', async (req, res) => {
  const userId = getUserId(req)
  const { otherUserId } = req.params
  if (!userId) return res.status(401).json({ error: 'Missing x-user-id header' })

  const { error } = await supabase
    .from('friend_requests')
    .delete()
    .eq('status', 'accepted')
    .or(`and(requester_id.eq.${userId},addressee_id.eq.${otherUserId}),and(requester_id.eq.${otherUserId},addressee_id.eq.${userId})`)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true })
})

// Get mutual friends between current user and another user
router.get('/mutual/:otherUserId', async (req, res) => {
  const userId = getUserId(req)
  const { otherUserId } = req.params
  if (!userId) return res.status(401).json({ error: 'Missing x-user-id header' })

  // Get current user's friends
  const { data: myFriends, error: myErr } = await supabase
    .from('friend_requests')
    .select('requester_id, addressee_id')
    .eq('status', 'accepted')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)

  if (myErr) return res.status(500).json({ error: myErr.message })

  const myFriendIds = new Set(
    myFriends?.map(r => r.requester_id === userId ? r.addressee_id : r.requester_id) || []
  )

  // Get other user's friends
  const { data: theirFriends, error: theirErr } = await supabase
    .from('friend_requests')
    .select('requester_id, addressee_id')
    .eq('status', 'accepted')
    .or(`requester_id.eq.${otherUserId},addressee_id.eq.${otherUserId}`)

  if (theirErr) return res.status(500).json({ error: theirErr.message })

  const theirFriendIds = new Set(
    theirFriends?.map(r => r.requester_id === otherUserId ? r.addressee_id : r.requester_id) || []
  )

  // Intersection
  const mutualIds = [...myFriendIds].filter(id => theirFriendIds.has(id))

  if (mutualIds.length === 0) return res.json([])

  // Fetch user details for mutual friends
  const { data: mutualUsers, error: usersErr } = await supabase
    .from('users')
    .select('id, username')
    .in('id', mutualIds)

  if (usersErr) return res.status(500).json({ error: usersErr.message })
  res.json(mutualUsers || [])
})

export default router
