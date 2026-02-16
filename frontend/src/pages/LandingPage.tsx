import { Link } from 'react-router-dom'
import { Button, Text, Heading, Card } from '@radix-ui/themes'
import { MOCK_CURRENT_USER_ID } from '../lib/auth'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

const ALBUM_COVERS = [
  { title: 'Midnight Drive', colors: 'from-purple-400 to-indigo-600' },
  { title: 'Golden Hour', colors: 'from-amber-300 to-orange-500' },
  { title: 'Ocean Waves', colors: 'from-cyan-300 to-blue-500' },
  { title: 'Neon Nights', colors: 'from-pink-400 to-purple-600' },
  { title: 'Forest Echo', colors: 'from-emerald-300 to-green-600' },
  { title: 'Sunset Blvd', colors: 'from-rose-300 to-red-500' },
  { title: 'Electric Dreams', colors: 'from-violet-400 to-fuchsia-600' },
  { title: 'Rainy Days', colors: 'from-slate-300 to-blue-400' },
  { title: 'Summer Haze', colors: 'from-yellow-300 to-amber-500' },
  { title: 'Cosmic Dust', colors: 'from-indigo-400 to-purple-700' },
  { title: 'City Lights', colors: 'from-teal-300 to-cyan-600' },
  { title: 'Warm Embrace', colors: 'from-orange-300 to-rose-500' },
]

const ALBUM_COVERS_ROW2 = [
  { title: 'Velvet Sky', colors: 'from-fuchsia-300 to-pink-600' },
  { title: 'Deep Blue', colors: 'from-blue-400 to-indigo-700' },
  { title: 'Wildflower', colors: 'from-lime-300 to-emerald-500' },
  { title: 'Afterglow', colors: 'from-red-300 to-orange-500' },
  { title: 'Starlight', colors: 'from-sky-300 to-violet-500' },
  { title: 'Honey', colors: 'from-yellow-200 to-amber-400' },
  { title: 'Thunder', colors: 'from-gray-400 to-slate-700' },
  { title: 'Blossom', colors: 'from-pink-200 to-rose-400' },
  { title: 'Embers', colors: 'from-orange-400 to-red-600' },
  { title: 'Dusk', colors: 'from-purple-300 to-indigo-500' },
  { title: 'Breeze', colors: 'from-teal-200 to-cyan-400' },
  { title: 'Aurora', colors: 'from-green-300 to-blue-500' },
]

function AlbumCover({ title, colors }: { title: string; colors: string }) {
  return (
    <div className="flex-shrink-0 w-36 h-36 md:w-44 md:h-44 mx-3">
      <div
        className={`w-full h-full rounded-xl bg-gradient-to-br ${colors} shadow-lg flex items-end p-3`}
      >
        <span className="text-white text-xs font-semibold drop-shadow-md truncate">
          {title}
        </span>
      </div>
    </div>
  )
}

function CarouselRow({
  albums,
  direction,
}: {
  albums: typeof ALBUM_COVERS
  direction: 'left' | 'right'
}) {
  const animationClass =
    direction === 'left' ? 'animate-scroll-left' : 'animate-scroll-right'

  return (
    <div className="overflow-hidden py-3">
      <div className={`flex ${animationClass}`}>
        {albums.map((album, i) => (
          <AlbumCover key={`a-${i}`} {...album} />
        ))}
        {albums.map((album, i) => (
          <AlbumCover key={`b-${i}`} {...album} />
        ))}
      </div>
    </div>
  )
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-pink-50 via-fuchsia-50 to-blue-100">
        <div className="max-w-6xl mx-auto px-6 pt-16 pb-6 text-center">
          <Heading size="9" weight="bold" className="text-gray-900 mb-4">
            Discover. Review. Share.
          </Heading>
          <Text size="4" className="text-gray-600 max-w-xl mx-auto block mb-2">
            Your music, your opinions, your community. Rate albums, build
            playlists, and connect with friends.
          </Text>
        </div>

        {/* Carousel */}
        <div className="pt-4 pb-12">
          <CarouselRow albums={ALBUM_COVERS} direction="left" />
          <CarouselRow albums={ALBUM_COVERS_ROW2} direction="right" />
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <Heading size="7" weight="bold" className="text-gray-900 mb-3">
              Everything you need to enjoy music together
            </Heading>
            <Text size="3" className="text-gray-500 block">
              Harmoniq brings your music experience to life with powerful social features.
            </Text>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card size="3" className="text-center p-6">
              <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-amber-200 to-orange-400 flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </div>
              <Heading size="4" weight="bold" mb="2">
                Rate & Review
              </Heading>
              <Text size="2" className="text-gray-500">
                Share your honest takes on albums and tracks. Build a review history that reflects your unique taste.
              </Text>
            </Card>

            <Card size="3" className="text-center p-6">
              <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-violet-200 to-purple-500 flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
              </div>
              <Heading size="4" weight="bold" mb="2">
                Build Playlists
              </Heading>
              <Text size="2" className="text-gray-500">
                Curate the perfect playlist for any mood. Organize your favorite tracks and share them with friends.
              </Text>
            </Card>

            <Card size="3" className="text-center p-6">
              <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-cyan-200 to-blue-500 flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <Heading size="4" weight="bold" mb="2">
                Connect with Friends
              </Heading>
              <Text size="2" className="text-gray-500">
                Find friends with similar taste, see what they're listening to, and discover music through your community.
              </Text>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <Heading size="7" weight="bold" className="text-gray-900 mb-3">
              Get started in minutes
            </Heading>
            <Text size="3" className="text-gray-500 block">
              Three simple steps to your new music home.
            </Text>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xl font-bold">
                1
              </div>
              <Heading size="4" weight="bold" mb="2">
                Create your profile
              </Heading>
              <Text size="2" className="text-gray-500">
                Set up your profile. Tell the world about your music taste.
              </Text>
            </div>

            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xl font-bold">
                2
              </div>
              <Heading size="4" weight="bold" mb="2">
                Discover & review
              </Heading>
              <Text size="2" className="text-gray-500">
                Browse albums, rate your favorites, and write reviews that help others find great music.
              </Text>
            </div>

            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xl font-bold">
                3
              </div>
              <Heading size="4" weight="bold" mb="2">
                Connect & share
              </Heading>
              <Text size="2" className="text-gray-500">
                Add friends, share playlists, and build a community around the music you love.
              </Text>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
