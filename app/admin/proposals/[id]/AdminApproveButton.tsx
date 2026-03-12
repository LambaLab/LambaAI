'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = { proposalId: string }

export default function AdminApproveButton({ proposalId }: Props) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleApprove() {
    setLoading(true)
    await fetch(`/api/admin/proposals/${proposalId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    })
    setLoading(false)
    router.refresh()
  }

  return (
    <button
      onClick={handleApprove}
      disabled={loading}
      className="w-full py-3 bg-brand-green text-white font-medium rounded-xl hover:bg-brand-green/90 transition-all disabled:opacity-50 text-sm"
    >
      {loading ? 'Approving...' : 'Approve Proposal'}
    </button>
  )
}
