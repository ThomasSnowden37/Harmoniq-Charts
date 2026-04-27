import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { supabase } from './lib/supabase.js'

import friendRequestsRouter from './routes/friendRequests.js'
import usersRouter from './routes/users.js'
import songRouter from './routes/song.js'
import authRouter from './routes/auth.js'
import playlistRouter from './routes/playlists.js'
import spotifyRouter from './routes/spotify.js'
import likesRouter from './routes/likes.js'
import reviewsRouter from './routes/reviews.js'
import ratingsRouter from './routes/ratings.js'
import trendingRouter from './routes/trending.js'
import favoriteSongsRouter from './routes/favoriteSongs.js'
import feedRouter from './routes/feed.js'
import topAlbumsRouter from './routes/topAlbums.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

// Define all routes in the routes subfolder here
app.use('/api/friend-requests', friendRequestsRouter)
app.use('/api/users', usersRouter)
app.use('/api/songs', songRouter)
app.use('/api/auth', authRouter)
app.use('/api/playlists', playlistRouter)
app.use('/api/spotify', spotifyRouter)
app.use('/api/likes', likesRouter)
app.use('/api/reviews', reviewsRouter)
app.use('/api/ratings', ratingsRouter)
app.use('/api/trending', trendingRouter)
app.use('/api/favorite-songs', favoriteSongsRouter)
app.use('/api/feed', feedRouter)
app.use('/api/top-albums', topAlbumsRouter)

// Test the supabase connection with this endpoint
app.get('/api/test-db', async (req, res) => {
  const { data, error } = await supabase.from('artists').select('*')
  if (error) return res.status(500).json({ error: error.message })
  res.json({ connected: true, artists: data })
})

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
