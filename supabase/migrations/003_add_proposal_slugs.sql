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
