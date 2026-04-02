import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase';
import { Form } from "radix-ui";
import { Button } from '@radix-ui/themes'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { useNavigate } from "react-router-dom";
import {ArrowRight, Footprints } from 'lucide-react';

interface Song {
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

export default function TrendingSongs() {
  const [loading, setLoading] = useState(true)
  const [songs, setSongs] = useState<Song[]>([])
  const [error, setError] = useState<string | null>(null)
  
  const navigate = useNavigate();


useEffect(() => {

      async function fetchTrending() {
        setLoading(true)
        try {
          const res = await fetch(`http://localhost:3001/api/trending`)
          const data = await res.json()

          if (!res.ok) {
            setError(data.error || 'Failed to load song')
            return
          }

          setSongs(data)

        } catch (err) {
          setError('Failed to fetch trending songs')
          console.error(err)
        } finally {
          setLoading(false)
        }
      }
      fetchTrending()
    }, [])

 return (

  <div>
    <Navbar />
  <div className="min-h-screen w-full flex flex-col items-center bg-background p-6">
  <h1 className="text-3xl font-semibold mb-2 text-primary">
    Trending Songs
  </h1>
  <p className="text-muted-foreground mb-6">
    Based on recent likes, reviews, and listens
  </p>

  {loading && <p className="text-muted-foreground">Loading...</p>}

  {!loading && songs.length === 0 && (
    <p className="text-muted-foreground">No songs are trending</p>
  )}

  {!loading && songs.length > 0 && (
    <ul className="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {songs.map((song, index) => (
        <li
          key={song.id}
          className="rounded-xl border border-border p-4 hover:bg-secondary transition flex flex-col justify-between"
        >
          <div className="flex items-start gap-2">
            <div
              className={`text-xl font-bold
                ${index === 0 ? "text-yellow-400" : ""}
                ${index === 1 ? "text-gray-300" : ""}
                ${index === 2 ? "text-orange-400" : ""}
              `}
            >
              #{index + 1}
            </div>
            {/* List the song, artist, and album */}
            <div className="flex-1">
              <div className="text-lg text-primary">{song.title}</div>
              <div className="text-sm text-foreground mt-1">
                <div>Artists: {song.song_artists?.map((sa) => sa.artists.name) || "No artist"}</div>
                <div>Album: {song.albums?.name ?? "Single"}</div>
              </div>
            </div>
          </div>
          {/* Button to access the song */}
          <Button
            variant="ghost"
            size="2"
            className="self-end mt-2"
            onClick={() => navigate(`/songs/${song.id}`)}
          >
            <ArrowRight className="w-5 h-5" />
          </Button>
        </li>
      ))}
    </ul>
  )}
</div>
<footer />
</div>
  )
}