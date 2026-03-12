import { getConfidenceLabel } from '@/lib/pricing/engine'

type Props = {
  score: number
}

export default function ConfidenceBar({ score }: Props) {
  const label = getConfidenceLabel(score)
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-brand-gray-mid">
        <span>Estimate Accuracy</span>
        <span className="text-brand-white font-medium">{label} ({score}%)</span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-brand-yellow rounded-full transition-all duration-700"
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  )
}
