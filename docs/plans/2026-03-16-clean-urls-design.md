# Clean Proposal URLs

## Context
Proposal URLs currently use raw UUIDs (`?c=503b5592-...`). Replace with human-friendly slugs like `/proposal/calorie-tracker` generated from the AI project name.

## URL Lifecycle
1. **No name yet** — `?c=UUID` (unchanged)
2. **AI names project** — URL swaps to `/proposal/calorie-tracker`
3. **User renames** — URL updates to `/proposal/fitlog`, old slug redirects
4. **Shared/email links** — always use current slug

## DB Changes

### `proposals` table
- Add `slug` column: `text`, nullable, unique index

### New `proposal_slug_history` table
| Column | Type | Notes |
|--------|------|-------|
| `slug` | text | PK |
| `proposal_id` | uuid | FK → proposals.id |
| `created_at` | timestamptz | default now() |

## API Changes

### `POST /api/proposals/[id]/slug`
- Input: `{ name: string }`
- Slugify: lowercase, replace spaces/special chars with hyphens, trim
- Uniqueness: if taken, append first 4 chars of proposalId (e.g. `calorie-tracker-503b`)
- If proposal already has a slug, move old slug to `proposal_slug_history`
- Update `proposals.slug` with new value
- Return: `{ slug: string }`

### `GET /api/proposals/by-slug/[slug]`
- Look up `proposals` where `slug = param`
- If not found, check `proposal_slug_history` → return `{ redirect: currentSlug }`
- If neither, return 404
- Returns same shape as the existing restore endpoint

### Update `verify-otp` route
- After saving, construct email URL using slug if available, else `?c=UUID`

## Frontend Changes

### New page: `app/proposal/[slug]/page.tsx`
- Server component that resolves slug → proposalId via API
- If redirect response, do `redirect('/proposal/newSlug')`
- If found, render `HeroSection` with proposalId passed as prop/searchParam
- If 404, show not found

### `HeroSection.tsx`
- Accept optional `proposalId` prop (from slug page)
- On mount: check for slug in URL path (`/proposal/xxx`) in addition to `?c=` param
- Both paths feed into the same restore/gate flow

### `IntakeOverlay.tsx`
- Track current slug in state: `const [currentSlug, setCurrentSlug] = useState<string | null>(null)`
- On initial session load: if proposal has a slug, store it
- In `handleStateChange`: when `projectName` arrives (first time or rename):
  - Call `POST /api/proposals/[id]/slug` with the name
  - On success: `setCurrentSlug(slug)`, `replaceState` to `/proposal/slug`
- In `saveAppName`: when user manually renames, same slug API call + URL update
- All other `replaceState` calls: use `/proposal/slug` if slug exists, else `?c=UUID`
- `switchToProposal` / `handleNewProposal`: update slug from target proposal data

### `RestoreGateModal.tsx`
- No changes needed — works on proposalId internally

### Email template (`verify-otp/route.ts`)
- Construct URL: `slug ? /proposal/${slug} : /?c=${proposalId}`

## Slug Generation Rules
- Lowercase
- Replace spaces and special chars with hyphens
- Remove consecutive hyphens
- Trim hyphens from start/end
- Max 50 chars
- If collision: append `-` + first 4 chars of proposalId

## Files to Modify
1. `supabase/migrations/` — new migration for slug column + history table
2. `lib/supabase/types.ts` — add slug to Proposals type
3. `app/api/proposals/[id]/slug/route.ts` — new endpoint
4. `app/api/proposals/by-slug/[slug]/route.ts` — new endpoint
5. `app/api/proposals/[id]/restore/route.ts` — include slug in response
6. `app/api/auth/verify-otp/route.ts` — use slug in email URL
7. `app/proposal/[slug]/page.tsx` — new page
8. `components/landing/HeroSection.tsx` — handle slug URLs
9. `components/intake/IntakeOverlay.tsx` — slug state + URL management
10. `lib/email/templates/confirmation.ts` — no change (already takes URL as param)

## Verification
- Start new conversation → URL is `?c=UUID`
- AI names project → URL swaps to `/proposal/slug`
- Rename project → URL updates, old slug redirects
- Open slug URL in incognito → restore gate modal appears
- Email link uses slug URL
- Old `?c=UUID` links still work (backward compatible)
