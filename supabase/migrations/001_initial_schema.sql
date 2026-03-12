-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Sessions (anonymous + registered)
create table sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Proposals
create table proposals (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid references sessions(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft', 'pending_review', 'approved', 'accepted')),
  modules jsonb not null default '[]',
  confidence_score integer not null default 0 check (confidence_score between 0 and 100),
  price_min integer not null default 0,
  price_max integer not null default 0,
  brief text not null default '',
  admin_notes text,
  prd text,
  technical_architecture text,
  task_breakdown jsonb,
  timeline text,
  milestone_plan jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Chat messages
create table chat_messages (
  id uuid primary key default uuid_generate_v4(),
  proposal_id uuid references proposals(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  metadata jsonb,
  created_at timestamptz default now()
);

-- RLS
alter table sessions enable row level security;
alter table proposals enable row level security;
alter table chat_messages enable row level security;

-- Sessions: owner can read/write their own
create policy "sessions_owner" on sessions
  using (auth.uid() = user_id);

-- Proposals: owner can read
create policy "proposals_owner_read" on proposals
  for select using (auth.uid() = user_id);

-- Proposals: owner can insert
create policy "proposals_owner_insert" on proposals
  for insert with check (auth.uid() = user_id);

-- Proposals: owner can update draft/pending proposals
create policy "proposals_owner_update" on proposals
  for update using (auth.uid() = user_id and status in ('draft', 'pending_review'));

-- Chat messages: owner can read via proposal
create policy "chat_messages_owner" on chat_messages
  using (
    exists (
      select 1 from proposals p
      where p.id = chat_messages.proposal_id
      and p.user_id = auth.uid()
    )
  );
