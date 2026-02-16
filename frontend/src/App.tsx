import { BrowserRouter, Routes, Route } from 'react-router-dom'
import UserProfile from './pages/UserProfile'
import LandingPage from './pages/LandingPage'
import CreateSong from './pages/CreateSong'


// Define routes to various pages here
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/user/:userId" element={<UserProfile />} />
        <Route path="/songs/add" element={<CreateSong  />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
