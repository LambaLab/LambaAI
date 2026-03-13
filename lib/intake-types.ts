export type QuickReplyOption = {
  label: string
  description?: string
  icon?: string
  value: string
}

export type QuickReplies = {
  style: 'list' | 'icon-cards' | 'pills'
  multiSelect?: boolean
  allowCustom?: boolean
  options: QuickReplyOption[]
}

export type OnboardingContext = {
  idea: string
  platform: string
  productType: string
  scale: string
}
