import { MODULE_CATALOG, type Module } from './catalog'

// Hardcoded dependency graph: key module requires all listed modules
const DEPENDENCY_GRAPH: Record<string, string[]> = {
  auth: [],
  database: [],
  web_app: [],
  mobile_app: [],
  payments: ['auth', 'database'],
  messaging: ['auth', 'database'],
  admin_dashboard: ['auth', 'database'],
  ai: ['database'],
  file_uploads: ['database'],
  notifications: ['database'],
  search: ['database'],
  analytics: ['database'],
  monetization: [],
  branding: [],
  integrations: ['database'],
}

// Reverse map: which modules depend on a given module
function buildDependentsMap(): Record<string, string[]> {
  const dependents: Record<string, string[]> = {}
  for (const [moduleId, deps] of Object.entries(DEPENDENCY_GRAPH)) {
    for (const dep of deps) {
      if (!dependents[dep]) dependents[dep] = []
      dependents[dep].push(moduleId)
    }
  }
  return dependents
}

const DEPENDENTS_MAP = buildDependentsMap()

export function getModuleDependencies(moduleId: string): string[] {
  return DEPENDENCY_GRAPH[moduleId] ?? []
}

export function validateModuleRemoval(
  moduleId: string,
  activeModuleIds: string[]
): { canRemove: boolean; blockedBy: string[] } {
  const potentialDependents = DEPENDENTS_MAP[moduleId] ?? []
  const blockedBy = potentialDependents.filter((dep) => activeModuleIds.includes(dep))
  return { canRemove: blockedBy.length === 0, blockedBy }
}

export function getModuleById(moduleId: string): Module | null {
  return MODULE_CATALOG.find((m) => m.id === moduleId) ?? null
}

export function getRequiredModulesForSelection(moduleId: string): string[] {
  return getModuleDependencies(moduleId)
}

// Expand a module list to include all required dependencies (recursive).
// Example: ["payments"] → ["payments", "auth", "database"]
export function expandWithDependencies(modules: string[]): string[] {
  const result = new Set(modules)
  let changed = true
  while (changed) {
    changed = false
    for (const id of Array.from(result)) {
      for (const dep of DEPENDENCY_GRAPH[id] ?? []) {
        if (!result.has(dep)) {
          result.add(dep)
          changed = true
        }
      }
    }
  }
  return Array.from(result)
}
