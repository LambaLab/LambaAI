-- 006_admin_users.sql
-- Database-driven admin access control.
-- Replaces ADMIN_EMAILS env var with a managed table.
-- nagi@lambalab.com is hardcoded as permanent super admin in app code.

CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'admin'
    CHECK (role IN ('super_admin', 'admin')),
  added_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed the super admin
INSERT INTO admin_users (email, role) VALUES ('nagi@lambalab.com', 'super_admin');

-- RLS: only accessible via service role (admin API routes use createServiceClient)
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
-- No user-facing policies — all access goes through service role client
