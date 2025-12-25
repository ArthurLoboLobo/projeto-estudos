-- Study Plans Migration
-- Adds stage to sessions and creates study_plans table with version history

-- Add stage column to study_sessions (default to 'studying' for existing sessions)
ALTER TABLE study_sessions 
ADD COLUMN stage VARCHAR(20) NOT NULL DEFAULT 'uploading'
CHECK (stage IN ('uploading', 'planning', 'studying'));

-- Update existing sessions to 'studying' stage (since they were created before this feature)
UPDATE study_sessions SET stage = 'studying' WHERE stage = 'uploading';

-- Study Plans table (supports version history for undo)
CREATE TABLE study_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
    version INTEGER NOT NULL DEFAULT 1,
    content_md TEXT NOT NULL,
    instruction TEXT, -- The user instruction that led to this version (null for initial)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fetching plans by session
CREATE INDEX idx_study_plans_session ON study_plans(session_id);

-- Index for ordering by version
CREATE INDEX idx_study_plans_version ON study_plans(session_id, version DESC);

-- Constraint: unique version per session
ALTER TABLE study_plans ADD CONSTRAINT unique_session_version UNIQUE (session_id, version);

