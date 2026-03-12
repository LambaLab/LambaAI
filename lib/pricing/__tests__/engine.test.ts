import { describe, it, expect } from 'vitest'
import {
  calculatePriceRange,
  applyComplexityAdjustment,
  tightenPriceRange,
  getConfidenceLabel,
  isPricingVisible,
  formatPriceRange,
} from '../engine'

describe('calculatePriceRange', () => {
  it('returns zero for empty modules', () => {
    const result = calculatePriceRange([])
    expect(result).toEqual({ min: 0, max: 0 })
  })

  it('sums base prices of active modules', () => {
    const result = calculatePriceRange(['auth', 'web_app'])
    expect(result.min).toBe(1500 + 3000)
    expect(result.max).toBe(3000 + 7000)
  })

  it('ignores unknown module ids', () => {
    const result = calculatePriceRange(['auth', 'unknown_module'])
    expect(result.min).toBe(1500)
    expect(result.max).toBe(3000)
  })
})

describe('applyComplexityAdjustment', () => {
  it('applies positive multiplier for high complexity', () => {
    const base = { min: 10000, max: 20000 }
    const result = applyComplexityAdjustment(base, 1.3)
    expect(result.min).toBe(13000)
    expect(result.max).toBe(26000)
  })

  it('applies negative multiplier for low complexity', () => {
    const base = { min: 10000, max: 20000 }
    const result = applyComplexityAdjustment(base, 0.8)
    expect(result.min).toBe(8000)
    expect(result.max).toBe(16000)
  })

  it('clamps multiplier at 2.0 maximum', () => {
    const base = { min: 10000, max: 20000 }
    expect(applyComplexityAdjustment(base, 3.0).max).toBe(40000) // clamped to 2.0
  })

  it('clamps multiplier at 0.5 minimum', () => {
    const base = { min: 10000, max: 20000 }
    expect(applyComplexityAdjustment(base, 0.1).min).toBe(5000) // clamped to 0.5
  })
})

describe('tightenPriceRange', () => {
  it('tightens range proportionally at 50% confidence', () => {
    const base = { min: 10000, max: 30000 }
    const result = tightenPriceRange(base, 50)
    expect(result.min).toBeGreaterThan(10000)
    expect(result.max).toBeLessThan(30000)
    expect(result.min).toBeLessThan(result.max)
  })

  it('returns original range at 30% confidence (just unlocked)', () => {
    const base = { min: 10000, max: 30000 }
    const result = tightenPriceRange(base, 30)
    expect(result).toEqual(base)
  })

  it('returns tight range at 95% confidence', () => {
    const base = { min: 10000, max: 30000 }
    const result = tightenPriceRange(base, 95)
    const spread = result.max - result.min
    const originalSpread = base.max - base.min
    expect(spread).toBeLessThan(originalSpread * 0.3)
  })
})

describe('getConfidenceLabel', () => {
  it('returns Low for scores below 30', () => {
    expect(getConfidenceLabel(10)).toBe('Low')
    expect(getConfidenceLabel(0)).toBe('Low')
  })

  it('returns Fair for scores 30–54', () => {
    expect(getConfidenceLabel(30)).toBe('Fair')
    expect(getConfidenceLabel(45)).toBe('Fair')
  })

  it('returns Good for scores 55–74', () => {
    expect(getConfidenceLabel(55)).toBe('Good')
    expect(getConfidenceLabel(65)).toBe('Good')
  })

  it('returns High for scores 75+', () => {
    expect(getConfidenceLabel(75)).toBe('High')
    expect(getConfidenceLabel(85)).toBe('High')
  })
})

describe('isPricingVisible', () => {
  it('returns false below 30%', () => {
    expect(isPricingVisible(29)).toBe(false)
    expect(isPricingVisible(0)).toBe(false)
  })

  it('returns true at and above 30%', () => {
    expect(isPricingVisible(30)).toBe(true)
    expect(isPricingVisible(75)).toBe(true)
  })
})

describe('formatPriceRange', () => {
  it('formats clean thousand values without decimal', () => {
    expect(formatPriceRange({ min: 2000, max: 5000 })).toBe('$2k–$5k')
  })

  it('formats non-round values with one decimal', () => {
    expect(formatPriceRange({ min: 1500, max: 3500 })).toBe('$1.5k–$3.5k')
  })

  it('formats sub-$1000 values as plain dollars', () => {
    expect(formatPriceRange({ min: 500, max: 900 })).toBe('$500–$900')
  })
})
