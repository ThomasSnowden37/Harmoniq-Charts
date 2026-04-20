import { useState } from 'react'
import { Box, Button, Card, Flex, Heading, Text } from '@radix-ui/themes'
import { ChevronDown, ChevronUp } from 'lucide-react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

interface FAQItem {
  question: string
  answer: string
}

interface FAQCategory {
  title: string
  items: FAQItem[]
}

const FAQ_DATA: FAQCategory[] = [
  {
    title: 'Getting Started',
    items: [
      {
        question: 'What is Harmoniq?',
        answer:
          'Harmoniq is a social music platform where you can discover, rate, and review songs, build playlists, and share music with friends. Think of it as your personal music diary combined with a community of fellow music lovers.',
      },
      {
        question: 'Do I need an account to use Harmoniq?',
        answer:
          'You can browse trending songs and public profiles without an account. However, you need to sign in to rate songs, write reviews, create playlists, and connect with friends.',
      },
      {
        question: 'How do I sign in?',
        answer:
          'Click the "Sign in with Google" button in the top right corner of any page. Harmoniq uses Google OAuth so no separate password is needed.',
      },
      {
        question: 'Is Harmoniq free to use?',
        answer: 'Yes, Harmoniq is completely free.',
      },
    ],
  },
  {
    title: 'Songs & Reviews',
    items: [
      {
        question: 'How do I add a song to Harmoniq?',
        answer:
          'Click "Add Song" in the navbar, fill in the song details (title, artist, album, year, genre, BPM), and submit. Songs you add are visible to the whole community.',
      },
      {
        question: 'How do I rate or review a song?',
        answer:
          "Navigate to any song's page, scroll to the review section, and submit a star rating along with an optional written review.",
      },
      {
        question: 'How is the trending score calculated?',
        answer:
          'Trending scores are based on the number of recent likes, reviews, and listens a song has received. The more engagement a song gets recently, the higher it appears.',
      },
      {
        question: 'Can I import my Spotify playlists?',
        answer:
          'Yes! On your profile page you can connect your Spotify account and import your existing playlists directly into Harmoniq.',
      },
    ],
  },
  {
    title: 'Playlists',
    items: [
      {
        question: 'How do I create a playlist?',
        answer:
          'Go to your profile page and use the playlist creation option. Give your playlist a name and start adding songs.',
      },
      {
        question: 'Can I share my playlist with others?',
        answer: 'Yes, each playlist has a unique URL you can copy and share with anyone.',
      },
      {
        question: 'Can I add songs from search results to a playlist?',
        answer: "Yes, on any song's page you can add it to one of your existing playlists.",
      },
    ],
  },
  {
    title: 'Friends & Social',
    items: [
      {
        question: 'How do I find friends on Harmoniq?',
        answer:
          'Use the "User Lookup" feature in the navbar to search for users by name. Once you find someone, visit their profile to follow them.',
      },
      {
        question: 'What shows up in my feed?',
        answer: 'Your feed shows recent activity — likes, reviews, and listens — from people you follow.',
      },
      {
        question: 'How do I recommend a song to someone?',
        answer:
          'Use the "Recommend" feature in the navbar to browse songs and send a recommendation to any user.',
      },
      {
        question: "Can I see what songs my friends are listening to?",
        answer:
          "Yes! Your Feed page shows recent activity from everyone you follow, including what they've been listening to, liking, and reviewing.",
      },
    ],
  },
  {
    title: 'Account & Profile',
    items: [
      {
        question: 'How do I change my username?',
        answer:
          'Click your avatar in the top right to go to your profile page. From there you can edit your username in Settings.',
      },
      {
        question: 'How do I view my review history?',
        answer: 'Visit your profile page to see all your past ratings and reviews in one place.',
      },
      {
        question: 'Can I delete my account?',
        answer:
          "To delete your account, please contact us using the form at the bottom of this page and we'll take care of it promptly.",
      },
    ],
  },
  {
    title: 'Technical',
    items: [
      {
        question: "The app isn't loading correctly. What should I do?",
        answer:
          'Try refreshing the page or clearing your browser cache and cookies. If the issue persists, please reach out using the contact form below.',
      },
      {
        question: "Why can't I see my friends' activity in my feed?",
        answer:
          "Make sure you're following your friends and that they have recent activity on the platform. New activity may take a moment to appear.",
      },
      {
        question: "The Spotify import isn't working. What should I do?",
        answer:
          "Make sure you're logged in to Harmoniq, then try disconnecting and reconnecting your Spotify account from your profile page.",
      },
    ],
  },
]

function AccordionItem({ question, answer }: FAQItem) {
  const [open, setOpen] = useState(false)

  return (
    <Box className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(prev => !prev)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-secondary transition-colors"
      >
        <Text size="2" weight="medium" className="pr-4">
          {question}
        </Text>
        {open ? (
          <ChevronUp className="h-4 w-4 flex-shrink-0 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 flex-shrink-0 text-gray-400" />
        )}
      </button>
      {open && (
        <Box px="4" py="3" className="border-t border-border bg-background">
          <Text size="2" color="gray">
            {answer}
          </Text>
        </Box>
      )}
    </Box>
  )
}

function ContactForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [question, setQuestion] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const subject = encodeURIComponent(`Harmoniq FAQ: Question from ${name}`)
    const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\nQuestion:\n${question}`)
    window.location.href = `mailto:harmoniq.support@gmail.com?subject=${subject}&body=${body}`
  }

  const inputClass =
    'w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40'

  return (
    <form onSubmit={handleSubmit}>
      <Flex direction="column" gap="3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Flex direction="column" gap="1">
            <Text size="2" weight="medium">Name</Text>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name"
              className={inputClass}
            />
          </Flex>
          <Flex direction="column" gap="1">
            <Text size="2" weight="medium">Email</Text>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              className={inputClass}
            />
          </Flex>
        </div>
        <Flex direction="column" gap="1">
          <Text size="2" weight="medium">Your Question</Text>
          <textarea
            required
            value={question}
            onChange={e => setQuestion(e.target.value)}
            placeholder="What would you like to know?"
            rows={4}
            className={`${inputClass} resize-none`}
          />
        </Flex>
        <Box>
          <Button type="submit" size="2">
            Send Question
          </Button>
        </Box>
      </Flex>
    </form>
  )
}

export default function FAQPage() {
  return (
    <Box className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <Box className="max-w-3xl w-full mx-auto flex-grow" p="4" pt="6">
        <Heading size="6" mb="1">
          Frequently Asked Questions
        </Heading>
        <Text size="2" color="gray" as="p" mb="5">
          Find answers to common questions about Harmoniq. Can't find what you're looking for? Send us a message below.
        </Text>

        <Flex direction="column" gap="4">
          {FAQ_DATA.map(category => (
            <Card key={category.title} size="3">
              <Heading size="4" mb="3">
                {category.title}
              </Heading>
              <Flex direction="column" gap="2">
                {category.items.map(item => (
                  <AccordionItem key={item.question} {...item} />
                ))}
              </Flex>
            </Card>
          ))}

          <Card size="3">
            <Heading size="4" mb="1">
              Still have questions?
            </Heading>
            <Text size="2" color="gray" as="p" mb="4">
              Send us a message and we'll get back to you as soon as possible.
            </Text>
            <ContactForm />
          </Card>
        </Flex>
      </Box>

      <Footer />
    </Box>
  )
}
