import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import DeleteSongModal from '../features/songs/components/DeleteSongModal'
import EditSongModal from '../features/songs/components/EditSongModal'
import AddToPlaylistModal from '../features/playlists/components/AddToPlaylistModal'
import { useAuth } from '../context/AuthContext';


//Super basic placeholder
//TODO: Make page look good
//TODO: Edit and Delete only for who created - need auths

/**
 * SongPage.tsx
 *
 * Description:
 * This UI displays the song and information
 *  
 * Author: 
 * 
 */

interface Song {
    id: string
    title: string
    bpm: number
    genre: string
    year_released: number
    user_id: string
}

export default function SongPage() {
    const { user } = useAuth()
    const { id } = useParams()
    const [loading, setLoading] = useState(true)
    const [song, setSong] = useState<Song | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [editOpen, setEditOpen] = useState(false)
    const [playlistOpen, setPlaylistOpen] = useState(false)
    const [listenedCount, setListenedCount] = useState(0)


    useEffect(() => {
        async function fetchSongAndListened() {
        try {
            //songs/{song uuid}
            const res = await fetch(`http://localhost:3001/api/songs/${id}`)
            const data = await res.json()

            if (!res.ok) setError(`Error: ${data.error}`)
            setSong(data)

            const countRes = await fetch(`http://localhost:3001/api/songs/${id}/listened/count`)
            const countData = await countRes.json()
            if (!countRes.ok) setError(`Error: ${data.error}`)
            setListenedCount(countData.total)
        } finally {
            setLoading(false)
        }
    }
    if (id) fetchSongAndListened()
  }, [id])

  if (loading) return <p className="text-white p-6">Loading...</p>
  if (error) return <p className="text-red-400 p-6">{error}</p>
  if (!song) return <p className="text-gray-400 p-6">Song not found</p>

  return (
    <div className="p-6 text-black">
      <h1 className="text-2xl font-bold mb-4">{song.title}</h1>

      <p>BPM: {song.bpm}</p>
      <p>Genre: {song.genre}</p>
      <p>Year: {song.year_released}</p>

      {/*  Total listeners */}
      <p> Listeners: {listenedCount}</p>

      {/* Delete button only if user created song*/}
      {user && user.id == song.user_id && (
        <>
      <button
        onClick={() => setDeleteOpen(true)}
        className="mt-6 px-4 py-2 bg-red-600 rounded-lg hover:bg-red-500"
      >
        Delete Song
      </button>
      {/* Edit button only if user created song*/}
      <button
        onClick={() => setEditOpen(true)}
        className="mt-6 px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-500"
      >
        Edit Song
      </button>
        </>
      )}
      {/* Add to Playlist button */}
      <button
        onClick={() => setPlaylistOpen(true)}
        className="mt-6 px-4 py-2 bg-green-600 rounded-lg hover:bg-green-500"
      >
        Add to Playlist
      </button>
      <DeleteSongModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        songId={song.id}
        songTitle={song.title}
        onDeleted={() => setSong(null)}
      />
      <EditSongModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        song={song}
        onUpdated={(updated) => setSong(updated)}
      />
      <AddToPlaylistModal
        isOpen={playlistOpen}
        onClose={() => setPlaylistOpen(false)}
        songId={song.id}
      />
    </div>
  )
}


