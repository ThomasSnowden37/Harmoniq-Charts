import { useState } from 'react'
import { Button, Dialog, Flex, Text } from '@radix-ui/themes'
import { X } from 'lucide-react'
import { reportProposal } from '../api'

interface ReportProposalModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  proposalId: string
  userId: string
  onReported?: () => void
}

const REPORT_OPTIONS = [
  { value: 'spam', label: 'Spam or duplicate' },
  { value: 'abuse', label: 'Abusive or malicious' },
  { value: 'invalid', label: 'Invalid data' },
  { value: 'other', label: 'Other' },
]

export default function ReportProposalModal({ open, onOpenChange, proposalId, userId, onReported }: ReportProposalModalProps) {
  const [category, setCategory] = useState('invalid')
  const [details, setDetails] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleSubmit() {
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      await reportProposal(proposalId, userId, category, details)
      setSuccess('Report submitted for admin review.')
      onReported?.()
    } catch (reportError) {
      const message = reportError instanceof Error ? reportError.message : 'Failed to submit report'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="460px">
        <div className="flex items-center justify-between">
          <Dialog.Title mb="0">Report contribution</Dialog.Title>
          <Dialog.Close>
            <button className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" aria-label="Close">
              <X size={18} />
            </button>
          </Dialog.Close>
        </div>

        <div className="mt-4 space-y-4">
          {error && <Text color="red" size="2">{error}</Text>}
          {success && <Text color="green" size="2">{success}</Text>}

          <label className="block space-y-1">
            <Text size="2" weight="medium">Category</Text>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              {REPORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="block space-y-1">
            <Text size="2" weight="medium">Details</Text>
            <textarea
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              rows={4}
              placeholder="Explain what looks wrong so admins can triage it quickly."
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>

          <Flex justify="end" gap="2">
            <Button variant="soft" color="gray" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading || !details.trim()}>
              {loading ? 'Submitting...' : 'Submit report'}
            </Button>
          </Flex>
        </div>
      </Dialog.Content>
    </Dialog.Root>
  )
}