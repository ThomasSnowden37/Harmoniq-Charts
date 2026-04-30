import { useEffect, useState, type ChangeEvent } from 'react'
import { Dialog, Button } from '@radix-ui/themes'
import { X } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { supabase } from '../../../lib/supabase'
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
  onPictureUrlChange?: (url: string) => void
}

export default function SettingsModal({ 
  isOpen, 
  onClose, 
  currentPrivacy, 
  onPrivacyChange,
  currentUsername,
  onUsernameChange,
  onDeleteAccount,
  onPictureUrlChange,
}: SettingsModalProps) {
  const { user, updateUser } = useAuth()
  // Privacy State
  const [privacy, setPrivacy] = useState<PrivacySetting>(currentPrivacy)
  const [savingPrivacy, setSavingPrivacy] = useState(false)
  
  // Username State
  const [username, setUsername] = useState(currentUsername)
  const [savingUsername, setSavingUsername] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  // Profile Picture State
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploadingPicture, setUploadingPicture] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [pictureSuccess, setPictureSuccess] = useState(false)

  // Global Modal State
  const [error, setError] = useState<string | null>(null)

  // Sync local state when modal opens
  useEffect(() => {
    if (isOpen) {
      setPrivacy(currentPrivacy)
      setUsername(currentUsername)
      setError(null)
      setShowSuccess(false)
      setUploadError(null)
      setPictureSuccess(false)
      setSelectedFile(null)
    }
  }, [isOpen, currentPrivacy, currentUsername])

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null)
      return
    }

    const url = URL.createObjectURL(selectedFile)
    setPreviewUrl(url)

    return () => URL.revokeObjectURL(url)
  }, [selectedFile])

  async function handlePrivacyToggle() {
    const newPrivacy: PrivacySetting = privacy === 'public' ? 'private' : 'public'
    setSavingPrivacy(true)
    setError(null)
    try {
      const res = await fetch(`/api/users/${user?.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user?.id || '',
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
      const res = await fetch(`/api/users/${user?.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user?.id || '',
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

  async function handlePictureUpload() {
    if (!user?.id || !selectedFile) return
    setUploadingPicture(true)
    setUploadError(null)
    setPictureSuccess(false)
    setError(null)

    try {
      const fileName = selectedFile.name.replace(/\s+/g, '_')
      const path = `${user.id}/${Date.now()}_${fileName}`

      const { error: uploadError } = await supabase
        .storage
        .from('profile_picture')
        .upload(path, selectedFile, { cacheControl: '3600', upsert: true })

      if (uploadError) throw uploadError

      const { data: urlData } = await supabase
        .storage
        .from('profile_picture')
        .getPublicUrl(path)

      if (!urlData?.publicUrl) {
        throw new Error('Failed to generate profile picture URL')
      }

      const publicUrl = urlData.publicUrl
      
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
        },
        body: JSON.stringify({ picture_url: publicUrl }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save profile picture')
      }

      const updated = await res.json()
      updateUser?.({ picture: updated.picture_url ?? user.picture })
      onPictureUrlChange?.(updated.picture_url ?? '')
      setSelectedFile(null)
      setPictureSuccess(true)
      setTimeout(() => setPictureSuccess(false), 3000)
    } catch (err: any) {
      setUploadError(err.message)
    } finally {
      setUploadingPicture(false)
    }
  }

  function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    setSelectedFile(file)
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

          {/* Profile Picture Setting */}
          <div>
            <h3 className="text-sm font-medium text-foreground mb-1">Profile Picture</h3>
            <p className="text-muted-foreground text-xs mb-3">
              Upload an image for your account avatar.
            </p>
            <div className="flex items-center gap-4 mb-3">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-muted flex items-center justify-center">
                {previewUrl ? (
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                ) : user?.picture ? (
                  <img src={user.picture} alt="Current avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-lg font-bold text-foreground">
                    {currentUsername.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelection}
                  className="text-sm text-muted-foreground"
                />
                <Button
                  size="2"
                  onClick={handlePictureUpload}
                  disabled={!selectedFile || uploadingPicture}
                >
                  {uploadingPicture ? 'Uploading...' : 'Upload'}
                </Button>
                {uploadError && <p className="text-destructive text-xs">{uploadError}</p>}
                {pictureSuccess && <p className="text-success text-xs">Profile picture updated successfully!</p>}
              </div>
            </div>
          </div>

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