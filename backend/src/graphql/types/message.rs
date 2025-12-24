use async_graphql::{Enum, SimpleObject};
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::storage::messages::MessageRow;

#[derive(Enum, Copy, Clone, Eq, PartialEq)]
pub enum MessageRole {
    User,
    Assistant,
    System,
}

impl From<&str> for MessageRole {
    fn from(s: &str) -> Self {
        match s {
            "user" => MessageRole::User,
            "assistant" => MessageRole::Assistant,
            "system" => MessageRole::System,
            _ => MessageRole::User,
        }
    }
}

impl From<MessageRole> for &'static str {
    fn from(role: MessageRole) -> Self {
        match role {
            MessageRole::User => "user",
            MessageRole::Assistant => "assistant",
            MessageRole::System => "system",
        }
    }
}

#[derive(SimpleObject, Clone)]
pub struct Message {
    pub id: Uuid,
    pub role: MessageRole,
    pub content: String,
    pub created_at: DateTime<Utc>,
}

impl From<MessageRow> for Message {
    fn from(row: MessageRow) -> Self {
        Self {
            id: row.id,
            role: MessageRole::from(row.role.as_str()),
            content: row.content,
            created_at: row.created_at,
        }
    }
}
