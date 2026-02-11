import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import UserProfile from './pages/UserProfile'
import { MOCK_CURRENT_USER_ID } from './lib/auth'

function Home() {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Harmoniq</h1>
        <nav className="flex flex-col gap-3 mt-6">
          <Link to={`/user/${MOCK_CURRENT_USER_ID}`} className="text-blue-400 hover:text-blue-300">
            My Profile
          </Link>
        </nav>
      </div>
    </div>
  )
}

// Define routes to various pages here
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/user/:userId" element={<UserProfile />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
