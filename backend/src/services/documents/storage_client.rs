use reqwest::Client;

use crate::config::Config;

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
