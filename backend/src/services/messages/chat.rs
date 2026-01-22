use sqlx::PgPool;
use uuid::Uuid;

use crate::config::Config;
use crate::prompts::{REVIEW_SYSTEM_PROMPT, TOPIC_SYSTEM_PROMPT};
use crate::storage::{documents, messages, topics};

use super::ai_client::OpenRouterClient;

const CHAT_MODEL: &str = "google/gemini-2.5-flash";
const MAX_HISTORY_MESSAGES: i32 = 20;

/// Convert language code to full language name
fn language_name(code: &str) -> &str {
    match code {
        "en" => "English",
        "pt" => "Portuguese",
        "es" => "Spanish",
        "fr" => "French",
        "de" => "German",
        _ => code
    }
}

/// Process a chat message and get AI response
pub async fn process_message(
    pool: &PgPool,
    config: &Config,
    profile_id: Uuid,
    session_id: Uuid,
    chat_id: Uuid,
    user_message: &str,
    topic_name: Option<&str>,
    language: &str,
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

    // 2. Fetch topics for study plan context
    let all_topics = topics::get_session_topics(pool, profile_id, session_id).await?;
    let study_plan_context = all_topics
        .iter()
        .map(|t| format!("- {}: {} ({})", t.title, t.description.as_deref().unwrap_or(""), if t.is_completed { "Completed" } else { "Not Completed" }))
        .collect::<Vec<_>>()
        .join("\n");

    // 3. Build system prompt based on chat type
    let lang = language_name(language);
    let system_prompt = if let Some(topic) = topic_name {
        TOPIC_SYSTEM_PROMPT
            .replace("{topic_name}", topic)
            .replace("{context}", &context)
            .replace("{study_plan}", &study_plan_context)
            .replace("{language}", lang)
    } else {
        REVIEW_SYSTEM_PROMPT
            .replace("{context}", &context)
            .replace("{study_plan}", &study_plan_context)
            .replace("{language}", lang)
    };

    // Debug logging: show the final system prompt
    tracing::debug!("Final system prompt for chat {}: {}", chat_id, system_prompt);

    // 4. Fetch recent conversation history for this specific chat
    let recent_messages = messages::get_recent_messages(
        pool, 
        profile_id, 
        chat_id, 
        MAX_HISTORY_MESSAGES
    ).await?;

    // 5. Build conversation history for the AI
    let history: Vec<(String, String)> = recent_messages
        .iter()
        .map(|m| (m.role.clone(), m.content.clone()))
        .collect();

    // 6. Call AI
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
    language: &str,
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
    let lang = language_name(language);
    let (system_prompt, welcome_instruction) = if let Some(topic) = topic_name {
        let prompt = TOPIC_SYSTEM_PROMPT
            .replace("{topic_name}", topic)
            .replace("{context}", &context)
            .replace("{study_plan}", "")
            .replace("{language}", lang);
        let instruction = format!(
            "Generate a welcome message for the student who is starting to study the topic '{}'. \
            1. Briefly introduce what this topic is about and why it's useful. \
            2. Based on the study materials, suggest the first important concept or 'thing' they should learn. \
            3. Ask if they are ready to start with that specific concept. \
            Be direct and focus on getting started.",
            topic
        );
        (prompt, instruction)
    } else {
        // Get all topics to show progress
        let all_topics = topics::get_session_topics(pool, profile_id, session_id).await?;
        let completed_count = all_topics.iter().filter(|t| t.is_completed).count();
        let total_count = all_topics.len();

        let prompt = REVIEW_SYSTEM_PROMPT
            .replace("{context}", &context)
            .replace("{study_plan}", "")
            .replace("{language}", lang);
        let instruction = format!(
            "Generate a welcome message for the General Review chat. \
            The student has completed {}/{} topics and is now ready for final review. \
            1. Congratulate them on reaching the review phase. \
            2. Explain this is for exam simulation and integrated practice. \
            3. Ask what they'd like to focus on: past exam problems, specific topics, or a full practice test. \
            Be direct, enthusiastic and supportive.",
            completed_count, total_count
        );
        (prompt, instruction)
    };

    // Debug logging: show the final system prompt and welcome instruction
    tracing::debug!("Final welcome system prompt: {}", system_prompt);
    tracing::debug!("Final welcome instruction: {}", welcome_instruction);

    // 3. Call AI to generate the welcome message
    let ai_client = OpenRouterClient::new(config.openrouter_api_key.clone());
    
    let welcome_message = ai_client
        .chat(CHAT_MODEL, &system_prompt, &welcome_instruction)
        .await?;

    Ok(welcome_message)
}
