use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

/// Session status enum matching the database
#[derive(Debug, Clone, PartialEq, Eq, sqlx::Type, Serialize, Deserialize)]
#[sqlx(type_name = "session_status", rename_all = "UPPERCASE")]
pub enum SessionStatus {
    Planning,
    Active,
    Completed,
}

impl std::fmt::Display for SessionStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SessionStatus::Planning => write!(f, "PLANNING"),
            SessionStatus::Active => write!(f, "ACTIVE"),
            SessionStatus::Completed => write!(f, "COMPLETED"),
        }
    }
}

/// Draft plan topic structure (stored in draft_plan JSONB)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DraftPlanTopic {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub is_completed: bool,
}

/// Draft plan structure (stored in draft_plan JSONB)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DraftPlan {
    pub topics: Vec<DraftPlanTopic>,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct SessionRow {
    pub id: Uuid,
    pub profile_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub status: SessionStatus,
    pub draft_plan: Option<sqlx::types::JsonValue>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Create a new study session
pub async fn create_session(
    pool: &PgPool,
    profile_id: Uuid,
    title: &str,
    description: Option<&str>,
) -> Result<SessionRow, async_graphql::Error> {
    let session = sqlx::query_as::<_, SessionRow>(
        r#"
        INSERT INTO study_sessions (profile_id, title, description, status)
        VALUES ($1, $2, $3, 'PLANNING')
        RETURNING id, profile_id, title, description, status, draft_plan, created_at, updated_at
        "#,
    )
    .bind(profile_id)
    .bind(title)
    .bind(description)
    .fetch_one(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    Ok(session)
}

/// Get all sessions for a profile
pub async fn get_profile_sessions(
    pool: &PgPool,
    profile_id: Uuid,
) -> Result<Vec<SessionRow>, async_graphql::Error> {
    let sessions = sqlx::query_as::<_, SessionRow>(
        r#"
        SELECT id, profile_id, title, description, status, draft_plan, created_at, updated_at
        FROM study_sessions
        WHERE profile_id = $1
        ORDER BY updated_at DESC
        "#,
    )
    .bind(profile_id)
    .fetch_all(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    Ok(sessions)
}

/// Get a specific session by ID (with authorization check)
pub async fn get_session_by_id(
    pool: &PgPool,
    profile_id: Uuid,
    session_id: Uuid,
) -> Result<Option<SessionRow>, async_graphql::Error> {
    let session = sqlx::query_as::<_, SessionRow>(
        r#"
        SELECT id, profile_id, title, description, status, draft_plan, created_at, updated_at
        FROM study_sessions
        WHERE id = $1 AND profile_id = $2
        "#,
    )
    .bind(session_id)
    .bind(profile_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    Ok(session)
}

/// Update a session's metadata
pub async fn update_session(
    pool: &PgPool,
    profile_id: Uuid,
    session_id: Uuid,
    title: Option<&str>,
    description: Option<&str>,
) -> Result<Option<SessionRow>, async_graphql::Error> {
    // Build dynamic update query
    let mut query = String::from("UPDATE study_sessions SET updated_at = NOW()");
    let mut param_count = 3; // profile_id, session_id are the first two bindings

    if title.is_some() {
        query.push_str(&format!(", title = ${}", param_count));
        param_count += 1;
    }

    if description.is_some() {
        query.push_str(&format!(", description = ${}", param_count));
    }

    query.push_str(" WHERE id = $1 AND profile_id = $2 RETURNING id, profile_id, title, description, status, draft_plan, created_at, updated_at");

    let mut q = sqlx::query_as::<_, SessionRow>(&query)
        .bind(session_id)
        .bind(profile_id);

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

/// Update a session's status
pub async fn update_session_status(
    pool: &PgPool,
    profile_id: Uuid,
    session_id: Uuid,
    status: SessionStatus,
) -> Result<Option<SessionRow>, async_graphql::Error> {
    let session = sqlx::query_as::<_, SessionRow>(
        r#"
        UPDATE study_sessions
        SET status = $3, updated_at = NOW()
        WHERE id = $1 AND profile_id = $2
        RETURNING id, profile_id, title, description, status, draft_plan, created_at, updated_at
        "#,
    )
    .bind(session_id)
    .bind(profile_id)
    .bind(status)
    .fetch_optional(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    Ok(session)
}

/// Update a session's draft plan
pub async fn update_draft_plan(
    pool: &PgPool,
    profile_id: Uuid,
    session_id: Uuid,
    draft_plan: &DraftPlan,
) -> Result<Option<SessionRow>, async_graphql::Error> {
    let json_value = serde_json::to_value(draft_plan)
        .map_err(|e| async_graphql::Error::new(format!("JSON serialization error: {}", e)))?;

    let session = sqlx::query_as::<_, SessionRow>(
        r#"
        UPDATE study_sessions
        SET draft_plan = $3, updated_at = NOW()
        WHERE id = $1 AND profile_id = $2
        RETURNING id, profile_id, title, description, status, draft_plan, created_at, updated_at
        "#,
    )
    .bind(session_id)
    .bind(profile_id)
    .bind(json_value)
    .fetch_optional(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    Ok(session)
}

/// Clear a session's draft plan
pub async fn clear_draft_plan(
    pool: &PgPool,
    profile_id: Uuid,
    session_id: Uuid,
) -> Result<Option<SessionRow>, async_graphql::Error> {
    let session = sqlx::query_as::<_, SessionRow>(
        r#"
        UPDATE study_sessions
        SET draft_plan = NULL, updated_at = NOW()
        WHERE id = $1 AND profile_id = $2
        RETURNING id, profile_id, title, description, status, draft_plan, created_at, updated_at
        "#,
    )
    .bind(session_id)
    .bind(profile_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    Ok(session)
}

/// Delete a session (cascades to documents, topics, chats, messages)
pub async fn delete_session(
    pool: &PgPool,
    profile_id: Uuid,
    session_id: Uuid,
) -> Result<bool, async_graphql::Error> {
    let result = sqlx::query(
        r#"
        DELETE FROM study_sessions
        WHERE id = $1 AND profile_id = $2
        "#,
    )
    .bind(session_id)
    .bind(profile_id)
    .execute(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    Ok(result.rows_affected() > 0)
}

/// Helper function to parse draft plan from session row
pub fn parse_draft_plan(row: &SessionRow) -> Result<Option<DraftPlan>, async_graphql::Error> {
    match &row.draft_plan {
        Some(json_value) => {
            let plan: DraftPlan = serde_json::from_value(json_value.clone())
                .map_err(|e| async_graphql::Error::new(format!("JSON parse error: {}", e)))?;
            Ok(Some(plan))
        }
        None => Ok(None),
    }
}
