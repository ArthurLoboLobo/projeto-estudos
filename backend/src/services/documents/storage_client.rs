use reqwest::Client;

use crate::config::Config;

const BUCKET_NAME: &str = "documents";

/// Client for interacting with Supabase Storage
pub struct StorageClient {
    client: Client,
    base_url: String,
    service_key: String,
}

impl StorageClient {
    pub fn new(config: &Config) -> Self {
        Self {
            client: Client::new(),
            base_url: config.supabase_url.clone(),
            service_key: config.supabase_service_key.clone(),
        }
    }

    /// Download a file from Supabase Storage
    /// file_path should be in format: bucket_name/path/to/file.pdf
    pub async fn download(&self, file_path: &str) -> Result<Vec<u8>, async_graphql::Error> {
        let url = format!("{}/storage/v1/object/{}", self.base_url, file_path);

        let response = self
            .client
            .get(&url)
            .header("Authorization", format!("Bearer {}", self.service_key))
            .send()
            .await
            .map_err(|e| async_graphql::Error::new(format!("Storage request failed: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(async_graphql::Error::new(format!(
                "Storage download failed ({}): {}",
                status, error_text
            )));
        }

        let bytes = response
            .bytes()
            .await
            .map_err(|e| async_graphql::Error::new(format!("Failed to read bytes: {}", e)))?;

        Ok(bytes.to_vec())
    }

    /// Delete a file from Supabase Storage
    pub async fn delete(&self, file_path: &str) -> Result<(), async_graphql::Error> {
        let url = format!("{}/storage/v1/object/{}", self.base_url, file_path);

        let response = self
            .client
            .delete(&url)
            .header("Authorization", format!("Bearer {}", self.service_key))
            .send()
            .await
            .map_err(|e| async_graphql::Error::new(format!("Storage delete failed: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(async_graphql::Error::new(format!(
                "Storage delete failed ({}): {}",
                status, error_text
            )));
        }

        Ok(())
    }
}

// ============ Standalone Functions ============

/// Upload a file to Supabase Storage
pub async fn upload_file(
    supabase_url: &str,
    service_key: &str,
    file_path: &str,
    data: &[u8],
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let client = Client::new();
    let url = format!("{}/storage/v1/object/{}/{}", supabase_url, BUCKET_NAME, file_path);

    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", service_key))
        .header("Content-Type", "application/pdf")
        .body(data.to_vec())
        .send()
        .await?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("Storage upload failed ({}): {}", status, error_text).into());
    }

    Ok(())
}

/// Download a file from Supabase Storage (standalone version)
pub async fn download_file(
    supabase_url: &str,
    service_key: &str,
    file_path: &str,
) -> Result<Vec<u8>, Box<dyn std::error::Error + Send + Sync>> {
    let client = Client::new();
    let url = format!("{}/storage/v1/object/{}/{}", supabase_url, BUCKET_NAME, file_path);

    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", service_key))
        .send()
        .await?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("Storage download failed ({}): {}", status, error_text).into());
    }

    let bytes = response.bytes().await?;
    Ok(bytes.to_vec())
}

/// Delete a file from Supabase Storage (standalone version)
pub async fn delete_file(
    supabase_url: &str,
    service_key: &str,
    file_path: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let client = Client::new();
    let url = format!("{}/storage/v1/object/{}/{}", supabase_url, BUCKET_NAME, file_path);

    let response = client
        .delete(&url)
        .header("Authorization", format!("Bearer {}", service_key))
        .send()
        .await?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("Storage delete failed ({}): {}", status, error_text).into());
    }

    Ok(())
}
