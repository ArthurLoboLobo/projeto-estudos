use async_graphql::SimpleObject;
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::storage::documents::DocumentRow;

#[derive(SimpleObject, Clone)]
pub struct Document {
    pub id: Uuid,
    pub file_name: String,
    pub content_length: i32,
    pub created_at: DateTime<Utc>,
}

impl From<DocumentRow> for Document {
    fn from(row: DocumentRow) -> Self {
        Self {
            id: row.id,
            file_name: row.file_name,
            content_length: row.content_length,
            created_at: row.created_at,
        }
    }
}
