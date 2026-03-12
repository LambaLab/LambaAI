'use client'

import { useState } from 'react'
import { X, Mail, ArrowRight, Loader2 } from 'lucide-react'
import { getStoredSession } from '@/lib/session'

type Step = 'email' | 'otp' | 'loading' | 'success'

type Props = {
  proposalId: string
  onClose: () => void
  onSuccess: () => void
}

export default function AuthGateModal({ proposalId, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setStep('loading')
    setError('')

    const res = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), proposalId }),
    })

    if (res.ok) {
      setStep('otp')
    } else {
      setStep('email')
      setError('Failed to send code. Please try again.')
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    if (!otp.trim()) return
    setStep('loading')
    setError('')

    const session = getStoredSession()
    const res = await fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), otp: otp.trim(), proposalId, sessionId: session?.sessionId ?? '' }),
    })

    if (res.ok) {
      setStep('success')
      setTimeout(onSuccess, 1500)
    } else {
      setStep('otp')
      setError('Invalid code. Please try again.')
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-[#1d1d1d] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <button onClick={onClose} className="absolute top-4 right-4 text-brand-gray-mid hover:text-brand-white transition-colors" aria-label="Close">
          <X className="w-5 h-5" />
        </button>

        {step === 'success' ? (
          <div className="text-center space-y-3 py-4">
            <div className="w-12 h-12 bg-brand-green/20 rounded-full flex items-center justify-center mx-auto">
              <span className="text-brand-green text-2xl">&#10003;</span>
            </div>
            <p className="font-bold text-brand-white">Verified!</p>
            <p className="text-brand-gray-mid text-sm">Generating your proposal...</p>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <div className="w-10 h-10 bg-brand-yellow/10 rounded-xl flex items-center justify-center mb-4">
                <Mail className="w-5 h-5 text-brand-yellow" />
              </div>
              <h2 className="font-bold text-brand-white text-lg">
                {step === 'otp' ? 'Enter your code' : 'View your proposal'}
              </h2>
              <p className="text-brand-gray-mid text-sm mt-1">
                {step === 'otp'
                  ? `We sent a 6-digit code to ${email}`
                  : 'Enter your email to access the full proposal'}
              </p>
            </div>

            {error && (
              <p className="text-red-400 text-sm mb-4">{error}</p>
            )}

            {step === 'email' || step === 'loading' ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoFocus
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-brand-white placeholder:text-brand-gray-mid outline-none focus:border-brand-yellow/50 transition-colors text-sm"
                />
                <button
                  type="submit"
                  disabled={step === 'loading' || !email.trim()}
                  className="w-full py-3 bg-brand-yellow text-brand-dark font-medium rounded-xl hover:bg-brand-yellow/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                >
                  {step === 'loading' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>Send code <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <input
                  type="text"
                  inputMode="numeric"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  autoFocus
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-brand-white placeholder:text-brand-gray-mid outline-none focus:border-brand-yellow/50 transition-colors text-sm text-center text-2xl tracking-widest font-mono"
                />
                <button
                  type="submit"
                  disabled={otp.length !== 6}
                  className="w-full py-3 bg-brand-yellow text-brand-dark font-medium rounded-xl hover:bg-brand-yellow/90 transition-all disabled:opacity-50 text-sm"
                >
                  Verify &amp; View Proposal
                </button>
                <button
                  type="button"
                  onClick={() => setStep('email')}
                  className="w-full text-brand-gray-mid text-sm hover:text-brand-white transition-colors"
                >
                  Use a different email
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  )
}
