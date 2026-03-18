# Modules Section Redesign — Proposal Tab

## Date
2026-03-18

## Summary
Replace horizontal pill buttons in ProposalEditor's Modules section with vertical module cards matching the Proposal Builder's ModuleCard style, adapted for the admin panel's light/dark theme.

## Design

### Selected modules
- Vertical card list with Lucide icon in rounded square (yellow-tinted bg)
- Module name, chevron to expand/collapse
- Expanded state shows AI-generated module summary (from proposal.metadata)
- Remove button (X) on hover

### Available modules
- Shown below selected in an "Add modules" subsection
- Same card style but muted (50% opacity, dashed border)
- Click to add → moves to selected list
- Not expandable

### Adaptations from Builder → Admin
- Builder uses dark CSS vars → Admin uses Tailwind light/dark classes
- Builder has confirmed/current/detected/inactive → Admin has selected/available
- Admin cards get hover remove button

### Data
- Module summaries from `proposal.metadata.moduleSummaries` (from intake flow)
- Falls back to non-expandable if no summary exists

### Scope boundaries
- Tracker tab stays separate (not merged)
- Module toggle reuses existing `handleToggleModule` + auto-save
- No new API endpoints needed
