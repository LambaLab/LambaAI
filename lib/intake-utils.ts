import type { OnboardingContext } from './intake-types'

export function bundleOnboardingContext(ctx: OnboardingContext): string {
  return [
    `User idea: "${ctx.idea}"`,
    `Platform: ${ctx.platform}`,
    `Product type: ${ctx.productType}`,
    `Expected scale: ${ctx.scale}`,
  ].join('\n')
}

export function serializeMultiSelect(values: string[]): string {
  return values.join(', ')
}
