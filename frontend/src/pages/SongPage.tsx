import { useEffect, useState } from 'react'
import { MOCK_CURRENT_USER_ID } from '../lib/auth' //need to get acutal auths
import { useParams } from 'react-router-dom'
import DeleteSongModal from '../features/songs/components/DeleteSongModal'
import EditSongModal from '../features/songs/components/EditSongModal'


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
}

export default function SongPage() {
    const { id } = useParams()
    const [loading, setLoading] = useState(true)
    const [song, setSong] = useState<Song | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [editOpen, setEditOpen] = useState(false)


    useEffect(() => {
        async function fetchSong() {
        try {
            //songs/{song uuid}
            const res = await fetch(`http://localhost:3001/api/songs/${id}`)
            const data = await res.json()

            if (!res.ok) setError(`Error: ${data.error}`)
            setSong(data)
        } finally {
            setLoading(false)
        }
    }
    if (id) fetchSong()
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

      {/* Delete button */}
      <button
        onClick={() => setDeleteOpen(true)}
        className="mt-6 px-4 py-2 bg-red-600 rounded-lg hover:bg-red-500"
      >
        Delete Song
      </button>
      {/* Edit button */}
      <button
        onClick={() => setEditOpen(true)}
        className="mt-6 px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-500"
      >
        Edit Song
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
    </div>
  )
}


