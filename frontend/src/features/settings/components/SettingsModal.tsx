import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { MOCK_CURRENT_USER_ID } from '../../../lib/auth'
import type { PrivacySetting } from '../types'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  currentPrivacy: PrivacySetting
  onPrivacyChange: (privacy: PrivacySetting) => void
  currentUsername: string
  onUsernameChange: (username: string) => void
}

export default function SettingsModal({ 
  isOpen, 
  onClose, 
  currentPrivacy, 
  onPrivacyChange,
  currentUsername,
  onUsernameChange
}: SettingsModalProps) {
  // Privacy State
  const [privacy, setPrivacy] = useState<PrivacySetting>(currentPrivacy)
  const [savingPrivacy, setSavingPrivacy] = useState(false)
  
  // Username State
  const [username, setUsername] = useState(currentUsername)
  const [savingUsername, setSavingUsername] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  // Global Modal State
  const [error, setError] = useState<string | null>(null)

  // Sync local state when modal opens
  useEffect(() => {
    if (isOpen) {
      setPrivacy(currentPrivacy)
      setUsername(currentUsername)
      setError(null)
      setShowSuccess(false)
    }
  }, [isOpen, currentPrivacy, currentUsername])

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  async function handlePrivacyToggle() {
    const newPrivacy: PrivacySetting = privacy === 'public' ? 'private' : 'public'
    setSavingPrivacy(true)
    setError(null)
    try {
      const res = await fetch(`/api/users/${MOCK_CURRENT_USER_ID}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': MOCK_CURRENT_USER_ID,
        },
        body: JSON.stringify({ privacy: newPrivacy }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }
      setPrivacy(newPrivacy)
      onPrivacyChange(newPrivacy)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSavingPrivacy(false)
    }
  }

  async function handleUsernameSave() {
    if (!username.trim() || username === currentUsername) return;
    
    setSavingUsername(true)
    setError(null)
    setShowSuccess(false)
    
    try {
      const res = await fetch(`/api/users/${MOCK_CURRENT_USER_ID}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': MOCK_CURRENT_USER_ID,
        },
        body: JSON.stringify({ username: username.trim() }),
      })
      
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }
      
      onUsernameChange(username.trim())
      setShowSuccess(true)
      
      // Hide success message after 3 seconds
      setTimeout(() => setShowSuccess(false), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSavingUsername(false)
    }
  }

  if (!isOpen) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          {error && (
            <div className="bg-red-900/50 border border-red-700 rounded-lg p-3">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {/* Username Setting */}
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-1">Display Name</h3>
            <p className="text-gray-500 text-xs mb-3">
              This is how you will appear to other users.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                placeholder="Enter new username"
              />
              <button
                onClick={handleUsernameSave}
                disabled={savingUsername || username === currentUsername || !username.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-400 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {savingUsername ? 'Saving...' : 'Save'}
              </button>
            </div>
            {showSuccess && (
              <p className="text-green-400 text-xs mt-2">Username updated successfully!</p>
            )}
          </div>

          {/* Privacy Setting */}
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-1">Account Privacy</h3>
            <p className="text-gray-500 text-xs mb-3">
              Private accounts restrict profile content to friends only.
            </p>
            <div className="flex items-center justify-between bg-gray-800 rounded-lg p-4">
              <div>
                <p className="text-white font-medium">
                  {privacy === 'public' ? 'Public' : 'Private'}
                </p>
                <p className="text-gray-400 text-sm">
                  {privacy === 'public'
                    ? 'Anyone can view your profile'
                    : 'Only friends can view your profile'}
                </p>
              </div>
              <button
                onClick={handlePrivacyToggle}
                disabled={savingPrivacy}
                className={`relative w-12 h-7 rounded-full transition-colors disabled:opacity-50 ${
                  privacy === 'private' ? 'bg-indigo-600' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
                    privacy === 'private' ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>,
    document.body
  )
}