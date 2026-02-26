import { Link } from 'react-router-dom'
import { Button, Flex, Text, Avatar } from '@radix-ui/themes'
import { GoogleLogin } from '@react-oauth/google'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { user, login, logout } = useAuth();

  return (
    <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="no-underline">
          <Text size="5" weight="bold" className="text-gray-900 tracking-tight">Harmoniq</Text>
        </Link>
        <Link to="/search" className="no-underline">
          <div className="border-4 border-solid px-4 rounded-md">
            <Text size="2" className="text-gray-900 tracking-tight">Song Lookup</Text>
          </div>
        </Link>
        <Link to="/songs/add" className="no-underline">
          <div className="border-4 border-solid px-4 rounded-md">
            <Text size="2" className="text-gray-900 tracking-tight">Add Song</Text>
          </div>
        </Link>
        <Flex gap="3" align="center">
          {user ? (
            <Flex gap="3" align="center">
              <Link to={`/user/${user.id}`}>
                <Avatar src={user.picture} fallback={user.name[0]} size="2" radius="full" />
              </Link>
              <Button variant="ghost" size="2" onClick={logout}>Log Out</Button>
            </Flex>
          ) : (
            <GoogleLogin onSuccess={login} onError={() => console.log('Login Failed')} />
          )}
        </Flex>
      </div>
    </nav>
  )
}