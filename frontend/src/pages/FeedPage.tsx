import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase';
import { Form } from "radix-ui";
import { Button } from '@radix-ui/themes'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { useNavigate } from "react-router-dom";
import {ArrowRight, Footprints } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface Feeds {
    type: 'like' | 'review' | 'listen'
    user_id: string
    content?: string
    friend_name: string
    types: string[]
    song: {
        id: string
        title: string
        album_name: string
        artists: string[]
    }
}
interface Trendsong {
    id: string
    title: string
    bpm: number
    genre: string
    songwriter?: string
    song_artists?: {artists: {name: string}}[]
    albums?: { name: string }
    year_released: number
    trending_score?: number
}

export default function FeedSongs() {
    const [loading, setLoading] = useState(true)
    const [feed, setFeed] = useState<Feeds[]>([])
    const [error, setError] = useState<string | null>(null)
    const [trending, setTrending] = useState<Trendsong[]>([])
    const { user } = useAuth()
  
    const navigate = useNavigate();


useEffect(() => {

      async function fetchFeed() {
        if (!user) return
        setLoading(true)
        try {
            const res = await fetch(`http://localhost:3001/api/feed`, {
                headers: {
                    "x-user-id": user.id
                },
                })
          const data = await res.json()

          if (!res.ok) {
            setError(data.error || 'Failed to load song')
            return
          }

        setFeed(data)

        const resTrending = await fetch(`http://localhost:3001/api/trending`)
        const trendingData = await resTrending.json()
        if (!resTrending.ok) {
            setError(data.error || 'Failed to load trending')
            return
        }
        setTrending(trendingData.slice(0, 6))

        } catch (err) {
          setError('Failed to fetch friends songs')
          console.error(err)
        } finally {
          setLoading(false)
        }
      }
      fetchFeed()
    }, [user])

    return (
        <div>
            <Navbar />
            <div className="min-h-screen w-full flex flex-col items-center bg-background p-6">

                {/* Friends Activity */}
                <div className="w-full flex justify-center mb-4">
                    <h1 className="text-3xl font-semibold text-primary text-center">Friends Activity</h1>
                </div>
                <div className="w-full flex justify-center mb-8">
                    <a href="/feed/all" className="text-sm text-primary underline">See all</a>
                </div>

                {loading && <p className="text-muted-foreground">Loading...</p>}
                {!loading && feed.length === 0 && <p className="text-muted-foreground">No recent activity. Try adding some more friends</p>}

                {!loading && feed.length > 0 && (
                    <div className="w-full flex justify-center overflow-x-auto mb-12">
                        <ul className="flex gap-8">
                            {feed.map((item, index) => (
                                <li
                                    key={`${item.song.id}-${index}`}
                                    className="w-64 h-44 rounded-xl border border-border p-4 hover:bg-secondary transition flex flex-col justify-between items-center text-center flex-shrink-0"
                                >
                                    <div className="text-sm text-muted-foreground font-semibold">
                                        <a href={`/user/${item.user_id}`} className="underline">{item.friend_name}</a>
                                        <div className="mt-1">
                                            {item.types.map(t =>
                                                t === 'like' ? 'Liked' :
                                                t === 'listen' ? 'Listened' :
                                                t === 'review' ? 'Reviewed' : t
                                            ).join(', ')}
                                        </div>
                                    </div>

                                    <div className="flex-1 flex items-center justify-center">
                                        <div className="text-lg text-primary font-bold">{item.song.title}</div>
                                    </div>

                                    <Button variant="ghost" size="2" onClick={() => navigate(`/songs/${item.song.id}`)}>
                                        <ArrowRight className="w-5 h-5" />
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Trending Songs */}
                <div className="w-full flex justify-center mb-4">
                    <h1 className="text-3xl font-semibold text-primary text-center">Trending Songs</h1>
                </div>
                <div className="w-full flex justify-center mb-8">
                    <a href="/trending" className="text-sm text-primary underline">See all</a>
                </div>
                {!loading && trending.length > 0 && (
                    <div className="w-full flex justify-center overflow-x-auto">
                        <ul className="flex gap-8">
                            {trending.map(song => (
                                <li
                                    key={song.id}
                                    className="w-64 h-44 rounded-xl border border-border p-4 hover:bg-secondary transition flex flex-col justify-center items-center text-center flex-shrink-0"
                                >
                                    <div className="flex-1 flex items-center justify-center">
                                        <div className="text-lg text-primary font-bold">{song.title}</div>
                                    </div>

                                    <Button variant="ghost" size="2" onClick={() => navigate(`/songs/${song.id}`)}>
                                        <ArrowRight className="w-5 h-5" />
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {error && <p className="text-red-500 mt-4">{error}</p>}
            </div>
            <Footer />
        </div>
    )
}