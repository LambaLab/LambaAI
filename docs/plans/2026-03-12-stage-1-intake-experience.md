# Stage 1 — Intake Experience Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the full Lamba Lab intake experience — a landing page with AI-powered chat that detects technical modules, estimates project costs, and converts anonymous visitors into registered users via email OTP, funneling to an admin-reviewed proposal.

**Architecture:** Next.js App Router with Supabase anonymous auth + Postgres + Realtime. Single Claude API call per turn streams conversational response while returning structured JSON (modules, confidence, pricing) via tool use. Admin review queue sits between AI-generated proposal and client-visible final version.

**Tech Stack:** Next.js 14 (App Router, TypeScript), Supabase (JS client v2, anonymous auth, Realtime), Tailwind CSS, shadcn/ui, Claude claude-sonnet-4-6 API (streaming + tool use), Vitest (unit tests), Bebas Neue + Inter (fonts)

---

## Task 1: Project Bootstrap

**Files:**
- Create: `package.json`, `next.config.ts`, `tailwind.config.ts`, `tsconfig.json` (via create-next-app)
- Create: `.env.local.example`
- Modify: `tailwind.config.ts` — add brand tokens
- Create: `app/layout.tsx` — root layout with fonts

**Step 1: Scaffold the project**

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*"
```

Expected: Project scaffolded with `app/`, `public/`, `tailwind.config.ts`, etc.

**Step 2: Install dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr @anthropic-ai/sdk
npm install @radix-ui/react-dialog @radix-ui/react-progress @radix-ui/react-sheet @radix-ui/react-tooltip
npm install lucide-react class-variance-authority clsx tailwind-merge
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```

**Step 3: Configure Tailwind with brand tokens**

In `tailwind.config.ts`, replace the `theme.extend` section:

```ts
theme: {
  extend: {
    colors: {
      brand: {
        dark: '#1d1d1d',
        yellow: '#fffc00',
        white: '#ffffff',
        green: '#02ba6f',
        blue: '#0082fe',
        'gray-light': '#eeeeee',
        'gray-mid': '#727272',
      },
    },
    fontFamily: {
      bebas: ['var(--font-bebas)', 'sans-serif'],
      inter: ['var(--font-inter)', 'sans-serif'],
    },
  },
},
```

**Step 4: Set up root layout with fonts**

Replace `app/layout.tsx`:

```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import localFont from 'next/font/local'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const bebas = localFont({
  src: '../public/fonts/BebasNeue-Regular.ttf',
  variable: '--font-bebas',
})

export const metadata: Metadata = {
  title: 'Lamba Lab — Build Something',
  description: 'Tell us your idea. Get a real proposal.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${bebas.variable}`}>
      <body className="bg-brand-dark text-brand-white font-inter antialiased">
        {children}
      </body>
    </html>
  )
}
```

**Step 5: Download Bebas Neue font**

```bash
mkdir -p public/fonts
# Download BebasNeue-Regular.ttf from Google Fonts CDN or fonts.google.com and place in public/fonts/
curl -o public/fonts/BebasNeue-Regular.ttf "https://fonts.gstatic.com/s/bebasneuenew/v9/o-0EIpQlx3QUlC5A4PNjXhFVZNyB1W0.ttf"
```

**Step 6: Create `.env.local.example`**

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
ANTHROPIC_API_KEY=sk-ant-...
```

**Step 7: Set up Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
```

Create `vitest.setup.ts`:

```ts
import '@testing-library/jest-dom'
```

Add to `package.json` scripts:

```json
"test": "vitest",
"test:run": "vitest run"
```

**Step 8: Commit**

```bash
git init
git add .
git commit -m "feat: bootstrap Next.js project with brand tokens and Vitest"
```

---

## Task 2: Supabase Schema + Migrations

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/types.ts`

**Step 1: Write the failing test**

Create `lib/supabase/__tests__/types.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
// Type-level test: ensure DB types export compiles
import type { Database } from '../types'

describe('Database types', () => {
  it('exports Proposal type', () => {
    type ProposalRow = Database['public']['Tables']['proposals']['Row']
    const row: ProposalRow = {
      id: 'uuid',
      session_id: 'uuid',
      user_id: 'uuid',
      status: 'draft',
      modules: [],
      confidence_score: 0,
      price_min: 0,
      price_max: 0,
      brief: '',
      admin_notes: null,
      created_at: '',
      updated_at: '',
    }
    expect(row.status).toBe('draft')
  })
})
```

**Step 2: Run test to verify it fails**

```bash
npm run test:run -- lib/supabase/__tests__/types.test.ts
```

Expected: FAIL — `../types` module not found.

**Step 3: Create database migration**

Create `supabase/migrations/001_initial_schema.sql`:

```sql
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Sessions (anonymous + registered)
create table sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Proposals
create table proposals (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid references sessions(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft', 'pending_review', 'approved', 'accepted')),
  modules jsonb not null default '[]',
  confidence_score integer not null default 0 check (confidence_score between 0 and 100),
  price_min integer not null default 0,
  price_max integer not null default 0,
  brief text not null default '',
  admin_notes text,
  prd text,
  technical_architecture text,
  task_breakdown jsonb,
  timeline text,
  milestone_plan jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Chat messages
create table chat_messages (
  id uuid primary key default uuid_generate_v4(),
  proposal_id uuid references proposals(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  metadata jsonb,
  created_at timestamptz default now()
);

-- RLS Policies
alter table sessions enable row level security;
alter table proposals enable row level security;
alter table chat_messages enable row level security;

-- Sessions: owner can read/write their own
create policy "sessions_owner" on sessions
  using (auth.uid() = user_id);

-- Proposals: owner can read own proposals
create policy "proposals_owner_read" on proposals
  for select using (auth.uid() = user_id);

-- Proposals: owner can insert
create policy "proposals_owner_insert" on proposals
  for insert with check (auth.uid() = user_id);

-- Proposals: owner can update draft/pending proposals
create policy "proposals_owner_update" on proposals
  for update using (auth.uid() = user_id and status in ('draft', 'pending_review'));

-- Chat messages: owner can read via proposal
create policy "chat_messages_owner" on chat_messages
  using (
    exists (
      select 1 from proposals p
      where p.id = chat_messages.proposal_id
      and p.user_id = auth.uid()
    )
  );

-- Service role bypass for admin operations
-- (admin API routes use service role key)
```

**Step 4: Create Supabase client utilities**

Create `lib/supabase/types.ts`:

```ts
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
```

Create `lib/supabase/client.ts` (browser):

```ts
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

Create `lib/supabase/server.ts` (server components/routes):

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './types'

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}

export async function createServiceClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}
```

**Step 5: Run test to verify it passes**

```bash
npm run test:run -- lib/supabase/__tests__/types.test.ts
```

Expected: PASS

**Step 6: Commit**

```bash
git add supabase/ lib/supabase/
git commit -m "feat: add Supabase schema migration and typed client utilities"
```

---

## Task 3: Module Catalog + Dependency Graph

**Files:**
- Create: `lib/modules/catalog.ts`
- Create: `lib/modules/dependencies.ts`
- Create: `lib/modules/__tests__/dependencies.test.ts`

**Step 1: Write the failing tests**

Create `lib/modules/__tests__/dependencies.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getModuleDependencies, validateModuleRemoval, getModuleById } from '../dependencies'

describe('getModuleDependencies', () => {
  it('returns direct dependencies for a module', () => {
    const deps = getModuleDependencies('payments')
    expect(deps).toContain('auth')
  })

  it('returns empty array for module with no dependencies', () => {
    const deps = getModuleDependencies('auth')
    expect(deps).toEqual([])
  })
})

describe('validateModuleRemoval', () => {
  it('blocks removal when dependents exist', () => {
    const result = validateModuleRemoval('auth', ['auth', 'payments', 'admin_dashboard'])
    expect(result.canRemove).toBe(false)
    expect(result.blockedBy).toContain('payments')
  })

  it('allows removal when no dependents are active', () => {
    const result = validateModuleRemoval('payments', ['auth', 'payments'])
    expect(result.canRemove).toBe(true)
    expect(result.blockedBy).toHaveLength(0)
  })

  it('allows removal of auth when only auth is active', () => {
    const result = validateModuleRemoval('auth', ['auth'])
    expect(result.canRemove).toBe(true)
  })
})

describe('getModuleById', () => {
  it('returns module definition by id', () => {
    const mod = getModuleById('auth')
    expect(mod).not.toBeNull()
    expect(mod?.id).toBe('auth')
    expect(mod?.name).toBeTypeOf('string')
  })

  it('returns null for unknown id', () => {
    expect(getModuleById('nonexistent_module')).toBeNull()
  })
})
```

**Step 2: Run test to verify it fails**

```bash
npm run test:run -- lib/modules/__tests__/dependencies.test.ts
```

Expected: FAIL — module not found.

**Step 3: Create the module catalog**

Create `lib/modules/catalog.ts`:

```ts
export type Module = {
  id: string
  name: string
  description: string
  category: 'core' | 'payments' | 'communication' | 'ai' | 'storage' | 'admin'
  priceMin: number  // USD
  priceMax: number  // USD
  estimatedWeeks: [number, number]  // [min, max]
  icon: string  // lucide icon name
}

export const MODULE_CATALOG: Module[] = [
  {
    id: 'auth',
    name: 'Authentication',
    description: 'User sign-up, login, session management, password reset',
    category: 'core',
    priceMin: 1500,
    priceMax: 3000,
    estimatedWeeks: [1, 2],
    icon: 'Shield',
  },
  {
    id: 'database',
    name: 'Database & API',
    description: 'Core data models, REST/GraphQL API, CRUD operations',
    category: 'core',
    priceMin: 2000,
    priceMax: 5000,
    estimatedWeeks: [2, 4],
    icon: 'Database',
  },
  {
    id: 'web_app',
    name: 'Web App',
    description: 'Responsive web interface, navigation, core UI components',
    category: 'core',
    priceMin: 3000,
    priceMax: 7000,
    estimatedWeeks: [2, 5],
    icon: 'Monitor',
  },
  {
    id: 'mobile_app',
    name: 'Mobile App',
    description: 'iOS and Android app (React Native or PWA)',
    category: 'core',
    priceMin: 5000,
    priceMax: 12000,
    estimatedWeeks: [4, 8],
    icon: 'Smartphone',
  },
  {
    id: 'payments',
    name: 'Payments',
    description: 'Stripe integration, subscriptions, invoices, payment history',
    category: 'payments',
    priceMin: 2000,
    priceMax: 4000,
    estimatedWeeks: [1, 3],
    icon: 'CreditCard',
  },
  {
    id: 'messaging',
    name: 'Messaging / Chat',
    description: 'Real-time in-app messaging, notifications, chat history',
    category: 'communication',
    priceMin: 2500,
    priceMax: 5000,
    estimatedWeeks: [2, 4],
    icon: 'MessageSquare',
  },
  {
    id: 'admin_dashboard',
    name: 'Admin Dashboard',
    description: 'Internal management UI, user/data management, analytics',
    category: 'admin',
    priceMin: 2000,
    priceMax: 5000,
    estimatedWeeks: [2, 4],
    icon: 'LayoutDashboard',
  },
  {
    id: 'ai_features',
    name: 'AI Features',
    description: 'AI-powered features: chat, recommendations, content generation, analysis',
    category: 'ai',
    priceMin: 3000,
    priceMax: 8000,
    estimatedWeeks: [2, 5],
    icon: 'Sparkles',
  },
  {
    id: 'file_uploads',
    name: 'File Uploads',
    description: 'File/image upload, storage (S3/CDN), processing, previews',
    category: 'storage',
    priceMin: 1000,
    priceMax: 2500,
    estimatedWeeks: [1, 2],
    icon: 'Upload',
  },
  {
    id: 'notifications',
    name: 'Notifications',
    description: 'Email, push, and in-app notifications with templates',
    category: 'communication',
    priceMin: 1000,
    priceMax: 2500,
    estimatedWeeks: [1, 2],
    icon: 'Bell',
  },
  {
    id: 'search',
    name: 'Search',
    description: 'Full-text search, filters, faceted navigation',
    category: 'core',
    priceMin: 1500,
    priceMax: 3500,
    estimatedWeeks: [1, 3],
    icon: 'Search',
  },
  {
    id: 'analytics',
    name: 'Analytics',
    description: 'Usage tracking, dashboards, reporting, data export',
    category: 'admin',
    priceMin: 1500,
    priceMax: 4000,
    estimatedWeeks: [1, 3],
    icon: 'BarChart3',
  },
]
```

Create `lib/modules/dependencies.ts`:

```ts
import { MODULE_CATALOG, type Module } from './catalog'

// Hardcoded dependency graph: key module requires all listed modules
const DEPENDENCY_GRAPH: Record<string, string[]> = {
  auth: [],
  database: [],
  web_app: [],
  mobile_app: [],
  payments: ['auth', 'database'],
  messaging: ['auth', 'database'],
  admin_dashboard: ['auth', 'database'],
  ai_features: ['database'],
  file_uploads: ['database'],
  notifications: ['database'],
  search: ['database'],
  analytics: ['database'],
}

// Reverse map: which modules depend on a given module
function buildDependentsMap(): Record<string, string[]> {
  const dependents: Record<string, string[]> = {}
  for (const [moduleId, deps] of Object.entries(DEPENDENCY_GRAPH)) {
    for (const dep of deps) {
      if (!dependents[dep]) dependents[dep] = []
      dependents[dep].push(moduleId)
    }
  }
  return dependents
}

const DEPENDENTS_MAP = buildDependentsMap()

export function getModuleDependencies(moduleId: string): string[] {
  return DEPENDENCY_GRAPH[moduleId] ?? []
}

export function validateModuleRemoval(
  moduleId: string,
  activeModuleIds: string[]
): { canRemove: boolean; blockedBy: string[] } {
  const potentialDependents = DEPENDENTS_MAP[moduleId] ?? []
  const blockedBy = potentialDependents.filter((dep) => activeModuleIds.includes(dep))
  return { canRemove: blockedBy.length === 0, blockedBy }
}

export function getModuleById(moduleId: string): Module | null {
  return MODULE_CATALOG.find((m) => m.id === moduleId) ?? null
}

export function getRequiredModulesForSelection(moduleId: string): string[] {
  return getModuleDependencies(moduleId)
}
```

**Step 4: Run test to verify it passes**

```bash
npm run test:run -- lib/modules/__tests__/dependencies.test.ts
```

Expected: PASS — all 6 tests pass.

**Step 5: Commit**

```bash
git add lib/modules/
git commit -m "feat: add module catalog and dependency graph with tests"
```

---

## Task 4: Pricing Engine + Confidence Scoring

**Files:**
- Create: `lib/pricing/engine.ts`
- Create: `lib/pricing/__tests__/engine.test.ts`

**Step 1: Write the failing tests**

Create `lib/pricing/__tests__/engine.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  calculatePriceRange,
  applyComplexityAdjustment,
  tightenPriceRange,
  getConfidenceLabel,
  isPricingVisible,
} from '../engine'

describe('calculatePriceRange', () => {
  it('returns zero for empty modules', () => {
    const result = calculatePriceRange([])
    expect(result).toEqual({ min: 0, max: 0 })
  })

  it('sums base prices of active modules', () => {
    const result = calculatePriceRange(['auth', 'web_app'])
    expect(result.min).toBe(1500 + 3000)
    expect(result.max).toBe(3000 + 7000)
  })

  it('ignores unknown module ids', () => {
    const result = calculatePriceRange(['auth', 'unknown_module'])
    expect(result.min).toBe(1500)
    expect(result.max).toBe(3000)
  })
})

describe('applyComplexityAdjustment', () => {
  it('applies positive multiplier for high complexity', () => {
    const base = { min: 10000, max: 20000 }
    const result = applyComplexityAdjustment(base, 1.3)
    expect(result.min).toBe(13000)
    expect(result.max).toBe(26000)
  })

  it('applies negative multiplier for low complexity', () => {
    const base = { min: 10000, max: 20000 }
    const result = applyComplexityAdjustment(base, 0.8)
    expect(result.min).toBe(8000)
    expect(result.max).toBe(16000)
  })

  it('clamps multiplier between 0.5 and 2.0', () => {
    const base = { min: 10000, max: 20000 }
    expect(applyComplexityAdjustment(base, 3.0).max).toBe(40000) // clamped to 2.0
    expect(applyComplexityAdjustment(base, 0.1).min).toBe(5000) // clamped to 0.5
  })
})

describe('tightenPriceRange', () => {
  it('tightens range proportionally at 50% confidence', () => {
    const base = { min: 10000, max: 30000 }
    const result = tightenPriceRange(base, 50)
    expect(result.min).toBeGreaterThan(10000)
    expect(result.max).toBeLessThan(30000)
    expect(result.min).toBeLessThan(result.max)
  })

  it('returns original range at 30% confidence (just unlocked)', () => {
    const base = { min: 10000, max: 30000 }
    const result = tightenPriceRange(base, 30)
    expect(result).toEqual(base)
  })

  it('returns tight range at 95% confidence', () => {
    const base = { min: 10000, max: 30000 }
    const result = tightenPriceRange(base, 95)
    const spread = result.max - result.min
    const originalSpread = base.max - base.min
    expect(spread).toBeLessThan(originalSpread * 0.3)
  })
})

describe('getConfidenceLabel', () => {
  it('maps score ranges to labels', () => {
    expect(getConfidenceLabel(10)).toBe('Low')
    expect(getConfidenceLabel(45)).toBe('Fair')
    expect(getConfidenceLabel(65)).toBe('Good')
    expect(getConfidenceLabel(85)).toBe('High')
  })
})

describe('isPricingVisible', () => {
  it('returns false below 30%', () => {
    expect(isPricingVisible(29)).toBe(false)
    expect(isPricingVisible(0)).toBe(false)
  })

  it('returns true at and above 30%', () => {
    expect(isPricingVisible(30)).toBe(true)
    expect(isPricingVisible(75)).toBe(true)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
npm run test:run -- lib/pricing/__tests__/engine.test.ts
```

Expected: FAIL — `../engine` not found.

**Step 3: Implement the pricing engine**

Create `lib/pricing/engine.ts`:

```ts
import { MODULE_CATALOG } from '@/lib/modules/catalog'

export type PriceRange = { min: number; max: number }

export function calculatePriceRange(moduleIds: string[]): PriceRange {
  return moduleIds.reduce(
    (acc, id) => {
      const mod = MODULE_CATALOG.find((m) => m.id === id)
      if (!mod) return acc
      return { min: acc.min + mod.priceMin, max: acc.max + mod.priceMax }
    },
    { min: 0, max: 0 }
  )
}

export function applyComplexityAdjustment(base: PriceRange, multiplier: number): PriceRange {
  const clamped = Math.max(0.5, Math.min(2.0, multiplier))
  return {
    min: Math.round(base.min * clamped),
    max: Math.round(base.max * clamped),
  }
}

// At 30% confidence: full range. At 100%: range tightened to ~10% spread.
export function tightenPriceRange(base: PriceRange, confidenceScore: number): PriceRange {
  if (confidenceScore <= 30) return base
  const midpoint = (base.min + base.max) / 2
  const halfSpread = (base.max - base.min) / 2
  // tighten factor: 0 at 30%, 0.9 at 100%
  const tightenFactor = ((confidenceScore - 30) / 70) * 0.9
  const newHalfSpread = halfSpread * (1 - tightenFactor)
  return {
    min: Math.round(midpoint - newHalfSpread),
    max: Math.round(midpoint + newHalfSpread),
  }
}

export function getConfidenceLabel(score: number): string {
  if (score < 30) return 'Low'
  if (score < 55) return 'Fair'
  if (score < 75) return 'Good'
  return 'High'
}

export function isPricingVisible(score: number): boolean {
  return score >= 30
}

export function formatPriceRange(range: PriceRange): string {
  const fmt = (n: number) =>
    n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n}`
  return `${fmt(range.min)}–${fmt(range.max)}`
}
```

**Step 4: Run test to verify it passes**

```bash
npm run test:run -- lib/pricing/__tests__/engine.test.ts
```

Expected: PASS — all 12 tests pass.

**Step 5: Commit**

```bash
git add lib/pricing/
git commit -m "feat: add pricing engine with confidence-based range tightening (all tests pass)"
```

---

## Task 5: Landing Page

**Files:**
- Create: `app/page.tsx` — landing page shell
- Create: `components/landing/HeroSection.tsx`
- Create: `components/landing/HeroInput.tsx`
- Create: `components/landing/HowItWorks.tsx`
- Create: `components/landing/ValueProps.tsx`
- Create: `components/landing/SocialProof.tsx`
- Create: `components/landing/Footer.tsx`

**Step 1: Create the landing page shell**

Create `app/page.tsx`:

```tsx
import HeroSection from '@/components/landing/HeroSection'
import HowItWorks from '@/components/landing/HowItWorks'
import ValueProps from '@/components/landing/ValueProps'
import SocialProof from '@/components/landing/SocialProof'
import Footer from '@/components/landing/Footer'

export default function LandingPage() {
  return (
    <main>
      <HeroSection />
      <HowItWorks />
      <ValueProps />
      <SocialProof />
      <Footer />
    </main>
  )
}
```

**Step 2: Create HeroInput — the Replit-style input field**

Create `components/landing/HeroInput.tsx`:

```tsx
'use client'

import { useState, useRef } from 'react'
import { ArrowRight } from 'lucide-react'

type Props = {
  onFirstMessage: (message: string) => void
}

export default function HeroInput({ onFirstMessage }: Props) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  function handleSubmit() {
    const trimmed = value.trim()
    if (!trimmed) return
    onFirstMessage(trimmed)
  }

  // Auto-resize textarea
  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value)
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }
  }

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <div className="flex items-end gap-3 bg-white/5 border border-white/10 rounded-2xl p-4 focus-within:border-brand-yellow/50 transition-colors">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Describe your idea... (e.g. A marketplace for local service providers)"
          rows={1}
          className="flex-1 bg-transparent text-brand-white placeholder:text-brand-gray-mid resize-none outline-none text-base leading-relaxed min-h-[24px] max-h-[200px] overflow-y-auto font-inter"
        />
        <button
          onClick={handleSubmit}
          disabled={!value.trim()}
          className="flex-shrink-0 w-10 h-10 bg-brand-yellow rounded-xl flex items-center justify-center disabled:opacity-30 hover:bg-brand-yellow/90 transition-all active:scale-95"
          aria-label="Send message"
        >
          <ArrowRight className="w-5 h-5 text-brand-dark" />
        </button>
      </div>
      <p className="text-center text-brand-gray-mid text-sm mt-3">
        No account needed · Get a real proposal in minutes
      </p>
    </div>
  )
}
```

**Step 3: Create HeroSection**

Create `components/landing/HeroSection.tsx`:

```tsx
'use client'

import { useState } from 'react'
import HeroInput from './HeroInput'
import IntakeOverlay from '@/components/intake/IntakeOverlay'

export default function HeroSection() {
  const [intakeOpen, setIntakeOpen] = useState(false)
  const [initialMessage, setInitialMessage] = useState('')

  function handleFirstMessage(message: string) {
    setInitialMessage(message)
    setIntakeOpen(true)
  }

  return (
    <>
      <section className="min-h-screen flex flex-col items-center justify-center px-4 py-20 relative">
        {/* Background grid */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,252,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,252,0,0.03)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none" />

        <div className="relative z-10 text-center max-w-4xl mx-auto space-y-8">
          <div className="inline-flex items-center gap-2 bg-brand-yellow/10 border border-brand-yellow/20 rounded-full px-4 py-1.5 text-sm text-brand-yellow font-medium">
            <span className="w-2 h-2 bg-brand-yellow rounded-full animate-pulse" />
            AI-powered project estimation
          </div>

          <h1 className="font-bebas text-6xl sm:text-7xl md:text-8xl lg:text-9xl leading-none tracking-wide text-brand-white">
            BUILD YOUR
            <br />
            <span className="text-brand-yellow">NEXT IDEA</span>
          </h1>

          <p className="text-brand-gray-mid text-lg sm:text-xl max-w-xl mx-auto font-inter">
            Describe your product. Our AI breaks it down into modules,
            estimates the cost, and delivers a real proposal — in minutes.
          </p>

          <HeroInput onFirstMessage={handleFirstMessage} />
        </div>
      </section>

      {intakeOpen && (
        <IntakeOverlay
          initialMessage={initialMessage}
          onMinimize={() => setIntakeOpen(false)}
        />
      )}
    </>
  )
}
```

**Step 4: Create remaining landing sections**

Create `components/landing/HowItWorks.tsx`:

```tsx
const STEPS = [
  {
    number: '01',
    title: 'Describe Your Idea',
    description: 'Tell our AI about your product. Be as detailed or vague as you want — it'll ask the right questions.',
  },
  {
    number: '02',
    title: 'See It Come Together',
    description: 'Watch as modules are detected in real-time. Toggle what you need. Get a live cost estimate.',
  },
  {
    number: '03',
    title: 'Receive Your Proposal',
    description: 'Get a full PRD, technical architecture, and milestone plan reviewed by our team.',
  },
]

export default function HowItWorks() {
  return (
    <section className="py-24 px-4 border-t border-white/5">
      <div className="max-w-5xl mx-auto">
        <h2 className="font-bebas text-5xl md:text-6xl text-center text-brand-white mb-16">
          HOW IT WORKS
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          {STEPS.map((step) => (
            <div key={step.number} className="space-y-4">
              <span className="font-bebas text-7xl text-brand-yellow/20">{step.number}</span>
              <h3 className="text-xl font-bold text-brand-white">{step.title}</h3>
              <p className="text-brand-gray-mid leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

Create `components/landing/ValueProps.tsx`:

```tsx
import { Zap, Shield, BarChart3 } from 'lucide-react'

const PROPS = [
  {
    icon: Zap,
    title: 'Real Estimates, Not Guesses',
    description: 'Every number is backed by our actual project history — not a random range.',
  },
  {
    icon: Shield,
    title: 'Human-Reviewed Proposals',
    description: 'Our team reviews every AI-generated proposal before you see it.',
  },
  {
    icon: BarChart3,
    title: 'Full Technical Blueprint',
    description: 'You get a real PRD, architecture diagram, and milestone plan — not a pitch deck.',
  },
]

export default function ValueProps() {
  return (
    <section className="py-24 px-4 bg-white/2 border-t border-white/5">
      <div className="max-w-5xl mx-auto">
        <h2 className="font-bebas text-5xl md:text-6xl text-center text-brand-white mb-16">
          WHY LAMBA LAB
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          {PROPS.map(({ icon: Icon, title, description }) => (
            <div key={title} className="space-y-4 p-6 rounded-2xl border border-white/5 hover:border-brand-yellow/20 transition-colors">
              <div className="w-12 h-12 bg-brand-yellow/10 rounded-xl flex items-center justify-center">
                <Icon className="w-6 h-6 text-brand-yellow" />
              </div>
              <h3 className="text-lg font-bold text-brand-white">{title}</h3>
              <p className="text-brand-gray-mid leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

Create `components/landing/SocialProof.tsx`:

```tsx
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
            <div key={ex.label} className="p-6 rounded-2xl bg-white/3 border border-white/5">
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
```

Create `components/landing/Footer.tsx`:

```tsx
export default function Footer() {
  return (
    <footer className="py-12 px-4 border-t border-white/5">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <span className="font-bebas text-2xl text-brand-white tracking-widest">LAMBA LAB</span>
        <p className="text-brand-gray-mid text-sm">
          © {new Date().getFullYear()} Lamba Lab. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
```

**Step 5: Run the dev server and verify visually**

```bash
npm run dev
```

Open `http://localhost:3000` — expect: dark background, Bebas Neue headline, yellow accent, input field, landing sections below.

**Step 6: Commit**

```bash
git add app/page.tsx components/landing/
git commit -m "feat: build landing page with hero input and all sections"
```

---

## Task 6: Session Management API Route

**Files:**
- Create: `app/api/intake/session/route.ts`
- Create: `lib/session.ts`

**Step 1: Create session route**

This route creates a Supabase anonymous user and session row, returning session ID for URL state.

Create `app/api/intake/session/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createServerSupabaseClient()

  // Sign in anonymously — creates a real Supabase user with UUID
  const { data: authData, error: authError } = await supabase.auth.signInAnonymously()
  if (authError || !authData.user) {
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
  }

  // Create session row
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .insert({ user_id: authData.user.id })
    .select()
    .single()

  if (sessionError || !session) {
    return NextResponse.json({ error: 'Failed to create session record' }, { status: 500 })
  }

  // Create initial proposal for this session
  const { data: proposal, error: proposalError } = await supabase
    .from('proposals')
    .insert({
      session_id: session.id,
      user_id: authData.user.id,
    })
    .select()
    .single()

  if (proposalError || !proposal) {
    return NextResponse.json({ error: 'Failed to create proposal' }, { status: 500 })
  }

  return NextResponse.json({
    sessionId: session.id,
    proposalId: proposal.id,
    userId: authData.user.id,
  })
}
```

**Step 2: Create session utility for client components**

Create `lib/session.ts`:

```ts
'use client'

const SESSION_KEY = 'lamba_session'

export type SessionData = {
  sessionId: string
  proposalId: string
  userId: string
}

export function getStoredSession(): SessionData | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function storeSession(data: SessionData) {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(data))
}

export async function getOrCreateSession(): Promise<SessionData> {
  const stored = getStoredSession()
  if (stored) return stored

  const res = await fetch('/api/intake/session', { method: 'POST' })
  if (!res.ok) throw new Error('Failed to create session')
  const data: SessionData = await res.json()
  storeSession(data)
  return data
}
```

**Step 3: Commit**

```bash
git add app/api/intake/ lib/session.ts
git commit -m "feat: add anonymous session creation API route"
```

---

## Task 7: Claude AI Chat API Route

**Files:**
- Create: `lib/ai/tools.ts` — tool definitions for structured output
- Create: `lib/ai/system-prompt.ts`
- Create: `app/api/intake/chat/route.ts`

**Step 1: Define the AI tool for structured output**

Create `lib/ai/tools.ts`:

```ts
import type Anthropic from '@anthropic-ai/sdk'

export const UPDATE_PROPOSAL_TOOL: Anthropic.Tool = {
  name: 'update_proposal',
  description:
    'Called by the AI after every turn to update the detected modules, confidence score, price adjustment, and brief. Always call this tool alongside the conversational response.',
  input_schema: {
    type: 'object' as const,
    properties: {
      detected_modules: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of module IDs detected so far (from the module catalog)',
      },
      confidence_score_delta: {
        type: 'number',
        description: 'Change to confidence score this turn (positive or negative, integer)',
      },
      complexity_multiplier: {
        type: 'number',
        description: 'Complexity adjustment multiplier (0.5–2.0). 1.0 = no change. Use >1 for complex, <1 for simple.',
      },
      updated_brief: {
        type: 'string',
        description: 'Concise 2–4 sentence brief of the project as understood so far.',
      },
      follow_up_question: {
        type: 'string',
        description: 'The single most important clarifying question to ask next (already embedded in conversational response).',
      },
      capability_cards: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional capability card labels to show inline (e.g. "Payments", "Mobile App")',
      },
    },
    required: ['detected_modules', 'confidence_score_delta', 'complexity_multiplier', 'updated_brief', 'follow_up_question'],
  },
}
```

Create `lib/ai/system-prompt.ts`:

```ts
import { MODULE_CATALOG } from '@/lib/modules/catalog'

const MODULE_LIST = MODULE_CATALOG.map(
  (m) => `- ${m.id}: ${m.name} — ${m.description}`
).join('\n')

export function getSystemPrompt(): string {
  return `You are a senior technical consultant at Lamba Lab, a software agency. Your job is to understand a client's product idea through conversation and help them understand what technical modules their project needs.

## Your Personality
- Warm, smart, and direct — like a knowledgeable friend, not a salesperson
- Ask ONE focused follow-up question per turn
- Never overwhelm the client with technical jargon
- Be honest about complexity and tradeoffs

## Available Modules
You detect technical modules from the following catalog only:
${MODULE_LIST}

## Your Job Each Turn
1. Give a natural, conversational response (1-3 paragraphs max)
2. Ask ONE clarifying question that will meaningfully increase your understanding
3. ALWAYS call the \`update_proposal\` tool to update the structural data

## Confidence Score Rules
- Start at 5%
- Increase by 5-15% per turn based on how much new information you get
- Decrease if the client contradicts earlier statements
- Reach 80%+ only when you understand: target users, core workflow, monetization, and scale

## Module Detection Rules
- Only add modules you're confident about (>70% sure from conversation)
- Consider dependencies: payments requires auth + database
- Don't add modules just because they sound related — wait for evidence

## Brief Rules
- Keep it to 2-4 sentences
- Focus on WHAT it does and WHO it serves, not HOW it's built

Remember: the goal is to help the client think through their product, not to impress them with technical knowledge.`
}
```

Create `app/api/intake/chat/route.ts`:

```ts
import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'
import { UPDATE_PROPOSAL_TOOL } from '@/lib/ai/tools'
import { getSystemPrompt } from '@/lib/ai/system-prompt'

const anthropic = new Anthropic()

export async function POST(req: NextRequest) {
  const { messages, currentModules, confidenceScore } = await req.json()

  const stream = anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: getSystemPrompt(),
    tools: [UPDATE_PROPOSAL_TOOL],
    tool_choice: { type: 'auto' },
    messages,
  })

  // Create a ReadableStream that sends SSE events
  const readable = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()

      function send(event: string, data: unknown) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ event, data })}\n\n`)
        )
      }

      try {
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta') {
            if (chunk.delta.type === 'text_delta') {
              send('text', { text: chunk.delta.text })
            } else if (chunk.delta.type === 'input_json_delta') {
              send('tool_delta', { partial_json: chunk.delta.partial_json })
            }
          } else if (chunk.type === 'content_block_start') {
            if (chunk.content_block.type === 'tool_use') {
              send('tool_start', { name: chunk.content_block.name, id: chunk.content_block.id })
            }
          } else if (chunk.type === 'content_block_stop') {
            send('block_stop', {})
          } else if (chunk.type === 'message_stop') {
            const finalMessage = await stream.finalMessage()
            // Extract tool use result
            const toolBlock = finalMessage.content.find((b) => b.type === 'tool_use')
            if (toolBlock && toolBlock.type === 'tool_use') {
              send('tool_result', { name: toolBlock.name, input: toolBlock.input })
            }
            send('done', {})
          }
        }
      } catch (err) {
        send('error', { message: err instanceof Error ? err.message : 'Unknown error' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
```

**Step 2: Commit**

```bash
git add lib/ai/ app/api/intake/chat/
git commit -m "feat: add Claude streaming chat API route with tool use for structured output"
```

---

## Task 8: Intake Overlay + Split-Screen Layout

**Files:**
- Create: `components/intake/IntakeOverlay.tsx` — full-screen takeover
- Create: `components/intake/IntakeLayout.tsx` — split-screen shell
- Create: `components/intake/ChatPanel.tsx` — left panel
- Create: `components/intake/ModulesPanel.tsx` — right panel
- Create: `components/intake/MobileBottomDrawer.tsx` — mobile drawer
- Create: `hooks/useIntakeChat.ts` — chat state + streaming logic

**Step 1: Create the intake overlay (full-screen takeover)**

Create `components/intake/IntakeOverlay.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { X, Minus } from 'lucide-react'
import IntakeLayout from './IntakeLayout'
import { getOrCreateSession, type SessionData } from '@/lib/session'

type Props = {
  initialMessage: string
  onMinimize: () => void
}

export default function IntakeOverlay({ initialMessage, onMinimize }: Props) {
  const [session, setSession] = useState<SessionData | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Fade-in animation
    const timer = setTimeout(() => {
      document.body.style.overflow = 'hidden'
    }, 50)
    return () => {
      clearTimeout(timer)
      document.body.style.overflow = ''
    }
  }, [])

  useEffect(() => {
    getOrCreateSession().then(setSession)
  }, [])

  if (!session) {
    return (
      <div className={`fixed inset-0 z-50 bg-brand-dark flex items-center justify-center transition-opacity duration-300 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
        <div className="w-8 h-8 border-2 border-brand-yellow border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div
      className={`fixed inset-0 z-50 bg-brand-dark flex flex-col transition-opacity duration-300 ${mounted ? 'opacity-100' : 'opacity-0'}`}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 flex-shrink-0">
        <span className="font-bebas text-xl tracking-widest text-brand-white">LAMBA LAB</span>
        <div className="flex items-center gap-2">
          <button
            onClick={onMinimize}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-brand-gray-mid hover:text-brand-white transition-colors"
            aria-label="Minimize"
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main content */}
      <IntakeLayout
        proposalId={session.proposalId}
        initialMessage={initialMessage}
      />
    </div>
  )
}
```

**Step 2: Create the split-screen layout**

Create `components/intake/IntakeLayout.tsx`:

```tsx
'use client'

import ChatPanel from './ChatPanel'
import ModulesPanel from './ModulesPanel'
import MobileBottomDrawer from './MobileBottomDrawer'
import { useIntakeChat } from '@/hooks/useIntakeChat'
import { formatPriceRange, isPricingVisible } from '@/lib/pricing/engine'

type Props = {
  proposalId: string
  initialMessage: string
}

export default function IntakeLayout({ proposalId, initialMessage }: Props) {
  const {
    messages,
    activeModules,
    confidenceScore,
    priceRange,
    isStreaming,
    sendMessage,
    toggleModule,
  } = useIntakeChat({ proposalId, initialMessage })

  const pricingVisible = isPricingVisible(confidenceScore)
  const summaryText = pricingVisible
    ? `${activeModules.length} modules · ${formatPriceRange(priceRange)}`
    : `${activeModules.length} modules detected`

  return (
    <div className="flex-1 overflow-hidden flex">
      {/* Desktop: side by side */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        <div className="w-[55%] border-r border-white/5 overflow-hidden">
          <ChatPanel
            messages={messages}
            isStreaming={isStreaming}
            confidenceScore={confidenceScore}
            onSend={sendMessage}
            proposalId={proposalId}
            pricingVisible={pricingVisible}
            priceRange={priceRange}
          />
        </div>
        <div className="w-[45%] overflow-hidden">
          <ModulesPanel
            activeModules={activeModules}
            confidenceScore={confidenceScore}
            priceRange={priceRange}
            pricingVisible={pricingVisible}
            onToggle={toggleModule}
          />
        </div>
      </div>

      {/* Mobile: full chat + bottom drawer */}
      <div className="md:hidden flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-hidden">
          <ChatPanel
            messages={messages}
            isStreaming={isStreaming}
            confidenceScore={confidenceScore}
            onSend={sendMessage}
            proposalId={proposalId}
            pricingVisible={pricingVisible}
            priceRange={priceRange}
          />
        </div>
        <MobileBottomDrawer
          summary={summaryText}
          activeModules={activeModules}
          confidenceScore={confidenceScore}
          priceRange={priceRange}
          pricingVisible={pricingVisible}
          onToggle={toggleModule}
        />
      </div>
    </div>
  )
}
```

**Step 3: Create the chat hook**

Create `hooks/useIntakeChat.ts`:

```ts
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { calculatePriceRange, applyComplexityAdjustment, tightenPriceRange, type PriceRange } from '@/lib/pricing/engine'

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  capabilityCards?: string[]
}

type UpdateProposalInput = {
  detected_modules: string[]
  confidence_score_delta: number
  complexity_multiplier: number
  updated_brief: string
  follow_up_question: string
  capability_cards?: string[]
}

type Props = {
  proposalId: string
  initialMessage: string
}

export function useIntakeChat({ proposalId, initialMessage }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [activeModules, setActiveModules] = useState<string[]>([])
  const [confidenceScore, setConfidenceScore] = useState(0)
  const [complexityMultiplier, setComplexityMultiplier] = useState(1.0)
  const [priceRange, setPriceRange] = useState<PriceRange>({ min: 0, max: 0 })
  const [isStreaming, setIsStreaming] = useState(false)
  const initialSentRef = useRef(false)

  function updatePriceRange(modules: string[], multiplier: number, score: number) {
    const base = calculatePriceRange(modules)
    const adjusted = applyComplexityAdjustment(base, multiplier)
    const tightened = tightenPriceRange(adjusted, score)
    setPriceRange(tightened)
  }

  const sendMessage = useCallback(async (content: string) => {
    if (isStreaming) return

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
    }

    setMessages((prev) => [...prev, userMessage])
    setIsStreaming(true)

    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
    }
    setMessages((prev) => [...prev, assistantMessage])

    // Build message history for API
    const apiMessages = [...messages, userMessage].map((m) => ({
      role: m.role,
      content: m.content,
    }))

    try {
      const res = await fetch('/api/intake/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          currentModules: activeModules,
          confidenceScore,
        }),
      })

      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let toolResultBuffer = ''
      let inToolResult = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6)
          if (!raw.trim()) continue

          const { event, data } = JSON.parse(raw)

          if (event === 'text') {
            setMessages((prev) => {
              const last = prev[prev.length - 1]
              if (last?.role !== 'assistant') return prev
              return [...prev.slice(0, -1), { ...last, content: last.content + data.text }]
            })
          } else if (event === 'tool_result') {
            const input = data.input as UpdateProposalInput
            const newScore = Math.max(0, Math.min(100, confidenceScore + input.confidence_score_delta))
            const newMultiplier = input.complexity_multiplier
            const newModules = input.detected_modules

            setActiveModules(newModules)
            setConfidenceScore(newScore)
            setComplexityMultiplier(newMultiplier)
            updatePriceRange(newModules, newMultiplier, newScore)

            if (input.capability_cards?.length) {
              setMessages((prev) => {
                const last = prev[prev.length - 1]
                if (last?.role !== 'assistant') return prev
                return [...prev.slice(0, -1), { ...last, capabilityCards: input.capability_cards }]
              })
            }
          }
        }
      }
    } catch (err) {
      console.error('Chat error:', err)
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (last?.role !== 'assistant') return prev
        return [...prev.slice(0, -1), { ...last, content: 'Sorry, something went wrong. Please try again.' }]
      })
    } finally {
      setIsStreaming(false)
    }
  }, [messages, activeModules, confidenceScore, isStreaming])

  function toggleModule(moduleId: string) {
    setActiveModules((prev) => {
      const newModules = prev.includes(moduleId)
        ? prev.filter((m) => m !== moduleId)
        : [...prev, moduleId]
      updatePriceRange(newModules, complexityMultiplier, confidenceScore)
      return newModules
    })
  }

  // Send initial message on mount
  useEffect(() => {
    if (!initialSentRef.current && initialMessage) {
      initialSentRef.current = true
      sendMessage(initialMessage)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { messages, activeModules, confidenceScore, priceRange, isStreaming, sendMessage, toggleModule }
}
```

**Step 4: Commit**

```bash
git add components/intake/ hooks/useIntakeChat.ts
git commit -m "feat: add intake overlay, split-screen layout, and streaming chat hook"
```

---

## Task 9: Chat Panel + Module Panel Components

**Files:**
- Create: `components/intake/ChatPanel.tsx`
- Create: `components/intake/MessageBubble.tsx`
- Create: `components/intake/ConfidenceBar.tsx`
- Create: `components/intake/ModulesPanel.tsx`
- Create: `components/intake/ModuleCard.tsx`
- Create: `components/intake/MobileBottomDrawer.tsx`

**Step 1: Create the confidence bar**

Create `components/intake/ConfidenceBar.tsx`:

```tsx
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
```

**Step 2: Create message bubble**

Create `components/intake/MessageBubble.tsx`:

```tsx
import type { ChatMessage } from '@/hooks/useIntakeChat'

const CAPABILITY_CARDS = [
  'Web App', 'Mobile App', 'Payments', 'Messaging',
  'Admin Dashboard', 'AI Features', 'File Uploads', 'Notifications',
]

type Props = {
  message: ChatMessage
  isStreaming?: boolean
}

export default function MessageBubble({ message, isStreaming }: Props) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] space-y-3`}>
        <div
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
            isUser
              ? 'bg-brand-yellow text-brand-dark font-medium rounded-br-sm'
              : 'bg-white/5 text-brand-white rounded-bl-sm'
          }`}
        >
          {message.content}
          {isStreaming && !message.content && (
            <span className="inline-flex gap-1">
              <span className="w-1.5 h-1.5 bg-brand-gray-mid rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 bg-brand-gray-mid rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 bg-brand-gray-mid rounded-full animate-bounce [animation-delay:300ms]" />
            </span>
          )}
        </div>

        {/* Capability cards inline in chat */}
        {message.capabilityCards && message.capabilityCards.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {message.capabilityCards.map((card) => (
              <button
                key={card}
                className="px-3 py-1.5 text-xs font-medium border border-brand-yellow/30 text-brand-yellow rounded-lg hover:bg-brand-yellow/10 transition-colors"
              >
                + {card}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

**Step 3: Create the chat panel**

Create `components/intake/ChatPanel.tsx`:

```tsx
'use client'

import { useRef, useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import MessageBubble from './MessageBubble'
import ConfidenceBar from './ConfidenceBar'
import type { ChatMessage } from '@/hooks/useIntakeChat'
import type { PriceRange } from '@/lib/pricing/engine'
import { formatPriceRange } from '@/lib/pricing/engine'

type Props = {
  messages: ChatMessage[]
  isStreaming: boolean
  confidenceScore: number
  onSend: (message: string) => void
  proposalId: string
  pricingVisible: boolean
  priceRange: PriceRange
}

export default function ChatPanel({
  messages, isStreaming, confidenceScore, onSend,
  proposalId, pricingVisible, priceRange,
}: Props) {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleSubmit() {
    const trimmed = input.trim()
    if (!trimmed || isStreaming) return
    onSend(trimmed)
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  return (
    <div className="flex flex-col h-full">
      {/* Confidence bar header */}
      <div className="px-4 py-3 border-b border-white/5 flex-shrink-0 space-y-3">
        <ConfidenceBar score={confidenceScore} />
        {pricingVisible && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-brand-gray-mid">Estimated range</span>
            <span className="font-bebas text-xl text-brand-yellow">{formatPriceRange(priceRange)}</span>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg, i) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isStreaming={isStreaming && i === messages.length - 1 && msg.role === 'assistant'}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 px-4 pb-4">
        {pricingVisible && (
          <div className="mb-3">
            <button className="w-full py-3 bg-brand-yellow text-brand-dark font-medium rounded-xl hover:bg-brand-yellow/90 transition-all active:scale-[0.98] text-sm">
              View Full Proposal →
            </button>
          </div>
        )}
        <div className="flex items-end gap-2 bg-white/5 border border-white/10 rounded-xl p-3 focus-within:border-brand-yellow/30 transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Tell me more..."
            rows={1}
            disabled={isStreaming}
            className="flex-1 bg-transparent text-brand-white placeholder:text-brand-gray-mid resize-none outline-none text-sm leading-relaxed min-h-[20px] max-h-[120px] overflow-y-auto disabled:opacity-50"
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isStreaming}
            className="w-8 h-8 bg-brand-yellow rounded-lg flex items-center justify-center disabled:opacity-30 hover:bg-brand-yellow/90 transition-all active:scale-95 flex-shrink-0"
          >
            <ArrowRight className="w-4 h-4 text-brand-dark" />
          </button>
        </div>
      </div>
    </div>
  )
}
```

**Step 4: Create the module card**

Create `components/intake/ModuleCard.tsx`:

```tsx
import { getModuleById } from '@/lib/modules/dependencies'
import { validateModuleRemoval } from '@/lib/modules/dependencies'
import { MODULE_CATALOG } from '@/lib/modules/catalog'
import * as Icons from 'lucide-react'
import { X, Plus } from 'lucide-react'

type Props = {
  moduleId: string
  isActive: boolean
  activeModules: string[]
  onToggle: (id: string) => void
}

export default function ModuleCard({ moduleId, isActive, activeModules, onToggle }: Props) {
  const mod = getModuleById(moduleId)
  if (!mod) return null

  const { canRemove, blockedBy } = validateModuleRemoval(moduleId, activeModules)
  const canToggle = isActive ? canRemove : true

  const IconComponent = (Icons as Record<string, React.ComponentType<{ className?: string }>>)[mod.icon] ?? Icons.Box

  function handleClick() {
    if (!canToggle) return
    onToggle(moduleId)
  }

  return (
    <div
      className={`p-3 rounded-xl border transition-all ${
        isActive
          ? 'bg-brand-yellow/5 border-brand-yellow/30'
          : 'bg-white/2 border-white/5 opacity-50'
      } ${canToggle ? 'cursor-pointer hover:border-brand-yellow/50' : 'cursor-not-allowed'}`}
      onClick={handleClick}
      title={!canToggle ? `Required by: ${blockedBy.join(', ')}` : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-brand-yellow/15' : 'bg-white/5'}`}>
            <IconComponent className={`w-4 h-4 ${isActive ? 'text-brand-yellow' : 'text-brand-gray-mid'}`} />
          </div>
          <div className="min-w-0">
            <p className={`text-sm font-medium truncate ${isActive ? 'text-brand-white' : 'text-brand-gray-mid'}`}>
              {mod.name}
            </p>
            <p className="text-xs text-brand-gray-mid truncate">${mod.priceMin.toLocaleString()}–${mod.priceMax.toLocaleString()}</p>
          </div>
        </div>
        <button className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${isActive ? 'bg-brand-yellow/20 text-brand-yellow' : 'bg-white/5 text-brand-gray-mid'}`}>
          {isActive ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
        </button>
      </div>
    </div>
  )
}
```

**Step 5: Create modules panel**

Create `components/intake/ModulesPanel.tsx`:

```tsx
import ModuleCard from './ModuleCard'
import { MODULE_CATALOG } from '@/lib/modules/catalog'
import type { PriceRange } from '@/lib/pricing/engine'
import { formatPriceRange } from '@/lib/pricing/engine'

type Props = {
  activeModules: string[]
  confidenceScore: number
  priceRange: PriceRange
  pricingVisible: boolean
  onToggle: (id: string) => void
}

export default function ModulesPanel({ activeModules, confidenceScore, priceRange, pricingVisible, onToggle }: Props) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-white/5 flex-shrink-0">
        <h2 className="font-bebas text-2xl text-brand-white tracking-wide">
          TECHNICAL MODULES
        </h2>
        <p className="text-xs text-brand-gray-mid mt-0.5">
          {activeModules.length} selected · Toggle to customize
        </p>
      </div>

      {pricingVisible && (
        <div className="px-4 py-3 bg-brand-yellow/5 border-b border-brand-yellow/10">
          <p className="text-xs text-brand-gray-mid mb-1">Total estimate</p>
          <p className="font-bebas text-3xl text-brand-yellow">{formatPriceRange(priceRange)}</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {/* Active modules */}
        {activeModules.length > 0 && (
          <div className="space-y-2">
            {activeModules.map((id) => (
              <ModuleCard
                key={id}
                moduleId={id}
                isActive={true}
                activeModules={activeModules}
                onToggle={onToggle}
              />
            ))}
          </div>
        )}

        {/* Separator */}
        {activeModules.length > 0 && (
          <div className="py-2">
            <div className="h-px bg-white/5" />
            <p className="text-xs text-brand-gray-mid mt-2 mb-1">Add modules</p>
          </div>
        )}

        {/* Inactive modules */}
        {MODULE_CATALOG
          .filter((m) => !activeModules.includes(m.id))
          .map((m) => (
            <ModuleCard
              key={m.id}
              moduleId={m.id}
              isActive={false}
              activeModules={activeModules}
              onToggle={onToggle}
            />
          ))}
      </div>
    </div>
  )
}
```

**Step 6: Create mobile bottom drawer**

Create `components/intake/MobileBottomDrawer.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import ModulesPanel from './ModulesPanel'
import type { PriceRange } from '@/lib/pricing/engine'

type Props = {
  summary: string
  activeModules: string[]
  confidenceScore: number
  priceRange: PriceRange
  pricingVisible: boolean
  onToggle: (id: string) => void
}

export default function MobileBottomDrawer({ summary, activeModules, confidenceScore, priceRange, pricingVisible, onToggle }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-10"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={`relative z-20 bg-brand-dark border-t border-white/10 transition-all duration-300 ${
          open ? 'h-[70vh]' : 'h-12'
        }`}
      >
        {/* Handle bar */}
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between px-4 h-12 text-sm"
        >
          <span className="text-brand-gray-mid">{summary}</span>
          {open ? (
            <ChevronDown className="w-4 h-4 text-brand-gray-mid" />
          ) : (
            <ChevronUp className="w-4 h-4 text-brand-gray-mid" />
          )}
        </button>

        {open && (
          <div className="h-[calc(70vh-3rem)] overflow-hidden">
            <ModulesPanel
              activeModules={activeModules}
              confidenceScore={confidenceScore}
              priceRange={priceRange}
              pricingVisible={pricingVisible}
              onToggle={onToggle}
            />
          </div>
        )}
      </div>
    </>
  )
}
```

**Step 7: Commit**

```bash
git add components/intake/
git commit -m "feat: complete intake UI — chat panel, module panel, mobile drawer"
```

---

## Task 10: Auth Gate + Email OTP

**Files:**
- Create: `components/intake/AuthGateModal.tsx`
- Create: `app/api/auth/send-otp/route.ts`
- Create: `app/api/auth/verify-otp/route.ts`
- Modify: `components/intake/ChatPanel.tsx` — wire up "View Full Proposal" button

**Step 1: Create the auth gate modal**

Create `components/intake/AuthGateModal.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { X, Mail, ArrowRight, Loader2 } from 'lucide-react'

type Step = 'email' | 'otp' | 'loading' | 'success'

type Props = {
  proposalId: string
  onClose: () => void
  onSuccess: () => void
}

export default function AuthGateModal({ proposalId, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setStep('loading')
    setError('')

    const res = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), proposalId }),
    })

    if (res.ok) {
      setStep('otp')
    } else {
      setStep('email')
      setError('Failed to send code. Please try again.')
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    if (!otp.trim()) return
    setStep('loading')
    setError('')

    const res = await fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), otp: otp.trim(), proposalId }),
    })

    if (res.ok) {
      setStep('success')
      setTimeout(onSuccess, 1500)
    } else {
      setStep('otp')
      setError('Invalid code. Please try again.')
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-[#1d1d1d] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <button onClick={onClose} className="absolute top-4 right-4 text-brand-gray-mid hover:text-brand-white">
          <X className="w-5 h-5" />
        </button>

        {step === 'success' ? (
          <div className="text-center space-y-3 py-4">
            <div className="w-12 h-12 bg-brand-green/20 rounded-full flex items-center justify-center mx-auto">
              <span className="text-brand-green text-2xl">✓</span>
            </div>
            <p className="font-bold text-brand-white">Verified!</p>
            <p className="text-brand-gray-mid text-sm">Generating your proposal...</p>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <div className="w-10 h-10 bg-brand-yellow/10 rounded-xl flex items-center justify-center mb-4">
                <Mail className="w-5 h-5 text-brand-yellow" />
              </div>
              <h2 className="font-bold text-brand-white text-lg">
                {step === 'otp' ? 'Enter your code' : 'View your proposal'}
              </h2>
              <p className="text-brand-gray-mid text-sm mt-1">
                {step === 'otp'
                  ? `We sent a 6-digit code to ${email}`
                  : 'Enter your email to access the full proposal'}
              </p>
            </div>

            {error && (
              <p className="text-red-400 text-sm mb-4">{error}</p>
            )}

            {step === 'email' || step === 'loading' ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-brand-white placeholder:text-brand-gray-mid outline-none focus:border-brand-yellow/50 transition-colors text-sm"
                />
                <button
                  type="submit"
                  disabled={step === 'loading' || !email.trim()}
                  className="w-full py-3 bg-brand-yellow text-brand-dark font-medium rounded-xl hover:bg-brand-yellow/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                >
                  {step === 'loading' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>Send code <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-brand-white placeholder:text-brand-gray-mid outline-none focus:border-brand-yellow/50 transition-colors text-sm text-center text-2xl tracking-widest font-mono"
                />
                <button
                  type="submit"
                  disabled={otp.length !== 6}
                  className="w-full py-3 bg-brand-yellow text-brand-dark font-medium rounded-xl hover:bg-brand-yellow/90 transition-all disabled:opacity-50 text-sm"
                >
                  Verify & View Proposal
                </button>
                <button
                  type="button"
                  onClick={() => setStep('email')}
                  className="w-full text-brand-gray-mid text-sm hover:text-brand-white transition-colors"
                >
                  Use a different email
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  )
}
```

**Step 2: Create the OTP API routes**

Create `app/api/auth/send-otp/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { email, proposalId } = await req.json()
  if (!email || !proposalId) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()

  // Send OTP via Supabase Auth — this sends an email with a 6-digit code
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      data: { proposal_id: proposalId },
    },
  })

  if (error) {
    console.error('OTP send error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
```

Create `app/api/auth/verify-otp/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { email, otp, proposalId } = await req.json()
  if (!email || !otp || !proposalId) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()

  // Verify the OTP — this also signs the user in
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token: otp,
    type: 'email',
  })

  if (error || !data.user) {
    return NextResponse.json({ error: error?.message ?? 'Verification failed' }, { status: 400 })
  }

  // Link proposal to the now-verified user
  const { error: updateError } = await supabase
    .from('proposals')
    .update({ user_id: data.user.id, status: 'pending_review' })
    .eq('id', proposalId)

  if (updateError) {
    console.error('Proposal link error:', updateError)
    // Non-fatal — proposal still submitted
  }

  return NextResponse.json({ success: true, userId: data.user.id })
}
```

**Step 3: Wire up auth gate in ChatPanel**

In `components/intake/ChatPanel.tsx`, add state and modal:

```tsx
// Add to imports
import { useState } from 'react' // already there
import AuthGateModal from './AuthGateModal'
import { useRouter } from 'next/navigation'

// Add inside component, before return:
const [showAuthGate, setShowAuthGate] = useState(false)
const router = useRouter()

function handleViewProposal() {
  setShowAuthGate(true)
}

function handleAuthSuccess() {
  setShowAuthGate(false)
  router.push(`/proposal/${proposalId}?status=pending`)
}

// Replace the "View Full Proposal" button:
<button
  onClick={handleViewProposal}
  className="w-full py-3 bg-brand-yellow text-brand-dark font-medium rounded-xl hover:bg-brand-yellow/90 transition-all active:scale-[0.98] text-sm"
>
  View Full Proposal →
</button>

// Add before closing fragment:
{showAuthGate && (
  <AuthGateModal
    proposalId={proposalId}
    onClose={() => setShowAuthGate(false)}
    onSuccess={handleAuthSuccess}
  />
)}
```

**Step 4: Commit**

```bash
git add components/intake/AuthGateModal.tsx app/api/auth/
git commit -m "feat: add email OTP auth gate triggered by View Full Proposal CTA"
```

---

## Task 11: Proposal Generation + Admin Queue

**Files:**
- Create: `app/api/proposals/generate/route.ts`
- Create: `app/proposal/[proposalId]/page.tsx` — pending state
- Create: `app/admin/proposals/page.tsx` — admin list
- Create: `app/admin/proposals/[id]/page.tsx` — admin review
- Create: `app/api/admin/proposals/[id]/route.ts`

**Step 1: Create proposal generation route**

This is called server-side after OTP verify to generate the full proposal content using Claude.

Create `app/api/proposals/generate/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/server'

const anthropic = new Anthropic()

export async function POST(req: NextRequest) {
  const { proposalId } = await req.json()
  if (!proposalId) return NextResponse.json({ error: 'Missing proposalId' }, { status: 400 })

  const supabase = await createServiceClient()

  // Get proposal + chat history
  const { data: proposal } = await supabase
    .from('proposals')
    .select('*')
    .eq('id', proposalId)
    .single()

  if (!proposal) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })

  const { data: messages } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('proposal_id', proposalId)
    .order('created_at', { ascending: true })

  const chatHistory = (messages ?? []).map((m) => `${m.role}: ${m.content}`).join('\n\n')

  // Generate full proposal document
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `Based on the following product discovery conversation, generate a complete project proposal for Lamba Lab's client.

CONVERSATION:
${chatHistory}

DETECTED MODULES: ${JSON.stringify(proposal.modules)}
PROJECT BRIEF: ${proposal.brief}

Generate a structured proposal with these sections:
1. PRD (Product Requirements Document) — goals, users, features, non-goals
2. Technical Architecture — stack choices, data models, API design
3. Task Breakdown — grouped by module, each task with complexity (S/M/L)
4. Timeline — week-by-week milestone plan
5. Milestone Plan — 3-5 major milestones with deliverables

Format as structured JSON.`,
      },
    ],
    tools: [
      {
        name: 'submit_proposal',
        description: 'Submit the completed proposal document',
        input_schema: {
          type: 'object' as const,
          properties: {
            prd: { type: 'string', description: 'Full PRD as markdown' },
            technical_architecture: { type: 'string', description: 'Technical architecture as markdown' },
            task_breakdown: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  module: { type: 'string' },
                  tasks: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        complexity: { type: 'string', enum: ['S', 'M', 'L'] },
                        description: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
            timeline: { type: 'string', description: 'Week-by-week timeline as markdown' },
            milestone_plan: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  week: { type: 'number' },
                  deliverables: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
          required: ['prd', 'technical_architecture', 'task_breakdown', 'timeline', 'milestone_plan'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'submit_proposal' },
  })

  const toolUse = response.content.find((b) => b.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    return NextResponse.json({ error: 'Failed to generate proposal' }, { status: 500 })
  }

  const proposalData = toolUse.input as {
    prd: string
    technical_architecture: string
    task_breakdown: unknown
    timeline: string
    milestone_plan: unknown
  }

  // Save to DB — status stays 'pending_review' for admin queue
  const { error: updateError } = await supabase
    .from('proposals')
    .update({
      prd: proposalData.prd,
      technical_architecture: proposalData.technical_architecture,
      task_breakdown: proposalData.task_breakdown,
      timeline: proposalData.timeline,
      milestone_plan: proposalData.milestone_plan,
    })
    .eq('id', proposalId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
```

**Step 2: Create proposal pending view**

Create `app/proposal/[proposalId]/page.tsx`:

```tsx
export default function ProposalPage({ params }: { params: { proposalId: string } }) {
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
            You'll receive an email when it's ready — usually within 24 hours.
          </p>
        </div>
        <div className="p-4 bg-white/3 border border-white/5 rounded-xl text-left space-y-2">
          <p className="text-xs text-brand-gray-mid">Proposal ID</p>
          <p className="text-sm font-mono text-brand-white">{params.proposalId}</p>
        </div>
      </div>
    </div>
  )
}
```

**Step 3: Create admin proposals list**

Create `app/admin/proposals/page.tsx`:

```tsx
import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function AdminProposalsPage() {
  const supabase = await createServiceClient()

  const { data: proposals } = await supabase
    .from('proposals')
    .select('id, status, brief, price_min, price_max, confidence_score, created_at')
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto">
      <h1 className="font-bebas text-4xl text-brand-white mb-8">PROPOSAL QUEUE</h1>

      <div className="space-y-3">
        {(proposals ?? []).map((p) => (
          <Link
            key={p.id}
            href={`/admin/proposals/${p.id}`}
            className="flex items-center justify-between p-4 bg-white/3 border border-white/5 rounded-xl hover:border-brand-yellow/30 transition-colors"
          >
            <div className="space-y-1">
              <p className="text-sm text-brand-white line-clamp-1">{p.brief || 'No brief yet'}</p>
              <p className="text-xs text-brand-gray-mid">
                {new Date(p.created_at).toLocaleDateString()} · {p.confidence_score}% confidence
              </p>
            </div>
            <div className="text-right space-y-1">
              <span className={`text-xs px-2 py-1 rounded-full ${
                p.status === 'pending_review' ? 'bg-brand-yellow/10 text-brand-yellow' :
                p.status === 'approved' ? 'bg-brand-green/10 text-brand-green' :
                'bg-white/5 text-brand-gray-mid'
              }`}>
                {p.status.replace('_', ' ')}
              </span>
              {p.price_min > 0 && (
                <p className="text-sm font-bold text-brand-white">
                  ${p.price_min.toLocaleString()}–${p.price_max.toLocaleString()}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

**Step 4: Create admin review + approve route**

Create `app/api/admin/proposals/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createServiceClient()
  const updates = await req.json()

  // Admin can update: modules, price_min, price_max, admin_notes, status
  const allowedFields = ['modules', 'price_min', 'price_max', 'admin_notes', 'status']
  const filteredUpdates = Object.fromEntries(
    Object.entries(updates).filter(([key]) => allowedFields.includes(key))
  )

  const { data, error } = await supabase
    .from('proposals')
    .update(filteredUpdates)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

**Step 5: Commit**

```bash
git add app/api/proposals/ app/proposal/ app/admin/ app/api/admin/
git commit -m "feat: add proposal generation, admin queue, and review endpoints"
```

---

## Task 12: Full Proposal View + Accept Flow

**Files:**
- Create: `app/proposal/[proposalId]/approved/page.tsx` — full proposal view
- Create: `components/proposal/ProposalView.tsx`
- Create: `app/api/proposals/[id]/accept/route.ts`

**Step 1: Create the proposal view component**

Create `components/proposal/ProposalView.tsx`:

```tsx
'use client'

import { useState } from 'react'
import type { Database } from '@/lib/supabase/types'

type Proposal = Database['public']['Tables']['proposals']['Row']

type Props = {
  proposal: Proposal
}

export default function ProposalView({ proposal }: Props) {
  const [accepting, setAccepting] = useState(false)
  const [accepted, setAccepted] = useState(false)

  async function handleAccept() {
    setAccepting(true)
    const res = await fetch(`/api/proposals/${proposal.id}/accept`, { method: 'POST' })
    if (res.ok) {
      setAccepted(true)
    }
    setAccepting(false)
  }

  if (accepted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-brand-green/20 rounded-full flex items-center justify-center mx-auto">
            <span className="text-brand-green text-2xl">✓</span>
          </div>
          <h1 className="font-bebas text-4xl text-brand-white">PROPOSAL ACCEPTED!</h1>
          <p className="text-brand-gray-mid">We'll be in touch shortly to kick off your project.</p>
        </div>
      </div>
    )
  }

  const modules = proposal.modules as string[]
  const taskBreakdown = proposal.task_breakdown as Array<{ module: string; tasks: Array<{ name: string; complexity: string; description: string }> }> | null
  const milestones = proposal.milestone_plan as Array<{ name: string; week: number; deliverables: string[] }> | null

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-12">
      {/* Header */}
      <div className="space-y-4">
        <div className="inline-flex items-center gap-2 bg-brand-green/10 border border-brand-green/20 rounded-full px-3 py-1 text-xs text-brand-green">
          ✓ Reviewed by Lamba Lab team
        </div>
        <h1 className="font-bebas text-5xl md:text-6xl text-brand-white">YOUR PROJECT PROPOSAL</h1>
        <p className="text-brand-gray-mid">{proposal.brief}</p>

        <div className="flex items-center gap-6 p-4 bg-white/3 border border-white/5 rounded-xl">
          <div>
            <p className="text-xs text-brand-gray-mid">Estimated cost</p>
            <p className="font-bebas text-3xl text-brand-yellow">
              ${proposal.price_min.toLocaleString()}–${proposal.price_max.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-brand-gray-mid">Modules</p>
            <p className="font-bold text-brand-white">{modules.length}</p>
          </div>
        </div>
      </div>

      {/* PRD */}
      {proposal.prd && (
        <section className="space-y-4">
          <h2 className="font-bebas text-3xl text-brand-white">PRODUCT REQUIREMENTS</h2>
          <div className="prose prose-invert max-w-none text-sm text-brand-gray-mid leading-relaxed whitespace-pre-wrap">
            {proposal.prd}
          </div>
        </section>
      )}

      {/* Architecture */}
      {proposal.technical_architecture && (
        <section className="space-y-4">
          <h2 className="font-bebas text-3xl text-brand-white">TECHNICAL ARCHITECTURE</h2>
          <div className="prose prose-invert max-w-none text-sm text-brand-gray-mid leading-relaxed whitespace-pre-wrap">
            {proposal.technical_architecture}
          </div>
        </section>
      )}

      {/* Timeline */}
      {proposal.timeline && (
        <section className="space-y-4">
          <h2 className="font-bebas text-3xl text-brand-white">TIMELINE</h2>
          <div className="text-sm text-brand-gray-mid leading-relaxed whitespace-pre-wrap">
            {proposal.timeline}
          </div>
        </section>
      )}

      {/* Milestones */}
      {milestones && milestones.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-bebas text-3xl text-brand-white">MILESTONE PLAN</h2>
          <div className="space-y-3">
            {milestones.map((m, i) => (
              <div key={i} className="p-4 bg-white/3 border border-white/5 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-brand-white">{m.name}</h3>
                  <span className="text-xs text-brand-gray-mid">Week {m.week}</span>
                </div>
                <ul className="space-y-1">
                  {m.deliverables.map((d, j) => (
                    <li key={j} className="text-sm text-brand-gray-mid flex items-start gap-2">
                      <span className="text-brand-yellow mt-0.5">·</span>
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Accept CTA */}
      <div className="sticky bottom-6">
        <button
          onClick={handleAccept}
          disabled={accepting}
          className="w-full py-4 bg-brand-yellow text-brand-dark font-bold rounded-xl hover:bg-brand-yellow/90 transition-all active:scale-[0.98] text-base disabled:opacity-50"
        >
          {accepting ? 'Processing...' : 'Accept Proposal & Start Project →'}
        </button>
        <p className="text-center text-xs text-brand-gray-mid mt-2">
          By accepting, you agree to begin the project under these terms
        </p>
      </div>
    </div>
  )
}
```

**Step 2: Create the approved proposal page**

Create `app/proposal/[proposalId]/approved/page.tsx`:

```tsx
import { createServiceClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import ProposalView from '@/components/proposal/ProposalView'

export default async function ApprovedProposalPage({ params }: { params: { proposalId: string } }) {
  const supabase = await createServiceClient()

  const { data: proposal } = await supabase
    .from('proposals')
    .select('*')
    .eq('id', params.proposalId)
    .single()

  if (!proposal) notFound()
  if (proposal.status !== 'approved' && proposal.status !== 'accepted') {
    redirect(`/proposal/${params.proposalId}`)
  }

  return <ProposalView proposal={proposal} />
}
```

**Step 3: Create the accept route**

Create `app/api/proposals/[id]/accept/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Update proposal status to accepted
  const { error } = await supabase
    .from('proposals')
    .update({ status: 'accepted' })
    .eq('id', params.id)
    .eq('user_id', user.id)  // Ensure ownership
    .eq('status', 'approved') // Can only accept approved proposals

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // TODO Stage 2: create project record here

  return NextResponse.json({ success: true })
}
```

**Step 4: Run all tests to ensure everything passes**

```bash
npm run test:run
```

Expected: All tests pass.

**Step 5: Do a final dev server smoke test**

```bash
npm run dev
```

Walk through the full flow:
1. Open `http://localhost:3000` — landing page loads
2. Type a message → intake overlay expands full screen
3. Chat responds with streaming text — modules appear in right panel
4. Price range appears after confidence hits 30%
5. Click "View Full Proposal" → auth gate modal appears
6. Enter email → OTP modal appears
7. (Use Supabase test OTP or real email)
8. After verify → redirect to `/proposal/[id]`

**Step 6: Final commit**

```bash
git add app/proposal/ components/proposal/ app/api/proposals/
git commit -m "feat: complete Stage 1 — full proposal view, accept flow, and end-to-end intake pipeline"
```

---

## Full Flow Summary

```
Landing Page (/)
  → User types message in HeroInput
  → IntakeOverlay opens (full-screen, minimizable)
  → useIntakeChat creates anonymous session
  → Claude streams response + tool use (detected modules, confidence delta)
  → ModulesPanel updates in real-time
  → Confidence bar advances
  → At 30%+: price range appears and tightens
  → User clicks "View Full Proposal"
  → AuthGateModal opens → email OTP → Supabase verify
  → Proposal status → pending_review
  → /api/proposals/generate generates full proposal (background or on page load)
  → /proposal/[id]: "In Review" screen
  → Admin visits /admin/proposals → reviews + approves
  → Client sees /proposal/[id]/approved with full PRD + accept button
  → Client accepts → proposal status → accepted (Stage 2 entry point)
```

---

## Environment Setup Checklist

Before running locally:
1. Create a Supabase project at supabase.com
2. Run `supabase/migrations/001_initial_schema.sql` in Supabase SQL Editor
3. Enable anonymous sign-ins in Supabase Auth settings
4. Configure email OTP in Supabase Auth → Email settings
5. Copy `.env.local.example` to `.env.local` and fill in values
6. Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` (from Supabase Settings → API)
7. Download Bebas Neue font to `public/fonts/BebasNeue-Regular.ttf`
