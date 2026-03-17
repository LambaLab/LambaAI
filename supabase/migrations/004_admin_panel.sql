-- 004_admin_panel.sql
-- Adds admin chat role, budget proposals table, and new proposal statuses

-- 1. Expand chat_messages.role to include 'admin'
ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_role_check;
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_role_check
  CHECK (role IN ('user', 'assistant', 'admin'));

-- 2. Expand proposals.status to include budget statuses
ALTER TABLE proposals DROP CONSTRAINT IF EXISTS proposals_status_check;
ALTER TABLE proposals ADD CONSTRAINT proposals_status_check
  CHECK (status IN ('draft', 'saved', 'pending_review', 'approved', 'accepted', 'budget_proposed', 'budget_accepted'));

-- 3. Budget proposals table
CREATE TABLE budget_proposals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  client_notes TEXT,
  internal_notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'countered', 'call_requested')),
  counter_amount INTEGER,
  counter_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  responded_at TIMESTAMPTZ
);

CREATE INDEX budget_proposals_proposal_id ON budget_proposals (proposal_id);

-- 4. RLS on budget_proposals
ALTER TABLE budget_proposals ENABLE ROW LEVEL SECURITY;

-- Users can read budget proposals for their own proposals
CREATE POLICY "budget_proposals_owner_read" ON budget_proposals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM proposals p
      WHERE p.id = budget_proposals.proposal_id
      AND p.user_id = auth.uid()
    )
  );

-- Users can update (respond to) budget proposals for their own proposals
CREATE POLICY "budget_proposals_owner_update" ON budget_proposals
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM proposals p
      WHERE p.id = budget_proposals.proposal_id
      AND p.user_id = auth.uid()
    )
  );

-- 5. Enable Supabase Realtime on chat_messages and budget_proposals
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE budget_proposals;
