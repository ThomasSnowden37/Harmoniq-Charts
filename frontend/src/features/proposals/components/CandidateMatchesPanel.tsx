import { Card, Flex, Text } from '@radix-ui/themes'
import { AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { CandidateMatch } from '../types'

interface CandidateMatchesPanelProps {
  matches: CandidateMatch[]
}

export default function CandidateMatchesPanel({ matches }: CandidateMatchesPanelProps) {
  if (matches.length === 0) return null

  return (
    <Card size="2" className="border border-warning/40 bg-warning/10">
      <Flex align="start" gap="3">
        <AlertTriangle className="w-5 h-5 text-warning mt-0.5" />
        <div className="space-y-3">
          <div>
            <Text weight="bold" className="block text-foreground">Possible duplicates found</Text>
            <Text size="2" color="gray">
              Review these matches before submitting. You can still continue if the suggestion is genuinely new.
            </Text>
          </div>
          <div className="space-y-2">
            {matches.map((match) => (
              <Link
                key={match.songId}
                to={`/songs/${match.songId}`}
                className="block no-underline rounded-xl border border-border/60 bg-background/70 px-3 py-3 hover:bg-background"
              >
                <Flex justify="between" align="start" gap="3">
                  <div>
                    <Text weight="medium" className="block text-foreground">{match.title}</Text>
                    <Text size="2" color="gray" className="block">
                      {match.artistNames.join(', ') || 'Unknown artist'}
                      {match.albumName ? ` • ${match.albumName}` : ''}
                    </Text>
                    <Text size="1" color="gray" className="block mt-1">
                      {match.reasons.join(' • ')}
                    </Text>
                  </div>
                  <div className="text-right">
                    <Text weight="bold" className="block text-foreground">{Math.round(match.confidence * 100)}%</Text>
                    <Text size="1" color="gray">confidence</Text>
                  </div>
                </Flex>
              </Link>
            ))}
          </div>
        </div>
      </Flex>
    </Card>
  )
}