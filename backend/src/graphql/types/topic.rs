use async_graphql::SimpleObject;
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::storage::topics::TopicRow;

#[derive(SimpleObject, Clone)]
pub struct Topic {
    pub id: Uuid,
    pub session_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub order_index: i32,
    pub is_completed: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<TopicRow> for Topic {
    fn from(row: TopicRow) -> Self {
        Self {
            id: row.id,
            session_id: row.session_id,
            title: row.title,
            description: row.description,
            order_index: row.order_index,
            is_completed: row.is_completed,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }
}
