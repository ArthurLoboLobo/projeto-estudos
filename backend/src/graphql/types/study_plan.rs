use async_graphql::SimpleObject;
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::storage::study_plans::{StudyPlanRow, StudyPlanContent as StorageContent, StudyPlanTopic as StorageTopic};

#[derive(SimpleObject, Clone)]
pub struct StudyPlanTopic {
    pub id: String,
    pub title: String,
    pub description: String,
    pub status: String,
}

impl From<StorageTopic> for StudyPlanTopic {
    fn from(topic: StorageTopic) -> Self {
        Self {
            id: topic.id,
            title: topic.title,
            description: topic.description,
            status: topic.status,
        }
    }
}

#[derive(SimpleObject, Clone)]
pub struct StudyPlanContent {
    pub topics: Vec<StudyPlanTopic>,
}

impl From<StorageContent> for StudyPlanContent {
    fn from(content: StorageContent) -> Self {
        Self {
            topics: content.topics.into_iter().map(Into::into).collect(),
        }
    }
}

#[derive(SimpleObject, Clone)]
pub struct StudyPlan {
    pub id: Uuid,
    pub session_id: Uuid,
    pub version: i32,
    pub content_md: String,
    pub content: StudyPlanContent,
    pub instruction: Option<String>,
    pub created_at: DateTime<Utc>,
}

impl From<StudyPlanRow> for StudyPlan {
    fn from(row: StudyPlanRow) -> Self {
        // Parse JSON content or create empty structure
        let content = if let Some(json_value) = &row.content_json {
            serde_json::from_value::<StorageContent>(json_value.clone())
                .map(Into::into)
                .unwrap_or_else(|_| StudyPlanContent { topics: vec![] })
        } else {
            StudyPlanContent { topics: vec![] }
        };

        Self {
            id: row.id,
            session_id: row.session_id,
            version: row.version,
            content_md: row.content_md,
            content,
            instruction: row.instruction,
            created_at: row.created_at,
        }
    }
}

