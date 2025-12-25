use async_graphql::{Enum, SimpleObject};
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::storage::sessions::SessionRow;

/// The stage/phase of a study session
#[derive(Enum, Copy, Clone, Eq, PartialEq, Debug)]
pub enum SessionStage {
    /// Initial stage: user uploads documents
    Uploading,
    /// Planning stage: AI generates study plan, user can refine it
    Planning,
    /// Studying stage: main chat interface with finalized plan
    Studying,
}

impl From<&str> for SessionStage {
    fn from(s: &str) -> Self {
        match s {
            "planning" => SessionStage::Planning,
            "studying" => SessionStage::Studying,
            _ => SessionStage::Uploading,
        }
    }
}

impl From<String> for SessionStage {
    fn from(s: String) -> Self {
        SessionStage::from(s.as_str())
    }
}

#[derive(SimpleObject, Clone)]
pub struct Session {
    pub id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub stage: SessionStage,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<SessionRow> for Session {
    fn from(row: SessionRow) -> Self {
        Self {
            id: row.id,
            title: row.title,
            description: row.description,
            stage: SessionStage::from(row.stage),
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }
}
