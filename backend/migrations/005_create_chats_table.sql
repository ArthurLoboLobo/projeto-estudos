-- Enum for Chat Type
CREATE TYPE chat_type AS ENUM ('TOPIC_SPECIFIC', 'GENERAL_REVIEW');

CREATE TABLE chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
    type chat_type NOT NULL,
    topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
    is_started BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Constraint: topic_id must be unique if present (one chat per topic)
    CONSTRAINT unique_topic_chat UNIQUE (topic_id)
);

CREATE INDEX idx_chats_session ON chats(session_id);
