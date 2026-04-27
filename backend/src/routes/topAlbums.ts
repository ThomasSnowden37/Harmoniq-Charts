import { Router } from 'express'

const router = Router()

router.get('/', async (_req, res) => {
  try {
    const response = await fetch(
      'https://rss.marketingtools.apple.com/api/v2/us/music/most-played/25/albums.json'
    )
    const data = await response.json() as any
    const albums = data.feed.results.map((r: any) => ({
      title: r.name,
      artist: r.artistName,
      imageUrl: r.artworkUrl100.replace('100x100bb.jpg', '300x300bb.jpg'),
    }))
    res.json(albums)
  } catch {
    res.status(502).json({ error: 'Failed to fetch top albums' })
  }
})

export default router
