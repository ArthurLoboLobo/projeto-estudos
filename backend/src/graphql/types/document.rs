use async_graphql::SimpleObject;
use chrono::{DateTime, Utc};
use uuid::Uuid;

#[derive(SimpleObject, Clone)]
pub struct Document {
    pub id: Uuid,
    pub file_name: String,
    pub content_length: i32,
    pub created_at: DateTime<Utc>,
}

