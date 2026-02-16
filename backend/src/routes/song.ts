import { Router } from 'express'
import { supabase } from '../lib/supabase.js'

/**
 * TODO:
 * Add Deleting, and Editing own songs
 * Add artist_id to songs DB
 * Add user_id to songs DB for when user creates a song
 * Use album and artist id to find duplicates 
 */

/**
 * song.ts
 *
 * Description:
 * Defines the backend routes for accessing song information
 *  
 * Author: Jonas Langer
 * 
 */

const router = Router()

/**
 * Get song details by id
 */
router.get('/:id', async (req, res) => {
    const songId = req.params.id

    if (!songId) return res.status(400).json({ error: 'song id is required' })

    const { data, error } = await supabase
        .from('songs')
        .select('*')
        .eq('id', songId)
        .single()

    if (error) {
        return res.status(500).json({ error: 'Song not found'})
    }
    res.json(data)
})

/**
 * Import a new song
 */
router.post('/add', async (req, res) => {

    const { title, bpm, genre, year_released, album_id } = req.body

    if (!title || !bpm || !genre || !year_released)
        return res.status(400).json({ error: 'Missing required fields' })

    const { data: existing } = await supabase
        .from('songs')
        .select('*')
        .eq('title', title)
        .limit(1)

    if (existing && existing.length > 0) {
        return res.status(401).json({ error: 'Song already exists' })
    }
    //need to add artist id to songs and then check song name, artist and/or album for duplicates
    const { data, error} = await supabase
        .from('songs')
        .insert({
            title,
            bpm,
            genre,
            year_released,
            album_id, 
        })
        .select()
        .single()

  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
})

export default router