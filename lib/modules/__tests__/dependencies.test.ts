import { describe, it, expect } from 'vitest'
import { getModuleDependencies, validateModuleRemoval, getModuleById } from '../dependencies'

describe('getModuleDependencies', () => {
  it('returns direct dependencies for a module', () => {
    const deps = getModuleDependencies('payments')
    expect(deps).toContain('auth')
  })

  it('returns empty array for module with no dependencies', () => {
    const deps = getModuleDependencies('auth')
    expect(deps).toEqual([])
  })
})

describe('validateModuleRemoval', () => {
  it('blocks removal when dependents exist', () => {
    const result = validateModuleRemoval('auth', ['auth', 'payments', 'admin_dashboard'])
    expect(result.canRemove).toBe(false)
    expect(result.blockedBy).toContain('payments')
  })

  it('allows removal when no dependents are active', () => {
    const result = validateModuleRemoval('payments', ['auth', 'payments'])
    expect(result.canRemove).toBe(true)
    expect(result.blockedBy).toHaveLength(0)
  })

  it('allows removal of auth when only auth is active', () => {
    const result = validateModuleRemoval('auth', ['auth'])
    expect(result.canRemove).toBe(true)
  })
})

describe('getModuleById', () => {
  it('returns module definition by id', () => {
    const mod = getModuleById('auth')
    expect(mod).not.toBeNull()
    expect(mod?.id).toBe('auth')
    expect(mod?.name).toBeTypeOf('string')
  })

  it('returns null for unknown id', () => {
    expect(getModuleById('nonexistent_module')).toBeNull()
  })
})
