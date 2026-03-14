import { describe, it, expect } from 'vitest'
import { serializeMultiSelect } from '@/lib/intake-utils'

describe('serializeMultiSelect', () => {
  it('joins selected values with comma', () => {
    expect(serializeMultiSelect(['iOS', 'Android'])).toBe('iOS, Android')
  })
  it('returns single value unchanged', () => {
    expect(serializeMultiSelect(['Web App'])).toBe('Web App')
  })
})
