use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::config::Config;
use crate::prompts::{GENERATE_PLAN_PROMPT, REVISE_PLAN_PROMPT};
use crate::services::messages::ai_client::OpenRouterClient;
use crate::storage::documents;
use crate::storage::sessions::DraftPlan;

const PLANNING_MODEL: &str = "google/gemini-2.5-flash";

/// Internal structure for AI responses (matches the JSON format)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StudyPlanTopic {
    pub id: String,
    pub title: String,
    pub description: String,
    pub status: String, // "need_to_learn", "need_review", "know_well"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StudyPlanContent {
    pub topics: Vec<StudyPlanTopic>,
}

/// Generate an initial study plan from documents
pub async fn generate_study_plan(
    pool: &PgPool,
    config: &Config,
    profile_id: Uuid,
    session_id: Uuid,
    session_title: &str,
    session_description: Option<&str>,
) -> Result<StudyPlanContent, async_graphql::Error> {
    // Fetch all document texts
    let doc_texts = documents::get_session_document_texts(pool, profile_id, session_id).await?;
    
    if doc_texts.is_empty() {
        return Err(async_graphql::Error::new(
            "No documents with completed extraction found. Please wait for document processing to complete.",
        ));
    }

    // Build materials context
    let materials = doc_texts
        .iter()
        .map(|(name, content)| format!("=== {} ===\n{}", name, content))
        .collect::<Vec<_>>()
        .join("\n\n---\n\n");

    // Build the prompt
    let prompt = GENERATE_PLAN_PROMPT
        .replace("{materials}", &materials)
        .replace("{title}", session_title)
        .replace("{description}", session_description.unwrap_or("No description provided"));

    // Call AI
    let ai_client = OpenRouterClient::new(config.openrouter_api_key.clone());
    let ai_response = ai_client
        .chat(PLANNING_MODEL, "You are a helpful academic tutor. Output valid JSON only.", &prompt)
        .await?;

    // Parse JSON response
    let plan_content = parse_json_response(&ai_response)?;

    Ok(plan_content)
}

/// Revise an existing study plan based on user instruction
pub async fn revise_study_plan(
    pool: &PgPool,
    config: &Config,
    profile_id: Uuid,
    session_id: Uuid,
    current_plan: &DraftPlan,
    instruction: &str,
) -> Result<StudyPlanContent, async_graphql::Error> {
    // Fetch document texts for context
    let doc_texts = documents::get_session_document_texts(pool, profile_id, session_id).await?;
    
    let materials = if doc_texts.is_empty() {
        "No study materials available.".to_string()
    } else {
        doc_texts
            .iter()
            .map(|(name, content)| format!("=== {} ===\n{}", name, content))
            .collect::<Vec<_>>()
            .join("\n\n---\n\n")
    };

    // Convert DraftPlan to StudyPlanContent for serialization
    let current_content = StudyPlanContent {
        topics: current_plan.topics.iter().map(|t| StudyPlanTopic {
            id: t.id.clone(),
            title: t.title.clone(),
            description: t.description.clone().unwrap_or_default(),
            status: if t.is_completed { "know_well".to_string() } else { "need_to_learn".to_string() },
        }).collect(),
    };

    // Serialize current plan to JSON string
    let current_plan_json = serde_json::to_string_pretty(&current_content)
        .map_err(|e| async_graphql::Error::new(format!("JSON serialization error: {}", e)))?;

    // Build the revision prompt
    let prompt = REVISE_PLAN_PROMPT
        .replace("{current_plan}", &current_plan_json)
        .replace("{instruction}", instruction)
        .replace("{materials}", &materials);

    // Call AI
    let ai_client = OpenRouterClient::new(config.openrouter_api_key.clone());
    let ai_response = ai_client
        .chat(PLANNING_MODEL, "You are a helpful academic tutor. Output valid JSON only.", &prompt)
        .await?;

    // Parse JSON response
    let revised_plan = parse_json_response(&ai_response)?;

    Ok(revised_plan)
}

/// Helper function to parse JSON response from AI (handles markdown code blocks)
fn parse_json_response(response: &str) -> Result<StudyPlanContent, async_graphql::Error> {
    // Try to extract JSON from markdown code blocks if present
    let json_str = if response.contains("```") {
        // Extract content between ```json and ``` or just ``` and ```
        response
            .split("```")
            .nth(1)
            .and_then(|s| {
                // Remove language identifier if present
                if s.starts_with("json") {
                    Some(s.trim_start_matches("json").trim())
                } else {
                    Some(s.trim())
                }
            })
            .unwrap_or(response)
    } else {
        response.trim()
    };

    // Parse JSON
    serde_json::from_str::<StudyPlanContent>(json_str)
        .map_err(|e| {
            tracing::error!("Failed to parse AI response as JSON: {}\nResponse was: {}", e, json_str);
            async_graphql::Error::new(format!("Failed to parse AI response as JSON: {}", e))
        })
}
