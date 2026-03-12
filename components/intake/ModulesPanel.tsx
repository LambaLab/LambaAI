import type { PriceRange } from '@/lib/pricing/engine'

type Props = {
  activeModules: string[]
  confidenceScore: number
  priceRange: PriceRange
  pricingVisible: boolean
  onToggle: (id: string) => void
}

export default function ModulesPanel(_props: Props) {
  return <div className="flex-1 flex items-center justify-center text-brand-gray-mid">Modules Panel</div>
}
