import { useEffect, useState } from 'react'
import { useNavigate } from "react-router-dom";
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

interface Feeds {
  text: string
  timeAgo: string
  username: string
}

export default function FeedSongs() {
    const [loading, setLoading] = useState(true)
    const [feed, setFeed] = useState<Feeds[]>([])
    const [error, setError] = useState<string | null>(null)
    const { user } = useAuth()


useEffect(() => {

      async function fetchFeed() {
        if (!user) return
        setLoading(true)
        try {
            const res = await fetch(`http://localhost:3001/api/feed/all`, {
                headers: {
                    "x-user-id": user.id
                },
                })
          const data = await res.json()

          if (!res.ok) {
            setError(data.error || 'Failed to load song')
            return
          }

        setFeed(data)


        } catch (err) {
          setError('Failed to fetch friends songs')
          console.error(err)
        } finally {
          setLoading(false)
        }
      }
      fetchFeed()
    }, [user])

  return (
    <div>
      <Navbar />
      <div className="min-h-screen w-full flex flex-col items-center bg-background p-6">
        <h1 className="text-3xl font-semibold mb-4 text-primary">Friends Activity</h1>

        {loading && <p className="text-muted-foreground">Loading...</p>}
        {error && <p className="text-red-500">{error}</p>}
        {!loading && feed.length === 0 && (
          <p className="text-muted-foreground">No recent activity from your friends</p>
        )}

        {!loading && feed.length > 0 && (
          <ul className="w-full max-w-2xl space-y-4">
            {feed.map((item, idx) => (
              <li key={idx} className="p-3 border rounded-lg bg-secondary/20">
                <div className="text-sm text-muted-foreground">{item.timeAgo}</div>
                <div className="text-base text-foreground">{item.text}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Footer />
    </div>
  )
}