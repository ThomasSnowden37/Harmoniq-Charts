import { useEffect, useState } from 'react'
import { Button, Dialog, Flex, Text } from '@radix-ui/themes'
import { Search, X } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { submitProposal } from '../api'
import ProposalThanksDialog from './ProposalThanksDialog'

interface MergeSongRecord {
  id: string
  title: string
  year_released?: number | null
  albums?: { name: string } | null
  song_artists?: Array<{ artists?: { name: string } }>
}

interface MergeProposalModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentUserId: string
  song: MergeSongRecord
  onSubmitted?: () => void
}

function songSummary(song: MergeSongRecord): string {
  const artists = song.song_artists?.map((entry) => entry.artists?.name).filter(Boolean).join(', ') ?? 'Unknown artist'
  const album = song.albums?.name ? ` • ${song.albums.name}` : ''
  const year = song.year_released ? ` • ${song.year_released}` : ''
  return `${artists}${album}${year}`
}

export default function MergeProposalModal({ open, onOpenChange, currentUserId, song, onSubmitted }: MergeProposalModalProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MergeSongRecord[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null)
  const [canonicalSongId, setCanonicalSongId] = useState(song.id)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [thanksOpen, setThanksOpen] = useState(false)

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setResults([])
      return
    }

    let active = true

    async function searchSongs() {
      setSearching(true)
      try {
        const { data, error: searchError } = await supabase
          .from('songs')
          .select(`
            id,
            title,
            year_released,
            albums!left(name),
            song_artists(artists(name))
          `)
          .ilike('title', `%${query.trim()}%`)
          .neq('id', song.id)
          .limit(8)

        if (searchError || !data || !active) return
        setResults(data as MergeSongRecord[])
      } finally {
        if (active) setSearching(false)
      }
    }

    void searchSongs()
    return () => {
      active = false
    }
  }, [open, query, song.id])

  useEffect(() => {
    if (!open) return
    setCanonicalSongId(song.id)
    setSelectedSongId(null)
    setReason('')
    setError(null)
    setQuery('')
    setThanksOpen(false)
  }, [open, song.id])

  const selectedSong = results.find((entry) => entry.id === selectedSongId) ?? null

  async function handleSubmit() {
    if (!selectedSongId) return
    setSubmitting(true)
    setError(null)

    try {
      await submitProposal({
        userId: currentUserId,
        type: 'song_merge',
        reason,
        canonicalSongId,
        payload: {
          canonical_song_id: canonicalSongId,
          candidate_song_ids: [song.id, selectedSongId],
          field_mappings: {},
        },
      })
      onSubmitted?.()
      onOpenChange(false)
      setThanksOpen(true)
    } catch (submitError) {
      const errorMessage = submitError instanceof Error ? submitError.message : 'Failed to submit merge proposal'
      setError(errorMessage)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Content maxWidth="760px">
          <div className="flex items-center justify-between">
            <Dialog.Title mb="0">Propose a merge</Dialog.Title>
            <Dialog.Close>
              <button className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" aria-label="Close">
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-4 space-y-4">
            <Text size="2" color="gray">
              Pick one canonical song. The admin merge executor will re-link associations and write an audit trail when this proposal is approved.
            </Text>

            {error && <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-3 text-sm text-destructive">{error}</div>}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-border/70 bg-background/60 px-4 py-4">
                <Text size="1" className="uppercase tracking-[0.2em] text-muted-foreground">Current song</Text>
                <Text weight="bold" className="block mt-2">{song.title}</Text>
                <Text size="2" color="gray" className="block mt-1">{songSummary(song)}</Text>
                <label className="mt-3 flex items-center gap-2 text-sm text-foreground">
                  <input type="radio" checked={canonicalSongId === song.id} onChange={() => setCanonicalSongId(song.id)} />
                  Use this as canonical
                </label>
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/60 px-4 py-4 space-y-3">
                <label className="block space-y-1">
                  <Text size="1" className="uppercase tracking-[0.2em] text-muted-foreground">Find a duplicate</Text>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search songs by title"
                      className="w-full rounded-xl border border-border bg-background pl-10 pr-3 py-2 text-sm"
                    />
                  </div>
                </label>

                {searching && <Text size="2" color="gray">Searching...</Text>}

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {results.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => setSelectedSongId(result.id)}
                      className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${selectedSongId === result.id ? 'border-primary bg-primary/10' : 'border-border/70 bg-card/60 hover:bg-card'}`}
                    >
                      <Text weight="medium" className="block">{result.title}</Text>
                      <Text size="2" color="gray">{songSummary(result)}</Text>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {selectedSong && (
              <div className="rounded-2xl border border-border/70 bg-card/60 px-4 py-4">
                <Text size="1" className="uppercase tracking-[0.2em] text-muted-foreground">Selected match</Text>
                <Text weight="bold" className="block mt-2">{selectedSong.title}</Text>
                <Text size="2" color="gray" className="block mt-1">{songSummary(selectedSong)}</Text>
                <label className="mt-3 flex items-center gap-2 text-sm text-foreground">
                  <input type="radio" checked={canonicalSongId === selectedSong.id} onChange={() => setCanonicalSongId(selectedSong.id)} />
                  Use selected song as canonical
                </label>
              </div>
            )}

            <label className="block space-y-1">
              <Text size="2" weight="medium">Reasoning / sources (optional)</Text>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={4}
                placeholder="Add context for reviewers if it helps."
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
            </label>

            <Flex justify="end" gap="2">
              <Button variant="soft" color="gray" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
              <Button onClick={() => void handleSubmit()} disabled={submitting || !selectedSongId}>
                {submitting ? 'Submitting...' : 'Submit merge proposal'}
              </Button>
            </Flex>
          </div>
        </Dialog.Content>
      </Dialog.Root>

      <ProposalThanksDialog
        open={thanksOpen}
        onOpenChange={setThanksOpen}
        title="Thanks for the merge suggestion"
        description="Your merge proposal was submitted. Reviewers can inspect the pair and vote before any merge is executed."
      />
    </>
  )
}