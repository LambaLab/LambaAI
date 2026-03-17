'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LogOut, Search, Users } from 'lucide-react'
import TeamModal from './TeamModal'

type Props = {
  searchQuery: string
  onSearchChange: (query: string) => void
  adminRole?: 'super_admin' | 'admin' | null
}

export default function AdminHeader({ searchQuery, onSearchChange, adminRole }: Props) {
  const [loggingOut, setLoggingOut] = useState(false)
  const [teamOpen, setTeamOpen] = useState(false)
  const router = useRouter()

  async function handleLogout() {
    setLoggingOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  return (
    <>
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <h1 className="font-bebas text-2xl text-brand-white tracking-wide">LAMBA LAB ADMIN</h1>

        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-gray-mid" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search proposals..."
              className="pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-brand-white placeholder-brand-gray-mid/50 outline-none focus:border-brand-yellow/40 transition-colors w-64"
            />
          </div>

          {adminRole === 'super_admin' && (
            <button
              onClick={() => setTeamOpen(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-brand-gray-mid hover:text-brand-white transition-colors rounded-lg hover:bg-white/5 cursor-pointer"
            >
              <Users className="w-4 h-4" />
              Team
            </button>
          )}

          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center gap-2 px-3 py-2 text-sm text-brand-gray-mid hover:text-brand-white transition-colors rounded-lg hover:bg-white/5 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            {loggingOut ? 'Signing out...' : 'Sign out'}
          </button>
        </div>
      </header>

      {teamOpen && <TeamModal onClose={() => setTeamOpen(false)} />}
    </>
  )
}
