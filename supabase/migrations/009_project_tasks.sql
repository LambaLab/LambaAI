-- Project tasks table for the Tracker feature
-- Stores module-level parent tasks and their subtasks

CREATE TABLE project_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES project_tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  complexity TEXT CHECK (complexity IN ('S', 'M', 'L')),
  module_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_project_tasks_proposal ON project_tasks(proposal_id);
CREATE INDEX idx_project_tasks_parent ON project_tasks(parent_id);

-- RLS
ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON project_tasks FOR ALL USING (true);
