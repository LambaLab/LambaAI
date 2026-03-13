import type { OnboardingContext } from './intake-types'

export function bundleOnboardingContext(ctx: OnboardingContext): string {
  const lines: string[] = []
  if (ctx.idea.trim()) {
    lines.push(`User idea: "${ctx.idea.trim()}"`)
  }
  lines.push(
    `Platform: ${ctx.platform}`,
    `Product type: ${ctx.productType}`,
    `Expected scale: ${ctx.scale}`,
  )
  return lines.join('\n')
}

export function serializeMultiSelect(values: string[]): string {
  return values.join(', ')
}
