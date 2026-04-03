import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import { MOCK_CURRENT_USER_ID } from '../../../lib/auth'
import type { SpotifyConnectionStatus } from '../types'

interface SpotifyContextType {
  isConnected: boolean
  isLoading: boolean
  connectionStatus: SpotifyConnectionStatus | null
  connect: () => void
  disconnect: () => Promise<void>
  checkConnection: () => Promise<void>
}

const SpotifyContext = createContext<SpotifyContextType | undefined>(undefined)

export function SpotifyProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true)
  const [connectionStatus, setConnectionStatus] = useState<SpotifyConnectionStatus | null>(null)

  const checkConnection = useCallback(async () => {
    if (!MOCK_CURRENT_USER_ID) {
      setConnectionStatus(null)
      setIsLoading(false)
      return
    }

    try {
      const res = await fetch(`/api/spotify/connection-status`, {
        headers: {
          'x-user-id': MOCK_CURRENT_USER_ID,
        },
      })

      if (res.ok) {
        const data = await res.json()
        setConnectionStatus(data)
      } else {
        setConnectionStatus({ connected: false })
      }
    } catch (err) {
      console.error('Failed to check Spotify connection:', err)
      setConnectionStatus({ connected: false })
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    checkConnection()
  }, [checkConnection])

  // Handle OAuth callback params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const spotifyConnected = params.get('spotify_connected')
    const spotifyError = params.get('spotify_error')

    if (spotifyConnected === 'true') {
      // Clear URL params and refresh connection status
      window.history.replaceState({}, '', window.location.pathname)
      checkConnection()
    } else if (spotifyError) {
      console.error('Spotify connection error:', spotifyError)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [checkConnection])

  const connect = useCallback(async () => {
    if (!MOCK_CURRENT_USER_ID) {
      console.error('Must be logged in to connect Spotify')
      return
    }

    try {
      const res = await fetch(`/api/spotify/auth/url`, {
        headers: {
          'x-user-id': MOCK_CURRENT_USER_ID,
        },
      })

      if (res.ok) {
        const { url } = await res.json()
        // Redirect to Spotify OAuth
        window.location.href = url
      } else {
        const error = await res.json()
        console.error('Failed to get auth URL:', error)
      }
    } catch (err) {
      console.error('Failed to initiate Spotify connection:', err)
    }
  }, [])

  const disconnect = useCallback(async () => {
    if (!MOCK_CURRENT_USER_ID) return

    try {
      const res = await fetch(`/api/spotify/disconnect`, {
        method: 'DELETE',
        headers: {
          'x-user-id': MOCK_CURRENT_USER_ID,
        },
      })

      if (res.ok) {
        setConnectionStatus({ connected: false })
      } else {
        const error = await res.json()
        console.error('Failed to disconnect:', error)
      }
    } catch (err) {
      console.error('Failed to disconnect Spotify:', err)
    }
  }, [])

  return (
    <SpotifyContext.Provider
      value={{
        isConnected: connectionStatus?.connected ?? false,
        isLoading,
        connectionStatus,
        connect,
        disconnect,
        checkConnection,
      }}
    >
      {children}
    </SpotifyContext.Provider>
  )
}

export function useSpotify() {
  const context = useContext(SpotifyContext)
  if (context === undefined) {
    throw new Error('useSpotify must be used within a SpotifyProvider')
  }
  return context
}
