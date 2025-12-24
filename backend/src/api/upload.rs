use axum::{
    extract::{Multipart, State},
    http::{HeaderMap, StatusCode},
    response::Json,
};
use serde::Serialize;
use uuid::Uuid;

use crate::{
    config::Config,
    graphql::AppState,
    services::{
        auth::jwt::verify_jwt,
        documents::{ingestion, storage_client},
    },
    storage::documents,
};

const MAX_FILE_SIZE: usize = 50 * 1024 * 1024; // 50MB

#[derive(Debug, Serialize)]
pub struct UploadResponse {
    pub id: String,
    pub file_name: String,
    pub file_path: String,
    pub extraction_status: String,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: String,
}

/// POST /api/upload
/// 
/// Accepts multipart form data with:
/// - `file`: The PDF file to upload
/// - `sessionId`: The study session ID
/// 
/// Requires Authorization header with Bearer token
pub async fn upload_file(
    State(state): State<AppState>,
    headers: HeaderMap,
    mut multipart: Multipart,
) -> Result<Json<UploadResponse>, (StatusCode, Json<ErrorResponse>)> {
    // 1. Extract and validate JWT token
    let user_id = extract_user_id(&headers, &state.config).map_err(|e| {
        (
            StatusCode::UNAUTHORIZED,
            Json(ErrorResponse { error: e }),
        )
    })?;

    // 2. Parse multipart form
    let mut file_data: Option<Vec<u8>> = None;
    let mut file_name: Option<String> = None;
    let mut session_id: Option<Uuid> = None;

    while let Some(field) = multipart.next_field().await.map_err(|e| {
        (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: format!("Failed to read multipart: {}", e),
            }),
        )
    })? {
        let name = field.name().unwrap_or("").to_string();

        match name.as_str() {
            "file" => {
                file_name = field.file_name().map(|s| s.to_string());
                let data = field.bytes().await.map_err(|e| {
                    (
                        StatusCode::BAD_REQUEST,
                        Json(ErrorResponse {
                            error: format!("Failed to read file: {}", e),
                        }),
                    )
                })?;
                file_data = Some(data.to_vec());
            }
            "sessionId" => {
                let text = field.text().await.map_err(|e| {
                    (
                        StatusCode::BAD_REQUEST,
                        Json(ErrorResponse {
                            error: format!("Failed to read sessionId: {}", e),
                        }),
                    )
                })?;
                session_id = Some(Uuid::parse_str(&text).map_err(|_| {
                    (
                        StatusCode::BAD_REQUEST,
                        Json(ErrorResponse {
                            error: "Invalid sessionId format".to_string(),
                        }),
                    )
                })?);
            }
            _ => {}
        }
    }

    // 3. Validate required fields
    let file_data = file_data.ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "Missing file field".to_string(),
            }),
        )
    })?;

    let file_name = file_name.ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "Missing file name".to_string(),
            }),
        )
    })?;

    let session_id = session_id.ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "Missing sessionId field".to_string(),
            }),
        )
    })?;

    // 4. Validate file
    if file_data.len() > MAX_FILE_SIZE {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "File size exceeds 50MB limit".to_string(),
            }),
        ));
    }

    if !file_name.to_lowercase().ends_with(".pdf") {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "Only PDF files are supported".to_string(),
            }),
        ));
    }

    // 5. Verify user owns the session
    let session_check = sqlx::query!(
        "SELECT id, user_id FROM study_sessions WHERE id = $1",
        session_id
    )
    .fetch_optional(&state.db_pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Database error".to_string(),
            }),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "Session not found".to_string(),
            }),
        )
    })?;

    if session_check.user_id != user_id {
        return Err((
            StatusCode::FORBIDDEN,
            Json(ErrorResponse {
                error: "You don't have access to this session".to_string(),
            }),
        ));
    }

    // 6. Upload file to Supabase Storage
    let timestamp = chrono::Utc::now().timestamp();
    let safe_name = file_name.replace(|c: char| !c.is_alphanumeric() && c != '.' && c != '-', "_");
    let storage_path = format!("{}/{}-{}", session_id, timestamp, safe_name);

    storage_client::upload_file(
        &state.config.supabase_url,
        &state.config.supabase_service_key,
        &storage_path,
        &file_data,
    )
    .await
    .map_err(|e| {
        tracing::error!("Storage upload failed: {:?}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Failed to upload file to storage".to_string(),
            }),
        )
    })?;

    tracing::info!("File uploaded to storage: {}", storage_path);

    // 7. Create document record with pending status
    let doc = documents::create_document(
        &state.db_pool,
        session_id,
        &file_name,
        &storage_path,
        "", // Empty content initially
        0,
    )
    .await
    .map_err(|e| {
        tracing::error!("Failed to create document record: {:?}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Failed to create document record".to_string(),
            }),
        )
    })?;

    // 8. Spawn background task to process the document
    let pool = state.db_pool.clone();
    let config = state.config.clone();
    let doc_id = doc.id;
    let path = storage_path.clone();

    tokio::spawn(async move {
        tracing::info!("Starting document processing for: {}", doc_id);
        
        match ingestion::process_document(&pool, &config, doc_id, &path).await {
            Ok(_) => {
                tracing::info!("Document processing completed: {}", doc_id);
            }
            Err(e) => {
                tracing::error!("Document processing failed for {}: {:?}", doc_id, e);
                // Update status to failed
                let _ = sqlx::query(
                    "UPDATE documents SET extraction_status = 'failed' WHERE id = $1"
                )
                .bind(doc_id)
                .execute(&pool)
                .await;
            }
        }
    });

    // 9. Return response
    Ok(Json(UploadResponse {
        id: doc.id.to_string(),
        file_name: doc.file_name,
        file_path: doc.file_path,
        extraction_status: "processing".to_string(),
        message: "File uploaded successfully. Text extraction in progress.".to_string(),
    }))
}

fn extract_user_id(headers: &HeaderMap, config: &Config) -> Result<Uuid, String> {
    let auth_header = headers
        .get("authorization")
        .ok_or_else(|| "Missing Authorization header".to_string())?
        .to_str()
        .map_err(|_| "Invalid Authorization header".to_string())?;

    if !auth_header.starts_with("Bearer ") {
        return Err("Authorization header must start with 'Bearer '".to_string());
    }

    let token = &auth_header[7..];
    let user_id = verify_jwt(token, &config.jwt_secret)
        .map_err(|_| "Invalid or expired token".to_string())?;

    Ok(user_id)
}

