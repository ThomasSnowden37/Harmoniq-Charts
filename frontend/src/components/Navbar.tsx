import { useState, useRef, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Button, Flex, Avatar } from '@radix-ui/themes'
import { GoogleLogin } from '@react-oauth/google'
import { useAuth } from '../context/AuthContext'
import { useTheme } from 'next-themes'
import { Sun, Moon, Menu, X, ChevronDown, BookOpen, HelpCircle } from 'lucide-react'
import logo from '../assets/harmoniq-logo-flattened.svg'

const NAV_LINKS = [
  { to: '/feed', label: 'Feed' },
  { to: '/search', label: 'Song Lookup' },
  { to: '/usersearch', label: 'User Lookup' },
  { to: '/trending', label: 'Trending' },
  { to: '/songs/add', label: 'Add Song' },
  { to: '/recommend', label: 'Recommend' },
]

const HELP_LINKS = [
  { to: '/tutorial', label: 'Tutorial', icon: BookOpen, description: 'Step-by-step walkthrough' },
  { to: '/faq', label: 'FAQ', icon: HelpCircle, description: 'Common questions answered' },
]

function NavLink({ to, label, onClick }: { to: string; label: string; onClick?: () => void }) {
  const { pathname } = useLocation()
  const active = pathname === to

  return (
    <Link to={to} onClick={onClick} className="no-underline">
      <span
        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
          active
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        {label}
      </span>
    </Link>
  )
}

function HelpDropdown() {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const active = HELP_LINKS.some(l => l.to === pathname)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(prev => !prev)}
        className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
          active
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        Help
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-52 rounded-xl border border-border bg-card/95 backdrop-blur-md shadow-lg overflow-hidden z-50">
          {HELP_LINKS.map(({ to, label, icon: Icon, description }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className="no-underline flex items-start gap-3 px-4 py-3 hover:bg-secondary transition-colors"
            >
              <Icon className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Navbar() {
  const { user, login, logout } = useAuth()
  const { resolvedTheme, setTheme } = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)

  const toggleTheme = () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')

  return (
    <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-6">

        {/* Logo */}
        <Link to="/" className="no-underline flex-shrink-0">
          <img src={logo} alt="Harmoniq" className="h-9" />
        </Link>

        {/* Desktop pill nav */}
        <div className="hidden lg:flex items-center bg-secondary/70 rounded-full px-1 py-1 gap-0.5">
          {NAV_LINKS.map(link => (
            <NavLink key={link.to} {...link} />
          ))}
          <HelpDropdown />
        </div>

        {/* Right side controls */}
        <Flex gap="2" align="center" className="flex-shrink-0">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full hover:bg-secondary transition-colors"
            aria-label="Toggle theme"
          >
            {resolvedTheme === 'dark' ? (
              <Sun className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Moon className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          {user ? (
            <Flex gap="2" align="center">
              <Link to={`/user/${user.id}`}>
                <Avatar src={user.picture} fallback={user.name[0]} size="2" radius="full" className="ring-2 ring-border hover:ring-primary transition-all" />
              </Link>
              <Button variant="ghost" size="2" onClick={logout} className="hidden sm:flex text-muted-foreground">
                Log out
              </Button>
            </Flex>
          ) : (
            <div className="hidden sm:block">
              <GoogleLogin onSuccess={login} onError={() => console.log('Login Failed')} />
            </div>
          )}

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(prev => !prev)}
            className="lg:hidden p-2 rounded-full hover:bg-secondary transition-colors"
            aria-label="Toggle menu"
          >
            {mobileOpen ? (
              <X className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Menu className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </Flex>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="lg:hidden border-b border-border/50 bg-background/95 backdrop-blur-md px-4 py-3">
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map(link => (
              <NavLink key={link.to} {...link} onClick={() => setMobileOpen(false)} />
            ))}
            {HELP_LINKS.map(({ to, label }) => (
              <NavLink key={to} to={to} label={label} onClick={() => setMobileOpen(false)} />
            ))}
          </div>
          {!user && (
            <div className="sm:hidden pt-3 pb-1">
              <GoogleLogin onSuccess={login} onError={() => console.log('Login Failed')} />
            </div>
          )}
          {user && (
            <Button variant="ghost" size="2" onClick={logout} className="sm:hidden mt-2 text-muted-foreground">
              Log out
            </Button>
          )}
        </div>
      )}
    </nav>
  )
}