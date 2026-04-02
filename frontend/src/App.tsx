import { BrowserRouter, Routes, Route } from 'react-router-dom'
import UserProfile from './pages/UserProfile'
import LandingPage from './pages/LandingPage'
import CreateSong from './pages/CreateSong'
import SongPage from './pages/SongPage'
import SearchPage from "./pages/SearchPage"
import RecommendPage from './pages/RecommendPage'
import UserSearchPage from './pages/UserSearchPage'
import PlaylistPage from './pages/PlaylistPage'
import ListenToPage  from './pages/ListenToPage'
import RecommendResult from './pages/RecommendResult'

// Define routes to various pages here
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/user/:userId" element={<UserProfile />} />
        <Route path="/songs/add" element={<CreateSong  />} />
        <Route path="/songs/:id" element={<SongPage  />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/usersearch" element={<UserSearchPage />} />
        <Route path="/recommend" element={<RecommendPage />} />
        <Route path="/recommend/:id" element={<RecommendResult />} />
        <Route path="/playlists/:playlistId" element={<PlaylistPage />} />
        <Route path="/songs/listento" element={<ListenToPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
