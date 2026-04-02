import { Link } from 'react-router-dom'
import { Button, Flex, Text, Avatar } from '@radix-ui/themes'
import { GoogleLogin } from '@react-oauth/google'
import { useAuth } from '../context/AuthContext'
import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'
import logo from '../assets/harmoniq-logo.svg'

export default function Navbar() {
  const { user, login, logout } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }

  return (
    <nav className="sticky top-0 z-50 bg-card/90 backdrop-blur-sm border-b border-border">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="no-underline">
          <img src={logo} alt="Harmoniq" className="h-10" />
        </Link>
        <Link to="/usersearch" className="no-underline">
          <div className="border-4 border-solid border-border px-4 rounded-md">
            <Text size="2" className="text-foreground tracking-tight">User Lookup</Text>
          </div>
        </Link>
        <Link to="/search" className="no-underline">
          <div className="border-4 border-solid border-border px-4 rounded-md">
            <Text size="2" className="text-foreground tracking-tight">Song Lookup</Text>
          </div>
        </Link>
        <Link to="/feed" className="no-underline">
          <div className="border-4 border-solid border-border px-4 rounded-md">
            <Text size="2" className="text-foreground tracking-tight">Feed</Text>
          </div>
        </Link>
        <Link to="/songs/add" className="no-underline">
          <div className="border-4 border-solid border-border px-4 rounded-md">
            <Text size="2" className="text-foreground tracking-tight">Add Song</Text>
          </div>
        </Link>
        <Link to="/recommend" className="no-underline">
          <div className="border-4 border-solid border-border px-4 rounded-md">
            <Text size="2" className="text-foreground tracking-tight">Recommend Song</Text>
          </div>
        </Link>
        <Flex gap="3" align="center">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-md hover:bg-accent transition-colors"
            aria-label="Toggle theme"
          >
            {resolvedTheme === 'dark' ? (
              <Sun className="h-5 w-5 text-foreground" />
            ) : (
              <Moon className="h-5 w-5 text-foreground" />
            )}
          </button>
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