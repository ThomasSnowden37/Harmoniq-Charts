import { useEffect, useState } from 'react'
import { Card, Flex, Heading, Text } from '@radix-ui/themes'
import { fetchUserProposals } from '../api'
import type { Proposal } from '../types'
import ProposalCard from './ProposalCard'

interface UserProposalsPanelProps {
  userId: string
  viewerId?: string | null
  reputation?: number | null
}

export default function UserProposalsPanel({ userId, viewerId, reputation }: UserProposalsPanelProps) {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const data = await fetchUserProposals(userId, viewerId)
        if (!active) return
        setProposals(data)
      } catch (loadError) {
        if (!active) return
        const message = loadError instanceof Error ? loadError.message : 'Failed to load contributions'
        setError(message)
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [userId, viewerId])

  return (
    <Card size="3" mt="3" className="space-y-4">
      <div className="rounded-3xl border border-border/70 bg-background/70 px-4 py-4">
        <Text size="1" className="uppercase tracking-[0.25em] text-muted-foreground">Contribution Reputation</Text>
        <Heading size="6" className="mt-2">{(reputation ?? 0).toFixed(1)}</Heading>
        <Text size="2" color="gray" className="block mt-1">
          Proposal voting weight scales from this score. Higher-trust contributors still get more influence, but every review now follows the same weighting rules.
        </Text>
      </div>

      {loading && (
        <Flex justify="center" py="6">
          <Text color="gray">Loading contributions...</Text>
        </Flex>
      )}

      {error && <Text color="red">{error}</Text>}

      {!loading && !error && proposals.length === 0 && (
        <Flex direction="column" align="center" py="6">
          <Text color="gray">No contributions yet.</Text>
          <Text size="2" color="gray" mt="1">Song suggestions and edits will appear here.</Text>
        </Flex>
      )}

      <div className="space-y-3">
        {proposals.map((proposal) => (
          <ProposalCard
            key={proposal.id}
            proposal={proposal}
            currentUserId={viewerId}
            showVoting={viewerId !== userId}
            onUpdated={(updated) => {
              setProposals((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)))
            }}
          />
        ))}
      </div>
    </Card>
  )
}