use async_graphql::SimpleObject;
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::storage::sessions::SessionRow;

#[derive(SimpleObject, Clone)]
pub struct Session {
    pub id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<SessionRow> for Session {
    fn from(row: SessionRow) -> Self {
        Self {
            id: row.id,
            title: row.title,
            description: row.description,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }
}
