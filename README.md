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

### Frontend Structure

The frontend uses a **feature-based** folder layout. Each feature gets its own folder under `features/` with its components, types, and hooks. Pages stay thin — they just compose feature components.

```
frontend/src/
├── features/              # Feature modules
│   └── friends/           # Friends & friend requests feature
│       ├── components/    # UI components (FriendsModal, FriendsList, etc.)
│       └── types.ts       # Shared TypeScript interfaces
├── lib/                   # Shared utilities (auth, supabase client)
├── pages/                 # Route-level page components
└── App.tsx                # Router & app shell
```

When adding a new feature, create a folder under `features/` with the same pattern:

```
features/your-feature/
├── components/    # React components specific to this feature
├── types.ts       # TypeScript interfaces
└── hooks.ts       # Custom hooks (if needed)
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