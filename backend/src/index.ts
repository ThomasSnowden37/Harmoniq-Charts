import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { supabase } from './lib/supabase.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

// Test the supabase connection with this endpoint
app.get('/api/test-db', async (req, res) => {
  const { data, error } = await supabase.from('artists').select('*')
  if (error) return res.status(500).json({ error: error.message })
  res.json({ connected: true, artists: data })
})

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
