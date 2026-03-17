export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      sessions: {
        Row: {
          id: string
          user_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['sessions']['Insert']>
        Relationships: []
      }
      proposals: {
        Row: {
          id: string
          session_id: string
          user_id: string | null
          status: 'draft' | 'saved' | 'pending_review' | 'approved' | 'accepted' | 'budget_proposed' | 'budget_accepted'
          modules: Json
          confidence_score: number
          price_min: number
          price_max: number
          brief: string
          email: string | null
          saved_at: string | null
          slug: string | null
          admin_notes: string | null
          prd: string | null
          technical_architecture: string | null
          task_breakdown: Json | null
          timeline: string | null
          milestone_plan: Json | null
          metadata: Json | null
          email_auth_token: string | null
          email_auth_token_expires_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          session_id: string
          user_id?: string | null
          status?: 'draft' | 'saved' | 'pending_review' | 'approved' | 'accepted' | 'budget_proposed' | 'budget_accepted'
          modules?: Json
          confidence_score?: number
          price_min?: number
          price_max?: number
          brief?: string
          email?: string | null
          saved_at?: string | null
          slug?: string | null
          admin_notes?: string | null
          prd?: string | null
          technical_architecture?: string | null
          task_breakdown?: Json | null
          timeline?: string | null
          milestone_plan?: Json | null
          metadata?: Json | null
          email_auth_token?: string | null
          email_auth_token_expires_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['proposals']['Insert']>
        Relationships: []
      }
      chat_messages: {
        Row: {
          id: string
          proposal_id: string
          role: 'user' | 'assistant' | 'admin'
          content: string
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          proposal_id: string
          role: 'user' | 'assistant' | 'admin'
          content: string
          metadata?: Json | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['chat_messages']['Insert']>
        Relationships: []
      }
      otp_codes: {
        Row: {
          id: string
          email: string
          code: string
          proposal_id: string
          session_id: string
          expires_at: string
          used: boolean
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          code: string
          proposal_id: string
          session_id: string
          expires_at: string
          used?: boolean
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['otp_codes']['Insert']>
        Relationships: []
      }
      proposal_slug_history: {
        Row: {
          slug: string
          proposal_id: string
          created_at: string
        }
        Insert: {
          slug: string
          proposal_id: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['proposal_slug_history']['Insert']>
        Relationships: []
      }
      budget_proposals: {
        Row: {
          id: string
          proposal_id: string
          amount: number
          client_notes: string | null
          internal_notes: string | null
          status: 'pending' | 'accepted' | 'countered' | 'call_requested'
          counter_amount: number | null
          counter_notes: string | null
          created_at: string
          responded_at: string | null
        }
        Insert: {
          id?: string
          proposal_id: string
          amount: number
          client_notes?: string | null
          internal_notes?: string | null
          status?: 'pending' | 'accepted' | 'countered' | 'call_requested'
          counter_amount?: number | null
          counter_notes?: string | null
          created_at?: string
          responded_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['budget_proposals']['Insert']>
        Relationships: []
      }
      admin_users: {
        Row: {
          id: string
          email: string
          role: 'super_admin' | 'admin'
          added_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          role?: 'super_admin' | 'admin'
          added_by?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['admin_users']['Insert']>
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
