import { Router } from 'express'
import { supabase } from '../lib/supabase.js'
import { generateKey } from 'crypto'
import { create } from 'domain'

/**
 * song.ts
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

export default router