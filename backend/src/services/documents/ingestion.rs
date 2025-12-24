use sqlx::PgPool;
use std::path::Path;
use std::process::Command;
use tempfile::TempDir;
use tokio::fs;
use uuid::Uuid;

use crate::config::Config;
use crate::services::documents::storage_client;
use crate::services::messages::ai_client::{encode_base64, OpenRouterClient};
use crate::storage::documents as doc_storage;

const VISION_MODEL: &str = "google/gemini-2.5-flash";

/// Result of processing a PDF document
pub struct ProcessedDocument {
    pub extracted_text: String,
    pub page_count: i32,
}

/// Process a PDF file: convert to images and extract text using vision AI
pub async fn process_pdf(
    pdf_path: &Path,
    config: &Config,
) -> Result<ProcessedDocument, async_graphql::Error> {
    // Create a temporary directory for images
    let temp_dir = TempDir::new()
        .map_err(|e| async_graphql::Error::new(format!("Failed to create temp dir: {}", e)))?;

    // Convert PDF to PNG images using pdftoppm
    let output_prefix = temp_dir.path().join("page");
    let status = Command::new("pdftoppm")
        .args([
            "-png",
            "-r",
            "150", // 150 DPI - good balance of quality and size
            pdf_path.to_str().unwrap(),
            output_prefix.to_str().unwrap(),
        ])
        .status()
        .map_err(|e| async_graphql::Error::new(format!("Failed to run pdftoppm: {}", e)))?;

    if !status.success() {
        return Err(async_graphql::Error::new("pdftoppm failed to convert PDF"));
    }

    // Find all generated PNG files
    let mut page_files: Vec<_> = std::fs::read_dir(temp_dir.path())
        .map_err(|e| async_graphql::Error::new(format!("Failed to read temp dir: {}", e)))?
        .filter_map(|entry| entry.ok())
        .filter(|entry| {
            entry
                .path()
                .extension()
                .map(|ext| ext == "png")
                .unwrap_or(false)
        })
        .collect();

    // Sort by filename to ensure correct page order
    page_files.sort_by_key(|entry| entry.path());

    let page_count = page_files.len() as i32;

    if page_count == 0 {
        return Err(async_graphql::Error::new("No pages extracted from PDF"));
    }

    tracing::info!("Extracted {} pages from PDF", page_count);

    // Create OpenRouter client
    let ai_client = OpenRouterClient::new(config.openrouter_api_key.clone());

    // Process each page
    let mut all_text = Vec::new();

    for (i, entry) in page_files.iter().enumerate() {
        let page_path = entry.path();
        tracing::info!("Processing page {}/{}", i + 1, page_count);

        // Read image file
        let image_data = fs::read(&page_path)
            .await
            .map_err(|e| async_graphql::Error::new(format!("Failed to read page image: {}", e)))?;

        // Encode to base64
        let base64_image = encode_base64(&image_data);

        // Extract text using vision AI
        let page_text = ai_client
            .extract_text_from_image(VISION_MODEL, &base64_image, "image/png")
            .await?;

        all_text.push(format!("--- Page {} ---\n{}", i + 1, page_text));
    }

    let extracted_text = all_text.join("\n\n");

    Ok(ProcessedDocument {
        extracted_text,
        page_count,
    })
}

/// Download a file from Supabase Storage
pub async fn download_from_storage(
    file_path: &str,
    config: &Config,
) -> Result<Vec<u8>, async_graphql::Error> {
    let url = format!(
        "{}/storage/v1/object/{}",
        config.supabase_url, file_path
    );

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", config.supabase_service_key))
        .send()
        .await
        .map_err(|e| async_graphql::Error::new(format!("Failed to download file: {}", e)))?;

    if !response.status().is_success() {
        return Err(async_graphql::Error::new(format!(
            "Storage download failed: {}",
            response.status()
        )));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| async_graphql::Error::new(format!("Failed to read file bytes: {}", e)))?;

    Ok(bytes.to_vec())
}

/// Process a document: download, extract text, update database
pub async fn process_document(
    pool: &PgPool,
    config: &Config,
    document_id: Uuid,
    storage_path: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    tracing::info!("Processing document {}: {}", document_id, storage_path);

    // 1. Update status to processing
    sqlx::query("UPDATE documents SET extraction_status = 'processing' WHERE id = $1")
        .bind(document_id)
        .execute(pool)
        .await?;

    // 2. Download file from storage
    let pdf_data = storage_client::download_file(
        &config.supabase_url,
        &config.supabase_service_key,
        storage_path,
    )
    .await?;

    tracing::info!("Downloaded {} bytes", pdf_data.len());

    // 3. Save to temp file
    let temp_dir = TempDir::new()?;
    let temp_pdf_path = temp_dir.path().join("document.pdf");
    fs::write(&temp_pdf_path, &pdf_data).await?;

    // 4. Process PDF (extract text using vision)
    let result = process_pdf(&temp_pdf_path, config)
        .await
        .map_err(|e| format!("PDF processing failed: {:?}", e))?;

    tracing::info!(
        "Extracted {} chars from {} pages",
        result.extracted_text.len(),
        result.page_count
    );

    // 5. Update database with extracted content
    doc_storage::update_document_content(
        pool,
        document_id,
        &result.extracted_text,
        result.page_count,
        "completed",
    )
    .await
    .map_err(|e| format!("Database update failed: {:?}", e))?;

    tracing::info!("Document processing complete: {}", document_id);

    Ok(())
}
