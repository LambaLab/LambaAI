import type { PriceRange } from '@/lib/pricing/engine'

type Props = {
  summary: string
  activeModules: string[]
  confidenceScore: number
  priceRange: PriceRange
  pricingVisible: boolean
  onToggle: (id: string) => void
}

export default function MobileBottomDrawer({ summary }: Props) {
  return <div className="h-12 border-t border-white/10 flex items-center px-4 text-sm text-brand-gray-mid">{summary}</div>
}
