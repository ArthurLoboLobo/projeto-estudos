use async_graphql::{Enum, SimpleObject};
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::storage::sessions::{SessionRow, SessionStatus as StorageStatus, DraftPlan as StorageDraftPlan, DraftPlanTopic as StorageDraftPlanTopic};

/// The status of a study session
#[derive(Enum, Copy, Clone, Eq, PartialEq, Debug)]
pub enum SessionStatus {
    /// Planning: user uploads documents and refines the study plan
    Planning,
    /// Active: user is actively studying with topic-specific chats
    Active,
    /// Completed: study session is finished
    Completed,
}

impl From<StorageStatus> for SessionStatus {
    fn from(status: StorageStatus) -> Self {
        match status {
            StorageStatus::Planning => SessionStatus::Planning,
            StorageStatus::Active => SessionStatus::Active,
            StorageStatus::Completed => SessionStatus::Completed,
        }
    }
}

/// A topic in the draft study plan (before confirmation)
#[derive(SimpleObject, Clone)]
pub struct DraftPlanTopic {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub is_completed: bool,
}

impl From<StorageDraftPlanTopic> for DraftPlanTopic {
    fn from(topic: StorageDraftPlanTopic) -> Self {
        Self {
            id: topic.id,
            title: topic.title,
            description: topic.description,
            is_completed: topic.is_completed,
        }
    }
}

/// The draft study plan (before confirmation)
#[derive(SimpleObject, Clone)]
pub struct DraftPlan {
    pub topics: Vec<DraftPlanTopic>,
}

impl From<StorageDraftPlan> for DraftPlan {
    fn from(plan: StorageDraftPlan) -> Self {
        Self {
            topics: plan.topics.into_iter().map(Into::into).collect(),
        }
    }
}

#[derive(SimpleObject, Clone)]
pub struct Session {
    pub id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub status: SessionStatus,
    pub draft_plan: Option<DraftPlan>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<SessionRow> for Session {
    fn from(row: SessionRow) -> Self {
        // Parse draft_plan JSON if present
        let draft_plan = row.draft_plan.as_ref().and_then(|json| {
            serde_json::from_value::<StorageDraftPlan>(json.clone())
                .ok()
                .map(Into::into)
        });

        Self {
            id: row.id,
            title: row.title,
            description: row.description,
            status: SessionStatus::from(row.status),
            draft_plan,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }
}
