use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct TopicRow {
    pub id: Uuid,
    pub session_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub order_index: i32,
    pub is_completed: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Create a new topic
pub async fn create_topic(
    pool: &PgPool,
    session_id: Uuid,
    title: &str,
    description: Option<&str>,
    order_index: i32,
    is_completed: bool,
) -> Result<TopicRow, async_graphql::Error> {
    let topic = sqlx::query_as::<_, TopicRow>(
        r#"
        INSERT INTO topics (session_id, title, description, order_index, is_completed)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, session_id, title, description, order_index, is_completed, created_at, updated_at
        "#,
    )
    .bind(session_id)
    .bind(title)
    .bind(description)
    .bind(order_index)
    .bind(is_completed)
    .fetch_one(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    Ok(topic)
}

/// Create multiple topics at once (for materializing from draft_plan)
pub async fn create_topics_batch(
    pool: &PgPool,
    session_id: Uuid,
    topics: Vec<(String, Option<String>, i32, bool)>, // (title, description, order_index, is_completed)
) -> Result<Vec<TopicRow>, async_graphql::Error> {
    let mut created_topics = Vec::new();

    for (title, description, order_index, is_completed) in topics {
        let topic = create_topic(pool, session_id, &title, description.as_deref(), order_index, is_completed).await?;
        created_topics.push(topic);
    }

    Ok(created_topics)
}

/// Get all topics for a session (with authorization check)
pub async fn get_session_topics(
    pool: &PgPool,
    profile_id: Uuid,
    session_id: Uuid,
) -> Result<Vec<TopicRow>, async_graphql::Error> {
    let topics = sqlx::query_as::<_, TopicRow>(
        r#"
        SELECT t.id, t.session_id, t.title, t.description, t.order_index, t.is_completed, t.created_at, t.updated_at
        FROM topics t
        JOIN study_sessions s ON t.session_id = s.id
        WHERE t.session_id = $1 AND s.profile_id = $2
        ORDER BY t.order_index ASC
        "#,
    )
    .bind(session_id)
    .bind(profile_id)
    .fetch_all(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    Ok(topics)
}

/// Get a topic by ID (with authorization check)
pub async fn get_topic_by_id(
    pool: &PgPool,
    profile_id: Uuid,
    topic_id: Uuid,
) -> Result<Option<TopicRow>, async_graphql::Error> {
    let topic = sqlx::query_as::<_, TopicRow>(
        r#"
        SELECT t.id, t.session_id, t.title, t.description, t.order_index, t.is_completed, t.created_at, t.updated_at
        FROM topics t
        JOIN study_sessions s ON t.session_id = s.id
        WHERE t.id = $1 AND s.profile_id = $2
        "#,
    )
    .bind(topic_id)
    .bind(profile_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    Ok(topic)
}

/// Update topic completion status (with authorization check)
pub async fn update_topic_completion(
    pool: &PgPool,
    profile_id: Uuid,
    topic_id: Uuid,
    is_completed: bool,
) -> Result<Option<TopicRow>, async_graphql::Error> {
    let topic = sqlx::query_as::<_, TopicRow>(
        r#"
        UPDATE topics t
        SET is_completed = $3, updated_at = NOW()
        FROM study_sessions s
        WHERE t.session_id = s.id AND t.id = $1 AND s.profile_id = $2
        RETURNING t.id, t.session_id, t.title, t.description, t.order_index, t.is_completed, t.created_at, t.updated_at
        "#,
    )
    .bind(topic_id)
    .bind(profile_id)
    .bind(is_completed)
    .fetch_optional(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    Ok(topic)
}


