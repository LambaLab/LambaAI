'use client'

type Props = {
  initialMessage: string
  onMinimize: () => void
}

export default function IntakeOverlay({ initialMessage, onMinimize }: Props) {
  return (
    <div className="fixed inset-0 z-50 bg-brand-dark flex items-center justify-center">
      <div className="text-center space-y-4">
        <p className="text-brand-white">Intake: {initialMessage}</p>
        <button onClick={onMinimize} className="text-brand-gray-mid text-sm underline">
          Minimize
        </button>
      </div>
    </div>
  )
}
