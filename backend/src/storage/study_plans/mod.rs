use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StudyPlanTopic {
    pub id: String,
    pub title: String,
    pub description: String,
    pub status: String, // "need_to_learn", "need_review", "know_well"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StudyPlanContent {
    pub topics: Vec<StudyPlanTopic>,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct StudyPlanRow {
    pub id: Uuid,
    pub session_id: Uuid,
    pub version: i32,
    pub content_md: String,
    pub content_json: Option<sqlx::types::JsonValue>,
    pub instruction: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// Create the first study plan for a session
pub async fn create_study_plan(
    pool: &PgPool,
    session_id: Uuid,
    content_json: &StudyPlanContent,
) -> Result<StudyPlanRow, async_graphql::Error> {
    let json_value = serde_json::to_value(content_json)
        .map_err(|e| async_graphql::Error::new(format!("JSON serialization error: {}", e)))?;

    // Generate markdown for backward compatibility
    let content_md = generate_markdown_from_json(content_json);

    let plan = sqlx::query_as::<_, StudyPlanRow>(
        r#"
        INSERT INTO study_plans (session_id, version, content_md, content_json, instruction)
        VALUES ($1, 1, $2, $3, NULL)
        RETURNING id, session_id, version, content_md, content_json, instruction, created_at
        "#,
    )
    .bind(session_id)
    .bind(content_md)
    .bind(json_value)
    .fetch_one(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    Ok(plan)
}

/// Create a new version of the study plan (for revisions)
pub async fn create_plan_version(
    pool: &PgPool,
    session_id: Uuid,
    content_json: &StudyPlanContent,
    instruction: &str,
) -> Result<StudyPlanRow, async_graphql::Error> {
    let json_value = serde_json::to_value(content_json)
        .map_err(|e| async_graphql::Error::new(format!("JSON serialization error: {}", e)))?;

    // Generate markdown for backward compatibility
    let content_md = generate_markdown_from_json(content_json);

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
        INSERT INTO study_plans (session_id, version, content_md, content_json, instruction)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, session_id, version, content_md, content_json, instruction, created_at
        "#,
    )
    .bind(session_id)
    .bind(new_version)
    .bind(content_md)
    .bind(json_value)
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
        SELECT id, session_id, version, content_md, content_json, instruction, created_at
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
        SELECT id, session_id, version, content_md, content_json, instruction, created_at
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
        SELECT id, session_id, version, content_md, content_json, instruction, created_at
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

/// Update a specific topic's status
pub async fn update_topic_status(
    pool: &PgPool,
    session_id: Uuid,
    topic_id: &str,
    new_status: &str,
) -> Result<StudyPlanRow, async_graphql::Error> {
    // Get current plan
    let current = get_current_plan(pool, session_id)
        .await?
        .ok_or_else(|| async_graphql::Error::new("No study plan found"))?;

    // Parse JSON
    let json_value = current.content_json
        .ok_or_else(|| async_graphql::Error::new("Study plan has no JSON content"))?;
    
    let mut content: StudyPlanContent = serde_json::from_value(json_value)
        .map_err(|e| async_graphql::Error::new(format!("JSON parse error: {}", e)))?;

    // Update the specific topic
    let topic = content.topics.iter_mut()
        .find(|t| t.id == topic_id)
        .ok_or_else(|| async_graphql::Error::new("Topic not found"))?;
    
    topic.status = new_status.to_string();

    // Save updated plan
    let updated_json = serde_json::to_value(&content)
        .map_err(|e| async_graphql::Error::new(format!("JSON serialization error: {}", e)))?;
    
    let updated_md = generate_markdown_from_json(&content);

    let updated = sqlx::query_as::<_, StudyPlanRow>(
        r#"
        UPDATE study_plans 
        SET content_json = $1, content_md = $2
        WHERE session_id = $3 AND version = $4
        RETURNING id, session_id, version, content_md, content_json, instruction, created_at
        "#,
    )
    .bind(updated_json)
    .bind(updated_md)
    .bind(session_id)
    .bind(current.version)
    .fetch_one(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    Ok(updated)
}

/// Helper function to generate markdown from JSON (for AI context and display)
fn generate_markdown_from_json(content: &StudyPlanContent) -> String {
    let mut md = String::from("# Study Plan\n\n");
    
    for (i, topic) in content.topics.iter().enumerate() {
        md.push_str(&format!("{}. **{}**\n", i + 1, topic.title));
        md.push_str(&format!("   {}\n", topic.description));
        md.push_str(&format!("   *Status: {}*\n\n", format_status(&topic.status)));
    }
    
    md
}

/// Helper function to format status for display
fn format_status(status: &str) -> &str {
    match status {
        "need_to_learn" => "Need to Learn",
        "need_review" => "Need Review",
        "know_well" => "Know Well",
        _ => "Unknown",
    }
}

/// Helper function to parse JSON from study plan row
pub fn parse_plan_content(row: &StudyPlanRow) -> Result<StudyPlanContent, async_graphql::Error> {
    let json_value = row.content_json.as_ref()
        .ok_or_else(|| async_graphql::Error::new("Study plan has no JSON content"))?;
    
    serde_json::from_value(json_value.clone())
        .map_err(|e| async_graphql::Error::new(format!("JSON parse error: {}", e)))
}

