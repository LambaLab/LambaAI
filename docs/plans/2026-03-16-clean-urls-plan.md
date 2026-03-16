# Clean Proposal URLs Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace raw UUID URLs (`?c=503b5592-...`) with human-friendly slugs (`/proposal/calorie-tracker`) generated from the AI project name.

**Architecture:** Slugs are stored in a `slug` column on the `proposals` table. A `proposal_slug_history` table keeps old slugs as redirecting aliases when users rename. A new `/proposal/[slug]` page resolves slugs to proposalIds. The client swaps from `?c=UUID` to `/proposal/slug` as soon as the AI names the project.

**Tech Stack:** Next.js App Router, Supabase (Postgres), existing API patterns

---

### Task 1: Database Migration — Add slug column + history table

**Files:**
- Create: `supabase/migrations/003_add_proposal_slugs.sql`

**Step 1: Write the migration SQL**

```sql
-- Add slug column to proposals
ALTER TABLE proposals ADD COLUMN slug text;

-- Unique index (nulls are allowed — not every proposal has a slug yet)
CREATE UNIQUE INDEX proposals_slug_unique ON proposals (slug) WHERE slug IS NOT NULL;

-- History table for old slugs that redirect
CREATE TABLE proposal_slug_history (
  slug text PRIMARY KEY,
  proposal_id uuid NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX proposal_slug_history_proposal_id ON proposal_slug_history (proposal_id);
```

**Step 2: Run the migration against Supabase**

Run via Supabase dashboard SQL editor or CLI:
```bash
# If using Supabase CLI:
supabase db push
```

**Step 3: Commit**

```bash
git add supabase/migrations/003_add_proposal_slugs.sql
git commit -m "db: add slug column to proposals + slug history table"
```

---

### Task 2: Update TypeScript types

**Files:**
- Modify: `lib/supabase/types.ts`

**Step 1: Add slug to proposals Row type** (after line 34, `saved_at`)

Add `slug: string | null` to `Row`, `Insert`, and `Update` (via Insert).

In the `Row` type (after `saved_at: string | null`):
```typescript
slug: string | null
```

In the `Insert` type (after `saved_at?: string | null`):
```typescript
slug?: string | null
```

**Step 2: Add proposal_slug_history table type** (after the `otp_codes` block, before closing `}`):

```typescript
proposal_slug_history: {
  Row: {
    slug: string
    proposal_id: string
    created_at: string
  }
  Insert: {
    slug: string
    proposal_id: string
    created_at?: string
  }
  Update: Partial<Database['public']['Tables']['proposal_slug_history']['Insert']>
  Relationships: []
}
```

**Step 3: Commit**

```bash
git add lib/supabase/types.ts
git commit -m "types: add slug to proposals + proposal_slug_history table"
```

---

### Task 3: Create slug utility + API endpoint

**Files:**
- Create: `lib/slugify.ts`
- Create: `app/api/proposals/[id]/slug/route.ts`

**Step 1: Create the slugify utility**

`lib/slugify.ts`:
```typescript
/** Convert a project name to a URL-safe slug. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')  // remove special chars
    .replace(/[\s]+/g, '-')         // spaces → hyphens
    .replace(/-+/g, '-')            // collapse multiple hyphens
    .replace(/^-|-$/g, '')          // trim hyphens from edges
    .slice(0, 50)                   // max 50 chars
}
```

**Step 2: Create the slug API endpoint**

`app/api/proposals/[id]/slug/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { slugify } from '@/lib/slugify'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: proposalId } = await params
  const { name } = await req.json()

  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'Missing name' }, { status: 400 })
  }

  const supabase = createServiceClient()
  let slug = slugify(name)

  if (!slug) {
    return NextResponse.json({ error: 'Invalid name' }, { status: 400 })
  }

  // Check if this proposal already has a slug
  const { data: current } = await supabase
    .from('proposals')
    .select('slug')
    .eq('id', proposalId)
    .single()

  // If the slug hasn't changed, return early
  if (current?.slug === slug) {
    return NextResponse.json({ slug })
  }

  // Check uniqueness — if taken by another proposal, append short hash
  const { data: existing } = await supabase
    .from('proposals')
    .select('id')
    .eq('slug', slug)
    .neq('id', proposalId)
    .limit(1)
    .single()

  if (existing) {
    slug = `${slug}-${proposalId.slice(0, 4)}`
  }

  // Also check slug history for collisions
  const { data: historyHit } = await supabase
    .from('proposal_slug_history')
    .select('slug')
    .eq('slug', slug)
    .limit(1)
    .single()

  if (historyHit) {
    slug = `${slug}-${proposalId.slice(0, 4)}`
  }

  // Move old slug to history if it existed and is different
  if (current?.slug && current.slug !== slug) {
    await supabase
      .from('proposal_slug_history')
      .upsert({ slug: current.slug, proposal_id: proposalId }, { onConflict: 'slug' })
  }

  // Update the proposal with the new slug
  const { error } = await supabase
    .from('proposals')
    .update({ slug })
    .eq('id', proposalId)

  if (error) {
    console.error('[slug] update error:', error)
    return NextResponse.json({ error: 'Failed to update slug' }, { status: 500 })
  }

  return NextResponse.json({ slug })
}
```

**Step 3: Commit**

```bash
git add lib/slugify.ts app/api/proposals/[id]/slug/route.ts
git commit -m "feat: slug generation API + slugify utility"
```

---

### Task 4: Create slug lookup API + page route

**Files:**
- Create: `app/api/proposals/by-slug/[slug]/route.ts`
- Create: `app/proposal/[slug]/page.tsx`

**Step 1: Create the slug lookup API**

`app/api/proposals/by-slug/[slug]/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const supabase = createServiceClient()

  // Try direct slug match on proposals
  const { data: proposal } = await supabase
    .from('proposals')
    .select('id, slug')
    .eq('slug', slug)
    .single()

  if (proposal) {
    return NextResponse.json({ proposalId: proposal.id, slug: proposal.slug })
  }

  // Check slug history for redirect
  const { data: history } = await supabase
    .from('proposal_slug_history')
    .select('proposal_id')
    .eq('slug', slug)
    .single()

  if (history) {
    // Look up current slug for redirect
    const { data: target } = await supabase
      .from('proposals')
      .select('slug')
      .eq('id', history.proposal_id)
      .single()

    return NextResponse.json({
      redirect: true,
      proposalId: history.proposal_id,
      currentSlug: target?.slug ?? null,
    })
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
```

**Step 2: Create the `/proposal/[slug]` page**

`app/proposal/[slug]/page.tsx`:
```typescript
import { redirect, notFound } from 'next/navigation'
import HomePage from '../../page'

type Props = { params: Promise<{ slug: string }> }

export default async function SlugProposalPage({ params }: Props) {
  const { slug } = await params
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  // Resolve slug → proposalId
  const res = await fetch(`${appUrl}/api/proposals/by-slug/${slug}`, {
    cache: 'no-store',
  })

  if (!res.ok) notFound()

  const data = await res.json()

  // If this is an old slug, redirect to the current one
  if (data.redirect && data.currentSlug) {
    redirect(`/proposal/${data.currentSlug}`)
  }

  // Render the home page with the proposalId injected as a search param
  // This allows HeroSection to pick it up the same way as ?c=
  redirect(`/?c=${data.proposalId}`)
}
```

Note: This uses a server redirect to `/?c=UUID` which then gets swapped back to `/proposal/slug` by the client. This keeps HeroSection as the single source of truth for the restore flow.

**Step 3: Commit**

```bash
git add app/api/proposals/by-slug/[slug]/route.ts app/proposal/[slug]/page.tsx
git commit -m "feat: slug lookup API + /proposal/[slug] page route"
```

---

### Task 5: Update restore API to include slug

**Files:**
- Modify: `app/api/proposals/[id]/restore/route.ts`

**Step 1: Add slug to the select query** (line 13)

Change:
```typescript
.select('id, session_id, user_id, brief, email, modules, confidence_score, metadata')
```
To:
```typescript
.select('id, session_id, user_id, brief, email, modules, confidence_score, metadata, slug')
```

**Step 2: Add slug to the response** (around line 59, inside `NextResponse.json`)

Add after `metadata: meta ?? null,`:
```typescript
slug: (proposal as Record<string, unknown>).slug ?? null,
```

**Step 3: Commit**

```bash
git add app/api/proposals/[id]/restore/route.ts
git commit -m "feat: include slug in restore API response"
```

---

### Task 6: Update IntakeOverlay — slug state + URL management

**Files:**
- Modify: `components/intake/IntakeOverlay.tsx`

**Step 1: Add slug state** (after line 43, the `appName` state)

```typescript
const [currentSlug, setCurrentSlug] = useState<string | null>(null)
```

**Step 2: Create a helper to build the URL** (after the state declarations)

```typescript
const buildUrl = useCallback((slug: string | null, proposalId: string) => {
  return slug ? `/proposal/${slug}` : `?c=${proposalId}`
}, [])
```

**Step 3: Create a function to update slug via API** (after `buildUrl`)

```typescript
const updateSlug = useCallback(async (proposalId: string, name: string) => {
  try {
    const res = await fetch(`/api/proposals/${proposalId}/slug`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (!res.ok) return null
    const { slug } = await res.json()
    setCurrentSlug(slug)
    window.history.replaceState(null, '', `/proposal/${slug}`)
    return slug
  } catch {
    return null
  }
}, [])
```

**Step 4: Update session load** (line 105, the `replaceState` call)

Change:
```typescript
window.history.replaceState(null, '', `?c=${data.proposalId}`)
```
To:
```typescript
// If proposal already has a slug (restored session), use it
// The slug will be set later when the proposal state loads
window.history.replaceState(null, '', `?c=${data.proposalId}`)
```

(This stays as-is for initial load — the slug swap happens in handleStateChange.)

**Step 5: Update handleStateChange** (line 276) to trigger slug creation

Change:
```typescript
const handleStateChange = useCallback((m: number, c: number, pName?: string) => {
  setLiveModuleCount(m)
  setLiveConfidenceScore(c)
  if (pName && pName.trim() && !nameManuallyEditedRef.current) {
    setAppName(pName.trim())
    setNameInputValue(pName.trim())
  }
}, [])
```
To:
```typescript
const handleStateChange = useCallback((m: number, c: number, pName?: string) => {
  setLiveModuleCount(m)
  setLiveConfidenceScore(c)
  if (pName && pName.trim() && !nameManuallyEditedRef.current) {
    setAppName(pName.trim())
    setNameInputValue(pName.trim())
    // Generate/update slug when AI provides a project name
    if (session) {
      updateSlug(session.proposalId, pName.trim())
    }
  }
}, [session, updateSlug])
```

**Step 6: Update saveAppName** (line 73) to trigger slug update on manual rename

After `localStorage.setItem('lamba_app_name', trimmed)` and before `setEditingName(false)`, add:
```typescript
if (session) {
  updateSlug(session.proposalId, trimmed)
}
```

**Step 7: Update switchToProposal** (line 171, the replaceState)

Change:
```typescript
window.history.replaceState(null, '', `?c=${targetId}`)
```
To:
```typescript
// Use slug if target has one, otherwise UUID
const targetMeta = data.metadata && typeof data.metadata === 'object' ? data.metadata : {} as Record<string, unknown>
const targetSlug = (data as Record<string, unknown>).slug as string | null
setCurrentSlug(targetSlug ?? null)
window.history.replaceState(null, '', targetSlug ? `/proposal/${targetSlug}` : `?c=${targetId}`)
```

**Step 8: Update handleNewProposal** (line 262, the replaceState)

Change:
```typescript
window.history.replaceState(null, '', `?c=${newSessionData.proposalId}`)
```
To:
```typescript
setCurrentSlug(null) // new proposal has no slug yet
window.history.replaceState(null, '', `?c=${newSessionData.proposalId}`)
```

**Step 9: Commit**

```bash
git add components/intake/IntakeOverlay.tsx
git commit -m "feat: slug state management + URL swap in IntakeOverlay"
```

---

### Task 7: Update HeroSection — handle `/proposal/slug` URLs

**Files:**
- Modify: `components/landing/HeroSection.tsx`

**Step 1: Update URL parsing in useEffect** (line 15-46)

The existing code reads `?c=` from search params. Add handling for `/proposal/slug` path at the top:

```typescript
useEffect(() => {
  const params = new URLSearchParams(window.location.search)
  const c = params.get('c')

  // Also check if we arrived via /proposal/[slug] redirect
  // (the slug page does redirect(`/?c=proposalId`), so `c` handles it)

  if (c) {
    // ... existing restore logic unchanged ...
  }
  // ... rest unchanged ...
}, [])
```

Actually no change needed here — the `/proposal/[slug]` server page already redirects to `/?c=UUID` which HeroSection handles. The client then swaps back to `/proposal/slug` once IntakeOverlay loads the proposal state and finds the slug.

**Step 2: Commit** (skip if no changes)

---

### Task 8: Update email URL to use slug

**Files:**
- Modify: `app/api/auth/verify-otp/route.ts`

**Step 1: Fetch the proposal's slug** (after line 43, the update statement)

Add after the proposal update block:
```typescript
// Fetch slug for the email URL
const { data: proposalData } = await supabase
  .from('proposals')
  .select('slug')
  .eq('id', proposalId)
  .single()
```

**Step 2: Update URL construction** (line 51-52)

Change:
```typescript
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
const proposalUrl = `${appUrl}/?c=${proposalId}`
```
To:
```typescript
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
const slug = proposalData?.slug
const proposalUrl = slug
  ? `${appUrl}/proposal/${slug}`
  : `${appUrl}/?c=${proposalId}`
```

**Step 3: Commit**

```bash
git add app/api/auth/verify-otp/route.ts
git commit -m "feat: use clean slug URL in confirmation email"
```

---

### Task 9: Update by-email API to include slug

**Files:**
- Modify: `app/api/proposals/by-email/route.ts`

**Step 1: Add slug to the select** (line 26)

Change:
```typescript
.select('id, confidence_score, saved_at, metadata')
```
To:
```typescript
.select('id, confidence_score, saved_at, metadata, slug')
```

**Step 2: Add slug to the response mapping** (around line 44)

Add after `savedAt: p.saved_at,`:
```typescript
slug: (p as Record<string, unknown>).slug ?? null,
```

**Step 3: Commit**

```bash
git add app/api/proposals/by-email/route.ts
git commit -m "feat: include slug in by-email proposals response"
```

---

### Task 10: Backward compatibility — keep ?c=UUID working

No code changes needed. The `?c=UUID` flow is fully preserved:
- HeroSection still reads `?c=` from search params
- All localStorage keys still use UUIDs
- The slug is layered on top — `?c=` is the fallback before a slug exists

**Verification checklist:**
1. Start new conversation → URL is `?c=UUID`
2. AI generates project name → URL swaps to `/proposal/slug`
3. Click the app name to rename → URL updates to new slug
4. Open `/proposal/old-slug` → redirects to `/proposal/new-slug`
5. Open `/proposal/slug` in incognito → restore gate modal appears
6. Save for Later → email contains `/proposal/slug` link
7. Open `?c=UUID` directly → still works (backward compatible)
8. Create new proposal from drawer → URL resets to `?c=UUID` until named

**Step 1: Run through verification manually**

**Step 2: Final commit + push**

```bash
git push origin main
```
