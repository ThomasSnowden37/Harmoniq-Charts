import { Router } from 'express'
import { supabase } from '../lib/supabase.js'

/**
 * TODO:
 * Add Deleting, and Editing own songs
 * Add user_id to songs DB for when user creates a song
 * Use album and artist id to find duplicates 
 * Check for more errors
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

    const { title, bpm, genre, year_released, album_name, artist_name} = req.body

    if (!title || !bpm || !genre || !year_released || !album_name || !artist_name)
        return res.status(400).json({ error: 'Missing required fields' })

    const { data: existing } = await supabase
        .from('songs')
        .select('*')
        .eq('title', title)
        .limit(1)

    if (existing && existing.length > 0) {
        return res.status(401).json({ error: 'Song already exists' })
    }

    //check if the artist exists and if not create them
    let { data: artist } = await supabase
        .from('artists')
        .select('id')
        .eq('name', artist_name)
        .single()
    if (!artist) {
        const { data: Createartist} = await supabase
            .from('artists')
            .insert({ name: artist_name })
            .select()
            .single()
        artist = Createartist
    }
    const artist_id = artist?.id

    //check if the album exists and if not create it
    let { data: album } = await supabase
        .from('albums')
        .select('id')
        .eq('name', album_name)
        .single()
    if (!album) {
        const { data: Createalbum} = await supabase
            .from('albums')
            .insert({ name: album_name })
            .select()
            .single()
        album = Createalbum
    }
    const album_id = album?.id       
    
    //check if album_artist relationship exists, if not create it
    //TODO: kind of weird right now, probably should have some sort of admin to check songs
    //TODO: add a full database so most songs dont need to be manually added, sprint 2 work
    
    const { data: albumArtist } = await supabase
        .from('album_artists')
        .select('*')
        .eq('album_id', album_id)
        .eq('artist_id', artist_id)
        .single()
    if (!albumArtist) {
        const { data: newAA } = await supabase
        .from('album_artists')
        .insert({
            album_id,
            artist_id
        })
    }

    //TODO: Check for duplicates based on Song Name and check artist


    //add song to the database and add song artist relationship
    //TODO: More error checking
    const { data: song, error} = await supabase
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
    const song_id = song.id 
    if (error) return res.status(500).json({ error: error.message })

    const { data: newSongArtist } = await supabase
        .from('song_artists')
        .insert({
            song_id,
            artist_id
        })
    res.status(201).json(song)
})

export default router