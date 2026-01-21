use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct MessageRow {
    pub id: Uuid,
    pub chat_id: Uuid,
    pub role: String,
    pub content: String,
    pub created_at: DateTime<Utc>,
}

/// Create a new message
pub async fn create_message(
    pool: &PgPool,
    chat_id: Uuid,
    role: &str,
    content: &str,
) -> Result<MessageRow, async_graphql::Error> {
    let message = sqlx::query_as::<_, MessageRow>(
        r#"
        INSERT INTO messages (chat_id, role, content)
        VALUES ($1, $2, $3)
        RETURNING id, chat_id, role, content, created_at
        "#,
    )
    .bind(chat_id)
    .bind(role)
    .bind(content)
    .fetch_one(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    Ok(message)
}

/// Get messages for a chat (with authorization check)
pub async fn get_chat_messages(
    pool: &PgPool,
    profile_id: Uuid,
    chat_id: Uuid,
) -> Result<Vec<MessageRow>, async_graphql::Error> {
    let messages = sqlx::query_as::<_, MessageRow>(
        r#"
        SELECT m.id, m.chat_id, m.role, m.content, m.created_at
        FROM messages m
        JOIN chats c ON m.chat_id = c.id
        JOIN study_sessions s ON c.session_id = s.id
        WHERE m.chat_id = $1 AND s.profile_id = $2
        ORDER BY m.created_at ASC
        "#,
    )
    .bind(chat_id)
    .bind(profile_id)
    .fetch_all(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    Ok(messages)
}

/// Get recent messages for context (last N messages)
pub async fn get_recent_messages(
    pool: &PgPool,
    profile_id: Uuid,
    chat_id: Uuid,
    limit: i32,
) -> Result<Vec<MessageRow>, async_graphql::Error> {
    let messages = sqlx::query_as::<_, MessageRow>(
        r#"
        SELECT m.id, m.chat_id, m.role, m.content, m.created_at
        FROM messages m
        JOIN chats c ON m.chat_id = c.id
        JOIN study_sessions s ON c.session_id = s.id
        WHERE m.chat_id = $1 AND s.profile_id = $2
        ORDER BY m.created_at DESC
        LIMIT $3
        "#,
    )
    .bind(chat_id)
    .bind(profile_id)
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    // Reverse to get chronological order
    let mut messages = messages;
    messages.reverse();
    Ok(messages)
}

/// Clear all messages in a chat (for starting fresh)
pub async fn clear_chat_messages(
    pool: &PgPool,
    profile_id: Uuid,
    chat_id: Uuid,
) -> Result<u64, async_graphql::Error> {
    let result = sqlx::query(
        r#"
        DELETE FROM messages m
        USING chats c, study_sessions s
        WHERE m.chat_id = c.id AND c.session_id = s.id AND m.chat_id = $1 AND s.profile_id = $2
        "#,
    )
    .bind(chat_id)
    .bind(profile_id)
    .execute(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    Ok(result.rows_affected())
}

/// Check if a chat has any messages (with authorization check)
pub async fn chat_has_messages(
    pool: &PgPool,
    profile_id: Uuid,
    chat_id: Uuid,
) -> Result<bool, async_graphql::Error> {
    let count: Option<i64> = sqlx::query_scalar(
        r#"
        SELECT COUNT(m.id)
        FROM messages m
        JOIN chats c ON m.chat_id = c.id
        JOIN study_sessions s ON c.session_id = s.id
        WHERE m.chat_id = $1 AND s.profile_id = $2
        "#,
    )
    .bind(chat_id)
    .bind(profile_id)
    .fetch_one(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    Ok(count.unwrap_or(0) > 0)
}
