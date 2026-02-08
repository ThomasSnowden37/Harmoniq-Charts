# Harmoniq

## Project Structure

```
Harmoniq/
├── frontend/          # React + Vite app
├── backend/           # Express API server
├── shared/            # Shared TypeScript types
├── supabase/          # Database 
└── Docs/              # Project docs
```

## Setup

Create a `.env` file in **both** `frontend/` and `backend/` using the shared templates.

```bash
cd frontend && npm install
cd ../backend && npm install
```

**Terminal 1 — Backend (runs on port 3001):**

```bash
cd backend
npm run dev
```

**Terminal 2 — Frontend (runs on port 4000):**

```bash
cd frontend
npm run dev
```