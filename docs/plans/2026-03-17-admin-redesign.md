# Admin Panel Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the entire Lamba Lab admin panel using shadcn/ui components — collapsible sidebar nav, Gmail-style resizable proposals split view, dark/light/system theme toggle, and consistent component styling.

**Architecture:** Install shadcn/ui foundation (CSS variables, utils, base components), build sidebar navigation, restructure the dashboard with ResizablePanels for Gmail-style split view, restyle all admin components (Chat, Budget, Editor, Team, Login) with shadcn primitives. Theme supports light (default), dark, and system modes via next-themes.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS 4, shadcn/ui (copied components), next-themes, react-resizable-panels, Radix UI, Lucide React, Supabase

**Reference theme:** `/tmp/shadcn-theme/shadcn-ui-kit-dashboard-main/` — use as reference for patterns, NOT to copy verbatim.

---

## Task 1: Install Dependencies & Create Foundation Files

**Files:**
- Create: `lib/utils.ts`
- Create: `hooks/use-mobile.ts`
- Modify: `package.json` (via npm install)

**Step 1: Install required packages**

Run:
```bash
cd "/Users/nagi/Downloads/Lamba Lab/Lamba Lab app"
npm install next-themes react-resizable-panels @radix-ui/react-separator @radix-ui/react-scroll-area @radix-ui/react-dropdown-menu @radix-ui/react-select @radix-ui/react-label @radix-ui/react-avatar @radix-ui/react-tabs @radix-ui/react-slot tailwindcss-animate
```

Note: `@radix-ui/react-dialog`, `@radix-ui/react-tooltip`, `@radix-ui/react-progress`, `clsx`, `tailwind-merge`, `class-variance-authority`, and `lucide-react` are already installed.

**Step 2: Create `lib/utils.ts`**

```typescript
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

**Step 3: Create `hooks/use-mobile.ts`**

```typescript
import * as React from 'react'

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    mql.addEventListener('change', onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return !!isMobile
}
```

**Step 4: Commit**

```bash
git add lib/utils.ts hooks/use-mobile.ts package.json package-lock.json
git commit -m "feat: add shadcn/ui foundation — utils, mobile hook, dependencies"
```

---

## Task 2: Rewrite Theme System (globals.css)

**Files:**
- Modify: `app/globals.css`

**Step 1: Rewrite globals.css**

Replace the current `@theme` block and `:root` with the shadcn CSS variable system. KEEP the existing intake overlay styles, anti-flash styles, scrollbar-hide utility, and animations — they are used by the client-side intake experience.

The new CSS must:
- Import `tailwindcss` and `tailwindcss-animate`
- Define `@custom-variant dark (&:is(.dark *))` for Tailwind v4 dark mode
- Set up `:root` with light mode colors (white background, dark text)
- Set up `.dark` with dark mode colors
- Keep `--color-brand-yellow`, `--color-brand-green`, `--color-brand-blue` as accent colors in BOTH modes
- Map all shadcn semantic variables: background, foreground, card, popover, primary, secondary, muted, accent, destructive, border, input, ring, sidebar-*
- Keep brand fonts: `--font-bebas`, `--font-inter`
- Keep ALL existing styles below the theme block (anti-flash, intake overlay, scrollbar-hide, animations)
- Register Tailwind theme colors via `@theme inline` block

Key color decisions:
- Light `:root` → white background, near-black foreground, gray sidebar
- Dark `.dark` → near-black background, white foreground, dark gray sidebar
- `--color-brand-dark: #1d1d1d` kept for backward compat (intake uses it)
- `--primary` in light → `#1d1d1d` (dark), in dark → `#ffffff` (light)
- Sidebar light → `#f8f8f8`, sidebar dark → `#171717`

**Step 2: Commit**

```bash
git add app/globals.css
git commit -m "feat: rewrite theme system with shadcn CSS variables and dark/light mode support"
```

---

## Task 3: Create shadcn/ui Base Components

**Files:**
- Create: `components/ui/button.tsx`
- Create: `components/ui/input.tsx`
- Create: `components/ui/textarea.tsx`
- Create: `components/ui/label.tsx`
- Create: `components/ui/badge.tsx`
- Create: `components/ui/card.tsx`
- Create: `components/ui/separator.tsx`
- Create: `components/ui/scroll-area.tsx`
- Create: `components/ui/tabs.tsx`
- Create: `components/ui/tooltip.tsx`
- Create: `components/ui/skeleton.tsx`
- Create: `components/ui/avatar.tsx`
- Create: `components/ui/dropdown-menu.tsx`
- Create: `components/ui/select.tsx`
- Create: `components/ui/dialog.tsx`
- Create: `components/ui/sheet.tsx`
- Create: `components/ui/resizable.tsx`

**Step 1: Create all 17 shadcn/ui components**

Each component follows the standard shadcn/ui pattern:
- Uses `cn()` from `@/lib/utils`
- Uses `cva` for variants where needed
- Uses Radix UI primitives underneath
- Uses `data-slot` attributes for styling hooks

Reference the shadcn/ui docs or the theme kit at `/tmp/shadcn-theme/shadcn-ui-kit-dashboard-main/components/ui/` for each component's implementation. Standard shadcn/ui component code — do not customize, use vanilla implementations.

Key notes:
- `dialog.tsx` — replaces the current direct Radix `@radix-ui/react-dialog` usage
- `sheet.tsx` — needed for mobile sidebar (slide-out panel)
- `resizable.tsx` — wraps `react-resizable-panels` for Gmail-style split
- `tooltip.tsx` — needed by sidebar component

**Step 2: Commit**

```bash
git add components/ui/
git commit -m "feat: add 17 shadcn/ui base components"
```

---

## Task 4: Create Sidebar Component

**Files:**
- Create: `components/ui/sidebar.tsx`

**Step 1: Copy and adapt the sidebar component**

Copy from `/tmp/shadcn-theme/shadcn-ui-kit-dashboard-main/components/ui/sidebar.tsx`. This is the full sidebar system with:
- `SidebarProvider` — context + cookie persistence + keyboard shortcut (Cmd+B)
- `Sidebar` — renders desktop fixed sidebar or mobile Sheet
- `SidebarTrigger` — collapse toggle button
- `SidebarRail` — edge drag handle
- `SidebarInset` — main content wrapper
- `SidebarHeader`, `SidebarContent`, `SidebarFooter`
- `SidebarGroup`, `SidebarGroupLabel`, `SidebarGroupContent`
- `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton`
- `SidebarMenuBadge`, `SidebarMenuAction`
- `SidebarSeparator`

The file imports from `@/hooks/use-mobile`, `@/lib/utils`, and the shadcn components created in Task 3 (Button, Input, Separator, Sheet, Skeleton, Tooltip).

**Step 2: Commit**

```bash
git add components/ui/sidebar.tsx
git commit -m "feat: add sidebar component system"
```

---

## Task 5: Create Theme Provider & Theme Toggle

**Files:**
- Create: `components/theme-provider.tsx`
- Create: `components/admin/theme-toggle.tsx`

**Step 1: Create ThemeProvider wrapper**

```typescript
'use client'

import * as React from 'react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
```

**Step 2: Create ThemeToggle component**

A dropdown button that cycles between Light, Dark, and System themes. Uses shadcn `DropdownMenu` and `Button` components. Shows Sun icon in light mode, Moon in dark, Monitor for system. Compact enough to fit in the sidebar footer.

```typescript
'use client'

import { Moon, Sun, Monitor } from 'lucide-react'
import { useTheme } from 'next-themes'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenuButton,
} from '@/components/ui/sidebar'

export function ThemeToggle() {
  const { setTheme, theme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton tooltip="Theme">
          <Sun className="rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span>Theme</span>
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end">
        <DropdownMenuItem onClick={() => setTheme('light')}>
          <Sun className="mr-2 h-4 w-4" /> Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}>
          <Moon className="mr-2 h-4 w-4" /> Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}>
          <Monitor className="mr-2 h-4 w-4" /> System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

**Step 3: Commit**

```bash
git add components/theme-provider.tsx components/admin/theme-toggle.tsx
git commit -m "feat: add theme provider and dark/light/system toggle"
```

---

## Task 6: Create Admin Sidebar Navigation

**Files:**
- Create: `components/admin/app-sidebar.tsx`
- Create: `components/admin/nav-user.tsx`

**Step 1: Create `app-sidebar.tsx`**

The main admin sidebar component. Structure:

```
SidebarHeader → "LAMBA LAB" logo (font-bebas)
SidebarContent → NavMain with:
  - Main group:
    - Proposals (ClipboardList icon) — links to /admin
    - Analytics (BarChart3 icon) — disabled, "Coming" badge
  - Settings group (only for super_admin):
    - Team (Users icon) — opens TeamModal
    - Settings (Settings icon) — disabled, "Coming" badge
SidebarFooter →
  - ThemeToggle
  - NavUser (user dropdown with logout)
```

Props: `adminRole: 'super_admin' | 'admin' | null`

Uses: `Sidebar`, `SidebarHeader`, `SidebarContent`, `SidebarFooter`, `SidebarGroup`, `SidebarGroupLabel`, `SidebarGroupContent`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton`, `SidebarMenuBadge`, `SidebarRail`

The Team button should call an `onTeamOpen` callback (passed as prop) instead of navigating.

**Step 2: Create `nav-user.tsx`**

User dropdown in sidebar footer showing admin email and logout option.

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ChevronsUpDown, LogOut } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'

export function NavUser({ email }: { email: string }) {
  const { isMobile } = useSidebar()
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/admin/login'
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" tooltip="Account">
              <Avatar className="h-8 w-8">
                <AvatarFallback>{email.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">Admin</span>
                <span className="truncate text-xs text-muted-foreground">{email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-56"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel>
              <span className="truncate">{email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} disabled={loggingOut}>
              <LogOut className="mr-2 h-4 w-4" />
              {loggingOut ? 'Signing out...' : 'Sign out'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
```

**Step 3: Commit**

```bash
git add components/admin/app-sidebar.tsx components/admin/nav-user.tsx
git commit -m "feat: add admin sidebar navigation and user dropdown"
```

---

## Task 7: Restructure Admin Layouts

**Files:**
- Modify: `app/layout.tsx` (add `suppressHydrationWarning` for next-themes)
- Modify: `app/admin/layout.tsx` (add ThemeProvider)
- Modify: `app/admin/(dashboard)/layout.tsx` (add SidebarProvider + Sidebar)

**Step 1: Update root layout**

Add `suppressHydrationWarning` to the `<html>` tag (required by next-themes to avoid hydration mismatch warnings). Do NOT change anything else — the root layout serves the client intake too.

```typescript
// Only change: add suppressHydrationWarning to <html>
<html lang="en" suppressHydrationWarning className={`${inter.variable} ${bebas.variable}`}>
```

**Step 2: Update `app/admin/layout.tsx`**

Wrap children in ThemeProvider (only admin pages get theme switching):

```typescript
import { ThemeProvider } from '@/components/theme-provider'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      {children}
    </ThemeProvider>
  )
}
```

**Step 3: Update `app/admin/(dashboard)/layout.tsx`**

This becomes a server component that verifies auth AND wraps children in SidebarProvider. However, the Sidebar itself is client-side (needs adminRole state, team modal state). So we keep auth check server-side and pass to a client layout component.

Create `components/admin/admin-layout-shell.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/admin/app-sidebar'
import { Separator } from '@/components/ui/separator'
import TeamModal from '@/components/admin/TeamModal'

type Props = {
  children: React.ReactNode
  adminEmail: string
  adminRole: 'super_admin' | 'admin'
}

export function AdminLayoutShell({ children, adminEmail, adminRole }: Props) {
  const [teamOpen, setTeamOpen] = useState(false)

  return (
    <SidebarProvider>
      <AppSidebar
        adminRole={adminRole}
        adminEmail={adminEmail}
        onTeamOpen={() => setTeamOpen(true)}
      />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <h1 className="font-bebas text-lg tracking-wide">LAMBA LAB</h1>
        </header>
        {children}
      </SidebarInset>
      {teamOpen && <TeamModal onClose={() => setTeamOpen(false)} />}
    </SidebarProvider>
  )
}
```

Update `app/admin/(dashboard)/layout.tsx`:

```typescript
import { redirect } from 'next/navigation'
import { verifyAdminReadOnly } from '@/lib/admin/auth'
import { AdminLayoutShell } from '@/components/admin/admin-layout-shell'

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const auth = await verifyAdminReadOnly()

  if (!auth.admin) {
    redirect('/admin/login')
  }

  return (
    <AdminLayoutShell adminEmail={auth.admin.email} adminRole={auth.admin.role}>
      {children}
    </AdminLayoutShell>
  )
}
```

Note: Check `verifyAdminReadOnly()` return type — it should include the admin's email and role. If it doesn't return these, fetch them via an additional query or the admin users API.

**Step 4: Commit**

```bash
git add app/layout.tsx app/admin/layout.tsx app/admin/(dashboard)/layout.tsx components/admin/admin-layout-shell.tsx
git commit -m "feat: restructure admin layouts with sidebar and theme provider"
```

---

## Task 8: Rewrite Dashboard Page with Gmail-Style Split

**Files:**
- Modify: `app/admin/(dashboard)/page.tsx`

**Step 1: Rewrite the dashboard page**

Replace the current flexbox layout with `ResizablePanelGroup`. Remove AdminHeader import (replaced by sidebar). Keep all existing logic (polling, proposal selection, search, adminRole).

Key changes:
- Remove `AdminHeader` import and usage
- Remove `adminRole` state (now passed via layout)
- Add `ResizablePanelGroup` with horizontal layout
- Left panel (~35%): search bar + ProposalList
- Right panel (~65%): ProposalDetail or empty state
- Add `ResizableHandle` between panels
- On mobile: hide resizable, show list OR detail (not both)

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search } from 'lucide-react'
import type { Database } from '@/lib/supabase/types'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import { Input } from '@/components/ui/input'
import ProposalList from '@/components/admin/ProposalList'
import ProposalDetail from '@/components/admin/ProposalDetail'

type Proposal = Database['public']['Tables']['proposals']['Row']

export default function AdminDashboardPage() {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  const fetchProposals = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/proposals')
      if (res.ok) {
        const data = await res.json()
        setProposals(data)
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    async function loadData() {
      await fetchProposals()
      setLoading(false)
    }
    loadData()
    const pollInterval = setInterval(fetchProposals, 5000)
    return () => clearInterval(pollInterval)
  }, [fetchProposals])

  const selectedProposal = proposals.find((p) => p.id === selectedId) ?? null

  function handleProposalUpdate(updated: Proposal) {
    setProposals((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
      </div>
    )
  }

  return (
    <>
      {/* Desktop: resizable split */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={35} minSize={25} maxSize={50}>
            <div className="flex flex-col h-full">
              <div className="p-3 border-b">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search proposals..."
                    className="pl-9"
                  />
                </div>
              </div>
              <ProposalList
                proposals={proposals}
                selectedId={selectedId}
                onSelect={setSelectedId}
                searchQuery={searchQuery}
              />
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={65} minSize={40}>
            {selectedProposal ? (
              <ProposalDetail
                key={selectedProposal.id}
                proposal={selectedProposal}
                onBack={() => setSelectedId(null)}
                onProposalUpdate={handleProposalUpdate}
              />
            ) : (
              <div className="flex flex-1 h-full items-center justify-center">
                <p className="text-sm text-muted-foreground">Select a proposal to view details</p>
              </div>
            )}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Mobile: list or detail */}
      <div className="md:hidden flex-1 flex flex-col overflow-hidden">
        {selectedProposal ? (
          <ProposalDetail
            key={selectedProposal.id}
            proposal={selectedProposal}
            onBack={() => setSelectedId(null)}
            onProposalUpdate={handleProposalUpdate}
          />
        ) : (
          <div className="flex flex-col h-full">
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search proposals..."
                  className="pl-9"
                />
              </div>
            </div>
            <ProposalList
              proposals={proposals}
              selectedId={selectedId}
              onSelect={setSelectedId}
              searchQuery={searchQuery}
            />
          </div>
        )}
      </div>
    </>
  )
}
```

**Step 2: Commit**

```bash
git add app/admin/(dashboard)/page.tsx
git commit -m "feat: rewrite dashboard with Gmail-style resizable split view"
```

---

## Task 9: Restyle ProposalList & ProposalListItem

**Files:**
- Modify: `components/admin/ProposalList.tsx`
- Modify: `components/admin/ProposalListItem.tsx`

**Step 1: Restyle ProposalList**

Replace raw `<select>` elements with shadcn `Select` components. Replace raw scrolling div with `ScrollArea`. Use semantic colors (`text-muted-foreground`, `border`, etc.) instead of `brand-*` colors.

Key changes:
- Status filter: shadcn `Select` with `SelectTrigger`, `SelectContent`, `SelectItem`
- Sort selector: same
- List container: `ScrollArea`
- Count footer: use `text-muted-foreground`
- Remove all `bg-white/5`, `border-white/5`, `text-brand-*` classes
- Use `bg-muted`, `border`, `text-foreground`, `text-muted-foreground`

**Step 2: Restyle ProposalListItem**

Replace hardcoded status styles with shadcn `Badge` variants. Use semantic colors.

Key changes:
- Status badge: use shadcn `Badge` component with appropriate variants
- Selected state: `bg-accent` instead of `bg-brand-yellow/5`
- Selected border: `border-l-2 border-l-primary` instead of `border-l-brand-yellow`
- Text colors: `text-foreground` instead of `text-brand-white`
- Muted text: `text-muted-foreground` instead of `text-brand-gray-mid`
- Time: `text-muted-foreground`
- Confidence and price: `text-foreground`

**Step 3: Commit**

```bash
git add components/admin/ProposalList.tsx components/admin/ProposalListItem.tsx
git commit -m "feat: restyle proposal list and items with shadcn components"
```

---

## Task 10: Restyle ProposalDetail

**Files:**
- Modify: `components/admin/ProposalDetail.tsx`

**Step 1: Restyle with shadcn components**

Replace custom tabs with shadcn `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`. Use shadcn `Badge` for status. Use semantic colors.

Key changes:
- Status badge: shadcn `Badge`
- Back button: shadcn `Button` variant="ghost" size="icon"
- Tabs: shadcn `Tabs` system replacing custom tab buttons
- Module tags: shadcn `Badge` variant="secondary"
- Stats: `text-muted-foreground`, `text-foreground`
- Title: keep `font-bebas` for project name
- Borders: `border` instead of `border-white/5`

**Step 2: Commit**

```bash
git add components/admin/ProposalDetail.tsx
git commit -m "feat: restyle proposal detail with shadcn tabs and badges"
```

---

## Task 11: Restyle ChatTab

**Files:**
- Modify: `components/admin/ChatTab.tsx`

**Step 1: Restyle with shadcn components**

Key changes:
- Message input: shadcn `Input`
- Send button: shadcn `Button`
- Join/Leave button: shadcn `Button` with appropriate variants
- Message bubbles: use `Card` or semantic `bg-muted` / `bg-primary`
- User messages: `bg-primary text-primary-foreground` (right aligned)
- AI messages: `bg-muted` (left aligned)
- Admin messages: `bg-blue-500/10 border border-blue-500/20` (keep blue for admin distinction)
- Badges: shadcn `Badge` for admin label
- Live indicator: keep green pulse, use `text-green-500`
- ScrollArea for messages container
- Loading spinner: use semantic colors
- Borders: `border` instead of `border-white/5`

Do NOT change any functional logic (polling, broadcast, optimistic updates).

**Step 2: Commit**

```bash
git add components/admin/ChatTab.tsx
git commit -m "feat: restyle chat tab with shadcn components"
```

---

## Task 12: Restyle ProposalEditor

**Files:**
- Modify: `components/admin/ProposalEditor.tsx`

**Step 1: Restyle with shadcn components**

Key changes:
- Remove the `<style jsx global>` block entirely (the `.field-input` CSS)
- All inputs: shadcn `Input`
- All textareas: shadcn `Textarea`
- All labels: shadcn `Label`
- Status selector: shadcn `Select`
- Module toggle buttons: shadcn `Button` with `variant="outline"` (inactive) or `variant="default"` (active), or use `Badge` as toggle
- Save indicator: use `text-muted-foreground` and semantic colors
- Sections: `Separator` between groups
- Save/Check icons: keep lucide, use `text-green-500` for saved indicator

**Step 2: Commit**

```bash
git add components/admin/ProposalEditor.tsx
git commit -m "feat: restyle proposal editor with shadcn form components"
```

---

## Task 13: Restyle BudgetTab

**Files:**
- Modify: `components/admin/BudgetTab.tsx`

**Step 1: Restyle with shadcn components**

Key changes:
- Budget history items: shadcn `Card`, `CardContent`
- Status badges: shadcn `Badge`
- Form inputs: shadcn `Input`, `Textarea`, `Label`
- Submit button: shadcn `Button`
- Warning alert: use `Card` with destructive/warning styling
- Counter-offer section: `Card` with appropriate styling
- Loading spinner: semantic colors
- Sections: use `Separator`

**Step 2: Commit**

```bash
git add components/admin/BudgetTab.tsx
git commit -m "feat: restyle budget tab with shadcn components"
```

---

## Task 14: Restyle TeamModal with shadcn Dialog

**Files:**
- Modify: `components/admin/TeamModal.tsx`

**Step 1: Replace custom modal with shadcn Dialog**

Replace the entire manual modal (fixed backdrop + positioned div) with shadcn `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`.

Key changes:
- `Dialog` + `DialogContent` replaces manual backdrop + modal div
- `DialogHeader` + `DialogTitle` replaces manual header
- Team member list: use `Avatar`, `AvatarFallback` for each user
- Role badges: shadcn `Badge`
- Remove button: shadcn `Button` variant="ghost" size="icon"
- Add form: shadcn `Input` + `Button`
- Error display: use destructive text color
- Loading: semantic spinner

The component interface changes: instead of `onClose` prop, use Dialog's `open`/`onOpenChange` pattern. The parent (`admin-layout-shell.tsx`) controls open state.

Update the Props type:
```typescript
type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}
```

Update `admin-layout-shell.tsx` to pass `open` and `onOpenChange` instead of conditional rendering.

**Step 2: Commit**

```bash
git add components/admin/TeamModal.tsx components/admin/admin-layout-shell.tsx
git commit -m "feat: restyle team modal with shadcn dialog"
```

---

## Task 15: Restyle Login Page

**Files:**
- Modify: `app/admin/login/page.tsx`

**Step 1: Restyle with shadcn components**

Key changes:
- Center card: shadcn `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`
- Google button: shadcn `Button` variant="outline" with Google icon
- Email input: shadcn `Input`
- Submit button: shadcn `Button`
- Keep "LAMBA LAB" in `font-bebas`
- Page background: `bg-muted` for contrast against the card
- Error state: use destructive styling
- Success state: use `Card` with success styling

**Step 2: Commit**

```bash
git add app/admin/login/page.tsx
git commit -m "feat: restyle admin login page with shadcn card and form components"
```

---

## Task 16: Clean Up — Remove Old AdminHeader

**Files:**
- Delete: `components/admin/AdminHeader.tsx`
- Verify: no remaining imports of AdminHeader anywhere

**Step 1: Delete AdminHeader**

```bash
rm components/admin/AdminHeader.tsx
```

**Step 2: Search for remaining imports**

```bash
grep -r "AdminHeader" --include="*.tsx" --include="*.ts" .
```

Expected: no results (we already removed the import in Task 8). If any remain, remove them.

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove deprecated AdminHeader component"
```

---

## Task 17: Build & Verify

**Step 1: Run the build**

```bash
npm run build
```

Expected: successful build with no TypeScript errors.

**Step 2: Fix any build errors**

Common issues to watch for:
- Missing imports (cn, shadcn components)
- TypeScript type mismatches in shadcn components
- CSS variable references not matching between globals.css and component usage
- Tailwind v4 class syntax differences (`w-(--sidebar-width)` vs `w-[var(--sidebar-width)]`)

**Step 3: Start dev server and visually verify**

```bash
npm run dev
```

Check:
- [ ] Admin login page renders with card layout
- [ ] After login, sidebar appears with navigation
- [ ] Sidebar collapses/expands on desktop
- [ ] Sidebar opens as sheet on mobile
- [ ] Theme toggle switches between light/dark/system
- [ ] Proposals list loads and updates (5s polling)
- [ ] Clicking a proposal shows detail in right panel
- [ ] Resizable handle works between panels
- [ ] Chat tab works (messages load, admin can send)
- [ ] Proposal editor works (fields save with debounce)
- [ ] Budget tab works (form submits, history shows)
- [ ] Team modal opens and works (for super_admin)
- [ ] Client-side intake experience is NOT affected (no visual changes to homepage or intake overlay)

**Step 4: Final commit**

```bash
git add -A
git commit -m "fix: resolve build issues from admin redesign"
```

---

## Task 18: Deploy to Production

**Step 1: Push to main**

```bash
git push origin main
```

This triggers Vercel deployment automatically.

**Step 2: Verify on production**

Wait for Vercel deployment to complete, then verify the admin panel on the live site.
