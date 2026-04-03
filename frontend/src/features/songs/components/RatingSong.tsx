import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import * as Form from '@radix-ui/react-form'
import { Dialog, Button, Flex } from '@radix-ui/themes'
import { X } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'

interface StarRatingProps {
  id: string
}

export default function RatingSong({ id }:StarRatingProps) {
    const { user } = useAuth()
    const [loading, setLoading] = useState(false)
    const [rating, setRating] = useState<number | null>(null)
    const [average, setAverage] = useState<number | null>(null)
    const [deletes, setDeletes] = useState(false)
    const [hover, setHover] = useState<number | null>(null)
    const [message, setMessage] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect (() => {
        async function fetchRating() {
            if (!user || !id) return
            const userId = user.id
            setLoading(false)
            try {
                //fetch the users rating
                const res = await fetch(
                `http://localhost:3001/api/ratings/${id}/ratings`,
                { headers: { 'x-user-id': userId } 
                })
                const data = await res.json()
                if (!res.ok) {
                    setError(data.error || 'Failed to load song rating')
                    return
                }
                setRating(data.rating)

                //fetch the average rating
                const Avgres = await fetch(
                `http://localhost:3001/api/ratings/${id}/average`)
                const avgData = await Avgres.json()
                if (!Avgres.ok) {
                    setError(data.error || 'Failed to load song rating')
                    return
                }
                setAverage(avgData?.average ?? null)
            } catch (err) {
                setError('Failed to load song rating')
                return
            } finally {
                setLoading(false)
            }
        }
        fetchRating()
    }, [id, user])

    const changeRating = async (value: number) => {
        if (!user || !id) return
        setRating(value)
        try {
            await fetch(`http://localhost:3001/api/ratings/${id}/rate`, {
            method: 'POST',
            headers: {
            'Content-Type': 'application/json',
            'x-user-id': user.id
            },
            body: JSON.stringify({ rating: value})
        })
        await fetchAverage()
        } catch (err) {
            setError('Failed to load song rating')
            return
        }
    }
    const deleteRating = async () => {
        if (!user || !id) return
        try {
            const res = await fetch(`http://localhost:3001/api/ratings/${id}/remove`, {
            method: 'DELETE',
            headers: {
            'x-user-id': user.id
            }
        })
          if (res.ok) {
            setRating(null);
          }
          await fetchAverage()
        } catch (err) {
            setError('Failed to load song delete')
            return
        }
    }
    const fetchAverage = async () => {
      if (!id) return
      try {
        const res = await fetch(`http://localhost:3001/api/ratings/${id}/average`)
        const data = await res.json()

        if (!res.ok) {
          setError(data.error || 'Failed to load average')
          return
        }

        setAverage(data?.average ?? null)
      } catch (err) {
        setError('Failed to load average')
      }
    }
  return (
     <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'center' }}>
    <div
      onMouseEnter={() => setDeletes(true)}
      onMouseLeave={() => setDeletes(false)}
      style={{
        position: 'relative',
        display: 'flex',
        justifyContent: 'center',
        marginTop: '10px',
        padding: '10px 20px',
        borderRadius: '8px',
    }}
  >
    <div style={{ display: 'flex', gap: '5px', cursor: 'pointer' }}>
      {[1, 2, 3, 4, 5].map((star) => {
        const active = hover ?? rating ?? 0
        let fill = 0
        if (active >= star) fill = 1
        else if (active + 0.5 >= star) fill = 0.5
        else fill = 0

      return (
        <span
          key={star}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const x = e.clientX - rect.left
            const width = rect.width
            const newHover = x < width / 2 ? star - 0.5 : star
            setHover(newHover)  
          }}
          onMouseLeave={() => setHover(null)}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const x = e.clientX - rect.left
            const width = rect.width
            const newRating = x < width / 2 ? star - 0.5 : star
            changeRating(newRating)
          }}
          style={{
            fontSize: '30px',
            position: 'relative',
            display: 'inline-block',
            color: '#D3D3D3',
            transition: '0.2s',
          }}
        >
          ★
          <span
            style={{
              position: 'absolute',
              overflow: 'hidden',
              top: 0,
              left: 0,
              width: fill * 100 + '%',
              color: '#e7e300',
            }}
          >
            ★
          </span>
        </span>
      )
    })}
  </div>
  {deletes && rating !== null && (
    <button
      onClick={deleteRating}
      style={{
        position: 'absolute',
        right: '5px',
        top: '5px',
        transform: 'translateY(-50%)',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer'
      }}
    >
      <X size={18} />
    </button>
  )}
  </div>
    <div style={{ fontSize: '35px', color: '#666' }}>
      {average !== null
        ? `${average.toFixed(1)} ★`
        : 'No ratings'}
    </div>

</div>
  )
}


