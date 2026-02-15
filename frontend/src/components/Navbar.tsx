import { Link } from 'react-router-dom'
import { Button, Flex, Text } from '@radix-ui/themes'
import { MOCK_CURRENT_USER_ID } from '../lib/auth'

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="no-underline">
          <Text size="5" weight="bold" className="text-gray-900 tracking-tight">
            Harmoniq
          </Text>
        </Link>
        <Flex gap="3" align="center">
          <Link to={`/user/${MOCK_CURRENT_USER_ID}`}>
            <Button variant="ghost" size="2">
              Sign In
            </Button>
          </Link>
          <Link to={`/user/${MOCK_CURRENT_USER_ID}`}>
            <Button size="2">Get Started</Button>
          </Link>
        </Flex>
      </div>
    </nav>
  )
}
