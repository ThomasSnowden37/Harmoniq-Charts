import { Text } from '@radix-ui/themes'

export default function Footer() {
  return (
    <footer className="py-8 bg-white border-t border-gray-100">
      <div className="max-w-6xl mx-auto px-6 text-center">
        <Text size="2" className="text-gray-400">
          &copy; {new Date().getFullYear()} Harmoniq. All rights reserved.
        </Text>
      </div>
    </footer>
  )
}
