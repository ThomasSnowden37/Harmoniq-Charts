import { Router } from 'express'
import { supabase } from '../lib/supabase.js'
import { generateKey } from 'crypto'

/**
 * ratings.ts
 *
 * Description:
 * Defines the backend routes for accessing star ratings
 *  
 * Author: Jonas Langer
 * 
 */

const router = Router()

/**
 * Get user song ratings
 */
router.get('/:id/ratings', async (req, res) => {
    const songId = req.params.id
    const userId = req.headers['x-user-id'] as string

    if (!songId) return res.status(400).json({ error: 'song id is required' })
    if (!userId) return res.status(400).json({ error: 'Must be logged in to rate song' })

    const { data, error } = await supabase
        .from('ratings')
        .select('rating')
        .eq('user_id', userId)
        .eq('song_id', songId)
        .single()
    res.json(data)
})
/**
 * Add or update a rating to song
 */
    router.post('/:id/rate', async (req, res) => {
        const songId = req.params.id;
        const userId = req.headers['x-user-id'] as string
        const { rating } = req.body
        console.log('Click!', { songId: songId, userId: userId, rating })


        if (!songId) return res.status(400).json({ error: 'Song id is required' })
        if (!userId) return res.status(400).json({ error: 'Must be logged in to rate song' })

        const { data: existing, error: fetchError } = await supabase
            .from('ratings')
            .select('rating')
            .eq('user_id', userId)
            .eq('song_id', songId)
        if (fetchError){
              console.error('Supabase error:', fetchError)
            return res.status(500).json({ error: 'Failed to add rating'})
        } 
        // create new rating
        if (existing.length === 0) {
            console.log('EXISTS!', { songId: songId, userId: userId, rating })
            const { data, error} = await supabase
                .from('ratings')
                .insert({user_id: userId, song_id: songId, rating})
                .select()
                 return res.status(201).json(data)
        // edit existing rating
        } else {
                const { data, error} = await supabase
                .from('ratings')
                .update({rating})
                .eq('user_id', userId)
                .eq('song_id', songId)
                .select()
                return res.status(201).json(data)
        }
    })

/**
 * Remove a rating from a song
 */
router.delete('/:id/remove', async (req, res) => {
    const songId = req.params.id;
    const userId = req.headers['x-user-id'] as string

            console.log('Delete!', { songId: songId, userId: userId })

    if (!songId) return res.status(400).json({ error: 'Song id is required' })
    if (!userId) return res.status(400).json({ error: 'Must be logged in to rate song' })

    const { error } = await supabase
        .from('ratings')
        .delete()
        .eq('song_id', songId)
        .eq('user_id', userId)

    if (error) {
        return res.status(500).json({ error: 'Failed to remove listen to' })
    }
    res.json({ message: 'Successfully deleted' })
})

/**
 * Get the average rating for a song
 */
router.get('/:id/average', async (req, res) => {
    const songId = req.params.id;
    console.log('in')

    if (!songId) return res.status(400).json({ error: 'Song id is required' })

    const { data, error } = await supabase
        .from('ratings')
        .select('rating')
        .eq('song_id', songId)
        
    if (error) {
        return res.status(500).json({ error: 'Failed to fetch ratings' })
    }

    const ratings = data?.map(r => r.rating) ?? []
    const average = ratings.length > 0 ? ratings.reduce((acc, r) => acc + r, 0) / ratings.length : null
    const count = ratings.length
    console.log({ average, count })
    res.json({ average, count })
})


export default router