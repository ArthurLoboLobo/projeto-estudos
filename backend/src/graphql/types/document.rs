use async_graphql::{Enum, SimpleObject};
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::storage::documents::{DocumentRow, ProcessingStatus as StorageStatus};

/// The processing status of a document
#[derive(Enum, Copy, Clone, Eq, PartialEq, Debug)]
pub enum ProcessingStatus {
    /// Pending: document uploaded, waiting to be processed
    Pending,
    /// Processing: document is being processed (text extraction)
    Processing,
    /// Completed: document processing completed successfully
    Completed,
    /// Failed: document processing failed
    Failed,
}

impl From<StorageStatus> for ProcessingStatus {
    fn from(status: StorageStatus) -> Self {
        match status {
            StorageStatus::Pending => ProcessingStatus::Pending,
            StorageStatus::Processing => ProcessingStatus::Processing,
            StorageStatus::Completed => ProcessingStatus::Completed,
            StorageStatus::Failed => ProcessingStatus::Failed,
        }
    }
}

#[derive(SimpleObject, Clone)]
#[graphql(rename_fields = "camelCase")]
pub struct Document {
    pub id: Uuid,
    pub session_id: Uuid,
    pub file_name: String,
    pub file_path: String,
    pub content_length: Option<i32>,
    pub processing_status: ProcessingStatus,
    pub created_at: DateTime<Utc>,
}

impl From<DocumentRow> for Document {
    fn from(row: DocumentRow) -> Self {
        Self {
            id: row.id,
            session_id: row.session_id,
            file_name: row.file_name,
            file_path: row.file_path,
            content_length: row.content_length,
            processing_status: ProcessingStatus::from(row.processing_status),
            created_at: row.created_at,
        }
    }
}
