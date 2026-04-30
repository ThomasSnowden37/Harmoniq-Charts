import { useState } from 'react'
import { Box, Button, Dialog, Text } from '@radix-ui/themes'
import { X } from 'lucide-react'
import { banUser } from '../api'

interface BanUserModalProps {
  isOpen: boolean
  onClose: () => void
  targetUserId: string
  adminUserId: string
  onBanned?: () => void
}

export default function BanUserModal({
  isOpen,
  onClose,
  targetUserId,
  adminUserId,
  onBanned,
}: BanUserModalProps) {
  const [duration, setDuration] = useState('24')
  const [unit, setUnit] = useState<'hours' | 'days' | 'minutes'>('hours')
  const [customEndTime, setCustomEndTime] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleSubmit() {
    if (!adminUserId) {
      setError('You must be logged in as an admin to ban a user.')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const body: { durationMinutes?: number; endTime?: string } = {}

      if (customEndTime) {
        const endDate = new Date(customEndTime)
        if (Number.isNaN(endDate.getTime())) {
          throw new Error('Enter a valid end time')
        }
        body.endTime = endDate.toISOString()
      } else {
        const rawDuration = Number(duration)
        if (Number.isNaN(rawDuration) || rawDuration <= 0) {
          throw new Error('Enter a valid duration')
        }

        const multiplier = unit === 'days' ? 1440 : unit === 'hours' ? 60 : 1
        body.durationMinutes = rawDuration * multiplier
      }

      await banUser(targetUserId, adminUserId, body)
      setSuccess('User has been banned successfully.')
      onBanned?.()
    } catch (err: any) {
      setError(err?.message ?? 'Failed to ban user')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Content maxWidth="520px">
        <div className="flex items-center justify-between">
          <Dialog.Title mb="0">Ban</Dialog.Title>
          <Dialog.Close>
            <button
              className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </Dialog.Close>
        </div>

        <div className="pt-4 space-y-4">
          <Text size="2" color="gray">
            Create a temporary ban for this user. Choose a duration or enter a specific end time.
          </Text>

          {success && (
            <Box className="bg-success/20 border border-success rounded-lg p-3">
              <Text className="text-success">{success}</Text>
            </Box>
          )}

          {error && (
            <Box className="bg-destructive/20 border border-destructive rounded-lg p-3">
              <Text className="text-destructive">{error}</Text>
            </Box>
          )}

          <div className="grid gap-4">
            <label className="space-y-2">
              <span className="text-sm text-gray-600">Duration</span>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  value={duration}
                  onChange={(event) => setDuration(event.target.value)}
                  className="w-24 rounded-xl border border-border px-3 py-2 bg-background"
                />
                <select
                  value={unit}
                  onChange={(event) => setUnit(event.target.value as any)}
                  className="rounded-xl border border-border px-3 py-2 bg-background"
                >
                  <option value="minutes">minutes</option>
                  <option value="hours">hours</option>
                  <option value="days">days</option>
                </select>
              </div>
            </label>

            <label className="space-y-2">
              <span className="text-sm text-gray-600">Or end time</span>
              <input
                type="datetime-local"
                value={customEndTime}
                onChange={(event) => setCustomEndTime(event.target.value)}
                className="w-full rounded-xl border border-border px-3 py-2 bg-background"
              />
              <Text size="1" color="gray">
                If an end time is provided, it will be used instead of duration.
              </Text>
            </label>
          </div>

          <div className="flex justify-end gap-3">
            <Button size="2" variant="soft" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button color="red" size="2" onClick={handleSubmit} disabled={loading}>
              {loading ? 'Banning...' : 'Ban User'}
            </Button>
          </div>
        </div>
      </Dialog.Content>
    </Dialog.Root>
  )
}
