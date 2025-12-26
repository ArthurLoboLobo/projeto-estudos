-- Convert study plans from markdown to JSON structure
-- This allows for structured topic management with status tracking

-- Add JSON column for structured plan data
ALTER TABLE study_plans 
ADD COLUMN content_json JSONB;

-- Keep content_md for now for backward compatibility during migration
-- In production, you would migrate existing plans and then drop content_md

-- Add index for JSON queries (for future features like filtering by status)
CREATE INDEX idx_study_plans_content_json ON study_plans USING GIN (content_json);

-- Example JSON structure:
-- {
--   "topics": [
--     {
--       "id": "uuid",
--       "title": "Integration by Parts",
--       "description": "Learn to apply the integration by parts technique for complex integrals",
--       "status": "need_to_learn"
--     }
--   ]
-- }

