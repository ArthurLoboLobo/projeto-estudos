use async_graphql::SimpleObject;
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::storage::study_plans::StudyPlanRow;

#[derive(SimpleObject, Clone)]
pub struct StudyPlan {
    pub id: Uuid,
    pub session_id: Uuid,
    pub version: i32,
    pub content_md: String,
    pub instruction: Option<String>,
    pub created_at: DateTime<Utc>,
}

impl From<StudyPlanRow> for StudyPlan {
    fn from(row: StudyPlanRow) -> Self {
        Self {
            id: row.id,
            session_id: row.session_id,
            version: row.version,
            content_md: row.content_md,
            instruction: row.instruction,
            created_at: row.created_at,
        }
    }
}

