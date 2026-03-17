-- One-time auth token for email links (auto-authenticate without OTP)
alter table proposals add column if not exists email_auth_token text;
alter table proposals add column if not exists email_auth_token_expires_at timestamptz;

-- Index for fast token lookups
create index if not exists idx_proposals_email_auth_token on proposals (email_auth_token) where email_auth_token is not null;
