-- Enum for Session Status
CREATE TYPE session_status AS ENUM ('PLANNING', 'ACTIVE', 'COMPLETED');

CREATE TABLE study_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status session_status NOT NULL DEFAULT 'PLANNING',
    draft_plan JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_profile ON study_sessions(profile_id);
