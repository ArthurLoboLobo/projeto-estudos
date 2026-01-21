use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

/// Processing status enum matching the database
#[derive(Debug, Clone, PartialEq, Eq, sqlx::Type, Serialize, Deserialize)]
#[sqlx(type_name = "processing_status", rename_all = "UPPERCASE")]
pub enum ProcessingStatus {
    Pending,
    Processing,
    Completed,
    Failed,
}

impl std::fmt::Display for ProcessingStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ProcessingStatus::Pending => write!(f, "PENDING"),
            ProcessingStatus::Processing => write!(f, "PROCESSING"),
            ProcessingStatus::Completed => write!(f, "COMPLETED"),
            ProcessingStatus::Failed => write!(f, "FAILED"),
        }
    }
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct DocumentRow {
    pub id: Uuid,
    pub session_id: Uuid,
    pub file_name: String,
    pub file_path: String,
    pub content_text: Option<String>,
    pub content_length: Option<i32>,
    pub processing_status: ProcessingStatus,
    pub created_at: DateTime<Utc>,
}

/// Create a new document (with pending processing status)
pub async fn create_document(
    pool: &PgPool,
    session_id: Uuid,
    file_name: &str,
    file_path: &str,
) -> Result<DocumentRow, async_graphql::Error> {
    let document = sqlx::query_as::<_, DocumentRow>(
        r#"
        INSERT INTO documents (session_id, file_name, file_path, processing_status)
        VALUES ($1, $2, $3, 'PENDING')
        RETURNING id, session_id, file_name, file_path, content_text, content_length, processing_status, created_at
        "#,
    )
    .bind(session_id)
    .bind(file_name)
    .bind(file_path)
    .fetch_one(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    Ok(document)
}

/// Update document processing status
pub async fn update_document_status(
    pool: &PgPool,
    document_id: Uuid,
    status: ProcessingStatus,
) -> Result<(), async_graphql::Error> {
    sqlx::query(
        r#"
        UPDATE documents 
        SET processing_status = $1
        WHERE id = $2
        "#,
    )
    .bind(status)
    .bind(document_id)
    .execute(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    Ok(())
}

/// Update document after extraction
pub async fn update_document_content(
    pool: &PgPool,
    document_id: Uuid,
    content_text: &str,
    status: ProcessingStatus,
) -> Result<(), async_graphql::Error> {
    let content_length = content_text.len() as i32;

    sqlx::query(
        r#"
        UPDATE documents 
        SET content_text = $1, content_length = $2, processing_status = $3
        WHERE id = $4
        "#,
    )
    .bind(content_text)
    .bind(content_length)
    .bind(status)
    .bind(document_id)
    .execute(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    Ok(())
}

/// Get all documents for a session (with authorization check)
pub async fn get_session_documents(
    pool: &PgPool,
    profile_id: Uuid,
    session_id: Uuid,
) -> Result<Vec<DocumentRow>, async_graphql::Error> {
    let documents = sqlx::query_as::<_, DocumentRow>(
        r#"
        SELECT d.id, d.session_id, d.file_name, d.file_path, d.content_text, d.content_length, 
               d.processing_status, d.created_at
        FROM documents d
        JOIN study_sessions s ON d.session_id = s.id
        WHERE d.session_id = $1 AND s.profile_id = $2
        ORDER BY d.created_at DESC
        "#,
    )
    .bind(session_id)
    .bind(profile_id)
    .fetch_all(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    Ok(documents)
}

/// Get a document by ID (with authorization check)
pub async fn get_document_by_id(
    pool: &PgPool,
    profile_id: Uuid,
    document_id: Uuid,
) -> Result<Option<DocumentRow>, async_graphql::Error> {
    let document = sqlx::query_as::<_, DocumentRow>(
        r#"
        SELECT d.id, d.session_id, d.file_name, d.file_path, d.content_text, d.content_length,
               d.processing_status, d.created_at
        FROM documents d
        JOIN study_sessions s ON d.session_id = s.id
        WHERE d.id = $1 AND s.profile_id = $2
        "#,
    )
    .bind(document_id)
    .bind(profile_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    Ok(document)
}

/// Delete a document (with authorization check)
pub async fn delete_document(
    pool: &PgPool,
    profile_id: Uuid,
    document_id: Uuid,
) -> Result<Option<String>, async_graphql::Error> {
    // First get the file_path so we can delete from storage
    let result = sqlx::query_as::<_, (String,)>(
        r#"
        DELETE FROM documents d
        USING study_sessions s
        WHERE d.session_id = s.id AND d.id = $1 AND s.profile_id = $2
        RETURNING d.file_path
        "#,
    )
    .bind(document_id)
    .bind(profile_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    Ok(result.map(|(path,)| path))
}

/// Get all document texts for a session (for AI context) - only completed extractions
pub async fn get_session_document_texts(
    pool: &PgPool,
    profile_id: Uuid,
    session_id: Uuid,
) -> Result<Vec<(String, String)>, async_graphql::Error> {
    let texts = sqlx::query_as::<_, (String, String)>(
        r#"
        SELECT d.file_name, d.content_text
        FROM documents d
        JOIN study_sessions s ON d.session_id = s.id
        WHERE d.session_id = $1 AND s.profile_id = $2 AND d.processing_status = 'COMPLETED' AND d.content_text IS NOT NULL
        ORDER BY d.created_at ASC
        "#,
    )
    .bind(session_id)
    .bind(profile_id)
    .fetch_all(pool)
    .await
    .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

    Ok(texts)
}
