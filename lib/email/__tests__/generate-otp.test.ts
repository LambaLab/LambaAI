import { describe, it, expect } from 'vitest'
import { generateOtp } from '../generate-otp'

describe('generateOtp', () => {
  it('returns a 6-digit numeric string', () => {
    const code = generateOtp()
    expect(code).toMatch(/^\d{6}$/)
  })

  it('generates different codes each call (statistically)', () => {
    const codes = new Set(Array.from({ length: 20 }, generateOtp))
    expect(codes.size).toBeGreaterThan(1)
  })
})
