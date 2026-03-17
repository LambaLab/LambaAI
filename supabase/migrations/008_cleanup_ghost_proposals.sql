-- Delete ghost proposals: 0% confidence and no chat messages.
-- These are created when someone opens the intake but never types anything.
DELETE FROM proposals
WHERE confidence_score = 0
  AND NOT EXISTS (
    SELECT 1 FROM chat_messages cm WHERE cm.proposal_id = proposals.id
  );
