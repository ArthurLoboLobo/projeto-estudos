use async_graphql::{Context, Result, ID};
use sqlx::PgPool;
use tempfile::NamedTempFile;
use tokio::io::AsyncWriteExt;
use uuid::Uuid;

use crate::config::Config;
use crate::graphql::context::GraphQLContext;
use crate::graphql::types::Document;
use crate::services::documents::{ingestion, storage_client::{self, StorageClient}};
use crate::storage::{documents, sessions};

/// Get all documents for a session
pub async fn get_documents(ctx: &Context<'_>, session_id: ID) -> Result<Vec<Document>> {
    let gql_ctx = ctx.data::<GraphQLContext>()?;
    let user_id = gql_ctx.require_auth()?;
    let pool = ctx.data::<PgPool>()?;

    let session_uuid = Uuid::parse_str(&session_id).map_err(|_| "Invalid session ID")?;

    // Verify session exists and belongs to user
    let session = sessions::get_session_by_id(pool, user_id, session_uuid).await?;
    if session.is_none() {
        return Err("Session not found".into());
    }

    let docs = documents::get_session_documents(pool, user_id, session_uuid).await?;
    Ok(docs.into_iter().map(Into::into).collect())
}

/// Add a document to a session
/// file_path should be the path in Supabase Storage (e.g., "documents/user_id/file.pdf")
pub async fn add_document(
    ctx: &Context<'_>,
    session_id: ID,
    file_path: String,
    file_name: String,
) -> Result<Document> {
    let gql_ctx = ctx.data::<GraphQLContext>()?;
    let user_id = gql_ctx.require_auth()?;
    let pool = ctx.data::<PgPool>()?;
    let config = ctx.data::<Config>()?;

    let session_uuid = Uuid::parse_str(&session_id).map_err(|_| "Invalid session ID")?;

    // Verify session exists and belongs to user
    let session = sessions::get_session_by_id(pool, user_id, session_uuid).await?;
    if session.is_none() {
        return Err("Session not found".into());
    }

    tracing::info!("Processing document: {} for session {}", file_name, session_uuid);

    // Download file from Supabase Storage
    let storage = StorageClient::new(config);
    let file_bytes = storage.download(&file_path).await?;

    tracing::info!("Downloaded {} bytes from storage", file_bytes.len());

    // Write to temporary file for processing
    let temp_file = NamedTempFile::new()
        .map_err(|e| async_graphql::Error::new(format!("Failed to create temp file: {}", e)))?;

    let temp_path = temp_file.path().to_owned();

    // Write bytes to temp file
    let mut file = tokio::fs::File::create(&temp_path)
        .await
        .map_err(|e| async_graphql::Error::new(format!("Failed to write temp file: {}", e)))?;

    file.write_all(&file_bytes)
        .await
        .map_err(|e| async_graphql::Error::new(format!("Failed to write temp file: {}", e)))?;

    file.flush()
        .await
        .map_err(|e| async_graphql::Error::new(format!("Failed to flush temp file: {}", e)))?;

    drop(file); // Close the file handle

    // Process PDF with vision extraction
    let processed = ingestion::process_pdf(&temp_path, config).await?;

    tracing::info!(
        "Extracted {} characters from {} pages",
        processed.extracted_text.len(),
        processed.page_count
    );

    // Save to database
    let content_length = processed.extracted_text.len() as i32;
    let document = documents::create_document(
        pool,
        session_uuid,
        &file_name,
        &file_path,
        &processed.extracted_text,
        content_length,
    )
    .await?;

    Ok(document.into())
}

/// Delete a document
pub async fn delete_document(ctx: &Context<'_>, id: ID) -> Result<bool> {
    let gql_ctx = ctx.data::<GraphQLContext>()?;
    let user_id = gql_ctx.require_auth()?;
    let pool = ctx.data::<PgPool>()?;
    let config = ctx.data::<Config>()?;

    let document_id = Uuid::parse_str(&id).map_err(|_| "Invalid document ID")?;

    // Delete from database (returns file_path if successful)
    let file_path = documents::delete_document(pool, user_id, document_id).await?;

    if let Some(path) = file_path {
        // Also delete from storage
        let storage = StorageClient::new(config);
        if let Err(e) = storage.delete(&path).await {
            tracing::warn!("Failed to delete file from storage: {:?}", e);
            // Don't fail the operation if storage delete fails
        }
        Ok(true)
    } else {
        Ok(false)
    }
}

/// Get a signed URL to view a document (expires in 1 hour)
pub async fn get_document_url(ctx: &Context<'_>, id: ID) -> Result<String> {
    tracing::info!("get_document_url called for id: {:?}", id);
    
    let gql_ctx = ctx.data::<GraphQLContext>()?;
    let user_id = gql_ctx.require_auth()?;
    let pool = ctx.data::<PgPool>()?;
    let config = ctx.data::<Config>()?;

    let document_id = Uuid::parse_str(&id).map_err(|_| "Invalid document ID")?;
    tracing::info!("Parsed document_id: {}", document_id);

    // Get document and verify ownership
    let doc = documents::get_document_by_id(pool, user_id, document_id).await?;
    tracing::info!("Document found: {:?}", doc.is_some());
    
    let doc = doc.ok_or("Document not found")?;
    tracing::info!("Document file_path: {}", doc.file_path);

    // Create signed URL (expires in 1 hour = 3600 seconds)
    let signed_url = storage_client::create_signed_url(
        &config.supabase_url,
        &config.supabase_service_key,
        &doc.file_path,
        3600,
    )
    .await
    .map_err(|e| {
        tracing::error!("Failed to create signed URL: {}", e);
        async_graphql::Error::new(format!("Failed to create signed URL: {}", e))
    })?;

    tracing::info!("Signed URL created successfully");
    Ok(signed_url)
}
