import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase';
import { Form } from "radix-ui";
import { Button } from '@radix-ui/themes'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { useNavigate } from "react-router-dom";
import {ArrowRight, Footprints } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/**
 * PlaceholderCover
 *  
 * Author: Brice
 * 
 */
function PlaceholderCover({ title, size = 150, height = 190 }: { title: string; size?: number; height?: number}) {
  const hashStr = (s: string) => {
    let h = 0
    for (let i = 0; i < s.length; i++) {
      h = (h << 5) - h + s.charCodeAt(i)
      h |= 0
    }
    return Math.abs(h)
  }

  const seed = hashStr(title || 'Untitled')
  const hue = seed % 360
  const colorBg = `hsl(${hue}, 40%, 12%)`
  const colorAccent = `hsl(${(hue + 30) % 360}, 80%, 60%)`
  
  // Clean up title and grab the first 4 words
  
  const titleWords = (title || 'Untitled').trim().split(/\s+/).slice(0, 4)
  // Reverse them so word[0] is the bottom-most word near the accent line
  const displayWords = [...titleWords].reverse()

  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      preserveAspectRatio="xMidYMid slice"
      style={{ borderRadius: '6px', background: colorBg }}
    >
      <defs>
        <filter id="noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.12 0" />
        </filter>

        <radialGradient id="glow" cx="80%" cy="20%" r="70%">
          <stop offset="0%" stopColor={colorAccent} stopOpacity="0.4" />
          <stop offset="100%" stopColor={colorAccent} stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="100" height="100" fill={colorBg} />
      <rect width="100" height="100" fill="url(#glow)" />
      <rect width="100" height="100" filter="url(#noise)" />

      {/* Modern Typographic Layout */}
      <g transform="translate(10, 84)">
        {displayWords.map((word, i) => (
          <text
            key={i}
            x="0"
            y={-i * 11} // Moves upwards for each word
            fontFamily="system-ui, -apple-system, sans-serif"
            fontSize={word.length > 10 ? "8.5" : "10.5"}
            fontWeight="800"
            fill="white"
            style={{ 
              textTransform: 'uppercase', 
              letterSpacing: '-0.03em',
              opacity: 1 - (i * 0.1) // Top words fade out slightly
            }}
          >
            {word}
          </text>
        ))}
      </g>

      <rect x="10" y="88" width="12" height="1.5" fill={colorAccent} rx="0.75" />
    </svg>
  )
}

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
    credits?: string
    song_artists?: {artists: {name: string}}[]
    albums?: { name: string }
    year_released: number
    trending_score?: number
}

interface songReview {
    id: string
    content: string
    created_at: string
    user_id: string
    friend_name: string
    song: {
        id: string
        title:string
    }
}

interface friendPlaylist {
    id: string
    name: string
    created_at: string
    user_id: string
    friend_name: string
}

interface trendingPlaylist {
    id: string
    name: string
    created_at: string
    user_id: string
    trending_score: number
    username: string
}

interface trendingReview {
    id: string
    content: string
    created_at: string
    user_id: string
    friend_name: string
    trending_score: number
    song: {
        id: string
        title:string
    }
    
}

export default function FeedSongs() {
    const [loading, setLoading] = useState(true)
    const [feed, setFeed] = useState<Feeds[]>([])
    const [error, setError] = useState<string | null>(null)
    const [trending, setTrending] = useState<Trendsong[]>([])
    const [friendReviews, setfriendReviews] = useState<songReview[]>([])
    const [friendPlaylists, setfriendPlaylists] = useState<friendPlaylist[]>([])
    const [trendingPlaylist, setTrendingPlaylist] = useState<trendingPlaylist[]>([])
    const [trendingReviews, setTrendingReviews] = useState<trendingReview[]>([])
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
            setError(trendingData.error || 'Failed to load trending')
            return
        }
        setTrending(trendingData.slice(0, 6))
 
        const resfReview = await fetch(`http://localhost:3001/api/feed/reviews`, {
            headers: {
                "x-user-id": user.id
            }
        })
        const freviewData = await resfReview.json()
        if (!resfReview.ok) {
            setError(freviewData.error || 'Failed to load friend reviews')
            return
        }
        setfriendReviews(freviewData)

        const fplayReview = await fetch(`http://localhost:3001/api/feed/playlists`, {
            headers: {
                "x-user-id": user.id
            }
        })
        const fplayData = await fplayReview.json()
        if (!fplayReview.ok) {
            setError(fplayData.error || 'Failed to load friend reviews')
            return
        }
        setfriendPlaylists(fplayData)

        const trendingPaly = await fetch(`http://localhost:3001/api/trending/playlists`, {
            headers: {
                "x-user-id": user.id
            }
        })
        const trendingPData = await trendingPaly.json()
        if (!trendingPaly.ok) {
            setError(trendingPData.error || 'Failed to load trending Playlists')
            return
        }
        setTrendingPlaylist(trendingPData)

        const revTrending = await fetch(`http://localhost:3001/api/trending/reviews`)
        const revtrendingData = await revTrending.json()
        if (!revTrending.ok) {
            setError(revtrendingData.error || 'Failed to load trending')
            return
        }
        setTrendingReviews(revtrendingData.slice(0, 6))

        } catch (err) {
            console.error(err)
            setError('Failed to fetch friends songs')
        } finally {
            setLoading(false)
        }
      }

      fetchFeed()
    }, [user])


    if (loading) {
        return (
            <div>
            <Navbar />
            <div className="min-h-screen w-full flex items-center justify-center bg-background">
                <p className="text-lg text-muted-foreground">Loading...</p>
            </div>
            <Footer />
            </div>
        )
    }

    function ReviewCard({ review }: { review: any }) {
        return (
            <div className="w-56 rounded-2xl border border-border bg-card p-4 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all">
            <div className="flex flex-col gap-1 mb-2">
                <a
                href={`/user/${review.user_id}`}
                className="text-xs font-semibold text-primary underline"
                >
                {review.friend_name}
                </a>

                <span className="text-xs text-muted-foreground">
                {new Date(review.created_at).toLocaleDateString()}
                </span>
            </div>

            <button
                onClick={() => navigate(`/songs/${review.song.id}`)}
                className="text-base font-bold text-foreground hover:text-primary mb-2"
            >
                {review.song.title}
            </button>

            <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {review.content}
            </p>
            </div>
        )}
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
                {/* Reviews */}
                <div className="w-full max-w-7xl grid grid-cols-2 gap-8 mt-16 items-start">

                {/* Friend Reviews */}
                <section className="flex flex-col items-center">
                    <h1 className="text-2xl font-semibold text-primary text-center mb-8">
                    Friend Recent Reviews
                    </h1>

                    {friendReviews.length === 0 ? (
                    <p className="text-muted-foreground">No recent friend reviews.</p>
                    ) : (
                    <div className="grid grid-cols-2 gap-x-4">
                        <div className="flex flex-col gap-10">
                        {friendReviews.filter((_, index) => index % 2 === 0).map(review => (
                            <ReviewCard key={review.id} review={review} />
                        ))}
                        </div>

                        <div className="flex flex-col gap-10 mt-10">
                        {friendReviews.filter((_, index) => index % 2 === 1).map(review => (
                            <ReviewCard key={review.id} review={review} />
                        ))}
                        </div>
                    </div>
                    )}
                </section>

                {/* Trending Reviews */}
                <section className="flex flex-col items-center">
                    <h1 className="text-2xl font-semibold text-primary text-center mb-8">
                    Trending Reviews
                    </h1>

                    {trendingReviews.length === 0 ? (
                    <p className="text-muted-foreground">No trending reviews.</p>
                    ) : (
                    <div className="grid grid-cols-2 gap-x-4">
                        <div className="flex flex-col gap-10">
                        {trendingReviews.filter((_, index) => index % 2 === 0).map(review => (
                            <ReviewCard key={review.id} review={review} />
                        ))}
                        </div>

                        <div className="flex flex-col gap-10 mt-10">
                        {trendingReviews.filter((_, index) => index % 2 === 1).map(review => (
                            <ReviewCard key={review.id} review={review} />
                        ))}
                        </div>
                    </div>
                    )}
                </section>

                </div>
                {/* Friend Playlists */}
                <div className="w-full flex justify-center mt-16 mb-4">
                    <h1 className="text-3xl font-semibold text-primary text-center">
                        Friend Recent Playlists
                    </h1>
                </div>

                {!loading && friendPlaylists.length === 0 && (
                    <p className="text-muted-foreground">No recent friend playlist.</p>
                )}
                {!loading && friendPlaylists.length > 0 && (
                <div className="w-full max-w-7xl overflow-visible">
                    <div className="flex justify-center gap-4">
                        <div className="flex gap-6">
                            {friendPlaylists.slice(0, 8).map(playlist => (
                            <a
                                key={playlist.id}
                                href={`/playlists/${playlist.id}`}
                                className="w-36 flex-shrink-0 no-underline"
                            >
                                <div className="w-36 h-44 rounded-lg border border-border bg-card mb-2 flex items-center justify-center">
                                    <PlaceholderCover title={playlist.name} size={132} />
                                </div>

                                <div className="mt-1 text-xs text-muted-foreground">
                                    <a
                                        href={`/user/${playlist.user_id}`}
                                        className="font-semibold text-primary underline"
                                        onClick={e => e.stopPropagation()}
                                    >
                                        {playlist.friend_name}
                                    </a>
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                    {new Date(playlist.created_at).toLocaleDateString()}
                                </div>
                            </a>
                            ))}
                        </div>
                    </div>
                </div>
                )}
                {/* Trending Playlists */}
                <div className="w-full flex justify-center mt-16 mb-4">
                    <h1 className="text-3xl font-semibold text-primary text-center">
                        Trending Playlists
                    </h1>
                </div>

                {!loading && trendingPlaylist.length === 0 && (
                    <p className="text-muted-foreground">No trending playlists.</p>
                )}
                {!loading && trendingPlaylist.length > 0 && (
                <div className="w-full max-w-7xl overflow-visible">
                    <div className="flex justify-center gap-4">
                        <div className="flex gap-6">
                            {trendingPlaylist.slice(0, 8).map(playlist => (
                            <a
                                key={playlist.id}
                                href={`/playlists/${playlist.id}`}
                                className="w-36 flex-shrink-0 no-underline"
                            >
                                <div className="w-36 h-44 rounded-lg border border-border bg-card mb-2 flex items-center justify-center">
                                    <PlaceholderCover title={playlist.name} size={132} />
                                </div>

                                <div className="mt-1 text-xs text-muted-foreground">
                                    <a
                                        href={`/user/${playlist.user_id}`}
                                        className="font-semibold text-primary underline"
                                        onClick={e => e.stopPropagation()}
                                    >
                                        {playlist.username}
                                    </a>
                                </div>

                                <div className="mt-1 text-xs text-muted-foreground">
                                    {new Date(playlist.created_at).toLocaleDateString()}
                                </div>
                            </a>
                            ))}
                        </div>
                    </div>
                </div>
                )}


                {error && <p className="text-red-500 mt-4">{error}</p>}
            </div>
            <Footer />
        </div>
    )
}