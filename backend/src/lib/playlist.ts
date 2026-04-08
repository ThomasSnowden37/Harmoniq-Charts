import * as spotify from './spotify.js'

/**
 * Fetch all items from a Spotify playlist (paginated).
 * Returns the concatenated array of raw playlist items.
 */
export async function fetchAllPlaylistTracks(playlistId: string, accessToken: string, limit = 100): Promise<any[]> {
  const allTracks: any[] = []
  let offset = 0

  while (true) {
    const result: any = await spotify.getPlaylistTracks(playlistId, accessToken, limit, offset)
    allTracks.push(...(result.items || []))
    if (offset + limit >= (result.total ?? 0)) break
    offset += limit
  }

  return allTracks
}

/**
 * Normalize different playlist-item shapes into a predictable `{ raw, track }` shape.
 */
export function normalizePlaylistItems(items: any[]): Array<{ raw: any; track: any }> {
  return items.map((t: any) => {
    let trackObj: any = null
    if (t && typeof t === 'object') {
      if (t.track && typeof t.track === 'object') trackObj = t.track
      else if (t.item && typeof t.item === 'object') trackObj = (t.item.track && typeof t.item.track === 'object') ? t.item.track : t.item
      else if (t.name || t.id) trackObj = t
    }
    return { raw: t, track: trackObj }
  })
}
