import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Gracia Tech — Commercial Activation & 12-Month Execution Blueprint',
  description:
    'How Gracia Tech pairs institutional access across the UAE with Silicon Valley product and AI execution: pillars, Lamba Academy, target verticals and the 12-month roadmap.',
}

/* ───────────────────────────── Content ───────────────────────────── */

const ABOUT = [
  {
    title: 'Founder of Lamba',
    body: 'Currently the founder of Lamba, an AI-focused tech innovation company and the creator of Lamba TV, Lamba Lab, Lamba Academy, Oono, Aila, and many more.',
  },
  {
    title: 'Robotics & Electrical Engineer',
    body: 'Attended Carnegie Mellon University (ranked the #1 robotics university in the world) and holds a Bachelor of Engineering in Electrical Engineering from the American University of Beirut (AUB).',
  },
  {
    title: 'Launched Google in the Middle East (2008)',
    body: 'Was Google’s first regional marketing executive in the Middle East, launching and managing Google’s presence across 32 countries.',
  },
  {
    title: 'Silicon Valley Growth & Startup Expert (20+ Years)',
    body: 'Built, scaled, and sold multiple technology companies in Silicon Valley and the Middle East, including serving as Founder & CEO of Loomni.com in Silicon Valley.',
  },
  {
    title: 'CMO of Tango ($1B+ Silicon Valley Unicorn)',
    body: 'Served as Chief Marketing Officer of Tango, a $1B+ Silicon Valley unicorn and the #1 video calling app in the world.',
  },
  {
    title: 'CMO of N2V (Middle East’s First & Largest Tech Holding Group)',
    body: 'Served as Chief Marketing Officer of N2V, the first and largest tech holding and investment group in the Middle East, alongside serving as Regional Brand Manager at Procter & Gamble (P&G).',
  },
  {
    title: 'Creator of the #1 Online Startup Growth Academy',
    body: 'Created the #1 online startup growth academy with over 13,000 startups trained under it, and mentored 300+ startups across Y Combinator (YC), 500 Startups, Techstars, and Stanford StartX—helping founders raise or exit for $90M+.',
  },
  {
    title: 'Business & Executive Education',
    body: 'Holds an MBA from Michael Smurfit Business School (Ireland) and Executive Education in Marketing from Harvard Business School.',
  },
]

const STATS = [
  { value: '13,000+', label: 'Startups trained' },
  { value: '300+', label: 'YC / StartX startups mentored' },
  { value: '$90M+', label: 'Raised or exited by founders' },
  { value: '32', label: 'MENA countries launched for Google' },
]

const PILLARS = [
  {
    tag: 'Pillar A',
    name: 'Elite Tech Services & Venture Expertise',
    items: [
      {
        title: 'Custom AI & Product Engineering',
        body: 'Building enterprise-grade Arabic/English AI agents, complex software platforms, and automated workflows.',
      },
      {
        title: 'Lamba Lab (Autonomous AI Platform)',
        body: 'A proprietary development engine featuring automated proposal building, AI fact-checking, and milestone-based payments validated autonomously by an AI code checker for total enterprise transparency.',
      },
      {
        title: 'Lamba Academy',
        body: 'Practical, hands-on venture-building and AI execution programs led directly by Nagi—featuring our flagship “How to Build and Design a Startup with AI” curriculum, combining 20+ years of Silicon Valley startup scaling with deep GCC & MENA market mastery.',
      },
    ],
    model: 'High-ticket product development contracts, AI retainers, and institutional academy cohort fees.',
  },
  {
    tag: 'Pillar B',
    name: 'Proprietary Global Products',
    items: [
      {
        title: 'Lamba TV',
        body: 'A first-of-its-kind global OS that transforms idle flat screens in lobbies, boardrooms, classrooms, and retail spaces into smartphone-controlled interactive experiences via QR code (camera, voice, gesture, and mobile intake).',
      },
      {
        title: 'Oono (oono.ai)',
        body: 'A category-creating platform that converts static web traffic into interactive 9:16 tappable stories with instant lead capture, in-story checkouts, and nano-apps.',
      },
    ],
    model: 'Recurring SaaS license fees per screen/brand, enterprise subscriptions, and B2B2B channel deals.',
  },
]

const MODULES = [
  {
    title: 'How to Build and Design a Startup with AI',
    flagship: true,
    points: [
      'Moving from raw idea to a functional, designed, and deployed AI product in days rather than months without traditional engineering bottlenecks.',
      'Mastering modern AI-native product design, rapid prototyping workflows, AI agent orchestration, and user-centric interface architecture.',
    ],
  },
  {
    title: 'Product-Market Fit & Silicon Valley Growth Engineering',
    points: [
      'Applying battle-tested Silicon Valley acquisition loops, viral product mechanics, and retention frameworks (drawn from scaling Tango to unicorn status and training 13,000+ startups).',
      'Running rapid customer discovery and validation sprints without burning capital.',
    ],
  },
  {
    title: 'Building & Scaling Across GCC & MENA Realities',
    points: [
      'Navigating regional enterprise sales, government procurement, family business partnerships, and B2B2B distribution channels across the Emirates and wider MENA region.',
      'Adapting global tech models to local cultural, regulatory, and payment ecosystems.',
    ],
  },
  {
    title: 'Go-To-Market Execution & Customer Acquisition Mastery',
    points: [
      'Turning early prototypes into revenue-generating businesses using story-commerce, automated outbound systems, and high-conversion digital funnels.',
      'Mastering unit economics, pricing strategy, and enterprise deal closing.',
    ],
  },
  {
    title: 'Venture Fundraising, Pitch Engineering & Investor Readiness',
    points: [
      'Structuring cap tables, valuations, and term sheets using Silicon Valley standards.',
      'Crafting high-conviction investor decks and pitching directly to regional family offices, UAE sovereign/innovation funds, and global VCs.',
    ],
  },
  {
    title: 'Corporate & Family Office Venture Building (Intrapreneurship Track)',
    points: [
      'Designed specifically for Next-Gen family business leaders and corporate innovation teams to launch internal AI spin-offs, evaluate tech investments, and modernize legacy operations.',
    ],
  },
]

const VERTICALS = [
  {
    name: 'Universities & Higher Education',
    people: ['University Chancellors', 'Deans of Business & Engineering', 'Campus Innovation Directors'],
    a: 'Installing Lamba Academy (including “How to Build and Design a Startup with AI”) as the university’s flagship practical venture and AI program.',
    b: 'Deploying Lamba TV across student unions, lecture halls, and campus lobbies.',
  },
  {
    name: 'Family Businesses & Conglomerates',
    people: ['Family Office Principals', 'Group Chief Executive Officers', 'Next-Gen Council Heads'],
    a: 'Building custom AI agents and digital transformation platforms via Lamba Lab, plus Next-Gen venture & AI training through Lamba Academy.',
    b: 'Implementing Oono across group retail/real estate websites and Lamba TV in corporate headquarters.',
  },
  {
    name: 'Government & Semi-Government Entities',
    people: ['Government Undersecretaries', 'Digital Transformation Directors', 'Innovation Fund Heads'],
    a: 'Delivering national-scale Lamba Academy AI & entrepreneurship bootcamps and executing transparent custom AI builds via Lamba Lab.',
    b: 'Deploying Lamba TV interactive screens across citizen service and happiness centers.',
  },
  {
    name: 'Banks & Major Financial Institutions',
    people: ['Heads of SME Banking', 'Chief Digital Officers (CDOs)', 'Heads of Innovation'],
    a: 'Building secure enterprise AI workflow automation and custom internal software platforms.',
    b: 'B2B2B channel distribution of Oono across their thousands of SME merchant accounts, plus Lamba TV in branches.',
  },
  {
    name: 'Conferences, Summits & Major Events',
    people: ['Event Organizing Managing Directors', 'Exhibition & Venue Directors'],
    a: 'Positioning Nagi on major UAE event stages speaking on AI and Silicon Valley growth under Gracia Tech.',
    b: 'Deploying temporary or permanent Lamba TV interactive engagement networks for event attendees.',
  },
]

const ROADMAP = [
  {
    quarter: 'Q1',
    months: 'Months 1–3',
    title: 'Immediate Multi-Stream Launch',
    focus: 'Universities & Family Businesses',
    work: [
      'Deploy Lamba TV and Oono inside Gracia Group offices and facilities as live UAE showcase sites.',
      'Receive the first batch of targeted introductions from Hamed into Universities and Family Businesses.',
      'Nagi conducts executive meetings, live 10-second QR demos, and technical scoping sessions across all offerings immediately.',
    ],
    revenue: [
      'Close initial Lamba Academy cohorts (“How to Build and Design a Startup with AI”) with university partners and Next-Gen family councils.',
      'Sign paid pilot deployments for Lamba TV and Oono across corporate headquarters and retail/real estate arms.',
      'Kick off our first custom AI agent and product development contracts managed through Lamba Lab.',
    ],
  },
  {
    quarter: 'Q2',
    months: 'Months 4–6',
    title: 'Government & Banking Expansion',
    focus: 'Government Entities & SME Banking',
    work: [
      'Receive the second batch of targeted introductions from Hamed into Government Entities and Heads of SME Banking.',
      'Leverage live Q1 university and family business deployments as local UAE proof points.',
      'Deliver the first university Lamba Academy cohorts and complete initial milestone-verified custom builds via Lamba Lab.',
    ],
    revenue: [
      'Close a B2B2B channel partnership with a UAE bank or major enterprise to distribute Oono across their SME merchant base.',
      'Sign government innovation bootcamps under Lamba Academy and public-sector Lamba TV / custom AI contracts.',
      'Convert Q1 product pilots into annual recurring SaaS agreements.',
    ],
  },
  {
    quarter: 'Q3',
    months: 'Months 7–9',
    title: 'Conference Dominance & Enterprise Scaling',
    focus: 'Conferences, Summits & Large Conglomerates',
    work: [
      'Receive targeted introductions from Hamed to Major Conferences, Summits, and Large Conglomerates.',
      'Position Nagi on premier UAE event stages under the Gracia Tech banner to drive high-intent inbound enterprise demand.',
      'Expand engineering capacity to execute multiple high-ticket custom product development builds concurrently.',
    ],
    revenue: [
      'Close multi-screen enterprise Lamba TV deployments across banking branches, healthcare groups, and event venues.',
      'Secure large-scale custom AI product builds and recurring Lamba Lab retainers with enterprise conglomerates.',
    ],
  },
  {
    quarter: 'Q4',
    months: 'Months 10–12',
    title: 'Market Leadership & Regional Expansion',
    focus: 'Recurring Programs & GCC Expansion',
    work: [
      'Institutionalize multi-semester recurring intake cycles for Lamba Academy across universities and ministries.',
      'Host the inaugural Gracia Tech Annual Innovation & Demo Day, bringing together university cohorts, family business principals, banks, and government leaders.',
      'Finalize Year-2 expansion playbooks across the broader GCC.',
    ],
    revenue: [
      'Compound recurring annual SaaS revenue (Lamba TV + Oono) alongside high-margin custom product development and institutional Lamba Academy retainers.',
    ],
  },
]

const REVENUE_STREAMS = [
  {
    tag: 'Pillar A',
    title: 'High-Margin Product Development & AI Services',
    body: 'Lucrative custom software builds, enterprise AI agents, and transparent Lamba Lab execution contracts.',
  },
  {
    tag: 'Pillar A',
    title: 'Institutional Lamba Academy Programs',
    body: 'High-value recurring retainers and cohorts with universities, government innovation funds, and family conglomerates.',
  },
  {
    tag: 'Pillar B',
    title: 'Scalable Proprietary SaaS',
    body: 'Predictable, compounding subscription cash flows from Lamba TV screen networks and Oono merchant channels across the UAE.',
  },
]

const NAV = [
  { href: '#about', label: 'About Nagi' },
  { href: '#vision', label: 'Vision' },
  { href: '#pillars', label: 'Pillars' },
  { href: '#academy', label: 'Lamba Academy' },
  { href: '#verticals', label: 'Verticals' },
  { href: '#roadmap', label: 'Roadmap' },
  { href: '#vision-revenue', label: 'Revenue' },
]

/* ───────────────────────────── Building blocks ───────────────────────────── */

function SectionHeading({ index, title, kicker }: { index?: string; title: string; kicker?: string }) {
  return (
    <div className="mb-10 md:mb-14">
      {index && (
        <p className="text-brand-yellow text-sm font-semibold tracking-[0.2em] uppercase mb-3">{index}</p>
      )}
      <h2 className="font-bebas text-4xl md:text-6xl leading-[0.95] text-brand-white">{title}</h2>
      {kicker && <p className="mt-4 max-w-3xl text-white/70 text-base md:text-lg leading-relaxed">{kicker}</p>}
    </div>
  )
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3 text-white/75 leading-relaxed">
      <span aria-hidden className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-yellow" />
      <span>{children}</span>
    </li>
  )
}

/* ───────────────────────────── Page ───────────────────────────── */

export default function GraciaTechBlueprintPage() {
  return (
    <main className="min-h-screen bg-brand-dark text-brand-white scroll-smooth">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-white/5 bg-brand-dark/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-3">
          <a href="#top" className="font-bebas text-2xl tracking-wide text-brand-white">
            GRACIA <span className="text-brand-yellow">TECH</span>
          </a>
          <nav className="hidden lg:flex items-center gap-6 text-sm text-white/60">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="hover:text-brand-yellow transition-colors">
                {n.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section id="top" className="relative overflow-hidden px-4 pt-20 pb-16 md:pt-28 md:pb-24">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 right-[-10%] h-[520px] w-[520px] rounded-full bg-brand-yellow/10 blur-3xl"
        />
        <div className="relative mx-auto max-w-6xl">
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-yellow/30 bg-brand-yellow/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-brand-yellow">
            Execution Blueprint · 12 Months
          </p>
          <h1 className="font-bebas text-6xl sm:text-7xl md:text-8xl lg:text-9xl leading-[0.88]">
            Gracia Tech
            <span className="block text-brand-yellow">Commercial Activation</span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg md:text-xl text-white/70 leading-relaxed">
            A high-end tech innovation powerhouse uniting elite institutional access across the Emirates with Silicon
            Valley product, AI engineering, and venture-building expertise.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <a
              href="#roadmap"
              className="rounded-full bg-brand-yellow px-6 py-3 text-sm font-bold text-brand-dark hover:bg-brand-yellow/90 transition-colors"
            >
              View the 12-month roadmap
            </a>
            <a
              href="#academy"
              className="rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-brand-white hover:border-brand-yellow/50 transition-colors"
            >
              Explore Lamba Academy
            </a>
          </div>
        </div>
      </section>

      {/* About Nagi */}
      <section id="about" className="scroll-mt-20 border-t border-white/5 px-4 py-20 md:py-28">
        <div className="mx-auto max-w-6xl">
          <SectionHeading index="About" title="About Nagi" />
          <div className="mb-12 grid grid-cols-2 gap-4 md:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
                <p className="font-bebas text-4xl md:text-5xl text-brand-yellow leading-none">{s.value}</p>
                <p className="mt-2 text-sm text-white/60">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {ABOUT.map((a) => (
              <article
                key={a.title}
                className="rounded-2xl border border-white/5 p-6 hover:border-brand-yellow/20 transition-colors"
              >
                <h3 className="text-lg font-bold text-brand-white">{a.title}</h3>
                <p className="mt-2 text-white/70 leading-relaxed">{a.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 1. Vision & division of labor */}
      <section id="vision" className="scroll-mt-20 border-t border-white/5 px-4 py-20 md:py-28">
        <div className="mx-auto max-w-6xl">
          <SectionHeading
            index="01"
            title="The Core Vision & Division of Labor"
            kicker="Gracia Tech is a high-end tech innovation powerhouse—not a conventional web agency. As the UAE accelerates national AI adoption across public and private sectors, Gracia Tech unites Hamed’s elite institutional trust, network, and access across the Emirates with Nagi’s deep technical expertise in proprietary global products and high-ticket product development services."
          />
          <p className="mb-6 text-white/60">
            To make this partnership a hyper-efficient commercial engine, our operational split is clear:
          </p>
          <div className="grid gap-5 md:grid-cols-2">
            <article className="rounded-2xl border border-white/10 p-7">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">Hamed’s Role</p>
              <h3 className="mt-2 font-bebas text-3xl md:text-4xl">Strategic Network Access</h3>
              <p className="mt-4 text-white/75 leading-relaxed">
                Providing targeted, high-level introductions to key decision-makers across our core UAE verticals, while
                authorizing internal showcase deployments across Gracia Group.
              </p>
              <p className="mt-4 rounded-xl bg-white/5 px-4 py-3 text-sm font-semibold text-brand-white">
                Hamed does zero selling, zero pitching, and zero meeting attendance.
              </p>
            </article>
            <article className="rounded-2xl border border-brand-yellow/30 bg-brand-yellow/[0.04] p-7">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-yellow">Nagi’s Role</p>
              <h3 className="mt-2 font-bebas text-3xl md:text-4xl">100% Commercial & Technical Engine</h3>
              <p className="mt-4 text-white/75 leading-relaxed">
                Leading all executive presentations, live product demos, conference stages, commercial negotiations,
                contract closings, AI engineering, and client delivery.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* 2. Pillars */}
      <section id="pillars" className="scroll-mt-20 border-t border-white/5 px-4 py-20 md:py-28">
        <div className="mx-auto max-w-6xl">
          <SectionHeading index="02" title="Our Core Pillars" kicker="Services first, products second." />
          <div className="grid gap-6 lg:grid-cols-2">
            {PILLARS.map((p) => (
              <article key={p.tag} className="flex flex-col rounded-3xl border border-white/10 p-7 md:p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-yellow">{p.tag}</p>
                <h3 className="mt-2 font-bebas text-3xl md:text-4xl leading-none">{p.name}</h3>
                <div className="mt-6 space-y-5">
                  {p.items.map((i) => (
                    <div key={i.title}>
                      <h4 className="font-bold text-brand-white">{i.title}</h4>
                      <p className="mt-1 text-white/70 leading-relaxed">{i.body}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-auto pt-6">
                  <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">Commercial Model</p>
                    <p className="mt-1 text-white/85">{p.model}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Lamba Academy */}
      <section id="academy" className="scroll-mt-20 border-t border-white/5 px-4 py-20 md:py-28">
        <div className="mx-auto max-w-6xl">
          <SectionHeading
            index="03"
            title="Deep Dive: Lamba Academy"
            kicker="Unlike traditional academic courses taught by theorists, Lamba Academy is a practical, battle-tested venture-building program designed and led by Nagi. It distills 20+ years of building, scaling, and exiting companies in Silicon Valley and the Middle East, mentoring 300+ YC/StartX startups, and launching Google across 32 MENA countries into an actionable blueprint."
          />
          <p className="mb-10 max-w-3xl border-l-2 border-brand-yellow pl-5 text-lg text-brand-white leading-relaxed">
            Participants do not leave with theory—they leave with deployed AI products, real customer traction, and
            investor-ready ventures tailored to the realities of the GCC and global markets.
          </p>

          <h3 className="mb-6 font-bebas text-3xl text-white/90">Flagship Topic & Core Curriculum Modules</h3>
          <ol className="grid gap-5 md:grid-cols-2">
            {MODULES.map((m, idx) => (
              <li
                key={m.title}
                className={
                  m.flagship
                    ? 'md:col-span-2 rounded-3xl border border-brand-yellow/40 bg-brand-yellow/[0.06] p-7 md:p-9'
                    : 'rounded-2xl border border-white/10 p-6'
                }
              >
                <div className="flex items-start gap-4">
                  <span
                    className={
                      m.flagship
                        ? 'font-bebas text-5xl leading-none text-brand-yellow'
                        : 'font-bebas text-4xl leading-none text-white/30'
                    }
                  >
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <div>
                    {m.flagship && (
                      <span className="mb-2 inline-block rounded-full bg-brand-yellow px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-brand-dark">
                        Flagship Track
                      </span>
                    )}
                    <h4
                      className={
                        m.flagship
                          ? 'font-bebas text-3xl md:text-5xl leading-none text-brand-white'
                          : 'text-lg font-bold text-brand-white'
                      }
                    >
                      {m.title}
                    </h4>
                    <ul className="mt-4 space-y-2">
                      {m.points.map((pt) => (
                        <Bullet key={pt}>{pt}</Bullet>
                      ))}
                    </ul>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 4. Verticals */}
      <section id="verticals" className="scroll-mt-20 border-t border-white/5 px-4 py-20 md:py-28">
        <div className="mx-auto max-w-6xl">
          <SectionHeading
            index="04"
            title="Targeted Verticals & Introduction Requirements"
            kicker="To respect Hamed’s time and utilize his network with surgical precision, here are the exact verticals we are targeting from Month 1, the specific decision-makers we need introductions to, and what we deploy inside each organization."
          />
          <div className="space-y-5">
            {VERTICALS.map((v, idx) => (
              <article
                key={v.name}
                className="grid gap-6 rounded-2xl border border-white/10 p-6 md:grid-cols-[1fr_1fr_1.6fr] md:p-7"
              >
                <div>
                  <p className="font-bebas text-3xl leading-none text-brand-yellow">{idx + 1}.</p>
                  <h3 className="mt-1 text-xl font-bold text-brand-white">{v.name}</h3>
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
                    Decision-makers to introduce
                  </p>
                  <ul className="space-y-1.5">
                    {v.people.map((p) => (
                      <Bullet key={p}>{p}</Bullet>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
                    What we deploy & monetize
                  </p>
                  <div className="space-y-3">
                    <p className="text-white/75 leading-relaxed">
                      <span className="font-semibold text-brand-yellow">Pillar A · </span>
                      {v.a}
                    </p>
                    <p className="text-white/75 leading-relaxed">
                      <span className="font-semibold text-brand-yellow">Pillar B · </span>
                      {v.b}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Roadmap */}
      <section id="roadmap" className="scroll-mt-20 border-t border-white/5 px-4 py-20 md:py-28">
        <div className="mx-auto max-w-6xl">
          <SectionHeading index="05" title="12-Month Go-To-Market Execution Roadmap" />
          <ol className="relative space-y-8 md:space-y-10 md:before:absolute md:before:left-[2.75rem] md:before:top-2 md:before:bottom-2 md:before:w-px md:before:bg-white/10">
            {ROADMAP.map((q) => (
              <li key={q.quarter} className="relative md:pl-28">
                <div className="mb-4 flex items-center gap-4 md:absolute md:left-0 md:top-0 md:mb-0">
                  <span className="flex h-[5.5rem] w-[5.5rem] shrink-0 flex-col items-center justify-center rounded-full border border-brand-yellow/40 bg-brand-dark">
                    <span className="font-bebas text-4xl leading-none text-brand-yellow">{q.quarter}</span>
                    <span className="text-[10px] uppercase tracking-wider text-white/50">{q.months}</span>
                  </span>
                </div>
                <div className="rounded-2xl border border-white/10 p-6 md:p-8">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">{q.focus}</p>
                  <h3 className="mt-1 font-bebas text-3xl md:text-4xl leading-none">{q.title}</h3>
                  <div className="mt-6 grid gap-6 md:grid-cols-2">
                    <div>
                      <p className="mb-3 text-sm font-bold text-brand-white">The Work We Do</p>
                      <ul className="space-y-2">
                        {q.work.map((w) => (
                          <Bullet key={w}>{w}</Bullet>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-xl bg-brand-yellow/[0.05] p-5">
                      <p className="mb-3 text-sm font-bold text-brand-yellow">Revenue Closed</p>
                      <ul className="space-y-2">
                        {q.revenue.map((r) => (
                          <Bullet key={r}>{r}</Bullet>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 6. Multi-million dollar vision */}
      <section id="vision-revenue" className="scroll-mt-20 border-t border-white/5 px-4 py-20 md:py-28">
        <div className="mx-auto max-w-6xl">
          <SectionHeading
            index="06"
            title="The Multi-Million Dollar Vision"
            kicker="Gracia Tech is engineered to be a dominant, multi-million dollar tech powerhouse in the Emirates. By pairing Hamed’s elite institutional network access with Nagi’s proven Silicon Valley expertise across both proprietary global products and elite development services, Gracia Tech captures revenue from every angle:"
          />
          <div className="grid gap-5 md:grid-cols-3">
            {REVENUE_STREAMS.map((r, idx) => (
              <article key={r.title} className="rounded-2xl border border-white/10 p-6">
                <div className="flex items-center justify-between">
                  <span className="font-bebas text-5xl leading-none text-brand-yellow">{idx + 1}</span>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/60">
                    {r.tag}
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-bold text-brand-white">{r.title}</h3>
                <p className="mt-2 text-white/70 leading-relaxed">{r.body}</p>
              </article>
            ))}
          </div>
          <p className="mt-12 rounded-3xl border border-brand-yellow/30 bg-brand-yellow/[0.05] p-7 md:p-10 text-lg md:text-xl leading-relaxed text-brand-white">
            With Hamed opening the right institutional doors and Nagi leading 100% of product execution, sales, and
            delivery, Gracia Tech is positioned to capture significant market share, generate multi-million dollar cash
            flows, and define the future of AI and tech innovation in the region.
          </p>
        </div>
      </section>

      <footer className="border-t border-white/5 px-4 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 text-sm text-white/40 md:flex-row md:items-center">
          <p className="font-bebas text-xl text-white/70">
            GRACIA <span className="text-brand-yellow">TECH</span>
          </p>
          <p>Commercial Activation & 12-Month Execution Blueprint</p>
        </div>
      </footer>
    </main>
  )
}
