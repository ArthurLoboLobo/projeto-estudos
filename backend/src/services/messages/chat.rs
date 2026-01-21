use sqlx::PgPool;
use uuid::Uuid;

use crate::config::Config;
use crate::prompts::{REVIEW_SYSTEM_PROMPT, TOPIC_SYSTEM_PROMPT};
use crate::storage::{documents, messages, topics};

use super::ai_client::OpenRouterClient;

const CHAT_MODEL: &str = "google/gemini-2.5-flash";
const MAX_HISTORY_MESSAGES: i32 = 20;

/// Process a chat message and get AI response
pub async fn process_message(
    pool: &PgPool,
    config: &Config,
    profile_id: Uuid,
    session_id: Uuid,
    chat_id: Uuid,
    user_message: &str,
    topic_name: Option<&str>,
) -> Result<String, async_graphql::Error> {
    // 1. Fetch document context
    tracing::info!("Fetching documents for session {} by profile {}", session_id, profile_id);
    let doc_texts = documents::get_session_document_texts(pool, profile_id, session_id).await?;
    
    tracing::info!("Found {} documents with completed extraction", doc_texts.len());
    
    let context = if doc_texts.is_empty() {
        tracing::warn!("No documents found with processing_status='COMPLETED' for session {}", session_id);
        "No study materials have been uploaded yet. Please upload your course materials (slides, past exams, notes) to get personalized help.".to_string()
    } else {
        doc_texts
            .iter()
            .map(|(name, content)| format!("=== {} ===\n{}", name, content))
            .collect::<Vec<_>>()
            .join("\n\n")
    };

    // 2. Build system prompt based on chat type
    let system_prompt = if let Some(topic) = topic_name {
        TOPIC_SYSTEM_PROMPT
            .replace("{topic_name}", topic)
            .replace("{context}", &context)
    } else {
        REVIEW_SYSTEM_PROMPT
            .replace("{context}", &context)
    };

    // 3. Fetch recent conversation history for this specific chat
    let recent_messages = messages::get_recent_messages(
        pool, 
        profile_id, 
        chat_id, 
        MAX_HISTORY_MESSAGES
    ).await?;

    // 4. Build conversation history for the AI
    let history: Vec<(String, String)> = recent_messages
        .iter()
        .map(|m| (m.role.clone(), m.content.clone()))
        .collect();

    // 5. Call AI
    let ai_client = OpenRouterClient::new(config.openrouter_api_key.clone());
    
    let ai_response = ai_client
        .chat_with_history(CHAT_MODEL, &system_prompt, history, user_message)
        .await?;

    Ok(ai_response)
}

/// Generate the initial welcome message when a student enters a chat
pub async fn generate_welcome_message(
    pool: &PgPool,
    config: &Config,
    profile_id: Uuid,
    session_id: Uuid,
    topic_name: Option<&str>,
) -> Result<String, async_graphql::Error> {
    tracing::info!("Generating welcome message for session {}, topic: {:?}", session_id, topic_name);

    // 1. Fetch document context
    let doc_texts = documents::get_session_document_texts(pool, profile_id, session_id).await?;
    
    let context = if doc_texts.is_empty() {
        "Nenhum material de estudo foi processado ainda.".to_string()
    } else {
        doc_texts
            .iter()
            .map(|(name, content)| format!("=== {} ===\n{}", name, content))
            .collect::<Vec<_>>()
            .join("\n\n")
    };

    // 2. Build system prompt and welcome instruction based on chat type
    let (system_prompt, welcome_instruction) = if let Some(topic) = topic_name {
        let prompt = TOPIC_SYSTEM_PROMPT
            .replace("{topic_name}", topic)
            .replace("{context}", &context);
        let instruction = format!(
            "Generate a welcome message for the student who is starting to study the topic '{}'. \
            1. Greet them warmly as Caky \
            2. Briefly introduce what this topic is about \
            3. Explain why it's important/useful \
            4. Ask if they want to start with theory or jump into practice \
            Be conversational and motivating!",
            topic
        );
        (prompt, instruction)
    } else {
        // Get all topics to show progress
        let all_topics = topics::get_session_topics(pool, profile_id, session_id).await?;
        let completed_count = all_topics.iter().filter(|t| t.is_completed).count();
        let total_count = all_topics.len();

        let prompt = REVIEW_SYSTEM_PROMPT
            .replace("{context}", &context);
        let instruction = format!(
            "Generate a welcome message for the General Review chat. \
            The student has completed {}/{} topics and is now ready for final review. \
            1. Congratulate them on reaching the review phase \
            2. Explain this is for exam simulation and integrated practice \
            3. Ask what they'd like to focus on: past exam problems, specific topics, or a full practice test \
            Be enthusiastic and supportive!",
            completed_count, total_count
        );
        (prompt, instruction)
    };

    // 3. Call AI to generate the welcome message
    let ai_client = OpenRouterClient::new(config.openrouter_api_key.clone());
    
    let welcome_message = ai_client
        .chat(CHAT_MODEL, &system_prompt, &welcome_instruction)
        .await?;

    Ok(welcome_message)
}
