import { supabase } from './supabase.js'

export type ProposalType = 'song_add' | 'song_edit' | 'song_merge' | 'artist_link_spotify' | 'album_link_spotify' | 'playlist_song_add'
export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'merged' | 'reverted'
export type VoteValue = 1 | -1

type VoteReasonCode = 'duplicate' | 'incorrect_metadata' | 'not_enough_context' | 'wrong_target' | 'bad_source' | 'other'

type JsonPrimitive = string | number | boolean | null
type JsonValue = JsonPrimitive | JsonObject | JsonValue[]
type JsonObject = { [key: string]: JsonValue }

type ProposalArtistInput = {
  id?: string
  name: string
}

type ProposalCreditInput = {
  artist_id?: string
  artist_name: string
  role: string
}

type ProposalPayload = {
  title?: string
  song_id?: string
  artist_name?: string
  artist_id?: string
  artists?: ProposalArtistInput[]
  album_name?: string
  album_id?: string
  genre?: string | null
  bpm?: number | null
  year_released?: number | null
  spotify_id?: string | null
  spotify_url?: string | null
  credits?: ProposalCreditInput[]
  playlist_id?: string
  playlist_name?: string
  position?: number | null
  canonical_song_id?: string
  candidate_song_ids?: string[]
  field_mappings?: Record<string, string>
}

type ProposalDiffEntry = {
  field: string
  original: JsonValue
  proposed: JsonValue
}

type CandidateMatch = {
  songId: string
  title: string
  artistNames: string[]
  albumName: string | null
  spotifyId: string | null
  confidence: number
  reasons: string[]
}

type VoteTotals = {
  approvals: number
  rejections: number
  weightedApprovals: number
  weightedRejections: number
  weightedScore: number
}

type SongSnapshot = {
  id: string
  title: string
  bpm: number | null
  genre: string | null
  year_released: number | null
  duration_ms: number | null
  spotify_id: string | null
  spotify_import: boolean
  album_id: string | null
  album_name: string | null
  artist_ids: string[]
  artist_names: string[]
  credits: ProposalCreditInput[]
}

type ArtistSnapshot = {
  id: string
  name: string
  spotify_id: string | null
}

type AlbumSnapshot = {
  id: string
  name: string
  spotify_id: string | null
  artist_ids: string[]
  artist_names: string[]
}

type ProposalRecord = {
  id: string
  type: ProposalType
  target_song_id: string | null
  proposer_id: string
  status: ProposalStatus
  reason: string
  payload: ProposalPayload
  original_snapshot: JsonValue | null
  diff: ProposalDiffEntry[]
  canonical_song_id: string | null
  metadata: Record<string, JsonValue>
  reputation_delta: number
  approved_at: string | null
  approved_by: string | null
  created_at: string
  updated_at: string
}

type VoteRecord = {
  proposal_id: string
  user_id: string
  value: VoteValue
  weight: number
  reason: string | null
  reason_code: VoteReasonCode | null
}

type ReportRecord = {
  id: string
  proposal_id: string
  reporter_id: string
  category: string
  details: string
  status: string
  created_at: string
}

type ProposalDetail = ProposalRecord & {
  voteTotals: VoteTotals
  currentUserVote: VoteRecord | null
  reportCount: number
  rejectionReasons: Array<{
    code: VoteReasonCode
    label: string
    count: number
    reason: string | null
  }>
}

type ProposalReviewFeedPage = {
  proposals: ProposalDetail[]
  totalPendingCount: number
  availableCount: number
  nextOffset: number | null
  hasMore: boolean
}

type CreateProposalInput = {
  proposerId: string
  type: ProposalType
  reason: string
  payload: ProposalPayload
  targetSongId?: string | null
  canonicalSongId?: string | null
  ignoreMatches?: boolean
}

type CreateProposalResult = {
  proposal: ProposalDetail | null
  candidateMatches: CandidateMatch[]
  needsConfirmation: boolean
}

type PrivilegeLevel = 1 | 2

const PROPOSALS_ENABLED = process.env.ENABLE_PROPOSALS !== 'false'
const AUTO_APPROVE_THRESHOLD = Number(process.env.PROPOSAL_AUTO_APPROVE_THRESHOLD ?? 6)
const AUTO_REJECT_THRESHOLD = Number(process.env.PROPOSAL_AUTO_REJECT_THRESHOLD ?? 4)
const MAX_VOTE_WEIGHT = Number(process.env.PROPOSAL_MAX_VOTE_WEIGHT ?? 5)
const PROPOSAL_APPROVAL_REPUTATION = Number(process.env.PROPOSAL_APPROVAL_REPUTATION_DELTA ?? 2)
const PROPOSAL_REJECTION_REPUTATION = Number(process.env.PROPOSAL_REJECTION_REPUTATION_DELTA ?? -1)
const HIGH_CONFIDENCE_MATCH = Number(process.env.PROPOSAL_HIGH_CONFIDENCE_MATCH ?? 0.82)
const MAX_REPORTS_PER_DAY = Number(process.env.PROPOSAL_REPORTS_PER_DAY ?? 5)
const PROPOSAL_BASELINE_SNAPSHOT_KEY = 'baseline_snapshot'

const VOTE_REASON_LABELS: Record<VoteReasonCode, string> = {
  duplicate: 'Duplicate of an existing record',
  incorrect_metadata: 'Metadata looks incorrect',
  not_enough_context: 'Needs better reasoning or sources',
  wrong_target: 'Targets the wrong record',
  bad_source: 'Source link or source data is unreliable',
  other: 'Other',
}

const SONG_MUTATION_RELATIONS = [
  'likes',
  'ratings',
  'reviews',
  'listened',
  'listento',
  'playlist_songs',
  'favorite_songs',
  'recommendations',
] as const

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function normalizeDiffValue(value: JsonValue): JsonValue {
  if (typeof value === 'string') {
    return normalizeText(value)
  }

  if (Array.isArray(value)) {
    return value.map((entry) => normalizeDiffValue(entry))
  }

  if (value && typeof value === 'object') {
    const source = value as JsonObject
    return Object.fromEntries(
      Object.entries(source)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entryValue]) => [key, normalizeDiffValue(entryValue)]),
    )
  }

  return value
}

function valuesDiffer(current: JsonValue, proposed: JsonValue): boolean {
  return JSON.stringify(normalizeDiffValue(current)) !== JSON.stringify(normalizeDiffValue(proposed))
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function hasOwn(source: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(source, key)
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  return normalized ? normalized : undefined
}

function normalizeOptionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function normalizeProposalArtists(value: unknown): ProposalArtistInput[] | undefined {
  if (!Array.isArray(value)) return undefined

  const normalized = value
    .map((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        return null
      }

      const source = entry as Record<string, unknown>
      const name = normalizeOptionalString(source.name)
      if (!name) return null

      const id = normalizeOptionalString(source.id)
      return id ? { id, name } : { name }
    })
    .filter((entry): entry is ProposalArtistInput => Boolean(entry))

  return normalized.length > 0 ? normalized : undefined
}

function normalizeProposalCredits(value: unknown): ProposalCreditInput[] | undefined {
  if (!Array.isArray(value)) return undefined

  const normalized = value
    .map((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        return null
      }

      const source = entry as Record<string, unknown>
      const artistName = normalizeOptionalString(source.artist_name)
      const role = normalizeOptionalString(source.role)
      if (!artistName || !role) return null

      const artistId = normalizeOptionalString(source.artist_id)
      return artistId
        ? { artist_id: artistId, artist_name: artistName, role }
        : { artist_name: artistName, role }
    })
    .filter((entry): entry is ProposalCreditInput => Boolean(entry))

  return normalized.length > 0 ? normalized : undefined
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim())).map((value) => value.trim()))]
}

function parseArtistNames(value: string | undefined): string[] {
  if (!value) return []
  return uniqueStrings(value.split(',').map((entry) => entry.trim()))
}

function proposalArtistNames(payload: ProposalPayload): string[] {
  if (Array.isArray(payload.artists) && payload.artists.length > 0) {
    return uniqueStrings(payload.artists.map((artist) => artist.name))
  }

  return parseArtistNames(payload.artist_name)
}

function proposalArtistLabel(payload: ProposalPayload): string {
  return proposalArtistNames(payload).join(', ')
}

function snapshotCredits(raw: any): ProposalCreditInput[] {
  const credits = Array.isArray(raw?.song_credits) ? raw.song_credits : raw?.credits
  if (!Array.isArray(credits)) return []

  return credits
    .map((entry: any) => {
      const artistName = normalizeOptionalString(entry?.artists?.name ?? entry?.artist_name)
      const role = normalizeOptionalString(entry?.role)
      if (!artistName || !role) return null

      const artistId = normalizeOptionalString(entry?.artists?.id ?? entry?.artist_id)
      return artistId
        ? { artist_id: artistId, artist_name: artistName, role }
        : { artist_name: artistName, role }
    })
    .filter((entry): entry is ProposalCreditInput => Boolean(entry))
}

function roundWeight(value: number): number {
  return Math.round(value * 100) / 100
}

function isProposalType(value: unknown): value is ProposalType {
  return value === 'song_add'
    || value === 'song_edit'
    || value === 'song_merge'
    || value === 'artist_link_spotify'
    || value === 'album_link_spotify'
    || value === 'playlist_song_add'
}

function ensureProposalPayload(payload: unknown): ProposalPayload {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {}
  }

  const source = payload as Record<string, unknown>
  const normalized: ProposalPayload = {}
  const candidateSongIds = Array.isArray(source.candidate_song_ids)
    ? source.candidate_song_ids.filter((value): value is string => typeof value === 'string')
    : undefined

  const fieldMappings = source.field_mappings && typeof source.field_mappings === 'object' && !Array.isArray(source.field_mappings)
    ? Object.fromEntries(
        Object.entries(source.field_mappings as Record<string, unknown>).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
      )
    : undefined

  const title = normalizeOptionalString(source.title)
  if (title) normalized.title = title

  const songId = normalizeOptionalString(source.song_id)
  if (songId) normalized.song_id = songId

  const artistName = normalizeOptionalString(source.artist_name)
  if (artistName) normalized.artist_name = artistName

  const artistId = normalizeOptionalString(source.artist_id)
  if (artistId) normalized.artist_id = artistId

  const artists = normalizeProposalArtists(source.artists)
  if (artists || hasOwn(source, 'artists')) normalized.artists = artists ?? []

  const albumName = normalizeOptionalString(source.album_name)
  if (albumName) normalized.album_name = albumName

  const albumId = normalizeOptionalString(source.album_id)
  if (albumId) normalized.album_id = albumId

  const genre = normalizeOptionalString(source.genre)
  if (genre) normalized.genre = genre

  if (hasOwn(source, 'bpm')) {
    const bpm = normalizeOptionalNumber(source.bpm)
    if (bpm !== undefined) normalized.bpm = bpm
  }

  if (hasOwn(source, 'year_released')) {
    const yearReleased = normalizeOptionalNumber(source.year_released)
    if (yearReleased !== undefined) normalized.year_released = yearReleased
  }

  const spotifyId = normalizeOptionalString(source.spotify_id)
  if (spotifyId) normalized.spotify_id = spotifyId

  const spotifyUrl = normalizeOptionalString(source.spotify_url)
  if (spotifyUrl) normalized.spotify_url = spotifyUrl

  const credits = normalizeProposalCredits(source.credits)
  if (credits || hasOwn(source, 'credits')) normalized.credits = credits ?? []

  const playlistId = normalizeOptionalString(source.playlist_id)
  if (playlistId) normalized.playlist_id = playlistId

  const playlistName = normalizeOptionalString(source.playlist_name)
  if (playlistName) normalized.playlist_name = playlistName

  if (hasOwn(source, 'position')) {
    const position = normalizeOptionalNumber(source.position)
    if (position !== undefined) normalized.position = position
  }

  const canonicalSongId = normalizeOptionalString(source.canonical_song_id)
  if (canonicalSongId) normalized.canonical_song_id = canonicalSongId

  if (candidateSongIds) {
    normalized.candidate_song_ids = candidateSongIds
  }

  if (fieldMappings) {
    normalized.field_mappings = fieldMappings
  }

  return normalized
}

function mapSongSnapshot(raw: any): SongSnapshot {
  const artists = Array.isArray(raw?.song_artists) ? raw.song_artists : []
  const artistNames = uniqueStrings(artists.map((entry: any) => entry?.artists?.name ?? null))
  const artistIds = uniqueStrings(artists.map((entry: any) => entry?.artists?.id ?? null))
  const credits = snapshotCredits(raw)

  return {
    id: String(raw.id),
    title: String(raw.title ?? ''),
    bpm: toNumber(raw.bpm),
    genre: typeof raw.genre === 'string' ? raw.genre : null,
    year_released: toNumber(raw.year_released),
    duration_ms: toNumber(raw.duration_ms),
    spotify_id: typeof raw.spotify_id === 'string' ? raw.spotify_id : null,
    spotify_import: Boolean(raw.spotify_import),
    album_id: typeof raw.album_id === 'string' ? raw.album_id : null,
    album_name: typeof raw?.albums?.name === 'string' ? raw.albums.name : null,
    artist_ids: artistIds,
    artist_names: artistNames,
    credits,
  }
}

function serializeSongSnapshot(song: SongSnapshot): JsonObject {
  return {
    id: song.id,
    title: song.title,
    bpm: song.bpm,
    genre: song.genre,
    year_released: song.year_released,
    duration_ms: song.duration_ms,
    spotify_id: song.spotify_id,
    spotify_import: song.spotify_import,
    album_id: song.album_id,
    album_name: song.album_name,
    artist_ids: song.artist_ids,
    artist_names: song.artist_names,
    credits: song.credits as unknown as JsonValue,
  }
}

function parseSongSnapshot(value: JsonValue | null): SongSnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const source = value as Record<string, unknown>
  if (typeof source.id !== 'string') {
    return null
  }

  const artistIds = Array.isArray(source.artist_ids)
    ? source.artist_ids.filter((entry): entry is string => typeof entry === 'string')
    : []
  const artistNames = Array.isArray(source.artist_names)
    ? source.artist_names.filter((entry): entry is string => typeof entry === 'string')
    : []
  const credits = snapshotCredits(source)

  return {
    id: source.id,
    title: typeof source.title === 'string' ? source.title : '',
    bpm: toNumber(source.bpm),
    genre: typeof source.genre === 'string' ? source.genre : null,
    year_released: toNumber(source.year_released),
    duration_ms: toNumber(source.duration_ms),
    spotify_id: typeof source.spotify_id === 'string' ? source.spotify_id : null,
    spotify_import: Boolean(source.spotify_import),
    album_id: typeof source.album_id === 'string' ? source.album_id : null,
    album_name: typeof source.album_name === 'string' ? source.album_name : null,
    artist_ids: artistIds,
    artist_names: artistNames,
    credits,
  }
}

function mapArtistSnapshot(raw: any): ArtistSnapshot {
  return {
    id: String(raw.id),
    name: String(raw.name ?? ''),
    spotify_id: typeof raw.spotify_id === 'string' ? raw.spotify_id : null,
  }
}

function serializeArtistSnapshot(artist: ArtistSnapshot): JsonObject {
  return {
    id: artist.id,
    name: artist.name,
    spotify_id: artist.spotify_id,
  }
}

function parseArtistSnapshot(value: JsonValue | null): ArtistSnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const source = value as Record<string, unknown>
  if (typeof source.id !== 'string') {
    return null
  }

  return {
    id: source.id,
    name: typeof source.name === 'string' ? source.name : '',
    spotify_id: typeof source.spotify_id === 'string' ? source.spotify_id : null,
  }
}

function mapAlbumSnapshot(raw: any): AlbumSnapshot {
  const artists = Array.isArray(raw?.album_artists) ? raw.album_artists : []
  const artistNames = uniqueStrings(artists.map((entry: any) => entry?.artists?.name ?? null))
  const artistIds = uniqueStrings(artists.map((entry: any) => entry?.artists?.id ?? null))

  return {
    id: String(raw.id),
    name: String(raw.name ?? ''),
    spotify_id: typeof raw.spotify_id === 'string' ? raw.spotify_id : null,
    artist_ids: artistIds,
    artist_names: artistNames,
  }
}

function serializeAlbumSnapshot(album: AlbumSnapshot): JsonObject {
  return {
    id: album.id,
    name: album.name,
    spotify_id: album.spotify_id,
    artist_ids: album.artist_ids,
    artist_names: album.artist_names,
  }
}

function parseAlbumSnapshot(value: JsonValue | null): AlbumSnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const source = value as Record<string, unknown>
  if (typeof source.id !== 'string') {
    return null
  }

  return {
    id: source.id,
    name: typeof source.name === 'string' ? source.name : '',
    spotify_id: typeof source.spotify_id === 'string' ? source.spotify_id : null,
    artist_ids: Array.isArray(source.artist_ids)
      ? source.artist_ids.filter((entry): entry is string => typeof entry === 'string')
      : [],
    artist_names: Array.isArray(source.artist_names)
      ? source.artist_names.filter((entry): entry is string => typeof entry === 'string')
      : [],
  }
}

function snapshotStringField(value: JsonValue | null, key: string): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const raw = (value as Record<string, unknown>)[key]
  return typeof raw === 'string' ? raw : null
}

function snapshotStringArrayField(value: JsonValue | null, key: string): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return []
  }

  const raw = (value as Record<string, unknown>)[key]
  if (!Array.isArray(raw)) {
    return []
  }

  return raw.filter((entry): entry is string => typeof entry === 'string')
}

function buildSongDiff(original: SongSnapshot | null, payload: ProposalPayload, type: ProposalType): ProposalDiffEntry[] {
  if (type === 'song_merge') {
    return [
      {
        field: 'canonical_song_id',
        original: original?.id ?? null,
        proposed: payload.canonical_song_id ?? null,
      },
      {
        field: 'candidate_song_ids',
        original: null,
        proposed: payload.candidate_song_ids ?? [],
      },
      {
        field: 'field_mappings',
        original: null,
        proposed: (payload.field_mappings ?? {}) as JsonObject,
      },
    ]
  }

  const currentArtists = original?.artist_names ?? []
  const proposedArtists = proposalArtistNames(payload)
  const currentCredits = original?.credits ?? []
  const comparisons: Array<{ field: string; current: JsonValue; proposed: JsonValue; included: boolean }> = [
    { field: 'title', current: original?.title ?? null, proposed: payload.title ?? null, included: hasOwn(payload as Record<string, unknown>, 'title') },
    {
      field: 'artists',
      current: currentArtists,
      proposed: proposedArtists,
      included: hasOwn(payload as Record<string, unknown>, 'artists') || hasOwn(payload as Record<string, unknown>, 'artist_name'),
    },
    { field: 'album_name', current: original?.album_name ?? null, proposed: payload.album_name ?? null, included: hasOwn(payload as Record<string, unknown>, 'album_name') },
    { field: 'genre', current: original?.genre ?? null, proposed: payload.genre ?? null, included: hasOwn(payload as Record<string, unknown>, 'genre') },
    { field: 'bpm', current: original?.bpm ?? null, proposed: payload.bpm ?? null, included: hasOwn(payload as Record<string, unknown>, 'bpm') },
    { field: 'year_released', current: original?.year_released ?? null, proposed: payload.year_released ?? null, included: hasOwn(payload as Record<string, unknown>, 'year_released') },
    { field: 'credits', current: currentCredits as unknown as JsonValue, proposed: (payload.credits ?? []) as unknown as JsonValue, included: hasOwn(payload as Record<string, unknown>, 'credits') },
    { field: 'spotify_id', current: original?.spotify_id ?? null, proposed: payload.spotify_id ?? null, included: hasOwn(payload as Record<string, unknown>, 'spotify_id') },
  ]

  return comparisons
    .filter((entry) => entry.included)
    .filter((entry) => valuesDiffer(entry.current, entry.proposed))
    .map((entry) => ({ field: entry.field, original: entry.current, proposed: entry.proposed }))
}

function buildArtistDiff(original: ArtistSnapshot | null, payload: ProposalPayload): ProposalDiffEntry[] {
  const comparisons: Array<{ field: string; current: JsonValue; proposed: JsonValue; included: boolean }> = [
    {
      field: 'artist_name',
      current: original?.name ?? null,
      proposed: payload.artist_name ?? null,
      included: hasOwn(payload as Record<string, unknown>, 'artist_name'),
    },
    {
      field: 'spotify_id',
      current: original?.spotify_id ?? null,
      proposed: payload.spotify_id ?? null,
      included: hasOwn(payload as Record<string, unknown>, 'spotify_id'),
    },
  ]

  return comparisons
    .filter((entry) => entry.included)
    .filter((entry) => valuesDiffer(entry.current, entry.proposed))
    .map((entry) => ({ field: entry.field, original: entry.current, proposed: entry.proposed }))
}

function buildAlbumDiff(original: AlbumSnapshot | null, payload: ProposalPayload): ProposalDiffEntry[] {
  const comparisons: Array<{ field: string; current: JsonValue; proposed: JsonValue; included: boolean }> = [
    {
      field: 'album_name',
      current: original?.name ?? null,
      proposed: payload.album_name ?? null,
      included: hasOwn(payload as Record<string, unknown>, 'album_name'),
    },
    {
      field: 'artists',
      current: original?.artist_names ?? [],
      proposed: proposalArtistNames(payload),
      included: hasOwn(payload as Record<string, unknown>, 'artists') || hasOwn(payload as Record<string, unknown>, 'artist_name'),
    },
    {
      field: 'spotify_id',
      current: original?.spotify_id ?? null,
      proposed: payload.spotify_id ?? null,
      included: hasOwn(payload as Record<string, unknown>, 'spotify_id'),
    },
  ]

  return comparisons
    .filter((entry) => entry.included)
    .filter((entry) => valuesDiffer(entry.current, entry.proposed))
    .map((entry) => ({ field: entry.field, original: entry.current, proposed: entry.proposed }))
}

function buildPlaylistSongAddDiff(payload: ProposalPayload): ProposalDiffEntry[] {
  return [
    { field: 'song', original: null, proposed: payload.title ?? payload.song_id ?? null },
    { field: 'artists', original: null, proposed: proposalArtistNames(payload) },
    { field: 'position', original: null, proposed: payload.position ?? null },
  ].filter((entry) => normalizeText(entry.proposed) !== '' || entry.proposed !== null)
}

function buildProposalDiff(originalSnapshot: JsonValue | null, payload: ProposalPayload, type: ProposalType): ProposalDiffEntry[] {
  if (type === 'artist_link_spotify') {
    return buildArtistDiff(parseArtistSnapshot(originalSnapshot), payload)
  }

  if (type === 'album_link_spotify') {
    return buildAlbumDiff(parseAlbumSnapshot(originalSnapshot), payload)
  }

  if (type === 'playlist_song_add') {
    return buildPlaylistSongAddDiff(payload)
  }

  return buildSongDiff(parseSongSnapshot(originalSnapshot), payload, type)
}

function buildMergeSimulation(canonicalSongId: string, songs: SongSnapshot[], payload: ProposalPayload): JsonObject {
  const canonical = songs.find((song) => song.id === canonicalSongId) ?? null
  const secondarySongs = songs.filter((song) => song.id !== canonicalSongId)
  const totalRelations = secondarySongs.reduce<Record<string, number>>((accumulator, song) => {
    for (const relation of SONG_MUTATION_RELATIONS) {
      const current = accumulator[relation] ?? 0
      accumulator[relation] = current + (song.id ? 1 : 0)
    }
    return accumulator
  }, {})

  return {
    canonical_song_id: canonicalSongId,
    canonical_title: canonical?.title ?? null,
    merged_song_ids: secondarySongs.map((song) => song.id),
    field_mappings: (payload.field_mappings ?? {}) as JsonObject,
    resulting_title: canonical?.title ?? payload.title ?? null,
    relation_tables: SONG_MUTATION_RELATIONS as unknown as JsonValue[],
    relation_touch_count: totalRelations as unknown as JsonValue,
  }
}

async function fetchSongSnapshot(songId: string): Promise<SongSnapshot | null> {
  const { data, error } = await supabase
    .from('songs')
    .select(`
      id,
      title,
      bpm,
      genre,
      year_released,
      duration_ms,
      spotify_id,
      spotify_import,
      album_id,
      user_id,
      albums!left(name),
      song_artists(artists(id, name)),
      song_credits(role, artist_id, artists(id, name))
    `)
    .eq('id', songId)
    .single()

  if (error || !data) return null
  return mapSongSnapshot(data)
}

async function fetchSongSnapshots(songIds: string[]): Promise<SongSnapshot[]> {
  if (songIds.length === 0) return []

  const { data, error } = await supabase
    .from('songs')
    .select(`
      id,
      title,
      bpm,
      genre,
      year_released,
      duration_ms,
      spotify_id,
      spotify_import,
      album_id,
      user_id,
      albums!left(name),
      song_artists(artists(id, name)),
      song_credits(role, artist_id, artists(id, name))
    `)
    .in('id', songIds)

  if (error || !data) return []
  return (data as any[]).map((row) => mapSongSnapshot(row))
}

async function fetchArtistSnapshot(artistId: string): Promise<JsonValue | null> {
  const { data, error } = await supabase
    .from('artists')
    .select('id, name, spotify_id')
    .eq('id', artistId)
    .single()

  if (error || !data) return null
  return serializeArtistSnapshot(mapArtistSnapshot(data))
}

async function fetchAlbumSnapshot(albumId: string): Promise<JsonValue | null> {
  const { data, error } = await supabase
    .from('albums')
    .select('id, name, spotify_id, album_artists(artists(id, name))')
    .eq('id', albumId)
    .single()

  if (error || !data) return null
  return serializeAlbumSnapshot(mapAlbumSnapshot(data))
}

async function fetchUserContext(userId: string): Promise<{ id: string; reputation: number; privilegeLevel: PrivilegeLevel | null }> {
  const { data, error } = await supabase
    .from('users')
    .select('id, reputation')
    .eq('id', userId)
    .single()

  if (error || !data) {
    throw new Error('User not found')
  }

  const { data: privilegeData, error: privilegeError } = await supabase
    .from('user_privileges')
    .select('privilege_level')
    .eq('user_id', userId)
    .order('privilege_level', { ascending: false })
    .limit(1)

  if (privilegeError) {
    throw new Error('Failed to load user privileges')
  }

  const privilegeLevel = Array.isArray(privilegeData) && privilegeData.length > 0
    ? Number(privilegeData[0].privilege_level)
    : null

  return {
    id: data.id as string,
    reputation: toNumber((data as Record<string, unknown>).reputation) ?? 0,
    privilegeLevel: privilegeLevel === 1 || privilegeLevel === 2 ? privilegeLevel : null,
  }
}

function computeVoteWeight(reputation: number): number {
  const baseWeight = 1 + Math.max(0, reputation) / 100
  return roundWeight(Math.min(MAX_VOTE_WEIGHT, Math.max(1, baseWeight)))
}

function computeReputationDelta(status: 'approved' | 'rejected'): number {
  return status === 'approved' ? PROPOSAL_APPROVAL_REPUTATION : PROPOSAL_REJECTION_REPUTATION
}

function normalizeVoteReasonCode(value: unknown): VoteReasonCode | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim() as VoteReasonCode
  return normalized in VOTE_REASON_LABELS ? normalized : null
}

function aggregateRejectionReasons(votes: VoteRecord[]): ProposalDetail['rejectionReasons'] {
  const reasonMap = new Map<VoteReasonCode, { code: VoteReasonCode; label: string; count: number; reason: string | null }>()

  for (const vote of votes) {
    if (vote.value !== -1 || !vote.reason_code) continue

    const existing = reasonMap.get(vote.reason_code)
    if (existing) {
      existing.count += 1
      if (!existing.reason && vote.reason) {
        existing.reason = vote.reason
      }
      continue
    }

    reasonMap.set(vote.reason_code, {
      code: vote.reason_code,
      label: VOTE_REASON_LABELS[vote.reason_code],
      count: 1,
      reason: vote.reason,
    })
  }

  return Array.from(reasonMap.values()).sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
}

function candidateConfidence(song: SongSnapshot, payload: ProposalPayload): CandidateMatch | null {
  const artistLabel = proposalArtistLabel(payload)
  const titleScore = normalizeText(song.title) === normalizeText(payload.title) ? 0.35 : 0
  const artistScore = normalizeText(song.artist_names.join(' ')) === normalizeText(artistLabel) ? 0.25 : 0
  const albumScore = normalizeText(song.album_name) === normalizeText(payload.album_name) ? 0.1 : 0
  const yearScore = song.year_released && payload.year_released && song.year_released === payload.year_released ? 0.05 : 0
  const spotifyScore = song.spotify_id && payload.spotify_id && song.spotify_id === payload.spotify_id ? 1 : 0

  let fuzzyScore = 0
  const normalizedTitle = normalizeText(payload.title)
  if (normalizedTitle && normalizeText(song.title).includes(normalizedTitle)) {
    fuzzyScore += 0.1
  }
  const normalizedArtist = normalizeText(artistLabel)
  if (normalizedArtist && normalizeText(song.artist_names.join(' ')).includes(normalizedArtist)) {
    fuzzyScore += 0.05
  }

  const confidence = spotifyScore === 1 ? 1 : Math.min(0.99, titleScore + artistScore + albumScore + yearScore + fuzzyScore)
  if (confidence < 0.3) return null

  const reasons: string[] = []
  if (spotifyScore === 1) reasons.push('Spotify track already linked')
  if (titleScore > 0) reasons.push('Exact title match')
  if (artistScore > 0) reasons.push('Same artist')
  if (albumScore > 0) reasons.push('Same album')
  if (fuzzyScore > 0 && reasons.length === 0) reasons.push('High fuzzy match')

  return {
    songId: song.id,
    title: song.title,
    artistNames: song.artist_names,
    albumName: song.album_name,
    spotifyId: song.spotify_id,
    confidence: roundWeight(confidence),
    reasons,
  }
}

export async function detectDuplicateCandidates(payload: ProposalPayload): Promise<CandidateMatch[]> {
  if (!payload.title && !payload.spotify_id) return []

  const titleQuery = payload.title ? payload.title.trim().slice(0, 40) : null
  let query = supabase
    .from('songs')
    .select(`
      id,
      title,
      bpm,
      genre,
      year_released,
      duration_ms,
      spotify_id,
      spotify_import,
      album_id,
      user_id,
      albums!left(name),
      song_artists(artists(id, name))
    `)
    .limit(25)

  if (payload.spotify_id) {
    query = query.eq('spotify_id', payload.spotify_id)
  } else if (titleQuery) {
    query = query.ilike('title', `%${titleQuery}%`)
  }

  const { data, error } = await query
  if (error || !data) return []

  const candidates = (data as any[])
    .map((row) => candidateConfidence(mapSongSnapshot(row), payload))
    .filter((entry): entry is CandidateMatch => Boolean(entry))
    .sort((left, right) => right.confidence - left.confidence)

  return candidates
}

function proposalMetadata(record: Partial<ProposalRecord> | null): Record<string, JsonValue> {
  if (!record?.metadata || typeof record.metadata !== 'object') return {}
  return record.metadata
}

function proposalBaselineSnapshot(record: { metadata?: Record<string, JsonValue>; original_snapshot?: JsonValue | null } | null | undefined): JsonValue | null {
  const metadata = proposalMetadata(record ?? null)
  const snapshot = metadata[PROPOSAL_BASELINE_SNAPSHOT_KEY]
  if (snapshot !== undefined) {
    return snapshot as JsonValue
  }

  return record?.original_snapshot ?? null
}

function mapProposal(record: any): ProposalRecord {
  const payload = ensureProposalPayload(record.payload)
  const diff = Array.isArray(record.diff) ? (record.diff as ProposalDiffEntry[]) : []
  const metadata = (record.metadata ?? {}) as Record<string, JsonValue>

  return {
    id: String(record.id),
    type: record.type as ProposalType,
    target_song_id: typeof record.target_song_id === 'string' ? record.target_song_id : null,
    proposer_id: String(record.proposer_id),
    status: record.status as ProposalStatus,
    reason: String(record.reason ?? ''),
    payload,
    original_snapshot: proposalBaselineSnapshot({ metadata, original_snapshot: (record.original_snapshot ?? null) as JsonValue | null }),
    diff,
    canonical_song_id: typeof record.canonical_song_id === 'string' ? record.canonical_song_id : null,
    metadata,
    reputation_delta: toNumber(record.reputation_delta) ?? 0,
    approved_at: typeof record.approved_at === 'string' ? record.approved_at : null,
    approved_by: typeof record.approved_by === 'string' ? record.approved_by : null,
    created_at: String(record.created_at),
    updated_at: String(record.updated_at),
  }
}

async function fetchProposalRecord(proposalId: string): Promise<ProposalRecord | null> {
  const { data, error } = await supabase
    .from('proposals')
    .select('*')
    .eq('id', proposalId)
    .single()

  if (error || !data) return null
  return mapProposal(data)
}

async function fetchVotesByProposalIds(proposalIds: string[]): Promise<VoteRecord[]> {
  if (proposalIds.length === 0) return []

  const { data, error } = await supabase
    .from('proposal_votes')
    .select('proposal_id, user_id, value, weight')
    .in('proposal_id', proposalIds)

  if (error || !data) return []

  return (data as any[]).map((row) => ({
    proposal_id: String(row.proposal_id),
    user_id: String(row.user_id),
    value: Number(row.value) === -1 ? -1 : 1,
    weight: toNumber(row.weight) ?? 1,
    reason: typeof row.reason === 'string' && row.reason.trim() ? row.reason.trim() : null,
    reason_code: normalizeVoteReasonCode(row.reason_code),
  }))
}

async function fetchReportsByProposalIds(proposalIds: string[]): Promise<ReportRecord[]> {
  if (proposalIds.length === 0) return []

  const { data, error } = await supabase
    .from('proposal_reports')
    .select('id, proposal_id, reporter_id, category, details, status, created_at')
    .in('proposal_id', proposalIds)

  if (error || !data) return []

  return (data as any[]).map((row) => ({
    id: String(row.id),
    proposal_id: String(row.proposal_id),
    reporter_id: String(row.reporter_id),
    category: String(row.category),
    details: String(row.details ?? ''),
    status: String(row.status ?? 'open'),
    created_at: String(row.created_at),
  }))
}

async function fetchProposalOriginalSnapshots(proposals: ProposalRecord[]): Promise<Map<string, JsonValue | null>> {
  const snapshotByProposalId = new Map<string, JsonValue | null>()
  const editProposals = proposals.filter((proposal) => proposal.type === 'song_edit')
  const artistEditProposals = proposals.filter((proposal) => proposal.type === 'artist_link_spotify')
  const albumEditProposals = proposals.filter((proposal) => proposal.type === 'album_link_spotify')

  if (editProposals.length === 0) {
    return snapshotByProposalId
  }

  const approvedOrRevertedIds = editProposals
    .filter((proposal) => proposal.status === 'approved' || proposal.status === 'reverted')
    .map((proposal) => proposal.id)

  if (approvedOrRevertedIds.length > 0) {
    const { data } = await supabase
      .from('proposal_audit_logs')
      .select('proposal_id, action, before_snapshot, created_at')
      .in('proposal_id', approvedOrRevertedIds)
      .eq('action', 'approve')
      .order('created_at', { ascending: false })

    for (const row of (data as any[] | null) ?? []) {
      const proposalId = String(row.proposal_id)
      if (!snapshotByProposalId.has(proposalId)) {
        snapshotByProposalId.set(proposalId, (row.before_snapshot ?? null) as JsonValue | null)
      }
    }
  }

  const missingSongIds = uniqueStrings(
    editProposals
      .filter((proposal) => !snapshotByProposalId.has(proposal.id))
      .map((proposal) => proposal.target_song_id),
  )

  const currentSnapshots = new Map<string, JsonValue>()
  if (missingSongIds.length > 0) {
    const songs = await fetchSongSnapshots(missingSongIds)
    for (const song of songs) {
      currentSnapshots.set(song.id, serializeSongSnapshot(song))
    }
  }

  for (const proposal of editProposals) {
    if (snapshotByProposalId.has(proposal.id)) {
      continue
    }

    const currentSnapshot = proposal.target_song_id ? currentSnapshots.get(proposal.target_song_id) : null
    snapshotByProposalId.set(proposal.id, currentSnapshot ?? proposal.original_snapshot ?? null)
  }

  await Promise.all(
    artistEditProposals.map(async (proposal) => {
      if (snapshotByProposalId.has(proposal.id)) return
      if (proposal.original_snapshot) {
        snapshotByProposalId.set(proposal.id, proposal.original_snapshot)
        return
      }

      const artistId = proposal.payload.artist_id
      const snapshot = artistId ? await fetchArtistSnapshot(artistId) : null
      snapshotByProposalId.set(proposal.id, snapshot)
    }),
  )

  await Promise.all(
    albumEditProposals.map(async (proposal) => {
      if (snapshotByProposalId.has(proposal.id)) return
      if (proposal.original_snapshot) {
        snapshotByProposalId.set(proposal.id, proposal.original_snapshot)
        return
      }

      const albumId = proposal.payload.album_id
      const snapshot = albumId ? await fetchAlbumSnapshot(albumId) : null
      snapshotByProposalId.set(proposal.id, snapshot)
    }),
  )

  return snapshotByProposalId
}

async function resolveProposalOriginalSnapshot(proposal: ProposalRecord): Promise<JsonValue | null> {
  const snapshotMap = await fetchProposalOriginalSnapshots([proposal])
  return snapshotMap.get(proposal.id) ?? proposal.original_snapshot ?? null
}

function computeVoteTotals(votes: VoteRecord[]): VoteTotals {
  return votes.reduce<VoteTotals>(
    (accumulator, vote) => {
      if (vote.value > 0) {
        accumulator.approvals += 1
        accumulator.weightedApprovals += vote.weight
      } else {
        accumulator.rejections += 1
        accumulator.weightedRejections += vote.weight
      }
      accumulator.weightedScore = roundWeight(accumulator.weightedApprovals - accumulator.weightedRejections)
      return accumulator
    },
    {
      approvals: 0,
      rejections: 0,
      weightedApprovals: 0,
      weightedRejections: 0,
      weightedScore: 0,
    },
  )
}

async function hydrateProposalDetails(proposals: ProposalRecord[], currentUserId?: string | null): Promise<ProposalDetail[]> {
  if (proposals.length === 0) return []

  const proposalIds = proposals.map((proposal) => proposal.id)
  const [votes, reports, originalSnapshots] = await Promise.all([
    fetchVotesByProposalIds(proposalIds),
    fetchReportsByProposalIds(proposalIds),
    fetchProposalOriginalSnapshots(proposals),
  ])

  return proposals.map((proposal) => {
    const proposalVotes = votes.filter((vote) => vote.proposal_id === proposal.id)
    const voteTotals = computeVoteTotals(proposalVotes)
    const currentUserVote = currentUserId
      ? proposalVotes.find((vote) => vote.user_id === currentUserId) ?? null
      : null
    const reportCount = reports.filter((report) => report.proposal_id === proposal.id && report.status !== 'dismissed').length
    const originalSnapshot = originalSnapshots.get(proposal.id) ?? proposal.original_snapshot ?? null
    const computedDiff = buildProposalDiff(originalSnapshot, proposal.payload, proposal.type)
    const diff = computedDiff.length === 0 && proposal.diff.length > 0 ? proposal.diff : computedDiff
    const rejectionReasons = aggregateRejectionReasons(proposalVotes)

    return {
      ...proposal,
      original_snapshot: originalSnapshot,
      diff,
      voteTotals,
      currentUserVote,
      reportCount,
      rejectionReasons,
    }
  })
}

async function updateUserReputation(userId: string, delta: number): Promise<void> {
  if (!delta) return

  const user = await fetchUserContext(userId)
  const nextReputation = roundWeight(Math.max(0, user.reputation + delta))
  const { error } = await supabase
    .from('users')
    .update({ reputation: nextReputation })
    .eq('id', userId)

  if (error) {
    throw new Error(error.message)
  }
}

async function insertAuditLog(input: {
  proposalId: string
  actorId: string
  action: string
  reason: string
  beforeSnapshot?: JsonValue | null
  afterSnapshot?: JsonValue | null
  metadata?: Record<string, JsonValue>
}): Promise<void> {
  const { error } = await supabase.from('proposal_audit_logs').insert({
    proposal_id: input.proposalId,
    actor_id: input.actorId,
    action: input.action,
    reason: input.reason,
    before_snapshot: input.beforeSnapshot ?? null,
    after_snapshot: input.afterSnapshot ?? null,
    metadata: input.metadata ?? {},
  })

  if (error) {
    throw new Error(error.message)
  }
}

async function rejectProposalInternal(proposal: ProposalRecord, actorId: string, reason: string): Promise<ProposalDetail> {
  const reputationDelta = computeReputationDelta('rejected')
  const originalSnapshot = proposal.type === 'song_edit'
    ? await resolveProposalOriginalSnapshot(proposal)
    : null

  const nextMetadata = {
    ...proposalMetadata(proposal),
    last_action_reason: reason,
    last_action_by: actorId,
    moderation_source: 'manual',
  }

  const { error } = await supabase
    .from('proposals')
    .update({
      status: 'rejected',
      metadata: nextMetadata,
      approved_by: actorId,
      approved_at: new Date().toISOString(),
      reputation_delta: reputationDelta,
    })
    .eq('id', proposal.id)

  if (error) {
    throw new Error(error.message)
  }

  await updateUserReputation(proposal.proposer_id, reputationDelta)
  await insertAuditLog({
    proposalId: proposal.id,
    actorId,
    action: 'reject',
    reason,
    beforeSnapshot: originalSnapshot,
    afterSnapshot: originalSnapshot,
    metadata: {
      reputation_delta: reputationDelta,
    },
  })

  return getProposalDetail(proposal.id, actorId)
}

async function approveViaRpc(proposal: ProposalRecord, actorId: string, reason: string): Promise<void> {
  const rpcName = proposal.type === 'song_merge' ? 'execute_song_merge' : 'approve_song_proposal'
  const { error } = await supabase.rpc(rpcName, {
    p_proposal_id: proposal.id,
    p_actor_id: actorId,
    p_reason: reason,
  })

  if (error) {
    throw new Error(error.message)
  }
}

async function revertViaRpc(proposalId: string, actorId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('revert_song_proposal', {
    p_proposal_id: proposalId,
    p_actor_id: actorId,
    p_reason: reason,
  })

  if (error) {
    throw new Error(error.message)
  }
}

async function maybeAutoTransition(proposalId: string, actorId: string): Promise<void> {
  const proposal = await fetchProposalRecord(proposalId)
  if (!proposal || proposal.status !== 'pending') return

  const detail = await getProposalDetail(proposalId, actorId)
  if (detail.voteTotals.weightedScore >= AUTO_APPROVE_THRESHOLD) {
    if (proposal.type === 'song_merge') {
      const metadata = {
        ...proposalMetadata(proposal),
        auto_ready: true,
        auto_transitioned_at: new Date().toISOString(),
        threshold_weight: detail.voteTotals.weightedScore,
      }
      const { error } = await supabase
        .from('proposals')
        .update({
          status: 'approved',
          metadata,
          approved_by: actorId,
          approved_at: new Date().toISOString(),
        })
        .eq('id', proposal.id)

      if (error) throw new Error(error.message)

      await insertAuditLog({
        proposalId: proposal.id,
        actorId,
        action: 'auto-approve',
        reason: 'Weighted approval threshold met for merge proposal',
        metadata: {
          weighted_score: detail.voteTotals.weightedScore,
        },
      })
      return
    }

    await approveProposal(proposal.id, actorId, 'Weighted approval threshold met')
  }

  if (detail.voteTotals.weightedScore <= AUTO_REJECT_THRESHOLD * -1) {
    await rejectProposalInternal(proposal, actorId, 'Weighted rejection threshold met')
  }
}

export function proposalHighConfidenceMatchThreshold(): number {
  return HIGH_CONFIDENCE_MATCH
}

async function resolveProposalArtistId(artist: ProposalArtistInput): Promise<string> {
  const artistId = normalizeOptionalString(artist.id)
  const artistName = normalizeOptionalString(artist.name)

  if (artistId) {
    const { data, error } = await supabase.from('artists').select('id').eq('id', artistId).single()
    if (!error && data) {
      return String(data.id)
    }
  }

  if (!artistName) {
    throw new Error('Artist name is required')
  }

  const { data: existingArtist, error: lookupError } = await supabase
    .from('artists')
    .select('id')
    .ilike('name', artistName)
    .limit(1)

  if (lookupError) {
    throw new Error(lookupError.message)
  }

  if (existingArtist && existingArtist.length > 0) {
    return String(existingArtist[0].id)
  }

  const { data: createdArtist, error: createError } = await supabase
    .from('artists')
    .insert({ name: artistName })
    .select('id')
    .single()

  if (createError || !createdArtist) {
    throw new Error(createError?.message ?? 'Failed to create artist')
  }

  return String(createdArtist.id)
}

async function resolveProposalArtistIds(artists: ProposalArtistInput[] | undefined, fallbackArtistName?: string): Promise<string[]> {
  const nextArtists = Array.isArray(artists) && artists.length > 0
    ? artists
    : parseArtistNames(fallbackArtistName).map((name) => ({ name }))

  const resolvedArtistIds: string[] = []
  for (const artist of nextArtists) {
    resolvedArtistIds.push(await resolveProposalArtistId(artist))
  }

  return uniqueStrings(resolvedArtistIds)
}

async function approveNonSongProposal(proposal: ProposalRecord, actorId: string, reason: string): Promise<void> {
  if (proposal.type === 'artist_link_spotify') {
    const artistId = proposal.payload.artist_id
    const spotifyId = proposal.payload.spotify_id
    if (!artistId || !spotifyId) {
      throw new Error('Artist link proposal is missing required data')
    }

    const { data: existingArtist } = await supabase
      .from('artists')
      .select('id')
      .eq('spotify_id', spotifyId)
      .neq('id', artistId)
      .limit(1)

    if (existingArtist && existingArtist.length > 0) {
      throw new Error('That Spotify artist is already linked to another artist')
    }

    const nextArtistName = normalizeOptionalString(proposal.payload.artist_name)
    const artistUpdate: Record<string, string> = { spotify_id: spotifyId }
    if (nextArtistName) {
      artistUpdate.name = nextArtistName
    }

    const { error } = await supabase.from('artists').update(artistUpdate).eq('id', artistId)
    if (error) throw new Error(error.message)
  }

  if (proposal.type === 'album_link_spotify') {
    const albumId = proposal.payload.album_id
    const spotifyId = proposal.payload.spotify_id
    if (!albumId || !spotifyId) {
      throw new Error('Album link proposal is missing required data')
    }

    const { data: existingAlbum } = await supabase
      .from('albums')
      .select('id')
      .eq('spotify_id', spotifyId)
      .neq('id', albumId)
      .limit(1)

    if (existingAlbum && existingAlbum.length > 0) {
      throw new Error('That Spotify album is already linked to another album')
    }

    const nextAlbumName = normalizeOptionalString(proposal.payload.album_name)
    const albumUpdate: Record<string, string> = { spotify_id: spotifyId }
    if (nextAlbumName) {
      albumUpdate.name = nextAlbumName
    }

    const { error } = await supabase.from('albums').update(albumUpdate).eq('id', albumId)
    if (error) throw new Error(error.message)

    const nextArtistIds = await resolveProposalArtistIds(proposal.payload.artists, proposal.payload.artist_name)
    if (nextArtistIds.length > 0) {
      const { error: deleteError } = await supabase.from('album_artists').delete().eq('album_id', albumId)
      if (deleteError) throw new Error(deleteError.message)

      const { error: insertError } = await supabase.from('album_artists').insert(
        nextArtistIds.map((artistId) => ({ album_id: albumId, artist_id: artistId })),
      )

      if (insertError) throw new Error(insertError.message)
    }
  }

  if (proposal.type === 'playlist_song_add') {
    const playlistId = proposal.payload.playlist_id
    const songId = proposal.payload.song_id
    const requestedPosition = Math.max(0, Math.floor(Number(proposal.payload.position ?? 0)))
    if (!playlistId || !songId) {
      throw new Error('Playlist song proposal is missing required data')
    }

    const { data: existingRows } = await supabase
      .from('playlist_songs')
      .select('id')
      .eq('playlist_id', playlistId)
      .eq('song_id', songId)
      .limit(1)

    if (existingRows && existingRows.length > 0) {
      throw new Error('That song is already in the playlist')
    }

    const { data: rowsToShift, error: shiftError } = await supabase
      .from('playlist_songs')
      .select('id, position')
      .eq('playlist_id', playlistId)
      .gte('position', requestedPosition)
      .order('position', { ascending: false })

    if (shiftError) throw new Error(shiftError.message)

    for (const row of rowsToShift ?? []) {
      const { error } = await supabase
        .from('playlist_songs')
        .update({ position: Number(row.position) + 1 })
        .eq('id', row.id)

      if (error) throw new Error(error.message)
    }

    const { error } = await supabase
      .from('playlist_songs')
      .insert({ playlist_id: playlistId, song_id: songId, position: requestedPosition })

    if (error) throw new Error(error.message)
  }

  await insertAuditLog({
    proposalId: proposal.id,
    actorId,
    action: 'approve',
    reason,
    metadata: {
      proposal_type: proposal.type,
    },
  })
}

export function proposalsEnabled(): boolean {
  return PROPOSALS_ENABLED
}

export async function requireAdminUser(userId: string): Promise<void> {
  const user = await fetchUserContext(userId)
  if (user.privilegeLevel !== 1 && user.privilegeLevel !== 2) {
    throw new Error('Admin access required')
  }
}

export async function createProposal(input: CreateProposalInput): Promise<CreateProposalResult> {
  const payload = ensureProposalPayload(input.payload)

  if (input.type === 'playlist_song_add') {
    throw new Error('Playlist song proposals are no longer supported')
  }

  if (input.type === 'song_add') {
    if (!payload.title || proposalArtistNames(payload).length === 0 || !payload.album_name || !payload.year_released) {
      throw new Error('Missing required song suggestion fields')
    }
  }

  if (input.type === 'song_edit' && !input.targetSongId) {
    throw new Error('A target song is required for edit proposals')
  }

  if (input.type === 'artist_link_spotify' && (!payload.artist_id || !payload.spotify_id)) {
    throw new Error('Artist Spotify link proposals require an artist and a Spotify id')
  }

  if (input.type === 'album_link_spotify' && (!payload.album_id || !payload.spotify_id)) {
    throw new Error('Album Spotify link proposals require an album and a Spotify id')
  }

  let originalSnapshot: JsonValue | null = null
  if (input.type === 'song_edit') {
    const songSnapshot = input.targetSongId ? await fetchSongSnapshot(input.targetSongId) : null
    if (!songSnapshot) {
      throw new Error('Target song not found')
    }
    originalSnapshot = serializeSongSnapshot(songSnapshot)
  }

  if (input.type === 'artist_link_spotify') {
    originalSnapshot = payload.artist_id ? await fetchArtistSnapshot(payload.artist_id) : null
    if (!originalSnapshot) {
      throw new Error('Target artist not found')
    }
  }

  if (input.type === 'album_link_spotify') {
    originalSnapshot = payload.album_id ? await fetchAlbumSnapshot(payload.album_id) : null
    if (!originalSnapshot) {
      throw new Error('Target album not found')
    }
  }

  let canonicalSongId = input.canonicalSongId ?? payload.canonical_song_id ?? null
  let simulation: JsonObject | null = null

  if (input.type === 'song_merge') {
    const candidateSongIds = uniqueStrings(payload.candidate_song_ids ?? [])
    canonicalSongId = canonicalSongId ?? candidateSongIds[0] ?? null
    if (!canonicalSongId || candidateSongIds.length < 2) {
      throw new Error('Merge proposals require a canonical song and at least two candidates')
    }
    const snapshots = await fetchSongSnapshots(uniqueStrings([canonicalSongId, ...candidateSongIds]))
    simulation = buildMergeSimulation(canonicalSongId, snapshots, payload)
  }

  const candidateMatches = input.type === 'song_add' ? await detectDuplicateCandidates(payload) : []
  const needsConfirmation = candidateMatches.some((match) => match.confidence >= HIGH_CONFIDENCE_MATCH)
  if (needsConfirmation && !input.ignoreMatches) {
    return {
      proposal: null,
      candidateMatches,
      needsConfirmation: true,
    }
  }

  const spotifyImport = input.type === 'song_add' && Boolean(payload.spotify_id)
  const metadata: Record<string, JsonValue> = {
    candidate_matches: candidateMatches as unknown as JsonValue,
    vote_thresholds: {
      approve: AUTO_APPROVE_THRESHOLD,
      reject: AUTO_REJECT_THRESHOLD,
    } as unknown as JsonValue,
    simulation,
  }

  if (originalSnapshot !== null) {
    metadata[PROPOSAL_BASELINE_SNAPSHOT_KEY] = originalSnapshot
  }

  const { data, error } = await supabase
    .from('proposals')
    .insert({
      type: input.type,
      target_song_id: input.targetSongId ?? null,
      proposer_id: input.proposerId,
      status: 'pending',
      reason: input.reason.trim(),
      payload,
      spotify_import: false,
      canonical_song_id: canonicalSongId,
      metadata,
    })
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to create proposal')
  }

  const detail = await getProposalDetail(String(data.id), input.proposerId)
  return {
    proposal: detail,
    candidateMatches,
    needsConfirmation: false,
  }
}

export async function listUserProposals(userId: string, viewerId?: string | null): Promise<ProposalDetail[]> {
  let query = supabase
    .from('proposals')
    .select('*')
    .eq('proposer_id', userId)
    .neq('type', 'playlist_song_add')
    .order('created_at', { ascending: false })

  if (viewerId !== userId) {
    query = query.in('status', ['approved', 'rejected', 'merged', 'reverted'])
  }

  const { data, error } = await query
  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to load proposals')
  }

  return hydrateProposalDetails((data as any[]).map((row) => mapProposal(row)), viewerId)
}

function applyProposalFeedFilters(query: any, filters: { status?: string; type?: string }) {
  let nextQuery = query.neq('type', 'playlist_song_add')

  if (filters.status) {
    nextQuery = nextQuery.eq('status', filters.status)
  }

  if (filters.type) {
    nextQuery = nextQuery.eq('type', filters.type)
  }

  return nextQuery
}

async function countProposalFeedRows(filters: { status?: string; type?: string }): Promise<number> {
  const { count, error } = await applyProposalFeedFilters(
    supabase.from('proposals').select('id', { count: 'exact', head: true }),
    filters,
  )

  if (error) {
    throw new Error(error.message)
  }

  return count ?? 0
}

async function countOwnPendingProposals(userId: string, filters: { status?: string; type?: string }): Promise<number> {
  const { count, error } = await applyProposalFeedFilters(
    supabase.from('proposals').select('id', { count: 'exact', head: true }).eq('proposer_id', userId),
    filters,
  )

  if (error) {
    throw new Error(error.message)
  }

  return count ?? 0
}

async function countReviewedPendingProposals(userId: string, filters: { status?: string; type?: string }): Promise<number> {
  let query = supabase
    .from('proposal_votes')
    .select('proposal_id, proposals!inner(id)', { count: 'exact', head: true })
    .eq('user_id', userId)

  if (filters.status) {
    query = query.eq('proposals.status', filters.status)
  }

  if (filters.type) {
    query = query.eq('proposals.type', filters.type)
  }

  const { count, error } = await query
  if (error) {
    throw new Error(error.message)
  }

  return count ?? 0
}

export async function listProposalReviewFeed(
  filters: { status?: string; type?: string },
  currentUserId?: string | null,
  options?: { limit?: number; offset?: number },
): Promise<ProposalReviewFeedPage> {
  const requestedLimit = Number.isFinite(options?.limit) ? Number(options?.limit) : 10
  const requestedOffset = Number.isFinite(options?.offset) ? Number(options?.offset) : 0
  const limit = Math.max(1, Math.min(50, requestedLimit))
  const initialOffset = Math.max(0, requestedOffset)
  const chunkSize = Math.max(limit * 2, 20)

  const totalPendingCount = await countProposalFeedRows(filters)
  let availableCount = totalPendingCount

  if (currentUserId) {
    const [ownPendingCount, reviewedPendingCount] = await Promise.all([
      countOwnPendingProposals(currentUserId, filters),
      countReviewedPendingProposals(currentUserId, filters),
    ])

    availableCount = Math.max(0, totalPendingCount - ownPendingCount - reviewedPendingCount)
  }

  const collected: ProposalDetail[] = []
  let rawOffset = initialOffset

  while (collected.length < limit && rawOffset < totalPendingCount) {
    const rangeEnd = rawOffset + chunkSize - 1
    const { data, error } = await applyProposalFeedFilters(
      supabase
        .from('proposals')
        .select('*')
        .order('created_at', { ascending: false })
        .range(rawOffset, rangeEnd),
      filters,
    )

    if (error) {
      throw new Error(error.message)
    }

    const rows = (data as any[] | null) ?? []
    if (rows.length === 0) {
      break
    }

    const hydrated = await hydrateProposalDetails(rows.map((row) => mapProposal(row)), currentUserId)
    const reviewable = hydrated.filter((proposal) => (
      proposal.status === 'pending'
      && (!currentUserId || (proposal.proposer_id !== currentUserId && proposal.currentUserVote === null))
    ))

    collected.push(...reviewable.slice(0, limit - collected.length))
    rawOffset += rows.length

    if (rows.length < chunkSize) {
      break
    }
  }

  const nextOffset = rawOffset < totalPendingCount ? rawOffset : null

  return {
    proposals: collected,
    totalPendingCount,
    availableCount,
    nextOffset,
    hasMore: nextOffset !== null,
  }
}

export async function listProposalFeed(filters: { status?: string; type?: string }, currentUserId?: string | null): Promise<ProposalDetail[]> {
  const query = applyProposalFeedFilters(
    supabase
      .from('proposals')
      .select('*')
      .order('created_at', { ascending: false }),
    filters,
  )

  const { data, error } = await query
  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to load proposal feed')
  }

  return hydrateProposalDetails((data as any[]).map((row) => mapProposal(row)), currentUserId)
}

export async function getProposalDetail(proposalId: string, currentUserId?: string | null): Promise<ProposalDetail> {
  const proposal = await fetchProposalRecord(proposalId)
  if (!proposal) {
    throw new Error('Proposal not found')
  }

  const [detail] = await hydrateProposalDetails([proposal], currentUserId)
  return detail
}

export async function castProposalVote(
  proposalId: string,
  userId: string,
  value: VoteValue,
  options?: { reason?: string | null; reasonCode?: VoteReasonCode | null },
): Promise<ProposalDetail> {
  const proposal = await fetchProposalRecord(proposalId)
  if (!proposal) {
    throw new Error('Proposal not found')
  }

  if (proposal.status !== 'pending') {
    throw new Error('This proposal is no longer open for voting')
  }

  if (proposal.proposer_id === userId) {
    throw new Error('You cannot vote on your own contribution')
  }

  const reason = options?.reason?.trim() ?? ''
  const reasonCode = options?.reasonCode ?? null

  if (value === -1 && !reason && !reasonCode) {
    throw new Error('A rejection reason is required')
  }

  const user = await fetchUserContext(userId)
  const weight = computeVoteWeight(user.reputation)

  const { error } = await supabase
    .from('proposal_votes')
    .upsert(
      {
        proposal_id: proposalId,
        user_id: userId,
        value,
        weight,
        reason: value === -1 ? (reason || null) : null,
        reason_code: value === -1 ? reasonCode : null,
      },
      {
        onConflict: 'proposal_id,user_id',
      },
    )

  if (error) {
    throw new Error(error.message)
  }

  await maybeAutoTransition(proposalId, userId)
  return getProposalDetail(proposalId, userId)
}

export async function createProposalReport(input: {
  proposalId: string
  reporterId: string
  category: string
  details: string
}): Promise<ReportRecord> {
  const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count } = await supabase
    .from('proposal_reports')
    .select('id', { count: 'exact', head: true })
    .eq('reporter_id', input.reporterId)
    .gte('created_at', windowStart)

  if ((count ?? 0) >= MAX_REPORTS_PER_DAY) {
    throw new Error('Daily proposal report limit reached')
  }

  const { data, error } = await supabase
    .from('proposal_reports')
    .insert({
      proposal_id: input.proposalId,
      reporter_id: input.reporterId,
      category: input.category,
      details: input.details.trim(),
      status: 'open',
    })
    .select('id, proposal_id, reporter_id, category, details, status, created_at')
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to file report')
  }

  await insertAuditLog({
    proposalId: input.proposalId,
    actorId: input.reporterId,
    action: 'report',
    reason: input.category,
    metadata: {
      details: input.details.trim(),
    },
  })

  return {
    id: String(data.id),
    proposal_id: String(data.proposal_id),
    reporter_id: String(data.reporter_id),
    category: String(data.category),
    details: String(data.details ?? ''),
    status: String(data.status ?? 'open'),
    created_at: String(data.created_at),
  }
}

export async function listAdminQueue(filters: { status?: string; type?: string; reporterState?: string }, currentUserId: string): Promise<ProposalDetail[]> {
  let query = supabase.from('proposals').select('*').neq('type', 'playlist_song_add').order('created_at', { ascending: false })
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.type) query = query.eq('type', filters.type)

  const { data, error } = await query
  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to load admin queue')
  }

  let proposals = await hydrateProposalDetails((data as any[]).map((row) => mapProposal(row)), currentUserId)
  if (filters.reporterState === 'reported') {
    proposals = proposals.filter((proposal) => proposal.reportCount > 0)
  }

  return proposals.sort((left, right) => right.voteTotals.weightedScore - left.voteTotals.weightedScore)
}

export async function listProposalReports(status?: string): Promise<Array<ReportRecord & { proposal?: ProposalRecord | null }>> {
  let query = supabase
    .from('proposal_reports')
    .select('id, proposal_id, reporter_id, category, details, status, created_at')
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to load reports')
  }

  const reports = (data as any[]).map((row) => ({
    id: String(row.id),
    proposal_id: String(row.proposal_id),
    reporter_id: String(row.reporter_id),
    category: String(row.category),
    details: String(row.details ?? ''),
    status: String(row.status ?? 'open'),
    created_at: String(row.created_at),
  }))

  const proposalIds = uniqueStrings(reports.map((report) => report.proposal_id))
  const proposals = await Promise.all(proposalIds.map((proposalId) => fetchProposalRecord(proposalId)))
  const proposalMap = new Map<string, ProposalRecord>()
  for (const proposal of proposals) {
    if (proposal) proposalMap.set(proposal.id, proposal)
  }

  return reports.map((report) => ({
    ...report,
    proposal: proposalMap.get(report.proposal_id) ?? null,
  }))
}

export async function approveProposal(proposalId: string, actorId: string, reason: string): Promise<ProposalDetail> {
  const proposal = await fetchProposalRecord(proposalId)
  if (!proposal) {
    throw new Error('Proposal not found')
  }

  if (proposal.status !== 'pending' && !(proposal.type === 'song_merge' && proposal.status === 'approved')) {
    throw new Error('Only pending proposals can be approved')
  }

  if (proposal.type === 'song_merge') {
    return executeMergeProposal(proposalId, actorId, reason)
  }

  const isNonSongProposal = proposal.type === 'artist_link_spotify'
    || proposal.type === 'album_link_spotify'
    || proposal.type === 'playlist_song_add'

  if (isNonSongProposal) {
    await approveNonSongProposal(proposal, actorId, reason)
  } else {
    await approveViaRpc(proposal, actorId, reason)
  }

  const reputationDelta = computeReputationDelta('approved')
  if (reputationDelta) {
    await updateUserReputation(proposal.proposer_id, reputationDelta)
  }

  const nextMetadata = {
    ...proposalMetadata(proposal),
    last_action_reason: reason,
    last_action_by: actorId,
    moderation_source: 'approve',
  }

  const { error } = await supabase
    .from('proposals')
    .update({
      ...(isNonSongProposal ? {
        status: 'approved',
        approved_by: actorId,
        approved_at: new Date().toISOString(),
      } : {}),
      reputation_delta: reputationDelta,
      metadata: nextMetadata,
    })
    .eq('id', proposalId)

  if (error) {
    throw new Error(error.message)
  }

  return getProposalDetail(proposalId, actorId)
}

export async function rejectProposal(proposalId: string, actorId: string, reason: string): Promise<ProposalDetail> {
  const proposal = await fetchProposalRecord(proposalId)
  if (!proposal) {
    throw new Error('Proposal not found')
  }

  if (proposal.status !== 'pending' && proposal.status !== 'approved') {
    throw new Error('Only pending or approved proposals can be rejected')
  }

  return rejectProposalInternal(proposal, actorId, reason)
}

export async function executeMergeProposal(proposalId: string, actorId: string, reason: string): Promise<ProposalDetail> {
  const proposal = await fetchProposalRecord(proposalId)
  if (!proposal) {
    throw new Error('Proposal not found')
  }

  if (proposal.type !== 'song_merge') {
    throw new Error('Only merge proposals can be merged')
  }

  if (proposal.status !== 'pending' && proposal.status !== 'approved') {
    throw new Error('Only pending or approved merge proposals can be executed')
  }

  await approveViaRpc(proposal, actorId, reason)
  const reputationDelta = computeReputationDelta('approved')
  if (reputationDelta) {
    await updateUserReputation(proposal.proposer_id, reputationDelta)
  }

  const nextMetadata = {
    ...proposalMetadata(proposal),
    last_action_reason: reason,
    last_action_by: actorId,
    moderation_source: 'merge',
  }

  const { error } = await supabase
    .from('proposals')
    .update({
      reputation_delta: reputationDelta,
      metadata: nextMetadata,
    })
    .eq('id', proposalId)

  if (error) {
    throw new Error(error.message)
  }

  return getProposalDetail(proposalId, actorId)
}

export async function revertProposal(proposalId: string, actorId: string, reason: string): Promise<ProposalDetail> {
  const proposal = await fetchProposalRecord(proposalId)
  if (!proposal) {
    throw new Error('Proposal not found')
  }

  if (proposal.type === 'artist_link_spotify' || proposal.type === 'album_link_spotify' || proposal.type === 'playlist_song_add') {
    throw new Error('Revert is currently only supported for song-based proposals')
  }

  if (proposal.status !== 'approved' && proposal.status !== 'merged') {
    throw new Error('Only approved or merged proposals can be reverted')
  }

  await revertViaRpc(proposalId, actorId, reason)
  if (proposal.reputation_delta) {
    await updateUserReputation(proposal.proposer_id, proposal.reputation_delta * -1)
  }

  const nextMetadata = {
    ...proposalMetadata(proposal),
    reverted_by: actorId,
    reverted_reason: reason,
  }

  const { error } = await supabase
    .from('proposals')
    .update({
      metadata: nextMetadata,
    })
    .eq('id', proposalId)

  if (error) {
    throw new Error(error.message)
  }

  return getProposalDetail(proposalId, actorId)
}