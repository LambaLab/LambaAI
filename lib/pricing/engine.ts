import { MODULE_CATALOG } from '@/lib/modules/catalog'

export type PriceRange = { min: number; max: number }

export function calculatePriceRange(moduleIds: string[]): PriceRange {
  return moduleIds.reduce(
    (acc, id) => {
      const mod = MODULE_CATALOG.find((m) => m.id === id)
      if (!mod) return acc
      return { min: acc.min + mod.priceMin, max: acc.max + mod.priceMax }
    },
    { min: 0, max: 0 }
  )
}

export function applyComplexityAdjustment(base: PriceRange, multiplier: number): PriceRange {
  const clamped = Math.max(0.5, Math.min(2.0, multiplier))
  return {
    min: Math.round(base.min * clamped),
    max: Math.round(base.max * clamped),
  }
}

// At 30% confidence: full range. At 100%: range tightened to ~10% spread.
export function tightenPriceRange(base: PriceRange, confidenceScore: number): PriceRange {
  if (confidenceScore <= 30) return base
  const midpoint = (base.min + base.max) / 2
  const halfSpread = (base.max - base.min) / 2
  // tighten factor: 0 at 30%, 0.9 at 100%
  const tightenFactor = ((confidenceScore - 30) / 70) * 0.9
  const newHalfSpread = halfSpread * (1 - tightenFactor)
  return {
    min: Math.round(midpoint - newHalfSpread),
    max: Math.round(midpoint + newHalfSpread),
  }
}

export function getConfidenceLabel(score: number): string {
  if (score < 30) return 'Low'
  if (score < 55) return 'Fair'
  if (score < 75) return 'Good'
  return 'High'
}

export function isPricingVisible(score: number): boolean {
  return score >= 30
}

export function formatPriceRange(range: PriceRange): string {
  // Use one decimal place and strip trailing .0 (e.g. 1500 → "$1.5k", 2000 → "$2k")
  const fmt = (n: number) =>
    n >= 1000 ? `$${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : `$${n}`
  return `${fmt(range.min)}–${fmt(range.max)}`
}
