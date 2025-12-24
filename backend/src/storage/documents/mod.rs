use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct DocumentRow {
    pub id: Uuid,
    pub session_id: Uuid,
    pub file_name: String,
    pub file_path: String,
    pub content_text: String,
    pub content_length: i32,
    pub created_at: DateTime<Utc>,
}

/// Create a new document
pub async fn create_document(
    pool: &PgPool,
    session_id: Uuid,
    file_name: &str,
    file_path: &str,
    content_text: &str,
) -> Result<DocumentRow, async_graphql::Error> {
    let content_length = content_text.len() as i32;

    let document = sqlx::query_as::<_, DocumentRow>(
        r#"
        INSERT INTO documents (session_id, file_name, file_path, content_text, content_length)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, session_id, file_name, file_path, content_text, content_length, created_at
        "#,
    )
    .bind(session_id)
    .bind(file_name)
    .bind(file_path)
    .bind(content_text)
    .bind(content_length)
    .fetch_one(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    Ok(document)
}

/// Get all documents for a session (with authorization check)
pub async fn get_session_documents(
    pool: &PgPool,
    user_id: Uuid,
    session_id: Uuid,
) -> Result<Vec<DocumentRow>, async_graphql::Error> {
    let documents = sqlx::query_as::<_, DocumentRow>(
        r#"
        SELECT d.id, d.session_id, d.file_name, d.file_path, d.content_text, d.content_length, d.created_at
        FROM documents d
        JOIN study_sessions s ON d.session_id = s.id
        WHERE d.session_id = $1 AND s.user_id = $2
        ORDER BY d.created_at DESC
        "#,
    )
    .bind(session_id)
    .bind(user_id)
    .fetch_all(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    Ok(documents)
}

/// Get a document by ID (with authorization check)
pub async fn get_document_by_id(
    pool: &PgPool,
    user_id: Uuid,
    document_id: Uuid,
) -> Result<Option<DocumentRow>, async_graphql::Error> {
    let document = sqlx::query_as::<_, DocumentRow>(
        r#"
        SELECT d.id, d.session_id, d.file_name, d.file_path, d.content_text, d.content_length, d.created_at
        FROM documents d
        JOIN study_sessions s ON d.session_id = s.id
        WHERE d.id = $1 AND s.user_id = $2
        "#,
    )
    .bind(document_id)
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    Ok(document)
}

/// Delete a document (with authorization check)
pub async fn delete_document(
    pool: &PgPool,
    user_id: Uuid,
    document_id: Uuid,
) -> Result<Option<String>, async_graphql::Error> {
    // First get the file_path so we can delete from storage
    let result = sqlx::query_as::<_, (String,)>(
        r#"
        DELETE FROM documents d
        USING study_sessions s
        WHERE d.session_id = s.id AND d.id = $1 AND s.user_id = $2
        RETURNING d.file_path
        "#,
    )
    .bind(document_id)
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    Ok(result.map(|(path,)| path))
}

/// Get all document texts for a session (for AI context)
pub async fn get_session_document_texts(
    pool: &PgPool,
    user_id: Uuid,
    session_id: Uuid,
) -> Result<Vec<(String, String)>, async_graphql::Error> {
    let texts = sqlx::query_as::<_, (String, String)>(
        r#"
        SELECT d.file_name, d.content_text
        FROM documents d
        JOIN study_sessions s ON d.session_id = s.id
        WHERE d.session_id = $1 AND s.user_id = $2
        ORDER BY d.created_at ASC
        "#,
    )
    .bind(session_id)
    .bind(user_id)
    .fetch_all(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    Ok(texts)
}
