use async_graphql::{Enum, SimpleObject};
use chrono::{DateTime, Utc};
use uuid::Uuid;

#[derive(Enum, Copy, Clone, Eq, PartialEq)]
pub enum MessageRole {
    User,
    Assistant,
    System,
}

#[derive(SimpleObject, Clone)]
pub struct Message {
    pub id: Uuid,
    pub role: MessageRole,
    pub content: String,
    pub created_at: DateTime<Utc>,
}

