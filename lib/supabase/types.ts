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
      }
      proposals: {
        Row: {
          id: string
          session_id: string
          user_id: string | null
          status: 'draft' | 'pending_review' | 'approved' | 'accepted'
          modules: Json
          confidence_score: number
          price_min: number
          price_max: number
          brief: string
          admin_notes: string | null
          prd: string | null
          technical_architecture: string | null
          task_breakdown: Json | null
          timeline: string | null
          milestone_plan: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          session_id: string
          user_id?: string | null
          status?: 'draft' | 'pending_review' | 'approved' | 'accepted'
          modules?: Json
          confidence_score?: number
          price_min?: number
          price_max?: number
          brief?: string
          admin_notes?: string | null
          prd?: string | null
          technical_architecture?: string | null
          task_breakdown?: Json | null
          timeline?: string | null
          milestone_plan?: Json | null
        }
        Update: Partial<Database['public']['Tables']['proposals']['Insert']>
      }
      chat_messages: {
        Row: {
          id: string
          proposal_id: string
          role: 'user' | 'assistant'
          content: string
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          proposal_id: string
          role: 'user' | 'assistant'
          content: string
          metadata?: Json | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['chat_messages']['Insert']>
      }
    }
  }
}
