use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct StudyPlanRow {
    pub id: Uuid,
    pub session_id: Uuid,
    pub version: i32,
    pub content_md: String,
    pub instruction: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// Create the first study plan for a session
pub async fn create_study_plan(
    pool: &PgPool,
    session_id: Uuid,
    content_md: &str,
) -> Result<StudyPlanRow, async_graphql::Error> {
    let plan = sqlx::query_as::<_, StudyPlanRow>(
        r#"
        INSERT INTO study_plans (session_id, version, content_md, instruction)
        VALUES ($1, 1, $2, NULL)
        RETURNING id, session_id, version, content_md, instruction, created_at
        "#,
    )
    .bind(session_id)
    .bind(content_md)
    .fetch_one(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    Ok(plan)
}

/// Create a new version of the study plan (for revisions)
pub async fn create_plan_version(
    pool: &PgPool,
    session_id: Uuid,
    content_md: &str,
    instruction: &str,
) -> Result<StudyPlanRow, async_graphql::Error> {
    // Get the current max version
    let max_version: Option<i32> = sqlx::query_scalar(
        r#"SELECT MAX(version) FROM study_plans WHERE session_id = $1"#,
    )
    .bind(session_id)
    .fetch_one(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    let new_version = max_version.unwrap_or(0) + 1;

    let plan = sqlx::query_as::<_, StudyPlanRow>(
        r#"
        INSERT INTO study_plans (session_id, version, content_md, instruction)
        VALUES ($1, $2, $3, $4)
        RETURNING id, session_id, version, content_md, instruction, created_at
        "#,
    )
    .bind(session_id)
    .bind(new_version)
    .bind(content_md)
    .bind(instruction)
    .fetch_one(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    Ok(plan)
}

/// Get the latest (current) study plan for a session
pub async fn get_current_plan(
    pool: &PgPool,
    session_id: Uuid,
) -> Result<Option<StudyPlanRow>, async_graphql::Error> {
    let plan = sqlx::query_as::<_, StudyPlanRow>(
        r#"
        SELECT id, session_id, version, content_md, instruction, created_at
        FROM study_plans
        WHERE session_id = $1
        ORDER BY version DESC
        LIMIT 1
        "#,
    )
    .bind(session_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    Ok(plan)
}

/// Get all study plan versions for a session (for history/undo)
pub async fn get_plan_history(
    pool: &PgPool,
    session_id: Uuid,
) -> Result<Vec<StudyPlanRow>, async_graphql::Error> {
    let plans = sqlx::query_as::<_, StudyPlanRow>(
        r#"
        SELECT id, session_id, version, content_md, instruction, created_at
        FROM study_plans
        WHERE session_id = $1
        ORDER BY version DESC
        "#,
    )
    .bind(session_id)
    .fetch_all(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    Ok(plans)
}

/// Delete the latest version (for undo) - returns the previous version
pub async fn delete_latest_version(
    pool: &PgPool,
    session_id: Uuid,
) -> Result<Option<StudyPlanRow>, async_graphql::Error> {
    // Get the current max version
    let max_version: Option<i32> = sqlx::query_scalar(
        r#"SELECT MAX(version) FROM study_plans WHERE session_id = $1"#,
    )
    .bind(session_id)
    .fetch_one(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    // Don't delete if only version 1 exists
    if max_version.unwrap_or(0) <= 1 {
        return Err(async_graphql::Error::new("Cannot undo: this is the initial plan"));
    }

    // Delete the latest version
    sqlx::query(
        r#"DELETE FROM study_plans WHERE session_id = $1 AND version = $2"#,
    )
    .bind(session_id)
    .bind(max_version.unwrap())
    .execute(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    // Return the now-current plan
    get_current_plan(pool, session_id).await
}

/// Get a specific plan version
pub async fn get_plan_by_version(
    pool: &PgPool,
    session_id: Uuid,
    version: i32,
) -> Result<Option<StudyPlanRow>, async_graphql::Error> {
    let plan = sqlx::query_as::<_, StudyPlanRow>(
        r#"
        SELECT id, session_id, version, content_md, instruction, created_at
        FROM study_plans
        WHERE session_id = $1 AND version = $2
        "#,
    )
    .bind(session_id)
    .bind(version)
    .fetch_optional(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    Ok(plan)
}

