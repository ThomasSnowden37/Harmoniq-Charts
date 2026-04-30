import { useState } from 'react'
import { Box, Button, Card, Flex, Heading, Text } from '@radix-ui/themes'
import { ArrowRight, CheckCircle2, Disc3 } from 'lucide-react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { useAuth } from '../context/AuthContext'
import CandidateMatchesPanel from '../features/proposals/components/CandidateMatchesPanel'
import { ProposalApiError, submitProposal } from '../features/proposals/api'
import type { CandidateMatch } from '../features/proposals/types'
import SongContributorEditor, {
  SONG_FORM_LIMITS,
  artistNamesText,
  serializeProposalArtists,
  serializeProposalCredits,
  type ArtistSelection,
  type SongCreditDraft,
} from '../features/songs/components/SongContributorEditor'
import { InlineSpotifyPicker } from '../features/spotify/components/InlineSpotifyPicker'
import type { SpotifyLookupItem, SpotifyTrack } from '../features/spotify/types'

type NoticeTone = 'success' | 'error' | null

function noticeClasses(tone: NoticeTone): string {
  if (tone === 'success') {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
  }

  if (tone === 'error') {
    return 'border-red-500/30 bg-red-500/10 text-red-200'
  }

  return 'border-border/70 bg-background/70 text-foreground'
}

function formatTrackYear(track: SpotifyTrack | null): string {
  if (!track?.album?.release_date) return 'Unknown'
  return track.album.release_date.split('-')[0] || 'Unknown'
}

function artistNames(track: SpotifyTrack | null): string {
  return track?.artists?.map((artist) => artist.name).join(', ') || 'Unknown artist'
}

export default function CreateSong() {
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [artists, setArtists] = useState<ArtistSelection[]>([])
  const [credits, setCredits] = useState<SongCreditDraft[]>([])
  const [albumName, setAlbumName] = useState('')
  const [genre, setGenre] = useState('')
  const [bpm, setBpm] = useState('')
  const [yearReleased, setYearReleased] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [noticeTone, setNoticeTone] = useState<NoticeTone>(null)
  const [matches, setMatches] = useState<CandidateMatch[]>([])
  const [selectedSpotifyItem, setSelectedSpotifyItem] = useState<SpotifyLookupItem | null>(null)
  const [selectedSpotifyTrack, setSelectedSpotifyTrack] = useState<SpotifyTrack | null>(null)

  function resetManualForm() {
    setTitle('')
    setArtists([])
    setCredits([])
    setAlbumName('')
    setGenre('')
    setBpm('')
    setYearReleased('')
    setReason('')
    setMatches([])
    setSelectedSpotifyItem(null)
    setSelectedSpotifyTrack(null)
  }

  async function fetchTrackDetails(trackId: string): Promise<SpotifyTrack> {
    const response = await fetch(`/api/spotify/tracks/${trackId}`, {
      headers: user ? { 'x-user-id': user.id } : undefined,
    })

    if (!response.ok) {
      throw new Error('Failed to load Spotify track details')
    }

    return response.json()
  }

  async function handleManualSubmit(ignoreMatches = false) {
    if (!user) {
      setNoticeTone('error')
      setNotice('You must be logged in to submit a song suggestion.')
      return
    }

    setLoading(true)
    setNotice(null)
    setNoticeTone(null)

    const proposalArtists = serializeProposalArtists(artists)
    const proposalCredits = serializeProposalCredits(credits)

    try {
      await submitProposal({
        userId: user.id,
        type: 'song_add',
        reason: reason.trim(),
        ignoreMatches,
        payload: {
          title: title.trim().slice(0, SONG_FORM_LIMITS.title),
          artist_name: artistNamesText(artists),
          artists: proposalArtists,
          album_name: albumName.trim().slice(0, SONG_FORM_LIMITS.album),
          genre: genre.trim().slice(0, SONG_FORM_LIMITS.genre) || null,
          bpm: bpm ? Number(bpm) : null,
          year_released: yearReleased ? Number(yearReleased) : null,
          credits: proposalCredits,
          spotify_id: selectedSpotifyTrack?.id ?? null,
        },
      })

      resetManualForm()
      setNoticeTone('success')
      setNotice('Suggestion submitted. The song will stay pending until it is reviewed.')
    } catch (submitError) {
      if (submitError instanceof ProposalApiError && submitError.needsConfirmation) {
        setMatches(submitError.candidateMatches ?? [])
        setNoticeTone('error')
        setNotice('Possible duplicate songs were found. Review them or submit anyway if this entry is genuinely different.')
      } else {
        setNoticeTone('error')
        setNotice(submitError instanceof Error ? submitError.message : 'Failed to submit suggestion')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleSpotifySelection(item: SpotifyLookupItem | null) {
    setSelectedSpotifyItem(item)

    if (!item) {
      setSelectedSpotifyTrack(null)
      return
    }

    const detailedTrack = await fetchTrackDetails(item.id)
    setSelectedSpotifyTrack(detailedTrack)
  }

  const canSubmitSuggestion = Boolean(
    title.trim() && artists.length > 0 && albumName.trim() && yearReleased.trim(),
  )

  return (
    <Box className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <Box className="flex-1 px-4 py-8 md:px-8">
        <div className="mx-auto max-w-6xl space-y-6">
          {notice && (
            <div className={`rounded-2xl border px-4 py-4 text-sm ${noticeClasses(noticeTone)}`}>
              <Flex align="center" gap="2">
                {noticeTone === 'success' && <CheckCircle2 className="h-4 w-4" />}
                <span>{notice}</span>
              </Flex>
            </div>
          )}

          <div className="grid gap-6 xl:grid-cols-[1.45fr_0.85fr]">
            <Card size="3" className="border border-border/70 bg-card/90 backdrop-blur-sm">
              <div className="space-y-5 p-1">
                <div>
                  <Text size="1" className="uppercase tracking-[0.28em] text-foreground/60">Entry Form</Text>
                  <Heading size="6" className="mt-2">Suggest a new song</Heading>
                  <Text size="2" color="gray" className="mt-2 block">
                    This form will open a proposal for other users to review.
                  </Text>
                </div>

                <CandidateMatchesPanel matches={matches} />

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-1.5">
                    <Text size="2" weight="medium">Title</Text>
                    <input
                      value={title}
                      maxLength={SONG_FORM_LIMITS.title}
                      onChange={(event) => setTitle(event.target.value.slice(0, SONG_FORM_LIMITS.title))}
                      className="w-full rounded-2xl border border-border bg-background px-3 py-2.5 text-sm text-foreground"
                      placeholder="Song title"
                    />
                  </label>

                  <label className="space-y-1.5">
                    <Text size="2" weight="medium">Album</Text>
                    <input
                      value={albumName}
                      maxLength={SONG_FORM_LIMITS.album}
                      onChange={(event) => setAlbumName(event.target.value.slice(0, SONG_FORM_LIMITS.album))}
                      className="w-full rounded-2xl border border-border bg-background px-3 py-2.5 text-sm text-foreground"
                      placeholder="Album name"
                    />
                  </label>

                  <div className="md:col-span-2">
                    <SongContributorEditor artists={artists} onArtistsChange={setArtists} credits={credits} onCreditsChange={setCredits} />
                  </div>

                  <label className="space-y-1.5">
                    <Text size="2" weight="medium">Genre</Text>
                    <input
                      value={genre}
                      maxLength={SONG_FORM_LIMITS.genre}
                      onChange={(event) => setGenre(event.target.value.slice(0, SONG_FORM_LIMITS.genre))}
                      className="w-full rounded-2xl border border-border bg-background px-3 py-2.5 text-sm text-foreground"
                      placeholder="Genre"
                    />
                  </label>

                  <label className="space-y-1.5">
                    <Text size="2" weight="medium">BPM</Text>
                    <input
                      value={bpm}
                      onChange={(event) => setBpm(event.target.value)}
                      type="number"
                      min={0}
                      max={SONG_FORM_LIMITS.bpm}
                      className="w-full rounded-2xl border border-border bg-background px-3 py-2.5 text-sm text-foreground"
                      placeholder="Optional"
                    />
                  </label>

                  <label className="space-y-1.5 md:col-span-2">
                    <Text size="2" weight="medium">Year Released</Text>
                    <input
                      value={yearReleased}
                      onChange={(event) => setYearReleased(event.target.value)}
                      type="number"
                      min={0}
                      max={SONG_FORM_LIMITS.year}
                      className="w-full rounded-2xl border border-border bg-background px-3 py-2.5 text-sm text-foreground"
                      placeholder="Release year"
                    />
                  </label>
                </div>

                <label className="block space-y-1.5">
                  <Text size="2" weight="medium">Reasoning / sources (optional)</Text>
                  <textarea
                    value={reason}
                    maxLength={SONG_FORM_LIMITS.reason}
                    onChange={(event) => setReason(event.target.value.slice(0, SONG_FORM_LIMITS.reason))}
                    rows={4}
                    className="w-full rounded-2xl border border-border bg-background px-3 py-3 text-sm text-foreground"
                    placeholder="Add context for reviewers if it helps."
                  />
                </label>

                <Flex justify="between" align="center" gap="3" wrap="wrap">
                  <Text size="2" color="gray">Suggestions stay pending until review. You can optionally attach a Spotify track.</Text>
                  <Flex gap="2" wrap="wrap" justify="end">
                    {matches.length > 0 && (
                      <Button variant="soft" color="orange" disabled={loading || !canSubmitSuggestion} onClick={() => void handleManualSubmit(true)}>
                        {loading ? 'Submitting...' : 'Submit anyway'}
                      </Button>
                    )}
                    <Button disabled={loading || !canSubmitSuggestion} onClick={() => void handleManualSubmit(false)}>
                      {loading ? 'Submitting...' : 'Submit suggestion'}
                      {!loading && <ArrowRight className="ml-1 h-4 w-4" />}
                    </Button>
                  </Flex>
                </Flex>
              </div>
            </Card>

            <Card size="3" className="border border-border/70 bg-card/90">
              <div className="space-y-5 p-1">
                <div>
                  <Text size="1" className="uppercase tracking-[0.28em] text-foreground/60">Platform Linking</Text>
                  <Heading size="6" className="mt-2">Attach a Spotify track</Heading>
                </div>

                <div className="space-y-3 rounded-3xl border border-border/60 bg-[linear-gradient(160deg,rgba(16,185,129,0.12),rgba(10,10,10,0.22))] p-4">
                  <InlineSpotifyPicker
                    entityType="track"
                    userId={user?.id ?? null}
                    value={selectedSpotifyItem}
                    onChange={(item) => {
                      void handleSpotifySelection(item)
                    }}
                    label="Spotify track"
                    description="Search inline or paste a Spotify track link."
                    placeholder="Search Spotify or paste a track link"
                    suggestedQuery={[title.trim(), artistNamesText(artists)].filter(Boolean).join(' ')}
                  />
                </div>
              </div>
            </Card>
          </div>
        </div>

      </Box>
      <Footer />
    </Box>
  )
}