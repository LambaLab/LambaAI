import { describe, it, expect } from 'vitest'
import type { Database } from '../types'

describe('Database types', () => {
  it('exports Proposal type with all required fields', () => {
    type ProposalRow = Database['public']['Tables']['proposals']['Row']
    const row: ProposalRow = {
      id: 'uuid',
      session_id: 'uuid',
      user_id: 'uuid',
      status: 'draft',
      modules: [],
      confidence_score: 0,
      price_min: 0,
      price_max: 0,
      brief: '',
      email: null,
      saved_at: null,
      admin_notes: null,
      prd: null,
      technical_architecture: null,
      task_breakdown: null,
      timeline: null,
      milestone_plan: null,
      slug: null,
      metadata: null,
      email_auth_token: null,
      email_auth_token_expires_at: null,
      created_at: '',
      updated_at: '',
    }
    expect(row.status).toBe('draft')
  })

  it('exports ChatMessage type', () => {
    type MessageRow = Database['public']['Tables']['chat_messages']['Row']
    const msg: MessageRow = {
      id: 'uuid',
      proposal_id: 'uuid',
      role: 'user',
      content: 'hello',
      metadata: null,
      created_at: '',
    }
    expect(msg.role).toBe('user')
  })
})
