use async_graphql::SimpleObject;
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::storage::documents::DocumentRow;

#[derive(SimpleObject, Clone)]
#[graphql(rename_fields = "camelCase")]
pub struct Document {
    pub id: Uuid,
    pub file_name: String,
    pub file_path: String,
    pub content_length: i32,
    pub extraction_status: Option<String>,
    pub page_count: Option<i32>,
    pub created_at: DateTime<Utc>,
}

impl From<DocumentRow> for Document {
    fn from(row: DocumentRow) -> Self {
        Self {
            id: row.id,
            file_name: row.file_name,
            file_path: row.file_path,
            content_length: row.content_length,
            extraction_status: row.extraction_status,
            page_count: row.page_count,
            created_at: row.created_at,
        }
    }
}
