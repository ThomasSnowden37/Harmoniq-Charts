import { Button, Dialog, Flex, Text } from '@radix-ui/themes'

interface ProposalThanksDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
}

export default function ProposalThanksDialog({
  open,
  onOpenChange,
  title = 'Thanks for the edit suggestion',
  description = 'Your proposal is in the review queue now. Nothing changed live yet, but reviewers can pick it up right away.',
}: ProposalThanksDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="420px">
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Description size="2" color="gray">
          {description}
        </Dialog.Description>

        <div className="mt-4 rounded-2xl border border-emerald-400/25 bg-emerald-400/8 px-4 py-3">
          <Text size="2" className="block text-emerald-100">
            Reviewers will see your suggestion in the queue and vote on whether it should go live.
          </Text>
        </div>

        <Flex justify="end" mt="4">
          <Button onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
