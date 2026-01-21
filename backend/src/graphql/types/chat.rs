use async_graphql::{Enum, SimpleObject};
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::storage::chats::{ChatRow, ChatType as StorageChatType};

/// The type of chat
#[derive(Enum, Copy, Clone, Eq, PartialEq, Debug)]
pub enum ChatType {
    /// Topic-specific chat for learning a single topic
    TopicSpecific,
    /// General review chat for exam simulation/practice
    GeneralReview,
}

impl From<StorageChatType> for ChatType {
    fn from(chat_type: StorageChatType) -> Self {
        match chat_type {
            StorageChatType::TopicSpecific => ChatType::TopicSpecific,
            StorageChatType::GeneralReview => ChatType::GeneralReview,
        }
    }
}

#[derive(SimpleObject, Clone)]
#[graphql(rename_fields = "camelCase")]
pub struct Chat {
    pub id: Uuid,
    pub session_id: Uuid,
    pub chat_type: ChatType,
    pub topic_id: Option<Uuid>,
    pub is_started: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<ChatRow> for Chat {
    fn from(row: ChatRow) -> Self {
        Self {
            id: row.id,
            session_id: row.session_id,
            chat_type: ChatType::from(row.chat_type),
            topic_id: row.topic_id,
            is_started: row.is_started,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }
}
