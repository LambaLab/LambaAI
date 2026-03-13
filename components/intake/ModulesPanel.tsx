import ModuleCard from './ModuleCard'
import { MODULE_CATALOG } from '@/lib/modules/catalog'
import type { PriceRange } from '@/lib/pricing/engine'
import { formatPriceRange } from '@/lib/pricing/engine'

type Props = {
  activeModules: string[]
  confidenceScore: number
  priceRange: PriceRange
  pricingVisible: boolean
  onToggle: (id: string) => void
}

export default function ModulesPanel({ activeModules, confidenceScore: _confidenceScore, priceRange, pricingVisible, onToggle }: Props) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-white/5 flex-shrink-0">
        <h2 className="font-bebas text-2xl text-brand-white tracking-wide">
          TECHNICAL MODULES
        </h2>
        <p className="text-xs text-brand-gray-mid mt-0.5">
          {activeModules.length} selected · Toggle to customize
        </p>
      </div>

      {pricingVisible && (
        <div className="px-4 py-3 bg-brand-yellow/5 border-b border-brand-yellow/10">
          <p className="text-xs text-brand-gray-mid mb-1">Total estimate</p>
          <p className="font-bebas text-3xl text-brand-yellow">{formatPriceRange(priceRange)}</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {activeModules.length > 0 && (
          <div className="space-y-2">
            {activeModules.map((id) => (
              <ModuleCard
                key={id}
                moduleId={id}
                isActive={true}
                activeModules={activeModules}
                pricingVisible={pricingVisible}
                onToggle={onToggle}
              />
            ))}
          </div>
        )}

        {activeModules.length > 0 && (
          <div className="py-2">
            <div className="h-px bg-white/5" />
            <p className="text-xs text-brand-gray-mid mt-2 mb-1">Add modules</p>
          </div>
        )}

        {MODULE_CATALOG
          .filter((m) => !activeModules.includes(m.id))
          .map((m) => (
            <ModuleCard
              key={m.id}
              moduleId={m.id}
              isActive={false}
              activeModules={activeModules}
              pricingVisible={pricingVisible}
              onToggle={onToggle}
            />
          ))}
      </div>
    </div>
  )
}
