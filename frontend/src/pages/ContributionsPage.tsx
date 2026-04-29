import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Box, Button, Card, Flex, Heading, Tabs, Text } from '@radix-ui/themes'
import { ArrowRight, RefreshCcw, SkipForward } from 'lucide-react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { useAuth } from '../context/AuthContext'
import { fetchProposalReviewFeed } from '../features/proposals/api'
import type { Proposal } from '../features/proposals/types'
import ProposalCard from '../features/proposals/components/ProposalCard'
import UserProposalsPanel from '../features/proposals/components/UserProposalsPanel'

const REVIEW_BATCH_SIZE = 10

function mergeProposals(current: Proposal[], nextBatch: Proposal[]): Proposal[] {
  const seen = new Set(current.map((proposal) => proposal.id))
  const merged = [...current]

  for (const proposal of nextBatch) {
    if (!seen.has(proposal.id)) {
      merged.push(proposal)
      seen.add(proposal.id)
    }
  }

  return merged
}

export default function ContributionsPage() {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [pending, setPending] = useState<Proposal[]>([])
  const [seenProposalIds, setSeenProposalIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nextOffset, setNextOffset] = useState<number | null>(0)
  const [totalPendingCount, setTotalPendingCount] = useState(0)
  const [availableProposalCount, setAvailableProposalCount] = useState(0)

  const seenProposalIdSet = useMemo(() => new Set(seenProposalIds), [seenProposalIds])
  const unseenPending = useMemo(
    () => pending.filter((proposal) => !seenProposalIdSet.has(proposal.id)),
    [pending, seenProposalIdSet],
  )
  const activeProposal = unseenPending[0] ?? null
  const unseenRemainingCount = unseenPending.length
  const shouldOfferRefresh = !loading && !loadingMore && !error && !activeProposal && availableProposalCount > 0 && nextOffset === null
  const noneRemaining = !loading && !loadingMore && !error && availableProposalCount === 0

  useEffect(() => {
    let active = true

    async function load(initialLoad: boolean) {
      if (!userId) {
        if (!active) return
        setPending([])
        setSeenProposalIds([])
          setTotalPendingCount(0)
          setAvailableProposalCount(0)
        setNextOffset(null)
        setLoading(false)
        setLoadingMore(false)
        setRefreshing(false)
        return
      }

      if (initialLoad) {
        setLoading(true)
      } else if (refreshing) {
        setRefreshing(true)
      } else {
        setLoadingMore(true)
      }

      setError(null)

      try {
        const feed = await fetchProposalReviewFeed(
          {
            status: 'pending',
            limit: String(REVIEW_BATCH_SIZE),
            offset: String(initialLoad ? 0 : (nextOffset ?? 0)),
          },
          userId,
        )

        if (!active) return

        setTotalPendingCount(feed.totalPendingCount)
        setAvailableProposalCount(feed.availableCount)
        setNextOffset(feed.nextOffset)
        setPending((current) => (initialLoad ? feed.proposals : mergeProposals(current, feed.proposals)))
        if (initialLoad) {
          setSeenProposalIds([])
        }
      } catch (loadError) {
        if (!active) return
        const message = loadError instanceof Error ? loadError.message : 'Failed to load community queue'
        setError(message)
      } finally {
        if (!active) return
        if (initialLoad) {
          setLoading(false)
        }
        setLoadingMore(false)
        setRefreshing(false)
      }
    }

    void load(true)
    return () => {
      active = false
    }
  }, [user?.id])

  useEffect(() => {
    if (!userId) return
    if (loading || loadingMore || nextOffset === null) return
    if (unseenRemainingCount > 2) return

    let active = true

    async function prefetchNextBatch() {
      setLoadingMore(true)
      setError(null)

      try {
        const feed = await fetchProposalReviewFeed(
          {
            status: 'pending',
            limit: String(REVIEW_BATCH_SIZE),
            offset: String(nextOffset),
          },
          userId,
        )

        if (!active) return
        setTotalPendingCount(feed.totalPendingCount)
        setAvailableProposalCount(feed.availableCount)
        setNextOffset(feed.nextOffset)
        setPending((current) => mergeProposals(current, feed.proposals))
      } catch (loadError) {
        if (!active) return
        const message = loadError instanceof Error ? loadError.message : 'Failed to load more proposals'
        setError(message)
      } finally {
        if (active) {
          setLoadingMore(false)
        }
      }
    }

    void prefetchNextBatch()

    return () => {
      active = false
    }
  }, [loading, loadingMore, nextOffset, unseenRemainingCount, userId])

  function advanceQueue() {
    if (!activeProposal) return
    setSeenProposalIds((current) => (current.includes(activeProposal.id) ? current : [...current, activeProposal.id]))
  }

  function handleProposalUpdated(updated: Proposal) {
    setPending((current) => {
      if (updated.status !== 'pending' || updated.currentUserVote) {
        return current.filter((entry) => entry.id !== updated.id)
      }

      return current.map((entry) => (entry.id === updated.id ? updated : entry))
    })
    setSeenProposalIds((current) => current.filter((proposalId) => proposalId !== updated.id))
  }

  function handleProposalReviewed(updated: Proposal) {
    setPending((current) => current.filter((entry) => entry.id !== updated.id))
    setSeenProposalIds((current) => current.filter((proposalId) => proposalId !== updated.id))
    setAvailableProposalCount((current) => Math.max(0, current - 1))
    if (updated.status !== 'pending') {
      setTotalPendingCount((current) => Math.max(0, current - 1))
    }
  }

  function refreshQueue() {
    if (!userId) return
    setRefreshing(true)
    setNextOffset(0)
    setPending([])
    setSeenProposalIds([])
    setError(null)
    setLoading(true)
  }

  useEffect(() => {
    if (!refreshing || !userId) return

    let active = true

    async function reloadQueue() {
      try {
        const feed = await fetchProposalReviewFeed(
          {
            status: 'pending',
            limit: String(REVIEW_BATCH_SIZE),
            offset: '0',
          },
          userId,
        )

        if (!active) return
        setPending(feed.proposals)
        setSeenProposalIds([])
        setTotalPendingCount(feed.totalPendingCount)
        setAvailableProposalCount(feed.availableCount)
        setNextOffset(feed.nextOffset)
        setError(null)
      } catch (loadError) {
        if (!active) return
        const message = loadError instanceof Error ? loadError.message : 'Failed to refresh queue'
        setError(message)
      } finally {
        if (active) {
          setLoading(false)
          setLoadingMore(false)
          setRefreshing(false)
        }
      }
    }

    void reloadQueue()

    return () => {
      active = false
    }
  }, [refreshing, userId])

  return (
    <Box className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <Box className="max-w-6xl mx-auto flex-1 w-full p-6 space-y-6">
        <div className="rounded-[28px] border border-border/70 bg-[linear-gradient(135deg,rgba(25,74,128,0.18),rgba(16,28,46,0.78))] px-5 py-4 shadow-[0_18px_60px_rgba(10,25,45,0.16)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <Text size="1" className="uppercase tracking-[0.3em] text-muted-foreground">Contribution System</Text>
              <Heading size="6" className="mt-2 max-w-2xl">Review the queue one proposal at a time.</Heading>
              <Text size="2" color="gray" className="mt-1 block max-w-3xl">
                Vote to move the queue forward, or skip when you are not confident.
              </Text>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-2xl border border-border/60 bg-background/55 px-4 py-2">
                <Text size="1" className="uppercase tracking-[0.18em] text-muted-foreground">Open proposals</Text>
                <Text weight="bold" className="mt-1 block text-foreground">{loading ? '...' : totalPendingCount}</Text>
              </div>
              {user && (
                <Button asChild size="2" className="rounded-full px-4">
                  <Link to="/songs/add">
                    Suggest a new song
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>

        {!user ? (
          <Card size="3" className="p-6">
            <Heading size="5">Login required</Heading>
            <Text color="gray" className="block mt-2">
              Sign in to submit proposals, vote, or see your own pending contributions.
            </Text>
          </Card>
        ) : (
          <Tabs.Root defaultValue="community">
            <Tabs.List>
              <Tabs.Trigger value="community">Community Queue</Tabs.Trigger>
              <Tabs.Trigger value="mine">My Contributions</Tabs.Trigger>
            </Tabs.List>

            <Tabs.Content value="community">
              <Card size="3" mt="3" className="space-y-4">
                {loading && <Text color="gray">Loading proposal queue...</Text>}
                {!loading && loadingMore && <Text color="gray">Loading more proposals...</Text>}
                {error && <Text color="red">{error}</Text>}
                {!loading && !error && noneRemaining && <Text color="gray">None remaining. You have reviewed everything currently available.</Text>}
                {!loading && !error && shouldOfferRefresh && (
                  <div className="flex min-h-48 flex-col items-center justify-center gap-4 rounded-2xl border border-border/60 bg-background/45 px-6 py-8 text-center">
                    <Text color="gray" className="max-w-md">No new proposals right now. Refresh to see skipped ones again.</Text>
                    <Button variant="soft" color="gray" onClick={refreshQueue} disabled={refreshing} className="mx-auto rounded-full px-5">
                      <RefreshCcw className="h-4 w-4" />
                      Refresh queue
                    </Button>
                  </div>
                )}

                {!loading && !error && activeProposal && (
                  <div className="space-y-4">
                    <ProposalCard
                      key={activeProposal.id}
                      proposal={activeProposal}
                      currentUserId={user.id}
                      showReportAction={false}
                      onUpdated={handleProposalUpdated}
                      onReviewed={handleProposalReviewed}
                    />

                    <Flex justify="end" align="center">
                      <Button variant="soft" color="gray" onClick={advanceQueue}>
                        <SkipForward className="h-4 w-4" />
                        Skip
                      </Button>
                    </Flex>
                  </div>
                )}
              </Card>
            </Tabs.Content>

            <Tabs.Content value="mine">
              <UserProposalsPanel userId={user.id} viewerId={user.id} />
            </Tabs.Content>
          </Tabs.Root>
        )}
      </Box>
      <Footer />
    </Box>
  )
}