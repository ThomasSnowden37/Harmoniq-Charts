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
        .select('id, username, privacy, is_admin')
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

export default router