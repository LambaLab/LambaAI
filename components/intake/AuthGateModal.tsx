'use client'

import { useState } from 'react'
import { X, Mail, ArrowRight, Loader2, CheckCircle } from 'lucide-react'
import { getStoredSession } from '@/lib/session'

type Step = 'email' | 'loading' | 'sent'

type Props = {
  proposalId: string
  onClose: () => void
}

export default function AuthGateModal({ proposalId, onClose }: Props) {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

  async function handleSendLink(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setStep('loading')
    setError('')

    const session = getStoredSession()
    if (!session?.sessionId) {
      setStep('email')
      setError('Session expired. Please refresh the page and try again.')
      return
    }

    const res = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim(),
        proposalId,
        sessionId: session.sessionId,
      }),
    })

    if (res.ok) {
      setStep('sent')
    } else {
      setStep('email')
      setError('Failed to send link. Please try again.')
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-[var(--ov-surface,#1d1d1d)] border border-[var(--ov-border,rgba(255,255,255,0.10))] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[var(--ov-text-muted,#727272)] hover:text-[var(--ov-text,#ffffff)] transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {step === 'sent' ? (
          <div className="text-center space-y-4 py-2">
            <div className="w-12 h-12 bg-brand-yellow/10 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-6 h-6 text-brand-yellow" />
            </div>
            <div>
              <h2 className="font-bold text-[var(--ov-text,#ffffff)] text-lg">Check your inbox</h2>
              <p className="text-[var(--ov-text-muted,#727272)] text-sm mt-1">
                We sent a magic link to <span className="text-[var(--ov-text,#ffffff)]">{email}</span>.
                Click it to view your full proposal.
              </p>
            </div>
            <p className="text-brand-gray-mid/60 text-xs">
              Didn&apos;t receive it?{' '}
              <button
                onClick={() => setStep('email')}
                className="text-brand-yellow hover:underline"
              >
                Try again
              </button>
            </p>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <div className="w-10 h-10 bg-brand-yellow/10 rounded-xl flex items-center justify-center mb-4">
                <Mail className="w-5 h-5 text-brand-yellow" />
              </div>
              <h2 className="font-bold text-[var(--ov-text,#ffffff)] text-lg">View your proposal</h2>
              <p className="text-[var(--ov-text-muted,#727272)] text-sm mt-1">
                Enter your email and we&apos;ll send you a link to access the full proposal.
              </p>
            </div>

            {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

            <form onSubmit={handleSendLink} className="space-y-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
                disabled={step === 'loading'}
                className="w-full bg-[var(--ov-input-bg,rgba(255,255,255,0.05))] border border-[var(--ov-border,rgba(255,255,255,0.10))] rounded-xl px-4 py-3 text-[var(--ov-text,#ffffff)] placeholder:text-[var(--ov-text-muted,#727272)] outline-none focus:border-brand-yellow/50 transition-colors text-sm disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={step === 'loading' || !email.trim()}
                className="w-full py-3 bg-brand-yellow text-brand-dark font-medium rounded-xl hover:bg-brand-yellow/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
              >
                {step === 'loading' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>Send magic link <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
