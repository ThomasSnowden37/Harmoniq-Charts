import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useNavigate } from "react-router-dom";

interface Song {
    id: string
    title: string
    bpm: number
    genre: string
    year_released: number
    user_id: string
}

export default function ListenToLaterPage() {
    const [songs, setSongs]= useState<Song[]>([])
    const[loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const { user } = useAuth()
    const navigate = useNavigate();
    useEffect(() => {
        console.log("Current user:", user)
        if (!user) return
        const getSongs = async() => {
            try {
                const res = await fetch(`/api/songs/listentolist`, {
                    headers: {
                        "x-user-id": user.id
                    },
                })
                const data = await res.json()
                if (!res.ok) {
                    setError('Failed to retrieve songs')
                    return
                }
                setSongs(data.songs || [])
            } catch(err) {
                setError('Failed to retrieve songs')
            } finally {
                setLoading(false)
            }
        }
        getSongs()
    }, [user])

      return (
    <div className="flex flex-col min-h-screen bg-background">
        <Navbar />
            <main className="flex-1 flex items-center justify-center p-6">
                <div className="w-full max-w-2xl bg-card rounded-2xl shadow-xl p-8">
                <h1 className="text-3xl font-bold text-center text-primary mb-4">
                Listen To Later
                </h1>
                {!loading && songs.length == 0 && !error && (
                     <p className="text-muted-foreground text-center">No songs saved yet </p>
                )}
                {!loading && songs.length > 0 && (
                     <ul className="mt-4 space-y-3">
                {songs.map((song) => (
                    <li
                        key={song.id}
                        className="rounded-xl border border-border p-4 hover:bg-secondary transition flex justify-between items-center cursor-pointer"
                        onClick={() => navigate(`/songs/${song.id}`)}
                    >
                    <div className="flex flex-wrap gap-4 w-full">
                    <div className="flex-1 min-w-[200px]">Song Title: {song.title}</div>
                    <div className="flex-1 min-w-[120px]">Genre: {song.genre}</div>
                    <div className="flex-1 min-w-[120px]">BPM: {song.bpm}</div>
                    <div className="flex-1 min-w-[120px]">Year: {song.year_released}</div>
                    </div>
                </li>
                ))}
                     </ul>
                )}
                </div>
            </main>
      <Footer />
    </div>
)
}