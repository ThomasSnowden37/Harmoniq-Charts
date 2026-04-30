import { Dialog, Button, Flex, Text } from '@radix-ui/themes'
import { AlertCircle } from 'lucide-react'

interface LoginPromptModalProps {
  isOpen: boolean
  onClose: () => void
  actionName?: string
}

export default function LoginPromptModal({ isOpen, onClose, actionName = "do this" }: LoginPromptModalProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Content maxWidth="400px">
        <Flex gap="3" align="center" mb="3">
          <AlertCircle className="text-primary w-6 h-6" />
          <Dialog.Title mb="0">Sign In Required</Dialog.Title>
        </Flex>
        
        <Dialog.Description size="2" color="gray" mb="4">
          You must be logged in to {actionName}. Sign in or create an account to unlock all community features!
        </Dialog.Description>

        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close>
            <Button variant="soft" color="gray">
              Close
            </Button>
          </Dialog.Close>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}