# Admin Panel Redesign — Design Document

**Date:** 2026-03-17
**Status:** Approved

## Overview

Full redesign of the Lamba Lab admin panel using shadcn/ui components and the purchased shadcn UI kit dashboard theme. The goal is a modern, polished admin experience with collapsible sidebar navigation, Gmail-style split-view proposals, dark/light/system theme toggle, and consistent component styling.

## Decisions

- **Approach:** Full shadcn/ui adoption (Approach A)
- **Navigation:** Collapsible left sidebar
- **Proposals layout:** Gmail-style master-detail split with ResizablePanels
- **Color scheme:** Light mode default, dark/light/system toggle
- **Scope:** Full admin overhaul (nav, proposals, chat, budget, editor, login, team modal)

## 1. Color System & Theme

### Strategy
Replace current CSS-only brand colors with shadcn's CSS variable system using OKLCH color space. Support dark/light/system modes via `next-themes`.

### Light Mode (default)
- `--background`: white
- `--foreground`: near-black
- `--sidebar`: light gray
- `--border`: subtle gray

### Dark Mode
- `--background`: very dark gray
- `--foreground`: light gray
- `--sidebar`: dark gray

### Brand Colors Preserved
- `--primary` → Lamba Lab yellow (#fffc00) for key actions, active states
- `--brand-green` → success/live indicators
- `--brand-blue` → admin-specific elements (chat bubbles, join button)

### Implementation
- Rewrite `app/globals.css` with shadcn CSS variable system
- Install `next-themes` package
- Add `ThemeProvider` wrapper in admin layout
- Theme toggle component in sidebar footer
- Fonts unchanged: Bebas Neue (headings) + Inter (body)

## 2. Sidebar Navigation

### Structure
```
┌──────────────────┐
│ ◆ LAMBA LAB      │  Logo/brand (Bebas font)
│                  │
│ ── Main ──────── │
│ 📋 Proposals     │  Active = yellow accent
│ 📊 Analytics     │  Future (greyed, "Coming" badge)
│                  │
│ ── Settings ──── │
│ 👥 Team          │  super_admin only
│ ⚙ Settings       │  Future (greyed, "Coming" badge)
│                  │
│ 🌙/☀ Theme      │  Dark/Light/System toggle
│ 👤 Admin Name   │  Avatar + logout dropdown
└──────────────────┘
```

### Behavior
- Desktop: 16rem wide, collapsible to icon-only (3rem) via toggle or Cmd+B
- Tablet: Auto-collapses to icon-only
- Mobile: Hidden, opens as sheet overlay via hamburger
- Collapse state persisted via cookie

### Replaces
- `AdminHeader.tsx` top navbar is removed
- Search moves into proposals content area

### Key Components
- `SidebarProvider`, `Sidebar`, `SidebarInset` (from theme's sidebar.tsx)
- `SidebarHeader`, `SidebarContent`, `SidebarFooter`
- `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton`
- `SidebarTrigger` (collapse toggle)
- `NavUser` component for user dropdown

## 3. Gmail-Style Proposals Layout

### Layout
```
┌─────────────────────┬──────────────────────────────┐
│ Proposals           │ Project Name                 │
│ 🔍 Search...        │ Status: Draft  Conf: 85%    │
│ [All▼] [Sort▼]      │                              │
├─────────────────────┤ ┌────────────────────────────┐│
│ ● John Doe     2m   │ │ Chat │ Proposal │ Budget  ││
│   Mobile App Re...  │ ├────────────────────────────┤│
│   85% · Draft       │ │                            ││
│─────────────────────│ │  Tab content               ││
│   Jane Smith   1h   │ │                            ││
│   Website Redes...  │ │                            ││
│   60% · Saved       │ │                            ││
│─────────────────────│ │                            ││
│   Acme Corp    3h   │ │                            ││
│   API Integrat...   │ │                            ││
│   40% · Review      │ │                            ││
└─────────────────────┴──────────────────────────────┘
  ~35% width               ~65% width
```

### Left Panel — Proposal List
- Search bar at top
- Filter dropdown: All, Draft, Saved, Pending Review, Approved, Budget Proposed
- Sort: Newest (default), Oldest, Highest confidence
- Each item: name/email, project title, confidence %, status badge, relative time
- Selected item highlighted with accent
- ScrollArea for overflow

### Right Panel — Proposal Detail
- Header: project name, status badge, confidence
- Three tabs: Chat, Proposal, Budget (unchanged functionality)
- Empty state: "Select a proposal to view details"

### Resizable
- Drag divider to resize panels
- Sizes persisted via cookie
- Mobile: full-width list, click navigates to detail, back button to return

### Key Components
- `ResizablePanelGroup`, `ResizablePanel`, `ResizableHandle`
- `ScrollArea`, `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`
- `Badge`, `Button`, `Input`, `Separator`

## 4. Component Restyling

All existing functionality preserved. Only visual/component changes.

### Chat Tab
- Message bubbles: same layout, styled with shadcn Card
- Buttons: shadcn Button (Join, Send, Resume AI)
- Input: shadcn Input for message box
- Admin badge: shadcn Badge
- Live indicator: restyled

### Proposal Editor Tab
- Form fields: shadcn Input, Textarea, Label
- Auto-save indicator restyled
- Section headers with Separator
- Action buttons: shadcn Button variants

### Budget Tab
- History items: shadcn Card
- Form: shadcn Input, Textarea, Button
- Status badges: shadcn Badge

### Login Page
- Centered shadcn Card layout
- Google OAuth + magic link: shadcn Button, Input
- Keep Bebas font for "LAMBA LAB" title

### Team Modal
- shadcn Dialog, Input, Button, Select
- Role badges: shadcn Badge

## 5. shadcn/ui Components Needed

Components to install/port:
1. `sidebar` (from theme — custom)
2. `button`
3. `input`
4. `textarea`
5. `badge`
6. `card`
7. `tabs`
8. `separator`
9. `scroll-area`
10. `resizable` (requires `react-resizable-panels`)
11. `dialog`
12. `dropdown-menu`
13. `select`
14. `avatar`
15. `tooltip`
16. `label`
17. `sheet` (for mobile sidebar)

## 6. New Dependencies

- `next-themes` — dark/light/system theme management
- `react-resizable-panels` — resizable split view
- shadcn/ui components (copy-pasted, not a package dependency)

## 7. Files Changed

### New Files
- `components/ui/*.tsx` — ~17 shadcn components
- `components/admin/app-sidebar.tsx` — sidebar navigation
- `components/admin/nav-user.tsx` — user dropdown
- `components/admin/theme-toggle.tsx` — dark/light/system
- `components/theme-provider.tsx` — next-themes wrapper

### Modified Files
- `app/globals.css` — shadcn CSS variable system
- `app/admin/(dashboard)/layout.tsx` — SidebarProvider + ThemeProvider wrapper
- `app/admin/(dashboard)/page.tsx` — ResizablePanel layout
- `components/admin/ProposalList.tsx` — shadcn components
- `components/admin/ProposalListItem.tsx` — shadcn components
- `components/admin/ProposalDetail.tsx` — shadcn components
- `components/admin/ChatTab.tsx` — shadcn components
- `components/admin/BudgetTab.tsx` — shadcn components
- `components/admin/ProposalEditor.tsx` — shadcn components
- `components/admin/TeamModal.tsx` — shadcn Dialog
- `app/admin/login/page.tsx` — shadcn Card + Button

### Deleted Files
- `components/admin/AdminHeader.tsx` — replaced by sidebar

## 8. Non-Goals

- No changes to API routes or backend logic
- No changes to client-side intake experience
- No changes to Supabase schema
- No new features — purely visual/UX overhaul
