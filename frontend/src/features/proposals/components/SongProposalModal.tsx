import { useEffect, useState } from 'react'
import { Button, Dialog, Flex, Text } from '@radix-ui/themes'
import { X } from 'lucide-react'
import { submitProposal } from '../api'
import SongContributorEditor, {
  SONG_FORM_LIMITS,
  artistNamesText,
  serializeProposalArtists,
  serializeProposalCredits,
  type ArtistSelection,
  type SongCreditDraft,
} from '../../songs/components/SongContributorEditor'
import { InlineSpotifyPicker } from '../../spotify/components/InlineSpotifyPicker'
import type { SpotifyLookupItem } from '../../spotify/types'
import ProposalThanksDialog from './ProposalThanksDialog'

interface EditableSong {
  id: string
  title: string
  bpm?: number | null
  genre?: string | null
  year_released?: number | null
  spotify_id?: string | null
  albums?: { name: string } | null
  song_artists?: Array<{ artists?: { id?: string; name: string } }>
  song_credits?: Array<{
    role?: string | null
    artist_id?: string | null
    artist_name?: string | null
    artists?: { id?: string; name: string } | Array<{ id?: string; name: string }> | null
  }>
}

interface SongSuggestionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentUserId: string
  song: EditableSong
  onSubmitted?: () => void
}

function songArtists(song: EditableSong): ArtistSelection[] {
  return song.song_artists
    ?.map((entry) => {
      const artist = entry.artists
      if (!artist?.name) return null
      return artist.id ? { id: artist.id, name: artist.name } : { name: artist.name }
    })
    .filter((artist): artist is ArtistSelection => Boolean(artist)) ?? []
}

function songCredits(song: EditableSong): SongCreditDraft[] {
  return song.song_credits
    ?.map((entry) => {
      const relatedArtist = Array.isArray(entry.artists) ? entry.artists[0] : entry.artists
      const artistName = relatedArtist?.name ?? entry.artist_name ?? null
      const artist = artistName
        ? relatedArtist?.id
          ? { id: relatedArtist.id, name: artistName }
          : { name: artistName }
        : null

      return {
        artist,
        role: entry.role ?? '',
      }
    })
    .filter((entry) => entry.artist || entry.role.trim()) ?? []
}

function inputClassName(changed: boolean): string {
  return `w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none transition ${changed
    ? 'border-amber-400/80 bg-amber-400/5 ring-1 ring-amber-300/25 focus:border-amber-300 focus:ring-2 focus:ring-amber-300/35'
    : 'border-border focus:border-sky-300/50 focus:ring-2 focus:ring-sky-300/20'}`
}

function sectionClassName(changed: boolean): string {
  return `rounded-2xl border p-3 transition ${changed
    ? 'border-amber-400/80 bg-amber-400/5 ring-1 ring-amber-300/20'
    : 'border-border/70 bg-background/35'}`
}

function normalizedNumberText(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return ''
  return String(value).trim()
}

function sameSerializedValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

export default function SongSuggestionModal({ open, onOpenChange, currentUserId, song, onSubmitted }: SongSuggestionModalProps) {
  const [title, setTitle] = useState(song.title)
  const [artists, setArtists] = useState<ArtistSelection[]>(songArtists(song))
  const [credits, setCredits] = useState<SongCreditDraft[]>(songCredits(song))
  const [albumName, setAlbumName] = useState(song.albums?.name ?? '')
  const [genre, setGenre] = useState(song.genre ?? '')
  const [bpm, setBpm] = useState(song.bpm ? String(song.bpm) : '')
  const [yearReleased, setYearReleased] = useState(song.year_released ? String(song.year_released) : '')
  const [spotifyTrack, setSpotifyTrack] = useState<SpotifyLookupItem | null | undefined>(undefined)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [thanksOpen, setThanksOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    setTitle(song.title)
    setArtists(songArtists(song))
    setCredits(songCredits(song))
    setAlbumName(song.albums?.name ?? '')
    setGenre(song.genre ?? '')
    setBpm(song.bpm ? String(song.bpm) : '')
    setYearReleased(song.year_released ? String(song.year_released) : '')
    setSpotifyTrack(undefined)
    setReason('')
    setMessage(null)
    setThanksOpen(false)
  }, [open, song])

  const originalArtists = serializeProposalArtists(songArtists(song))
  const originalCredits = serializeProposalCredits(songCredits(song))
  const currentArtists = serializeProposalArtists(artists)
  const currentCredits = serializeProposalCredits(credits)
  const currentSpotifyId = spotifyTrack === undefined ? (song.spotify_id ?? null) : (spotifyTrack?.id ?? null)

  const titleChanged = title.trim() !== song.title.trim()
  const albumChanged = albumName.trim() !== (song.albums?.name ?? '').trim()
  const genreChanged = genre.trim() !== (song.genre ?? '').trim()
  const bpmChanged = normalizedNumberText(bpm) !== normalizedNumberText(song.bpm)
  const yearChanged = normalizedNumberText(yearReleased) !== normalizedNumberText(song.year_released)
  const artistsChanged = !sameSerializedValue(currentArtists, originalArtists)
  const creditsChanged = !sameSerializedValue(currentCredits, originalCredits)
  const spotifyChanged = currentSpotifyId !== (song.spotify_id ?? null)

  async function handleSubmit() {
    setLoading(true)
    setMessage(null)

    const proposalArtists = currentArtists
    const proposalCredits = currentCredits

    try {
      await submitProposal({
        userId: currentUserId,
        type: 'song_edit',
        reason,
        targetSongId: song.id,
        payload: {
          title: title.trim().slice(0, SONG_FORM_LIMITS.title),
          artist_name: artistNamesText(artists),
          artists: proposalArtists,
          album_name: albumName.trim().slice(0, SONG_FORM_LIMITS.album),
          genre: genre.trim().slice(0, SONG_FORM_LIMITS.genre) || null,
          bpm: bpm ? Number(bpm) : null,
          year_released: yearReleased ? Number(yearReleased) : null,
          credits: proposalCredits,
          spotify_id: spotifyTrack === undefined ? (song.spotify_id ?? null) : (spotifyTrack?.id ?? null),
        },
      })

      onSubmitted?.()
      onOpenChange(false)
      setThanksOpen(true)
    } catch (submitError) {
      const errorMessage = submitError instanceof Error ? submitError.message : 'Failed to submit suggestion'
      setMessage(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Content maxWidth="780px">
          <div className="flex items-center justify-between">
            <Dialog.Title mb="0">Suggest an edit</Dialog.Title>
            <Dialog.Close>
              <button className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" aria-label="Close">
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-4 space-y-4">
            <Text size="2" color="gray">
              This creates a proposal only. The live record will not change until the suggestion is approved.
            </Text>

            {message && <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-3 text-sm text-destructive">{message}</div>}

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1">
                <Text size="2" weight="medium">Title</Text>
                <input value={title} maxLength={SONG_FORM_LIMITS.title} onChange={(event) => setTitle(event.target.value.slice(0, SONG_FORM_LIMITS.title))} className={inputClassName(titleChanged)} />
              </label>
              <label className="space-y-1">
                <Text size="2" weight="medium">Album</Text>
                <input value={albumName} maxLength={SONG_FORM_LIMITS.album} onChange={(event) => setAlbumName(event.target.value.slice(0, SONG_FORM_LIMITS.album))} className={inputClassName(albumChanged)} />
              </label>
              <label className="space-y-1">
                <Text size="2" weight="medium">Genre</Text>
                <input value={genre} maxLength={SONG_FORM_LIMITS.genre} onChange={(event) => setGenre(event.target.value.slice(0, SONG_FORM_LIMITS.genre))} className={inputClassName(genreChanged)} />
              </label>
              <label className="space-y-1">
                <Text size="2" weight="medium">BPM</Text>
                <input value={bpm} onChange={(event) => setBpm(event.target.value)} type="number" min={0} max={SONG_FORM_LIMITS.bpm} className={inputClassName(bpmChanged)} />
              </label>
              <label className="space-y-1">
                <Text size="2" weight="medium">Year Released</Text>
                <input value={yearReleased} onChange={(event) => setYearReleased(event.target.value)} type="number" min={0} max={SONG_FORM_LIMITS.year} className={inputClassName(yearChanged)} />
              </label>
              <div className="md:col-span-2">
                <div className={sectionClassName(artistsChanged || creditsChanged)}>
                  <SongContributorEditor compact artists={artists} onArtistsChange={setArtists} credits={credits} onCreditsChange={setCredits} />
                </div>
              </div>
              <div className="space-y-2 md:col-span-2">
                <div className={sectionClassName(spotifyChanged)}>
                  <InlineSpotifyPicker
                    entityType="track"
                    userId={currentUserId}
                    value={spotifyTrack ?? null}
                    onChange={setSpotifyTrack}
                    currentSpotifyId={song.spotify_id ?? null}
                    resolveCurrentFromId={spotifyTrack === undefined}
                    label="Spotify track"
                    description="Search inline or paste a Spotify track link. This only updates the proposal payload."
                    placeholder="Search Spotify or paste a track link"
                    suggestedQuery={[title.trim(), artistNamesText(artists)].filter(Boolean).join(' ')}
                  />
                </div>
              </div>
            </div>

            <label className="block space-y-1">
              <Text size="2" weight="medium">Reasoning / sources (optional)</Text>
              <textarea
                value={reason}
                maxLength={SONG_FORM_LIMITS.reason}
                onChange={(event) => setReason(event.target.value.slice(0, SONG_FORM_LIMITS.reason))}
                rows={4}
                placeholder="Add context for reviewers if it helps."
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-sky-300/50 focus:ring-2 focus:ring-sky-300/20"
              />
            </label>

            <Flex justify="end" gap="2">
              <Button variant="soft" color="gray" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
              <Button onClick={() => void handleSubmit()} disabled={loading || !title.trim() || artists.length === 0 || !albumName.trim()}>
                {loading ? 'Submitting...' : 'Submit suggestion'}
              </Button>
            </Flex>
          </div>
        </Dialog.Content>
      </Dialog.Root>

      <ProposalThanksDialog
        open={thanksOpen}
        onOpenChange={setThanksOpen}
        description="Your edit proposal was submitted. Reviewers will compare it against the current song and vote on whether it should go live."
      />
    </>
  )
}