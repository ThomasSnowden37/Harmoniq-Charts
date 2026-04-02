import { Router } from 'express'
import { supabase } from '../lib/supabase.js'
import { generateKey } from 'crypto'
import { create } from 'domain'

/**
 * feed.ts
 *
 * Description:
 * Defines the backend routes for accessing a user feed information
 *  
 * Author: Jonas Langer
 * 
 */

const router = Router()
/**
 * Get recent friend activity 
 */
router.get('/', async (req, res) => {
    const userId = req.headers['x-user-id'] as string
    console.log("USER ID:", userId)
    // get the users friends
    const { data: friends, error: friends_error } = await supabase
        .from('friend_requests')
        .select('requester_id, addressee_id') 
        .eq('status', 'accepted')
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    
    if (friends_error) {
        console.log('check')
        return res.status(500).json({ error: 'Failed to get friends' })
    }

    const friendsId =  friends.map(f =>
        f.requester_id == userId ? f.addressee_id : f.requester_id
    )

    if (friendsId.length == 0) {
        return (res.json([]))
    }

    // get the users friends likes, reviews, and listens
    const { data: likes, error: likes_error } = await supabase
        .from('likes')
        .select('song_id, user_id, created_at')
        .in('user_id', friendsId)
    const { data: reviews, error: reviews_error } = await supabase
        .from('reviews')
        .select('song_id, user_id, created_at')
        .in('user_id', friendsId)
    const { data: listened, error: listen_error } = await supabase
        .from('listened')
        .select('song_id, user_id, created_at')
        .in('user_id', friendsId)
    
    if (likes_error) {
        return res.status(500).json({ error: 'Failed to get friends likes' })
    }
    if (reviews_error) {
        return res.status(500).json({ error: 'Failed to get friends reviews' })
    }
    if (listen_error) {
        return res.status(500).json({ error: 'Failed to get friends listens' })
    }


    const Feeds = [
      ...(likes || []).map(l => ({ type: 'like', ...l })),
      ...(reviews || []).map(r => ({ type: 'review', ...r })),
      ...(listened || []).map(ls => ({ type: 'listen', ...ls }))
    ]
    if (Feeds.length === 0) {
        return res.json([])
    }

    Feeds.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

    const grouped = new Map<string, any>()
    // group actions together if they happened in the same day
    Feeds.forEach(a => {
        const dateKey = new Date(a.created_at).toISOString().slice(0, 10)
        const key = `${a.user_id}-${a.song_id}-${dateKey}`

        if (!grouped.has(key)) {    
            grouped.set(key, {
            user_id: a.user_id,
            song_id: a.song_id,
            types: [a.type],
            created_at: a.created_at
        })
        } else {
            const existing = grouped.get(key)
            if (!existing.types.includes(a.type)) existing.types.push(a.type)
        }
  })
  // sort by the 6 newest actions
    const feed = Array.from(grouped.values())
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 6)

    const songids = feed.map(f => f.song_id)
    const { data: songs, error: songsError } = await supabase
        .from('songs')
        .select(`
            id, 
            title, 
            albums ( name ), 
            song_artists ( artists ( name ) )
        `)
        .in('id', songids);

    if (songsError) {
        return res.status(500).json({ error: 'Failed to get songs' });
    }

    const { data: friend } = await supabase
        .from('users')
        .select('id, username')
        .in('id', friendsId);

    const userData = new Map(friend?.map(u => [u.id, u.username]));
    // map the feed
    const feeds = feed.map(f => {
        const songData = songs.find(s => s.id === f.song_id)
        return {
            ...f,
            friend_name: userData.get(f.user_id) || 'No Name',
            song: {
            id: songData?.id || f.song_id,
            title: songData?.title || 'No title',
            }
        }
    })

    return res.json(feeds)
})


/**
 * Get all friend activity 
 */
router.get('/all', async (req, res) => {
    const userId = req.headers['x-user-id'] as string
    console.log("USER ID:", userId)
    // get the users friends
    const { data: friends, error: friends_error } = await supabase
        .from('friend_requests')
        .select('requester_id, addressee_id') 
        .eq('status', 'accepted')
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    
    if (friends_error) {
        console.log('check')
        return res.status(500).json({ error: 'Failed to get friends' })
    }

    const friendsId =  friends.map(f =>
        f.requester_id == userId ? f.addressee_id : f.requester_id
    )

    if (friendsId.length == 0) {
        return (res.json([]))
    }

    // get the users friends likes, reviews, and listens
    const { data: likes, error: likes_error } = await supabase
        .from('likes')
        .select('song_id, user_id, created_at')
        .in('user_id', friendsId)
    const { data: reviews, error: reviews_error } = await supabase
        .from('reviews')
        .select('song_id, user_id, created_at')
        .in('user_id', friendsId)
    const { data: listened, error: listen_error } = await supabase
        .from('listened')
        .select('song_id, user_id, created_at')
        .in('user_id', friendsId)
    
    if (likes_error) {
        return res.status(500).json({ error: 'Failed to get friends likes' })
    }
    if (reviews_error) {
        return res.status(500).json({ error: 'Failed to get friends reviews' })
    }
    if (listen_error) {
        return res.status(500).json({ error: 'Failed to get friends listens' })
    }


    const Feeds = [
      ...(likes || []).map(l => ({ type: 'like', ...l })),
      ...(reviews || []).map(r => ({ type: 'review', ...r })),
      ...(listened || []).map(ls => ({ type: 'listen', ...ls }))
    ]
    if (Feeds.length === 0) {
        return res.json([])
    }

    Feeds.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

    const songids = Array.from(new Set(Feeds.map(a => a.song_id)))

    const { data: songs, error: songsError } = await supabase
        .from('songs')
        .select('id, title')
        .in('id', songids);

    if (songsError) {
        return res.status(500).json({ error: 'Failed to get songs' });
    }

    const songData = new Map(songs?.map(s => [s.id, s.title]))

    const { data: friend } = await supabase
        .from('users')
        .select('id, username')
        .in('id', friendsId);

    const userData = new Map(friend?.map(u => [u.id, u.username]));

    const textFeed = Feeds.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(action => {
    const username = userData.get(action.user_id) || 'No name'
    const songTitle = songData.get(action.song_id) || 'No title'
    let actionText = ''

    if (action.type === 'like') {
        actionText = `${username} liked ${songTitle}`
    } else if (action.type === 'listen') {
        actionText = `${username} listened to ${songTitle}`
    } else if (action.type === 'review') {
        actionText = `${username} reviewed ${songTitle}`
    }

    const created = new Date(action.created_at)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
    const timeAgo = diffDays <= 0 ? 'Today' : `${diffDays}d`

    return { text: actionText, timeAgo, username
      }
    })

    res.json(textFeed)
})
export default router