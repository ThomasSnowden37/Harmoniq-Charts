import { Router } from 'express'
import { supabase } from '../lib/supabase.js'
import { generateKey } from 'crypto'
import * as spotify from '../lib/spotify.js'

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
 * Get all listened to for user
 */
router.get('/listentolist', async (req, res) => {
    const userId = req.headers['x-user-id'] as string
    if (!userId ) {
        return res.status(400).json({ error: 'User is required to be logged in' })
    }

    try {
        const { data: songsTo, error } = await supabase
            .from('listento')
            .select('song_id')
            .eq('user_id', userId)

        if (error) {
            return res.status(500).json ({ error: "Failed to get listen to songs"})
        }

        const songIds = songsTo.map((r) => r.song_id)

        if (songIds.length == 0) {
            return res.json({ songs: [] })
        }
        const { data: songs, error: songsError} = await supabase
            .from('songs')
            .select('id, title, genre, bpm, year_released')
            .in('id', songIds)
        
        if (songsError) {
            return res.status(500).json ({ error: "Failed to get listen to songs"})
        }
        res.json({ songs })
    } catch (err) {
        res.status(500).json ({ error: "Error"})
    }
})

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

    const { userId, title, bpm, genre, year_released, album_name, artist_name, spotify_id } = req.body

    if (!userId)
        return res.status(400).json({ error: 'Must be logged in to add song' })

    // Require essential fields; allow bpm and genre to be optional
    if (!title || !year_released || !album_name || !artist_name)
        return res.status(400).json({ error: 'Missing required fields' })

    // Normalize optional BPM and validate if provided
    let bpmValue: number | null = null
    if (bpm !== undefined && bpm !== null && bpm !== '') {
      const n = Number(bpm)
      if (isNaN(n) || n < 0) return res.status(400).json({ error: 'Invalid BPM' })
      bpmValue = n
    }

    const genreValue = genre === undefined || genre === null || genre === '' ? null : genre

    console.log(userId)

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
    let album_id: string | null = null
    const { data: album } = await supabase
        .from('albums')
        .select('id')
        .eq('name', album_name)

    if (album && album.length > 0) {
        const albumID = album.map(s => s.id)
        //check if album is tied to artist or different artist
        const { data: correctAlbum } = await supabase
            .from('album_artists')
            .select('album_id')
            .in('album_id', albumID)
            .eq('artist_id', artist_id)
            .limit(1)
        if (correctAlbum && correctAlbum.length > 0) {
            album_id = correctAlbum[0].album_id
        }
    }    
    if (!album_id) {
        const { data: Createalbum} = await supabase
            .from('albums')
            .insert({ name: album_name })
            .select()
            .single()
        album_id = Createalbum.id
    }
    
    
    //check if album_artist relationship exists, if not create it
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

    //Check if song added is a duplicate 
    //Check if song is already in album and if it is tied to same arist
    const { data: songsSameAlbum } = await supabase
        .from('songs')
        .select('id')
        .eq('title', title)
        .eq('album_id', album_id)

    if (songsSameAlbum && songsSameAlbum.length > 0) {
        const songsID = songsSameAlbum.map(s => s.id)

        const { data: songsSameArtist } = await supabase
            .from('song_artists')
            .select('song_id')
            .in('song_id', songsID)
            .eq('artist_id', artist_id)
            .limit(1)

        if (songsSameArtist && songsSameArtist.length > 0 ) {
            return res.status(409).json({error: 'This song has already been added'})
        }
    }

    //add song to the database and add song artist relationship
    //TODO: More error checking
    const { data: song, error} = await supabase
        .from('songs')
        .insert({
            user_id: userId ?? null,
            title,
            bpm: bpmValue,
            genre: genreValue,
            year_released,
            album_id,
            spotify_id: spotify_id ?? null,
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


/**
 * Delete a song
 */
router.delete('/:id', async (req, res) => {
     const songId = req.params.id
     const userId = req.headers['x-user-id'] as string

    if (!userId ) {
        return res.status(400).json({ error: 'User not logged in' })
    }
    
    if (!songId ) {
        return res.status(400).json({ error: 'Song ID is required' })
    }
    try {
        //check if the song exists and belongs to the user
        const { data: existSong, error: noSong } = await supabase 
            .from('songs')
            .select('id, user_id')
            .eq('id',songId )
            .single()
        if (noSong) {
            return res.status(404).json({ error: 'Song is not found' })
        }
        if (existSong.user_id != userId) {
            return res.status(404).json({ error: 'You can only delete your own songs' })
        }
        //delete the song
        const { error : deleteError } = await supabase
            .from('songs')
            .delete()
            .eq('id',songId )
        if (deleteError) {
            return res.status(500).json({ error: deleteError.message }) 
        } 
        res.status(201).json({ message: 'Song deleted successfully'})
    } catch (err: any) {
        return res.status(500).json({ error: err.message }) 
    }
})

/**
 * Edit a song
 */
router.patch('/:id', async (req, res) => {
    const songId = req.params.id
    const userId = req.headers['x-user-id'] as string
    const {title, bpm, genre, year_released, spotify_id} = req.body

    if (!userId ) {
        return res.status(400).json({ error: 'User not logged in' })
    }

    if (!songId ) {
        return res.status(400).json({ error: 'Song ID is required' })
    }

    if (bpm != null && (typeof bpm != 'number' || bpm < 0)) {
        return res.status(400).json({ error: 'Invalid BPM' })
    }
    if (year_released != null && (typeof year_released != 'number' || year_released < 0)) {
        return res.status(400).json({ error: 'Invalid Year' })
    }
    try {
        //check if the song exists and belongs to the user
        const { data: existSong, error: noSong } = await supabase 
            .from('songs')
            .select('id, user_id')
            .eq('id',songId )
            .single()
        if (noSong) {
            return res.status(404).json({ error: 'Song is not found' })
        }

        if (existSong.user_id != userId) {
            return res.status(403).json({ error: 'You can only edit your own songs' })
        }

        // Build update object; only set spotify_id when provided in request
        const updateFields: any = { title, bpm, genre, year_released }
        if (Object.prototype.hasOwnProperty.call(req.body, 'spotify_id')) {
            updateFields.spotify_id = spotify_id
        }

        const{ data, error: errorUpdate} = await supabase
            .from('songs')
            .update(updateFields)
            .eq('id', songId)
            .select()
            .single()
        if (errorUpdate) {
            return res.status(500).json({ error: 'Failed to update song' })
        }
        res.json(data);
    } catch (err: any) {
        return res.status(500).json({ error: err.message }) 
    }
})

/**
 * Get if listened to or not
 */
router.get('/:id/listened', async (req, res) => {
    const songId = req.params.id;
    const userId = req.headers['x-user-id'] as string
    if (!songId ) {
        return res.status(400).json({ error: 'Song ID is required' })
    }

    const { data: existSong, error: noSong } = await supabase 
        .from('songs')
        .select('id')
        .eq('id', songId)
        .single()
    if (noSong) {
        return res.status(404).json({ error: 'Song is not found' })
    }

    const { data, error } = await supabase
        .from('listened')
        .select('id')
        .eq('song_id', songId)
        .eq('user_id', userId)
        .single()
    const listened = !!data
    res.json({ listened })
})


/**
 * Add a song to a users listened
 */
router.post('/:id/listened', async (req, res) => {
     const songId = req.params.id;
     const userId = req.headers['x-user-id'] as string

    if (!songId ) {
        return res.status(400).json({ error: 'Song ID is required' })
    }

    const { data: existSong, error: noSong } = await supabase 
        .from('songs')
        .select('id')
        .eq('id', songId)
        .single()
    if (noSong) {
        return res.status(404).json({ error: 'Song is not found' })
    }

    const { data: existing, error: errorExisting } = await supabase
        .from('listened')
        .select('id')
        .eq('song_id', songId)
        .eq('user_id', userId)
        .single()

    if (existing) {
        return res.status(409).json({ error: 'Already listened' })
    }

    const {data, error} = await supabase
        .from('listened')
        .insert({
            user_id: userId,
            song_id: songId 
        })
        .select()
        .single()

    if (error){
        return res.status(500).json({ error: 'Failed to add song to listened'})
    }
    const { data: trend, error: trend_error } = await supabase.rpc('get_trending_songs');
    return res.status(201).json(data)
})

/**
 * Remove a song to a users listened
 */
router.delete('/:id/listened', async (req, res) => {
    const songId = req.params.id;
    const userId = req.headers['x-user-id'] as string
        console.log("add")

    if (!songId ) {
        return res.status(400).json({ error: 'Song ID is required' })
    }

    const { data: existSong, error: noSong } = await supabase 
        .from('songs')
        .select('id')
        .eq('id', songId)
        .single()
    if (noSong) {
        return res.status(404).json({ error: 'Song is not found' })
    }

    const { error } = await supabase
        .from('listened')
        .delete()
        .eq('song_id', songId)
        .eq('user_id', userId)


    if (error) {
        return res.status(500).json({ error: 'Failed to remove listened' })
    }
    const { data: trend, error: trend_error } = await supabase.rpc('get_trending_songs');
    res.json({ message: 'Successfully deleted' })
})

/**
 * Get total listened to count
 */
router.get('/:id/listened/count', async (req, res) => {
     const songId = req.params.id; 
    
      if (!songId ) {
        return res.status(400).json({ error: 'Song ID is required' })
    }
    const { data: existSong, error: noSong } = await supabase 
        .from('songs')
        .select('id')
        .eq('id', songId)
        .single()
    if (noSong) {
        return res.status(404).json({ error: 'Song is not found' })
    }
    const {count, error} = await supabase
        .from('listened')
        .select('*', { count: 'exact', head: true})
        .eq('song_id', songId)
    
     if (error) {
        return res.status(500).json({ error: 'Failed to get count' })
    }
    res.json({ total: count || 0 })
    
})
/**
 * Get if listened to or not
 */
router.get('/:id/listento', async (req, res) => {
    const songId = req.params.id;
    const userId = req.headers['x-user-id'] as string
    if (!songId ) {
        return res.status(400).json({ error: 'Song ID is required' })
    }

    const { data: existSong, error: noSong } = await supabase 
        .from('songs')
        .select('id')
        .eq('id', songId)
        .single()
    if (noSong) {
        return res.status(404).json({ error: 'Song is not found' })
    }

    const { data, error } = await supabase
        .from('listento')
        .select('id')
        .eq('song_id', songId)
        .eq('user_id', userId)
        .single()
    const listento = !!data
    res.json({ listento })
})

/**
 * Add a song to a users listen to
 */
router.post('/:id/listento', async (req, res) => {
     const songId = req.params.id;
     const userId = req.headers['x-user-id'] as string

    if (!songId ) {
        return res.status(400).json({ error: 'Song ID is required' })
    }

    const { data: existSong, error: noSong } = await supabase 
        .from('songs')
        .select('id')
        .eq('id', songId)
        .single()
    if (noSong) {
        return res.status(404).json({ error: 'Song is not found' })
    }

    const { data: existing, error: errorExisting } = await supabase
        .from('listento')
        .select('id')
        .eq('song_id', songId)
        .eq('user_id', userId)
        .single()

    if (existing) {
        return res.status(409).json({ error: 'Already listened' })
    }

    const {data, error} = await supabase
        .from('listento')
        .insert({
            user_id: userId,
            song_id: songId 
        })
        .select()
        .single()

    if (error){
        return res.status(500).json({ error: 'Failed to add song to listento'})
    }
    return res.status(201).json(data)
})

/**
 * Remove a song to a users listen to
 */
router.delete('/:id/listento', async (req, res) => {
    const songId = req.params.id;
    const userId = req.headers['x-user-id'] as string

    if (!songId ) {
        return res.status(400).json({ error: 'Song ID is required' })
    }

    const { data: existSong, error: noSong } = await supabase 
        .from('songs')
        .select('id')
        .eq('id', songId)
        .single()
    if (noSong) {
        return res.status(404).json({ error: 'Song is not found' })
    }

    const { error } = await supabase
        .from('listento')
        .delete()
        .eq('song_id', songId)
        .eq('user_id', userId)

    if (error) {
        return res.status(500).json({ error: 'Failed to remove listen to' })
    }
    res.json({ message: 'Successfully deleted' })
})


export default router