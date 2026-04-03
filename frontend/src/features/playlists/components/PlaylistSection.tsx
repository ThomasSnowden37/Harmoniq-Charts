import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, DropdownMenu, Flex, Heading, IconButton, Text } from '@radix-ui/themes'
import { Pin } from 'lucide-react'
import type { Playlist } from '../types'
import CreatePlaylistModal from './CreatePlaylistModal'
import RenamePlaylistModal from './RenamePlaylistModal'
import DeletePlaylistModal from './DeletePlaylistModal'
import ImportPlaylistModal from '../../spotify/components/ImportPlaylistModal'
import { useSpotify } from '../../spotify/context/SpotifyContext'
import { MOCK_CURRENT_USER_ID } from '../../../lib/auth'

interface PlaylistSectionProps {
  playlists: Playlist[]
  setPlaylists: React.Dispatch<React.SetStateAction<Playlist[]>>
  isOwnProfile: boolean
  loading?: boolean
  playlistCount?: number
}

export default function PlaylistSection({ playlists, setPlaylists, isOwnProfile, loading = false, playlistCount }: PlaylistSectionProps) {
  const { isConnected } = useSpotify()
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false)
  const [showImportPlaylist, setShowImportPlaylist] = useState(false)
  const [renamePlaylist, setRenamePlaylist] = useState<Playlist | null>(null)
  const [deletePlaylist, setDeletePlaylist] = useState<Playlist | null>(null)

  async function togglePin(playlist: Playlist) {
    try {
      const res = await fetch(`/api/playlists/${playlist.id}/pin`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': MOCK_CURRENT_USER_ID,
        },
        body: JSON.stringify({ is_pinned: !playlist.is_pinned }),
      })
      if (res.ok) {
        setPlaylists(prev =>
          prev.map(p => p.id === playlist.id ? { ...p, is_pinned: !p.is_pinned } : p)
        )
      }
    } catch {}
  }

  const pinnedPlaylists = playlists.filter(p => p.is_pinned)
  const unpinnedPlaylists = playlists.filter(p => !p.is_pinned)

  function renderPlaylistItem(playlist: Playlist) {
    return (
      <Flex
        key={playlist.id}
        align="center"
        className="p-3 rounded-lg transition-colors hover-bg-gray"
        style={{ position: 'relative' }}
      >
        {playlist.is_pinned && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            transform: 'translate(-40%, -40%)',
            width: 23,
            height: 23,
            borderRadius: 999,
            backgroundColor: 'var(--blue-12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none'
          }}>
            <Pin size={16} color="var(--blue-1)" />
          </div>
        )}

        <Link to={`/playlists/${playlist.id}`} className="flex-1 min-w-0">
          <Flex align="center" gap="1">
            <Text weight="medium">{playlist.name}</Text>
          </Flex>
          <Text size="1" color="gray" as="p">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <Text size="1" color="gray" as="span">{playlist.song_count || 0}</Text>
              <Text size="1" color="gray" as="span">{playlist.song_count === 1 ? 'song' : 'songs'}</Text>
            </span>
            <span style={{ margin: '0 8px', color: 'var(--gray-9)' }}>·</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <Text size="1" color="gray" as="span">{playlist.likes_count || 0}</Text>
              <Text size="1" color={playlist.liked ? 'blue' : 'gray'} as="span">{playlist.liked ? '♥' : '♡'}</Text>
            </span>
          </Text>
        </Link>
        {isOwnProfile && (
          <DropdownMenu.Root modal={false}>
            <DropdownMenu.Trigger>
              <IconButton variant="ghost" size="3">
                <svg width="18" height="18" viewBox="0 0 15 15" fill="currentColor">
                  <circle cx="7.5" cy="2.5" r="1.25" />
                  <circle cx="7.5" cy="7.5" r="1.25" />
                  <circle cx="7.5" cy="12.5" r="1.25" />
                </svg>
              </IconButton>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content size="2">
              <DropdownMenu.Item onClick={() => togglePin(playlist)}>
                {playlist.is_pinned ? 'Unpin' : 'Pin'}
              </DropdownMenu.Item>
              <DropdownMenu.Item onClick={() => setRenamePlaylist(playlist)}>
                Rename
              </DropdownMenu.Item>
              <DropdownMenu.Item color="red" onClick={() => setDeletePlaylist(playlist)}>
                Delete
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        )}
      </Flex>
    )
  }

  return (
    <>
      <Card size="3" mt="3">
        <Flex justify="between" align="center" mb="4">
          <Heading size="4">Playlists</Heading>
          {isOwnProfile && (
            <Flex gap="2">
              {isConnected && (
                <Button
                  size="2"
                  variant="soft"
                  onClick={() => setShowImportPlaylist(true)}
                  style={{ backgroundColor: '#1DB954', color: 'white' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '4px' }}>
                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                  </svg>
                  Import
                </Button>
              )}
              <Button size="2" onClick={() => setShowCreatePlaylist(true)}>
                Create Playlist
              </Button>
            </Flex>
          )}
        </Flex>
        {loading ? (
          <Flex direction="column" gap="1">
            {(() => {
              const count = (playlistCount && playlistCount > 0) ? playlistCount : 3
              return Array.from({ length: count }).map((_, i) => (
                <Flex key={i} align="center" gap="2" className="p-4 rounded-lg" style={{ backgroundColor: 'var(--gray-a3)' }}>
                  <div style={{ width: 28, height: 16, borderRadius: 4, backgroundColor: 'var(--gray-a4)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="animate-pulse" style={{ height: 14, width: '55%', borderRadius: 4, backgroundColor: 'var(--gray-a4)' }} />
                    <div className="animate-pulse" style={{ height: 12, width: '35%', borderRadius: 4, marginTop: 8, backgroundColor: 'var(--gray-a4)' }} />
                  </div>
                </Flex>
              ))
            })()}
          </Flex>
        ) : playlists.length === 0 ? (
          <Flex direction="column" align="center" py="6">
            <Text color="gray">No playlists yet.</Text>
            {isOwnProfile && (
              <Text size="2" color="gray" mt="1">
                Create a playlist to share your favorite tracks!
              </Text>
            )}
          </Flex>
        ) : (
          <Flex direction="column" gap="1">
            {pinnedPlaylists.length > 0 && (
              <Flex direction="column" gap="2">
                {pinnedPlaylists.map(renderPlaylistItem)}
              </Flex>
            )}
            {unpinnedPlaylists.length > 0 && (
              <Flex direction="column" gap="1">
                {unpinnedPlaylists.map(renderPlaylistItem)}
              </Flex>
            )}
          </Flex>
        )}
      </Card>

      <CreatePlaylistModal
        isOpen={showCreatePlaylist}
        onClose={() => setShowCreatePlaylist(false)}
        onCreated={playlist => setPlaylists(prev => [playlist, ...prev])}
      />

      {renamePlaylist && (
        <RenamePlaylistModal
          isOpen={!!renamePlaylist}
          onClose={() => setRenamePlaylist(null)}
          playlistId={renamePlaylist.id}
          currentName={renamePlaylist.name}
          onRenamed={(id, newName) => setPlaylists(prev =>
            prev.map(p => p.id === id ? { ...p, name: newName } : p)
          )}
        />
      )}

      {deletePlaylist && (
        <DeletePlaylistModal
          isOpen={!!deletePlaylist}
          onClose={() => setDeletePlaylist(null)}
          playlistId={deletePlaylist.id}
          playlistName={deletePlaylist.name}
          onDeleted={id => setPlaylists(prev => prev.filter(p => p.id !== id))}
        />
      )}

      <ImportPlaylistModal
        isOpen={showImportPlaylist}
        onClose={() => setShowImportPlaylist(false)}
        onImported={async () => {
          // Refetch playlists after import
          try {
            const userId = localStorage.getItem('harmoniq_user') 
              ? JSON.parse(localStorage.getItem('harmoniq_user')!).id 
              : null
            if (userId) {
              const res = await fetch(`/api/playlists/user/${userId}`)
              if (res.ok) {
                const data = await res.json()
                setPlaylists(data)
              }
            }
          } catch (err) {
            console.error('Failed to refresh playlists:', err)
          }
        }}
      />
    </>
  )
}
