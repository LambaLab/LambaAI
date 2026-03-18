# Modules Section Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace horizontal module pills in ProposalEditor with vertical card list matching the Builder's ModuleCard style.

**Architecture:** Single component change in ProposalEditor.tsx. Reuse MODULE_CATALOG icons via dynamic Lucide import. Read moduleSummaries from proposal.metadata for expandable cards.

**Tech Stack:** React, Tailwind CSS, Lucide React icons, existing MODULE_CATALOG

---

### Task 1: Replace module pills with vertical card list in ProposalEditor

**Files:**
- Modify: `components/admin/ProposalEditor.tsx:152-171` (Modules section)

**Step 1: Add imports and state**

Add `import * as Icons from 'lucide-react'` and `ChevronDown` to existing imports.
Add `expandedModules` state: `useState<Set<string>>(new Set())`.
Extract `moduleSummaries` from `proposal.metadata`.

**Step 2: Replace the modules pill UI**

Replace the `<Field label="Modules">` block (lines 153-171) with:

1. **Selected modules section** — vertical list of cards:
   - Each card: icon in yellow-tinted rounded square + module name + chevron (if summary exists)
   - Click chevron → expand to show AI summary
   - Hover → show X remove button
   - Styling: `bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 rounded-xl`

2. **Available modules section** — below selected, with "Add modules" label:
   - Same card style but muted: `opacity-50 border-dashed`
   - Click card → adds module (calls handleToggleModule)
   - Not expandable

**Step 3: Verify and commit**

Run: `npm run build` (or dev server check)
Commit and push to deploy.
