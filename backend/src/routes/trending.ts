import { Router } from 'express'
import { supabase } from '../lib/supabase.js'
import { generateKey } from 'crypto'
import { create } from 'domain'

/**
 * trending.ts
 *
 * Description:
 * Defines the backend routes for accessing trending song information
 *  
 * Author: Jonas Langer
 * 
 */

const router = Router()

/**
 * Get trending songs
 */
router.get('/', async (req, res) => {
    const { data: songs, error } = await supabase
        .from('songs')
        .select(`*,
            albums ( name ),
            song_artists (
                artists (name) )
            `)
        .order('trending_score', { ascending: false })
        .limit(20)
    
    if (error) {
        return res.status(500).json({ error: 'Failed to get trending songs' })
    }

    return res.json(songs ?? [])


})


/**
 * Get trending playlist
 */
router.get('/playlists', async (req, res) => {
    const { data: playlists, error } = await supabase
        .from('playlists')
        .select('id, name, user_id, created_at, trending_score')
        .or('permanent.eq.false,permanent.is.null')
        .order('trending_score', { ascending: false })
        .limit(20)

    if (error) {
        return res.status(500).json({ error: 'Failed to get trending playlist' })
    }

    if (!playlists || playlists.length === 0) {
        return res.json([])
    }

    const userIds = playlists.map(p => p.user_id)

    const { data: users, error: userError} = await supabase
        .from('users')
        .select('id, username, privacy')
        .in('id', userIds)
    
    if (userError) {
        return res.status(500).json({ error: 'Failed to get users' })
    }
    
    const userData = new Map(users?.map(u => [u.id, u]))

    const trendingPlaylists = playlists
    .filter(playlist => {
      const playlistUser = userData.get(playlist.user_id)
      return playlistUser && playlistUser.privacy !== true
    })
    .slice(0, 8)
    .map(playlist => {
      const playlistUser = userData.get(playlist.user_id)

      return {
        id: playlist.id,
        name: playlist.name,
        user_id: playlist.user_id,
        created_at: playlist.created_at,
        trending_score: playlist.trending_score,
        username: playlistUser?.username || 'No Name'
      }
    })

    return res.json(trendingPlaylists)


})

/**
 * Get trending review
 */
router.get('/reviews', async (req, res) => {
    const { data: reviews, error } = await supabase
        .from('reviews')
        .select('id, content, created_at, user_id, song_id, trending_score')
        .order('trending_score', { ascending: false })
        .limit(20)

    if (error) {
        return res.status(500).json({ error: 'Failed to get trending playlist' })
    }

    if (!reviews || reviews.length === 0) {
        return res.json([])
    }

    const userIds = reviews.map(p => p.user_id)
    const songIds = reviews.map(r => r.song_id)

    const { data: users, error: userError} = await supabase
        .from('users')
        .select('id, username, privacy')
        .in('id', userIds)
    
    if (userError) {
        return res.status(500).json({ error: 'Failed to get users' })
    }

    const { data: songs, error: songsError } = await supabase
        .from('songs')
        .select('id, title')
        .in('id', songIds)

    if (songsError) {
        return res.status(500).json({ error: 'Failed to get review songs' })
    }
    
    const userData = new Map(users?.map(u => [u.id, u]))
    const songData = new Map(songs?.map(s => [s.id, s.title]))

    const trendingReviews = reviews
        .filter(review => {
            const reviewUser = userData.get(review.user_id)
            return reviewUser && reviewUser.privacy !== 'private'
        })
        .slice(0, 6)
        .map(review => {
    const reviewUser = userData.get(review.user_id)
        return {
            id: review.id,
            content: review.content,
            created_at: review.created_at,
            user_id: review.user_id,
            friend_name: reviewUser?.username || 'No Name',
            song: {
                id: review.song_id,
                title: songData.get(review.song_id) || 'No title'
            },
            trending_score: review.trending_score
        }
    })

  res.json(trendingReviews)

})

export default router