use std::path::Path;
use std::process::Command;
use tempfile::TempDir;
use tokio::fs;

use crate::config::Config;
use crate::services::messages::ai_client::{encode_base64, OpenRouterClient};

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
