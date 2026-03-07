import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, DropdownMenu, Flex, Heading, IconButton, Text } from '@radix-ui/themes'
import type { Playlist } from '../types'
import CreatePlaylistModal from './CreatePlaylistModal'
import RenamePlaylistModal from './RenamePlaylistModal'
import DeletePlaylistModal from './DeletePlaylistModal'

interface PlaylistSectionProps {
  playlists: Playlist[]
  setPlaylists: React.Dispatch<React.SetStateAction<Playlist[]>>
  isOwnProfile: boolean
}

export default function PlaylistSection({ playlists, setPlaylists, isOwnProfile }: PlaylistSectionProps) {
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false)
  const [renamePlaylist, setRenamePlaylist] = useState<Playlist | null>(null)
  const [deletePlaylist, setDeletePlaylist] = useState<Playlist | null>(null)

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
        {playlists.length === 0 ? (
          <Flex direction="column" align="center" py="6">
            <Text color="gray">No playlists yet.</Text>
            {isOwnProfile && (
              <Text size="2" color="gray" mt="1">
                Create a playlist to share your favorite tracks!
              </Text>
            )}
          </Flex>
        ) : (
          <Flex direction="column" gap="2">
            {playlists.map(playlist => (
              <Flex
                key={playlist.id}
                align="center"
                className="p-3 rounded-lg transition-colors"
                style={{ backgroundColor: 'var(--gray-a3)' }}
                onMouseOver={e => e.currentTarget.style.backgroundColor = 'var(--gray-a4)'}
                onMouseOut={e => e.currentTarget.style.backgroundColor = 'var(--gray-a3)'}
              >
                <Link to={`/playlists/${playlist.id}`} className="flex-1 min-w-0">
                  <Text weight="medium">{playlist.name}</Text>
                  <Text size="1" color="gray" as="p">
                    {playlist.song_count || 0} {playlist.song_count === 1 ? 'song' : 'songs'}
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
            ))}
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
