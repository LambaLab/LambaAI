export default async function ProposalPage({ params }: { params: Promise<{ proposalId: string }> }) {
  const { proposalId } = await params

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-16 h-16 bg-brand-yellow/10 rounded-2xl flex items-center justify-center mx-auto">
          <span className="text-3xl">📋</span>
        </div>
        <div className="space-y-2">
          <h1 className="font-bebas text-4xl text-brand-white">YOUR PROPOSAL IS IN REVIEW</h1>
          <p className="text-brand-gray-mid leading-relaxed">
            Our team is reviewing your AI-generated proposal to make sure everything is accurate.
            You&apos;ll receive an email when it&apos;s ready — usually within 24 hours.
          </p>
        </div>
        <div className="p-4 bg-white/5 border border-white/5 rounded-xl text-left space-y-2">
          <p className="text-xs text-brand-gray-mid">Proposal ID</p>
          <p className="text-sm font-mono text-brand-white">{proposalId}</p>
        </div>
      </div>
    </div>
  )
}
