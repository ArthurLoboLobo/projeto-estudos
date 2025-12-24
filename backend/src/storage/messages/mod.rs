use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct MessageRow {
    pub id: Uuid,
    pub session_id: Uuid,
    pub role: String,
    pub content: String,
    pub created_at: DateTime<Utc>,
}

/// Create a new message
pub async fn create_message(
    pool: &PgPool,
    session_id: Uuid,
    role: &str,
    content: &str,
) -> Result<MessageRow, async_graphql::Error> {
    let message = sqlx::query_as::<_, MessageRow>(
        r#"
        INSERT INTO messages (session_id, role, content)
        VALUES ($1, $2, $3)
        RETURNING id, session_id, role, content, created_at
        "#,
    )
    .bind(session_id)
    .bind(role)
    .bind(content)
    .fetch_one(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    Ok(message)
}

/// Get messages for a session (with authorization check)
pub async fn get_session_messages(
    pool: &PgPool,
    user_id: Uuid,
    session_id: Uuid,
) -> Result<Vec<MessageRow>, async_graphql::Error> {
    let messages = sqlx::query_as::<_, MessageRow>(
        r#"
        SELECT m.id, m.session_id, m.role, m.content, m.created_at
        FROM messages m
        JOIN study_sessions s ON m.session_id = s.id
        WHERE m.session_id = $1 AND s.user_id = $2
        ORDER BY m.created_at ASC
        "#,
    )
    .bind(session_id)
    .bind(user_id)
    .fetch_all(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    Ok(messages)
}

/// Get recent messages for context (last N messages)
pub async fn get_recent_messages(
    pool: &PgPool,
    user_id: Uuid,
    session_id: Uuid,
    limit: i32,
) -> Result<Vec<MessageRow>, async_graphql::Error> {
    let messages = sqlx::query_as::<_, MessageRow>(
        r#"
        SELECT m.id, m.session_id, m.role, m.content, m.created_at
        FROM messages m
        JOIN study_sessions s ON m.session_id = s.id
        WHERE m.session_id = $1 AND s.user_id = $2
        ORDER BY m.created_at DESC
        LIMIT $3
        "#,
    )
    .bind(session_id)
    .bind(user_id)
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    // Reverse to get chronological order
    let mut messages = messages;
    messages.reverse();
    Ok(messages)
}

/// Clear all messages in a session (for starting fresh)
pub async fn clear_session_messages(
    pool: &PgPool,
    user_id: Uuid,
    session_id: Uuid,
) -> Result<u64, async_graphql::Error> {
    let result = sqlx::query(
        r#"
        DELETE FROM messages m
        USING study_sessions s
        WHERE m.session_id = s.id AND m.session_id = $1 AND s.user_id = $2
        "#,
    )
    .bind(session_id)
    .bind(user_id)
    .execute(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    Ok(result.rows_affected())
}
