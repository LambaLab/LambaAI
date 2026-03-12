import type { ChatMessage } from '@/hooks/useIntakeChat'
import type { PriceRange } from '@/lib/pricing/engine'

type Props = {
  messages: ChatMessage[]
  isStreaming: boolean
  confidenceScore: number
  onSend: (message: string) => void
  proposalId: string
  pricingVisible: boolean
  priceRange: PriceRange
}

export default function ChatPanel(_props: Props) {
  return <div className="flex-1 flex items-center justify-center text-brand-gray-mid">Chat Panel</div>
}
