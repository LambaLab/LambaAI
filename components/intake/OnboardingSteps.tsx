'use client'

import { useState } from 'react'
import type { OnboardingContext } from '@/lib/intake-types'

type Props = {
  idea: string
  onComplete: (ctx: OnboardingContext) => void
}

type Step = 0 | 1 | 2

const PLATFORM_OPTIONS = [
  { label: 'Web App', icon: '🌐', value: 'Web App' },
  { label: 'Mobile App', icon: '📱', value: 'Mobile App' },
  { label: 'Both', icon: '🖥️', value: 'Web + Mobile' },
  { label: 'Not sure yet', icon: '🤔', value: 'Platform TBD' },
]

const TYPE_OPTIONS = [
  { label: 'Marketplace', icon: '🛒', value: 'Marketplace' },
  { label: 'Social / Community', icon: '💬', value: 'Social / Community' },
  { label: 'SaaS / Internal Tool', icon: '🛠️', value: 'SaaS / Internal Tool' },
  { label: 'Something else', icon: '🎯', value: 'Other' },
]

const SCALE_OPTIONS = [
  { label: 'Just me', icon: '👤', value: 'Just me (personal use)' },
  { label: '<100 users', icon: '👥', value: '<100 users' },
  { label: '1,000+ users', icon: '🏢', value: '1,000+ users' },
  { label: 'Not sure', icon: '🤷', value: 'Scale TBD' },
]

const STEPS = [
  { question: "What platform are you building for?", options: PLATFORM_OPTIONS, style: 'cards' as const },
  { question: "What type of product is this?", options: TYPE_OPTIONS, style: 'cards' as const },
  { question: "What's the expected scale?", options: SCALE_OPTIONS, style: 'pills' as const },
]

export default function OnboardingSteps({ idea, onComplete }: Props) {
  const [step, setStep] = useState<Step>(0)
  const [answers, setAnswers] = useState<string[]>([])

  function handleSelect(value: string) {
    const newAnswers = [...answers, value]
    if (step < 2) {
      setAnswers(newAnswers)
      setStep((step + 1) as Step)
    } else {
      onComplete({
        idea,
        platform: newAnswers[0],
        productType: newAnswers[1],
        scale: value,
      })
    }
  }

  const current = STEPS[step]

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 max-w-md mx-auto w-full">
      {/* Progress dots */}
      <div className="flex gap-2 mb-8">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === step ? 'w-8 bg-brand-yellow' : i < step ? 'w-4 bg-brand-yellow/50' : 'w-4 bg-white/10'
            }`}
          />
        ))}
      </div>

      <p className="text-brand-gray-mid text-xs uppercase tracking-widest mb-3">Step {step + 1} of 3</p>
      <h2 className="font-bebas text-3xl text-brand-white text-center mb-6">{current.question}</h2>

      {current.style === 'cards' ? (
        <div className="grid grid-cols-2 gap-3 w-full">
          {current.options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleSelect(opt.value)}
              className="flex flex-col items-start gap-2 p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-brand-yellow/40 transition-all text-left active:scale-[0.98]"
            >
              <span className="text-2xl">{opt.icon}</span>
              <span className="text-sm font-medium text-brand-white leading-tight">{opt.label}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 justify-center w-full">
          {current.options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleSelect(opt.value)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 hover:border-brand-yellow/40 transition-all text-sm text-brand-white active:scale-[0.98]"
            >
              <span>{opt.icon}</span>
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
