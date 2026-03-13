import { describe, it, expect } from 'vitest'
import { bundleOnboardingContext, serializeMultiSelect } from '@/lib/intake-utils'

describe('bundleOnboardingContext', () => {
  it('returns structured message with all four fields', () => {
    const result = bundleOnboardingContext({
      idea: 'sell stories',
      platform: 'Web App',
      productType: 'Marketplace',
      scale: '<100 users',
    })
    expect(result).toContain('sell stories')
    expect(result).toContain('Web App')
    expect(result).toContain('Marketplace')
    expect(result).toContain('<100 users')
  })
})

describe('serializeMultiSelect', () => {
  it('joins selected values with comma', () => {
    expect(serializeMultiSelect(['iOS', 'Android'])).toBe('iOS, Android')
  })
  it('returns single value unchanged', () => {
    expect(serializeMultiSelect(['Web App'])).toBe('Web App')
  })
})
