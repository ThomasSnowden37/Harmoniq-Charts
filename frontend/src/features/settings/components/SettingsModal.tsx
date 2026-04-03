import { useEffect, useState } from 'react'
import { Dialog, Button } from '@radix-ui/themes'
import { X } from 'lucide-react'
import { MOCK_CURRENT_USER_ID } from '../../../lib/auth'
import type { PrivacySetting } from '../types'
import SpotifyConnectButton from '../../spotify/components/SpotifyConnectButton'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  currentPrivacy: PrivacySetting
  onPrivacyChange: (privacy: PrivacySetting) => void
  currentUsername: string
  onUsernameChange: (username: string) => void
  onDeleteAccount: () => void
}

export default function SettingsModal({ 
  isOpen, 
  onClose, 
  currentPrivacy, 
  onPrivacyChange,
  currentUsername,
  onUsernameChange,
  onDeleteAccount,
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

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Content maxWidth="450px" >
        <div className="flex items-center justify-between">
          <Dialog.Title mb="0">Settings</Dialog.Title>
          <Dialog.Close>
            <button className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer" aria-label="Close">
              <X size={18} />
            </button>
          </Dialog.Close>
        </div>

        {/* Content */}
        <div className="pt-4 space-y-6">
          {error && (
            <div className="bg-destructive/20 border border-destructive rounded-lg p-3">
              <p className="text-destructive text-sm">{error}</p>
            </div>
          )}

          {/* Username Setting */}
          <div>
            <h3 className="text-sm font-medium text-foreground mb-1">Display Name</h3>
            <p className="text-muted-foreground text-xs mb-3">
              This is how you will appear to other users.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary"
                placeholder="Enter new username"
              />
              <Button
                size="2"
                onClick={handleUsernameSave}
                disabled={savingUsername || username === currentUsername || !username.trim()}
              >
                {savingUsername ? 'Saving...' : 'Save'}
              </Button>
            </div>
            {showSuccess && (
              <p className="text-success text-xs mt-2">Username updated successfully!</p>
            )}
          </div>

          {/* Privacy Setting */}
          <div>
            <h3 className="text-sm font-medium text-foreground mb-1">Account Privacy</h3>
            <p className="text-muted-foreground text-xs mb-3">
              Private accounts restrict profile content to friends only.
            </p>
            <div className="flex items-center justify-between bg-secondary rounded-lg p-4">
              <div>
                <p className="text-foreground font-medium">
                  {privacy === 'public' ? 'Public' : 'Private'}
                </p>
                <p className="text-muted-foreground text-sm">
                  {privacy === 'public'
                    ? 'Anyone can view your profile'
                    : 'Only friends can view your profile'}
                </p>
              </div>
              <button
                onClick={handlePrivacyToggle}
                disabled={savingPrivacy}
                className={`relative w-12 h-7 rounded-full transition-colors disabled:opacity-50 cursor-pointer ${
                  privacy === 'private' ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-5 h-5 bg-primary-foreground rounded-full transition-transform ${
                    privacy === 'private' ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Spotify Connection */}
          <div>
            <h3 className="text-sm font-medium text-foreground mb-1">Spotify Connection</h3>
            <p className="text-muted-foreground text-xs mb-3">
              Connect your Spotify account to import playlists and link songs.
            </p>
            <div className="bg-secondary rounded-lg p-4">
              <SpotifyConnectButton />
            </div>
          </div>

          {/* Danger Zone */}
          <div>
            <h3 className="text-sm font-medium text-destructive mb-1">Danger Zone</h3>
            <p className="text-muted-foreground text-xs mb-3">
              Permanently delete your account and all associated data.
            </p>
            <Button
              size="2"
              color="red"
              variant="outline"
              onClick={onDeleteAccount}
            >
              Delete Account
            </Button>
          </div>

        </div>
      </Dialog.Content>
    </Dialog.Root>
  )
}