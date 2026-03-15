-- Add metadata jsonb column to proposals for storing rich state
-- (projectName, productOverview, moduleSummaries, last QR card state)
-- that the client needs for cross-device restore.
alter table proposals add column if not exists metadata jsonb;
