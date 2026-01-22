use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

/// Chat type enum matching the database
#[derive(Debug, Clone, PartialEq, Eq, sqlx::Type, Serialize, Deserialize)]
#[sqlx(type_name = "chat_type")]
pub enum ChatType {
    #[sqlx(rename = "TOPIC_SPECIFIC")]
    TopicSpecific,
    #[sqlx(rename = "GENERAL_REVIEW")]
    GeneralReview,
}

impl std::fmt::Display for ChatType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ChatType::TopicSpecific => write!(f, "TOPIC_SPECIFIC"),
            ChatType::GeneralReview => write!(f, "GENERAL_REVIEW"),
        }
    }
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct ChatRow {
    pub id: Uuid,
    pub session_id: Uuid,
    #[sqlx(rename = "type")]
    pub chat_type: ChatType,
    pub topic_id: Option<Uuid>,
    pub is_started: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Create a topic-specific chat
pub async fn create_topic_chat(
    pool: &PgPool,
    session_id: Uuid,
    topic_id: Uuid,
) -> Result<ChatRow, async_graphql::Error> {
    let chat = sqlx::query_as::<_, ChatRow>(
        r#"
        INSERT INTO chats (session_id, type, topic_id)
        VALUES ($1, 'TOPIC_SPECIFIC', $2)
        RETURNING id, session_id, type, topic_id, is_started, created_at, updated_at
        "#,
    )
    .bind(session_id)
    .bind(topic_id)
    .fetch_one(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    Ok(chat)
}

/// Create a general review chat
pub async fn create_review_chat(
    pool: &PgPool,
    session_id: Uuid,
) -> Result<ChatRow, async_graphql::Error> {
    let chat = sqlx::query_as::<_, ChatRow>(
        r#"
        INSERT INTO chats (session_id, type, topic_id)
        VALUES ($1, 'GENERAL_REVIEW', NULL)
        RETURNING id, session_id, type, topic_id, is_started, created_at, updated_at
        "#,
    )
    .bind(session_id)
    .fetch_one(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    Ok(chat)
}

/// Get all chats for a session (with authorization check)
pub async fn get_session_chats(
    pool: &PgPool,
    profile_id: Uuid,
    session_id: Uuid,
) -> Result<Vec<ChatRow>, async_graphql::Error> {
    let chats = sqlx::query_as::<_, ChatRow>(
        r#"
        SELECT c.id, c.session_id, c.type, c.topic_id, c.is_started, c.created_at, c.updated_at
        FROM chats c
        JOIN study_sessions s ON c.session_id = s.id
        WHERE c.session_id = $1 AND s.profile_id = $2
        ORDER BY c.created_at ASC
        "#,
    )
    .bind(session_id)
    .bind(profile_id)
    .fetch_all(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    Ok(chats)
}

/// Get a chat by ID (with authorization check)
pub async fn get_chat_by_id(
    pool: &PgPool,
    profile_id: Uuid,
    chat_id: Uuid,
) -> Result<Option<ChatRow>, async_graphql::Error> {
    let chat = sqlx::query_as::<_, ChatRow>(
        r#"
        SELECT c.id, c.session_id, c.type, c.topic_id, c.is_started, c.created_at, c.updated_at
        FROM chats c
        JOIN study_sessions s ON c.session_id = s.id
        WHERE c.id = $1 AND s.profile_id = $2
        "#,
    )
    .bind(chat_id)
    .bind(profile_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    Ok(chat)
}

/// Get chat by topic ID (with authorization check)
pub async fn get_chat_by_topic(
    pool: &PgPool,
    profile_id: Uuid,
    topic_id: Uuid,
) -> Result<Option<ChatRow>, async_graphql::Error> {
    let chat = sqlx::query_as::<_, ChatRow>(
        r#"
        SELECT c.id, c.session_id, c.type, c.topic_id, c.is_started, c.created_at, c.updated_at
        FROM chats c
        JOIN study_sessions s ON c.session_id = s.id
        WHERE c.topic_id = $1 AND s.profile_id = $2
        "#,
    )
    .bind(topic_id)
    .bind(profile_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    Ok(chat)
}

/// Get the review chat for a session (with authorization check)
pub async fn get_review_chat(
    pool: &PgPool,
    profile_id: Uuid,
    session_id: Uuid,
) -> Result<Option<ChatRow>, async_graphql::Error> {
    let chat = sqlx::query_as::<_, ChatRow>(
        r#"
        SELECT c.id, c.session_id, c.type, c.topic_id, c.is_started, c.created_at, c.updated_at
        FROM chats c
        JOIN study_sessions s ON c.session_id = s.id
        WHERE c.session_id = $1 AND s.profile_id = $2 AND c.type = 'GENERAL_REVIEW'
        "#,
    )
    .bind(session_id)
    .bind(profile_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    Ok(chat)
}

/// Mark chat as started (with authorization check)
pub async fn mark_chat_started(
    pool: &PgPool,
    profile_id: Uuid,
    chat_id: Uuid,
) -> Result<Option<ChatRow>, async_graphql::Error> {
    let chat = sqlx::query_as::<_, ChatRow>(
        r#"
        UPDATE chats c
        SET is_started = true, updated_at = NOW()
        FROM study_sessions s
        WHERE c.session_id = s.id AND c.id = $1 AND s.profile_id = $2
        RETURNING c.id, c.session_id, c.type, c.topic_id, c.is_started, c.created_at, c.updated_at
        "#,
    )
    .bind(chat_id)
    .bind(profile_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    Ok(chat)
}


