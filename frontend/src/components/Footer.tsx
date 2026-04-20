import { Link } from 'react-router-dom'
import { Text } from '@radix-ui/themes'
import logo from '../assets/harmoniq-logo-flattened.svg'

const FOOTER_LINKS = [
  {
    heading: 'Discover',
    links: [
      { to: '/feed', label: 'Feed' },
      { to: '/trending', label: 'Trending' },
      { to: '/search', label: 'Song Lookup' },
      { to: '/usersearch', label: 'User Lookup' },
    ],
  },
  {
    heading: 'Music',
    links: [
      { to: '/songs/add', label: 'Add Song' },
      { to: '/songs/listento', label: 'Listen To' },
      { to: '/recommend', label: 'Recommend Song' },
    ],
  },
  {
    heading: 'Help',
    links: [
      { to: '/faq', label: 'FAQ' },
      { to: '/tutorial', label: 'Tutorial' },
    ],
  },
]

export default function Footer() {
  return (
    <footer className="bg-card border-t border-border">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <img src={logo} alt="Harmoniq" className="h-9 mb-3" />
            <Text size="2" className="text-muted-foreground leading-relaxed block max-w-[12rem]">
              Discover, review, and share music with your community
            </Text>
          </div>

          {/* Link columns */}
          {FOOTER_LINKS.map(col => (
            <div key={col.heading}>
              <Text size="2" weight="bold" className="text-foreground mb-3 block uppercase tracking-wide">
                {col.heading}
              </Text>
              <ul className="flex flex-col gap-2">
                {col.links.map(link => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      className="no-underline text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-border pt-6 text-center">
          <Text size="2" className="text-muted-foreground">
            &copy; {new Date().getFullYear()} Harmoniq. All rights reserved.
          </Text>
        </div>
      </div>
    </footer>
  )
}
