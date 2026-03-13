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

  it('formats output as newline-separated labelled fields', () => {
    const result = bundleOnboardingContext({
      idea: 'sell stories',
      platform: 'Web App',
      productType: 'Marketplace',
      scale: '<100 users',
    })
    expect(result).toBe(
      'User idea: "sell stories"\nPlatform: Web App\nProduct type: Marketplace\nExpected scale: <100 users'
    )
  })

  it('omits idea line when idea is empty string', () => {
    const result = bundleOnboardingContext({
      idea: '',
      platform: 'Web App',
      productType: 'Marketplace',
      scale: '<100 users',
    })
    expect(result).not.toContain('User idea')
    expect(result).toBe('Platform: Web App\nProduct type: Marketplace\nExpected scale: <100 users')
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
