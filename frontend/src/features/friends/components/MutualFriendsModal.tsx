import { Dialog, Flex, Heading, Text, Avatar } from '@radix-ui/themes'
import { X } from 'lucide-react'
import { Link } from 'react-router-dom'

interface MutualFriendsModalProps {
  isOpen: boolean
  onClose: () => void
  mutualFriends: { id: string; username: string }[]
}

export default function MutualFriendsModal({ isOpen, onClose, mutualFriends }: MutualFriendsModalProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={open => { if (!open) onClose() }}>
      <Dialog.Content maxWidth="500px" style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div className="flex items-center justify-between">
          <Dialog.Title mb="0">Mutual Friends ({mutualFriends.length})</Dialog.Title>
          <Dialog.Close>
            <button className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer" aria-label="Close">
              <X size={18} />
            </button>
          </Dialog.Close>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {mutualFriends.length === 0 ? (
            <div className="text-center py-6">
              <Text color="gray">No mutual friends.</Text>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {mutualFriends.map(friend => (
                <Link
                  key={friend.id}
                  to={`/user/${friend.id}`}
                  className="no-underline"
                  onClick={() => onClose()}
                >
                  <Flex align="center" gap="3" className="p-2 rounded-lg transition-colors hover-bg-gray">
                    <Avatar size="3" fallback={friend.username.slice(0, 2).toUpperCase()} variant="solid" />
                    <Text size="2" weight="medium">{friend.username}</Text>
                  </Flex>
                </Link>
              ))}
            </div>
          )}
        </div>
      </Dialog.Content>
    </Dialog.Root>
  )
}
