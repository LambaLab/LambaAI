'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Plus, Trash2, Shield, ShieldCheck, Loader2 } from 'lucide-react'

type AdminUser = {
  id: string
  email: string
  role: 'super_admin' | 'admin'
  added_by: string | null
  created_at: string
}

type Props = {
  onClose: () => void
}

export default function TeamModal({ onClose }: Props) {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [newEmail, setNewEmail] = useState('')
  const [adding, setAdding] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users')
      const data = await res.json()
      if (res.ok) {
        setUsers(data.users)
      }
    } catch {
      setError('Failed to load team members')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newEmail.trim()) return

    setAdding(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail.trim() }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error)
        return
      }

      setUsers((prev) => [...prev, data.user])
      setNewEmail('')
    } catch {
      setError('Failed to add team member')
    } finally {
      setAdding(false)
    }
  }

  async function handleRemove(id: string) {
    setRemovingId(id)
    setError(null)

    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error)
        return
      }

      setUsers((prev) => prev.filter((u) => u.id !== id))
    } catch {
      setError('Failed to remove team member')
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-[#1d1d1d] border border-white/10 rounded-xl w-full max-w-lg mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <h2 className="font-bebas text-xl text-brand-white tracking-wide">TEAM MEMBERS</h2>
          <button
            onClick={onClose}
            className="text-brand-gray-mid hover:text-brand-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 max-h-96 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-brand-yellow animate-spin" />
            </div>
          ) : (
            <div className="space-y-2">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-white/5 group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {user.role === 'super_admin' ? (
                      <ShieldCheck className="w-4 h-4 text-brand-yellow flex-shrink-0" />
                    ) : (
                      <Shield className="w-4 h-4 text-brand-gray-mid flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm text-brand-white truncate">{user.email}</p>
                      <p className="text-xs text-brand-gray-mid">
                        {user.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                        {user.added_by && ` · Added by ${user.added_by}`}
                      </p>
                    </div>
                  </div>

                  {user.role !== 'super_admin' && (
                    <button
                      onClick={() => handleRemove(user.id)}
                      disabled={removingId === user.id}
                      className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-all p-1.5 rounded hover:bg-red-500/10 cursor-pointer disabled:opacity-50"
                    >
                      {removingId === user.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add member form */}
        <div className="px-6 py-4 border-t border-white/5">
          {error && (
            <p className="text-xs text-red-400 mb-3">{error}</p>
          )}
          <form onSubmit={handleAdd} className="flex gap-2">
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="Add team member by email..."
              className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-brand-white placeholder-brand-gray-mid/50 outline-none focus:border-brand-yellow/40 transition-colors"
            />
            <button
              type="submit"
              disabled={adding || !newEmail.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-yellow text-[#1d1d1d] rounded-lg text-sm font-medium hover:bg-brand-yellow/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {adding ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Add
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
