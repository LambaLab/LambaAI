const EXAMPLES = [
  { label: 'Marketplace App', modules: 6, range: '$22k–$38k' },
  { label: 'SaaS Dashboard', modules: 5, range: '$18k–$28k' },
  { label: 'Mobile + Web Platform', modules: 8, range: '$35k–$55k' },
]

export default function SocialProof() {
  return (
    <section className="py-24 px-4 border-t border-white/5">
      <div className="max-w-5xl mx-auto">
        <h2 className="font-bebas text-5xl md:text-6xl text-center text-brand-white mb-4">
          EXAMPLE PROJECTS
        </h2>
        <p className="text-center text-brand-gray-mid mb-16">Real estimates from past proposals</p>
        <div className="grid md:grid-cols-3 gap-6">
          {EXAMPLES.map((ex) => (
            <div key={ex.label} className="p-6 rounded-2xl bg-white/5 border border-white/5">
              <h3 className="font-bold text-brand-white mb-2">{ex.label}</h3>
              <p className="text-brand-gray-mid text-sm mb-4">{ex.modules} modules detected</p>
              <p className="font-bebas text-3xl text-brand-yellow">{ex.range}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
