use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct SessionRow {
    pub id: Uuid,
    pub user_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub stage: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Create a new study session
pub async fn create_session(
    pool: &PgPool,
    user_id: Uuid,
    title: &str,
    description: Option<&str>,
) -> Result<SessionRow, async_graphql::Error> {
    let session = sqlx::query_as::<_, SessionRow>(
        r#"
        INSERT INTO study_sessions (user_id, title, description, stage)
        VALUES ($1, $2, $3, 'uploading')
        RETURNING id, user_id, title, description, stage, created_at, updated_at
        "#,
    )
    .bind(user_id)
    .bind(title)
    .bind(description)
    .fetch_one(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    Ok(session)
}

/// Get all sessions for a user
pub async fn get_user_sessions(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<Vec<SessionRow>, async_graphql::Error> {
    let sessions = sqlx::query_as::<_, SessionRow>(
        r#"
        SELECT id, user_id, title, description, stage, created_at, updated_at
        FROM study_sessions
        WHERE user_id = $1
        ORDER BY updated_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    Ok(sessions)
}

/// Get a specific session by ID (with authorization check)
pub async fn get_session_by_id(
    pool: &PgPool,
    user_id: Uuid,
    session_id: Uuid,
) -> Result<Option<SessionRow>, async_graphql::Error> {
    let session = sqlx::query_as::<_, SessionRow>(
        r#"
        SELECT id, user_id, title, description, stage, created_at, updated_at
        FROM study_sessions
        WHERE id = $1 AND user_id = $2
        "#,
    )
    .bind(session_id)
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    Ok(session)
}

/// Update a session's metadata
pub async fn update_session(
    pool: &PgPool,
    user_id: Uuid,
    session_id: Uuid,
    title: Option<&str>,
    description: Option<&str>,
) -> Result<Option<SessionRow>, async_graphql::Error> {
    // Build dynamic update query
    let mut query = String::from("UPDATE study_sessions SET updated_at = NOW()");
    let mut param_count = 3; // user_id, session_id are the first two bindings

    if title.is_some() {
        query.push_str(&format!(", title = ${}", param_count));
        param_count += 1;
    }

    if description.is_some() {
        query.push_str(&format!(", description = ${}", param_count));
    }

    query.push_str(" WHERE id = $1 AND user_id = $2 RETURNING id, user_id, title, description, stage, created_at, updated_at");

    let mut q = sqlx::query_as::<_, SessionRow>(&query)
        .bind(session_id)
        .bind(user_id);

    if let Some(t) = title {
        q = q.bind(t);
    }

    if let Some(d) = description {
        q = q.bind(d);
    }

    let session = q
        .fetch_optional(pool)
        .await
        .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    Ok(session)
}

/// Update a session's stage
pub async fn update_session_stage(
    pool: &PgPool,
    user_id: Uuid,
    session_id: Uuid,
    stage: &str,
) -> Result<Option<SessionRow>, async_graphql::Error> {
    let session = sqlx::query_as::<_, SessionRow>(
        r#"
        UPDATE study_sessions
        SET stage = $3, updated_at = NOW()
        WHERE id = $1 AND user_id = $2
        RETURNING id, user_id, title, description, stage, created_at, updated_at
        "#,
    )
    .bind(session_id)
    .bind(user_id)
    .bind(stage)
    .fetch_optional(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    Ok(session)
}

/// Delete a session (cascades to documents and messages)
pub async fn delete_session(
    pool: &PgPool,
    user_id: Uuid,
    session_id: Uuid,
) -> Result<bool, async_graphql::Error> {
    let result = sqlx::query(
        r#"
        DELETE FROM study_sessions
        WHERE id = $1 AND user_id = $2
        "#,
    )
    .bind(session_id)
    .bind(user_id)
    .execute(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    Ok(result.rows_affected() > 0)
}