import { useEffect, useState } from 'react'
import { Box, Card, Flex, Heading, Tabs, Text } from '@radix-ui/themes'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { useAuth } from '../context/AuthContext'
import { fetchAdminQueue, fetchAdminReports } from '../features/proposals/api'
import type { Proposal, ProposalReport } from '../features/proposals/types'
import ProposalCard from '../features/proposals/components/ProposalCard'

export default function AdminProposalsPage() {
  const { user } = useAuth()
  const [queue, setQueue] = useState<Proposal[]>([])
  const [reports, setReports] = useState<ProposalReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function load() {
      if (!user) return

      setLoading(true)
      setError(null)
      try {
        const [queueData, reportData] = await Promise.all([
          fetchAdminQueue(user.id, { status: 'pending' }),
          fetchAdminReports(user.id),
        ])
        if (!active) return
        setQueue(queueData)
        setReports(reportData)
      } catch (loadError) {
        if (!active) return
        const message = loadError instanceof Error ? loadError.message : 'Failed to load admin dashboard'
        setError(message)
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [user])

  return (
    <Box className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <Box className="max-w-6xl mx-auto flex-1 w-full p-6 space-y-6">

        {!user && (
          <Card size="3" className="p-6">
            <Text color="gray">Sign in with an admin account to access moderation tools.</Text>
          </Card>
        )}

        {user && (
          <Tabs.Root defaultValue="queue">
            <Tabs.List>
              <Tabs.Trigger value="queue">Proposal Queue</Tabs.Trigger>
              <Tabs.Trigger value="reports">Reports</Tabs.Trigger>
            </Tabs.List>

            <Tabs.Content value="queue">
              <Card size="3" mt="3" className="space-y-4">
                {loading && <Text color="gray">Loading queue...</Text>}
                {error && <Text color="red">{error}</Text>}
                {!loading && !error && queue.length === 0 && <Text color="gray">No proposals waiting for review.</Text>}

                <div className="space-y-3">
                  {queue.map((proposal) => (
                    <ProposalCard
                      key={proposal.id}
                      proposal={proposal}
                      currentUserId={user.id}
                      showVoting={false}
                      showAdminActions
                      onUpdated={(updated) => {
                        setQueue((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)))
                      }}
                    />
                  ))}
                </div>
              </Card>
            </Tabs.Content>

            <Tabs.Content value="reports">
              <Card size="3" mt="3" className="space-y-3">
                <Heading size="5">Reports</Heading>
                {loading && <Text color="gray">Loading reports...</Text>}
                {error && <Text color="red">{error}</Text>}
                {!loading && !error && reports.length === 0 && <Text color="gray">No reports in the queue.</Text>}

                {reports.map((report) => (
                  <div key={report.id} className="rounded-2xl border border-border/70 bg-background/60 px-4 py-4">
                    <Flex justify="between" align="start" gap="3" wrap="wrap">
                      <div>
                        <Text weight="bold" className="block text-foreground">{report.category}</Text>
                        <Text size="2" color="gray" className="block mt-1">{report.details}</Text>
                        <Text size="1" color="gray" className="block mt-2">
                          {new Date(report.created_at).toLocaleString()} • status: {report.status}
                        </Text>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-card/80 px-3 py-2 min-w-48">
                        <Text size="1" color="gray" className="block">Proposal</Text>
                        <Text size="2" className="block text-foreground">
                          {report.proposal?.reason ?? 'Proposal unavailable'}
                        </Text>
                      </div>
                    </Flex>
                  </div>
                ))}
              </Card>
            </Tabs.Content>
          </Tabs.Root>
        )}
      </Box>
      <Footer />
    </Box>
  )
}