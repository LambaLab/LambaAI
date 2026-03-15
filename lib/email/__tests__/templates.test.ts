import { describe, it, expect } from 'vitest'
import { buildOtpEmail } from '../templates/otp'
import { buildConfirmationEmail } from '../templates/confirmation'

describe('buildOtpEmail', () => {
  it('includes the 6-digit code in the HTML', () => {
    const { html, subject } = buildOtpEmail({ code: '483102' })
    expect(html).toContain('483102')
    expect(subject).toBe('Your Lamba Lab verification code')
  })

  it('mentions expiry', () => {
    const { html } = buildOtpEmail({ code: '000000' })
    expect(html).toContain('10 minutes')
  })
})

describe('buildConfirmationEmail', () => {
  it('includes the proposal link', () => {
    const { html, subject } = buildConfirmationEmail({
      projectName: 'Mom Task Tracker',
      proposalUrl: 'https://app.lambalab.com/?c=abc-123',
    })
    expect(html).toContain('https://app.lambalab.com/?c=abc-123')
    expect(subject).toBe('Your proposal is saved — Mom Task Tracker')
  })

  it('falls back gracefully when projectName is empty', () => {
    const { subject } = buildConfirmationEmail({
      projectName: '',
      proposalUrl: 'https://app.lambalab.com/?c=abc-123',
    })
    expect(subject).toBe('Your proposal is saved')
  })
})
