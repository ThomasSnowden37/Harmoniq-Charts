import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, DropdownMenu, Flex, Heading, IconButton, Text } from '@radix-ui/themes'
import { Pin } from 'lucide-react'
import type { Playlist } from '../types'
import CreatePlaylistModal from './CreatePlaylistModal'
import RenamePlaylistModal from './RenamePlaylistModal'
import DeletePlaylistModal from './DeletePlaylistModal'
import { MOCK_CURRENT_USER_ID } from '../../../lib/auth'

interface PlaylistSectionProps {
  playlists: Playlist[]
  setPlaylists: React.Dispatch<React.SetStateAction<Playlist[]>>
  isOwnProfile: boolean
  loading?: boolean
  playlistCount?: number
}

export default function PlaylistSection({ playlists, setPlaylists, isOwnProfile, loading = false, playlistCount }: PlaylistSectionProps) {
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false)
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
            <Button size="2" onClick={() => setShowCreatePlaylist(true)}>
              Create Playlist
            </Button>
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
    </>
  )
}
