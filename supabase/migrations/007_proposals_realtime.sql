-- 007_proposals_realtime.sql
-- Enable Supabase Realtime on proposals table so the admin dashboard
-- can receive live updates when new proposals are created or updated.

ALTER PUBLICATION supabase_realtime ADD TABLE proposals;
