import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../../../context/AuthContext'

interface DeleteUserModalProps {
  isOpen: boolean
  onClose: () => void
  onDeleted?: () => void
}

export default function DeleteUserModal({
  isOpen,
  onClose,
  onDeleted,
}: DeleteUserModalProps) {
    const { user, logout } = useAuth()        
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

async function handleDelete() {
    if (!user) {
      setError("You must be logged in to delete your account")
      return
    }
    setLoading(true)
    setSuccess(null)
    setError(null)
    try {
        const res = await fetch(
            `http://localhost:3001/api/users/${user.id}`,
            { method: 'DELETE',
              headers: {
                'x-user-id': user.id 
              },
            })
            
        const text = await res.text()
    let data
    try {
      data = JSON.parse(text)   
    } catch {
      data = null              
    }
        setSuccess('Song deleted successfully')
        setTimeout(() => {
            setSuccess(null)
            onClose()
            logout()
            onDeleted?.()
        },1000)

        } catch (err: any) {
          setError(err.message)  
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
          <h2 className='text-xl font-bold text-white'>Delete Account</h2>
          <button
            onClick={onClose}
            className='text-gray-400 hover:text-white text-2xl leading-none'
          >
            &times;
          </button>
        </div>
        <div className='px-6 py-6'>
          {success && (
            <div className='bg-green-900/50 border border-green-700 rounded-lg p-3 mb-4'>
              <p className='text-green-300 text-sm'>{success}</p>
            </div>
          )}
          {error && (
            <div className='bg-red-900/50 border border-red-700 rounded-lg p-3 mb-4'>
              <p className='text-red-300 text-sm'>{error}</p>
            </div>
          )}
          {!success && (
          <p className='text-gray-300 mb-6'>
            Are you sure you want to delete your account?
            This action cannot be undone.
            </p>
          )}
          <div className='flex justify-end gap-3'>
            { success ? (
               <button onClick={() => {
                        onDeleted?.()
                        onClose()
              }}
               className='px-4 py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-600'
              >
                Close
              </button>
            ) : (
            <>
            <button onClick={onClose}
            className='px-4 py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-600'
            disabled={loading}>
            Cancel
            </button>

            <button onClick={handleDelete}
            disabled={loading}
            className='px-4 py-2 rounded-lg bg-red-700 text-white hover:bg-red-600'>
                {loading ? 'Deleting': 'Delete Account'}
            </button>
            </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
    )
}
