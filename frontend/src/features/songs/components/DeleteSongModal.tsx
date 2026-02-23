import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

interface DeleteSongModalProps {
  isOpen: boolean
  onClose: () => void
  songId: string
  songTitle: string
  onDeleted?: () => void
}

export default function DeleteSongModal({
  isOpen,
  onClose,
  songId,
  songTitle,
  onDeleted,
}: DeleteSongModalProps) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

async function handleDelete() {
    console.log("delete")
    setLoading(true)
    setError(null)
    try {
        const res = await fetch(
            `http://localhost:3001/api/songs/${songId}`,
            { method: 'DELETE' }
        )
        const data = await res.json()
        if (!res.ok) {
            throw new Error(data.error || 'Failed to delete song')
        }
        onDeleted?.()
        onClose()   
        } finally {
            setLoading(false)
        }
}
if (!isOpen) return null

return createPortal(
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/60'
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
        <div className='bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md flex flex-col shadow-2xl'>
        <div className='flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-700'>
          <h2 className='text-xl font-bold text-white'>Delete Song</h2>
          <button
            onClick={onClose}
            className='text-gray-400 hover:text-white text-2xl leading-none'
          >
            &times;
          </button>
        </div>
        
        <div className='px-6 py-6'>
          {error && (
            <div className='bg-red-900/50 border border-red-700 rounded-lg p-3 mb-4'>
              <p className='text-red-300 text-sm'>{error}</p>
            </div>
          )}

          <p className='text-gray-300 mb-6'>
            Are you sure you want to delete{' '}
            <span className='text-white font-semibold'>{songTitle}</span>?
            This action cannot be undone.
            </p>
          <div className='flex justify-end gap-3'>
            <button onClick={onClose}
            className='px-4 py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-600'
            disabled={loading}>
            Cancel
            </button>

            <button onClick={handleDelete}
            disabled={loading}
            className='px-4 py-2 rounded-lg bg-red-700 text-white hover:bg-red-600'>
                {loading ? 'Delete': 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
    )
}
