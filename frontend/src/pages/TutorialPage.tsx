import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Box, Button, Card, Flex, Heading, Text } from '@radix-ui/themes'
import { ChevronLeft, ChevronRight, HelpCircle } from 'lucide-react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

import googleLogin from '../assets/tutorial/googlelogin.png'
import profilePage from '../assets/tutorial/profilepage.png'
import songLookup from '../assets/tutorial/songlookup.png'
import songPage from '../assets/tutorial/songpage.png'
import playlistOnProfile from '../assets/tutorial/playlistonprofile.png'
import userLookup from '../assets/tutorial/userlookup.png'

interface Step {
  title: string
  description: string
  image: string
  imageAlt: string
}

const STEPS: Step[] = [
  {
    title: 'Sign in with Google',
    description:
      'Getting started is simple — no password needed. Click the "Sign in with Google" button in the top right corner of any page and log in with your Google account. Harmoniq will create your profile automatically.',
    image: googleLogin,
    imageAlt: 'Google login button in the navbar',
  },
  {
    title: 'Set up your profile',
    description:
      'Once you\'re signed in, click your avatar to visit your profile page. From here you can update your username, adjust your privacy settings, and see your review history, liked songs, and playlists all in one place.',
    image: profilePage,
    imageAlt: 'User profile page',
  },
  {
    title: 'Search for songs',
    description:
      'Use "Song Lookup" in the navbar to search for any song in the Harmoniq library. You can filter by title or artist and jump straight to a song\'s page to see ratings and reviews from the community.',
    image: songLookup,
    imageAlt: 'Song search page with results',
  },
  {
    title: 'Rate and review songs',
    description:
      'On any song\'s page you can leave a star rating and a written review. Share your honest take, see what others think, and build up a review history that reflects your unique taste.',
    image: songPage,
    imageAlt: 'Song page showing the rating and review section',
  },
  {
    title: 'Build your playlists',
    description:
      'Head to your profile page to create and manage playlists. Add songs from any song page, reorder them however you like, and share your playlists with friends via a direct link. You can also import existing playlists straight from Spotify.',
    image: playlistOnProfile,
    imageAlt: 'Playlist section on the profile page',
  },
  {
    title: 'Find and follow friends',
    description:
      'Use "User Lookup" in the navbar to search for friends by name. Visit their profile to send a friend request — once they accept, their activity will start showing up in your feed so you never miss what they\'re listening to.',
    image: userLookup,
    imageAlt: 'User lookup search page',
  },
]

function ScreenshotFrame({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="rounded-xl overflow-hidden border border-border shadow-lg bg-background">
      {/* Fake browser chrome */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 bg-secondary border-b border-border">
        <span className="w-3 h-3 rounded-full bg-border" />
        <span className="w-3 h-3 rounded-full bg-border" />
        <span className="w-3 h-3 rounded-full bg-border" />
        <div className="flex-1 mx-3 h-5 rounded-md bg-background/60 border border-border" />
      </div>
      <img src={src} alt={alt} className="w-full object-cover object-top max-h-72" />
    </div>
  )
}

export default function TutorialPage() {
  const [step, setStep] = useState(0)
  const current = STEPS[step]
  const isFirst = step === 0
  const isLast = step === STEPS.length - 1

  return (
    <Box className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <Box className="max-w-3xl w-full mx-auto flex-grow" p="4" pt="6">
        {/* Header */}
        <Heading size="6" mb="1">Tutorial</Heading>
        <Text size="2" color="gray" as="p" mb="5">
          A step-by-step guide to getting the most out of Harmoniq.
        </Text>

        {/* Step progress */}
        <Flex gap="1" mb="5">
          {STEPS.map((s, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              aria-label={`Go to step ${i + 1}: ${s.title}`}
              className={`h-1.5 rounded-full flex-1 transition-all ${
                i === step
                  ? 'bg-primary'
                  : i < step
                  ? 'bg-primary/40'
                  : 'bg-border'
              }`}
            />
          ))}
        </Flex>

        {/* Step card */}
        <Card size="3">
          {/* Step label */}
          <Flex align="center" gap="2" mb="4">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex-shrink-0">
              {step + 1}
            </span>
            <Text size="1" color="gray">Step {step + 1} of {STEPS.length}</Text>
          </Flex>

          {/* Screenshot */}
          <Box mb="5">
            <ScreenshotFrame src={current.image} alt={current.imageAlt} />
          </Box>

          {/* Text content */}
          <Heading size="4" mb="2">{current.title}</Heading>
          <Text size="2" color="gray" as="p" className="leading-relaxed">
            {current.description}
          </Text>

          {/* Navigation */}
          <Flex justify="between" align="center" mt="6">
            <Button
              variant="soft"
              color="gray"
              disabled={isFirst}
              onClick={() => setStep(prev => prev - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>

            {isLast ? (
              <Link to="/feed" className="no-underline">
                <Button>Go to Feed</Button>
              </Link>
            ) : (
              <Button onClick={() => setStep(prev => prev + 1)}>
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </Flex>
        </Card>

        {/* FAQ callout */}
        <Card size="2" mt="4">
          <Flex align="center" gap="3">
            <HelpCircle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <Text size="2" color="gray">
              Have questions along the way?{' '}
              <Link to="/faq" className="text-primary no-underline hover:underline font-medium">
                Visit our FAQ page
              </Link>{' '}
              for answers to common questions.
            </Text>
          </Flex>
        </Card>
      </Box>

      <Footer />
    </Box>
  )
}
