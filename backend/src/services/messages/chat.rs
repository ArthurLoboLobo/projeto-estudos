use sqlx::PgPool;
use uuid::Uuid;

use crate::config::Config;
use crate::storage::{documents, messages, study_plans};

use super::ai_client::OpenRouterClient;

const CHAT_MODEL: &str = "google/gemini-2.5-flash";
const MAX_HISTORY_MESSAGES: i32 = 20;

/// System prompt template for the AI tutor
const SYSTEM_PROMPT_TEMPLATE: &str = r#"You are an expert academic tutor helping a university student prepare for exams.

Your role is to:
1. Answer questions based on the provided study materials
2. Explain concepts clearly and thoroughly
3. Help the student understand difficult topics
4. Provide examples when helpful
5. Quiz the student when appropriate
6. Be aware of the student's knowledge level for each topic in their study plan

LANGUAGE GUIDELINES:
- PRIORITY 1: Match the language of the student's current question/message
- PRIORITY 2: Match the predominant language of the study materials provided
- PRIORITY 3: Default to Brazilian Portuguese (pt-BR) if no clear language context
- Maintain academic and professional tone in all languages
- Use appropriate mathematical terminology in the response language
- Examples:
  * Student asks in English → respond in English
  * Student asks in Portuguese → respond in Portuguese
  * Student asks in Spanish → respond in Spanish (if materials also in Spanish)
  * No clear language context → respond in Brazilian Portuguese

IMPORTANT GUIDELINES:
- Base your answers primarily on the provided study materials
- If the question cannot be answered from the materials, say so clearly
- When formulas are involved, show step-by-step solutions
- Use LaTeX notation for mathematical expressions (e.g., $x^2$ for inline, $$\int_0^1 x dx$$ for block)
- Be encouraging and supportive
- Adjust explanations based on the student's indicated knowledge level for each topic

{study_plan}

STUDY MATERIALS:
{context}

Now help the student with their questions."#;

/// Process a chat message and get AI response
pub async fn process_message(
    pool: &PgPool,
    config: &Config,
    user_id: Uuid,
    session_id: Uuid,
    user_message: &str,
) -> Result<String, async_graphql::Error> {
    // 1. Fetch document context
    tracing::info!("Fetching documents for session {} by user {}", session_id, user_id);
    let doc_texts = documents::get_session_document_texts(pool, user_id, session_id).await?;
    
    tracing::info!("Found {} documents with completed extraction", doc_texts.len());
    for (name, content) in &doc_texts {
        tracing::info!("  - {}: {} chars", name, content.len());
    }
    
    let context = if doc_texts.is_empty() {
        tracing::warn!("No documents found with extraction_status='completed' for session {}", session_id);
        "No study materials have been uploaded yet. Please upload your course materials (slides, past exams, notes) to get personalized help.".to_string()
    } else {
        doc_texts
            .iter()
            .map(|(name, content)| format!("=== {} ===\n{}", name, content))
            .collect::<Vec<_>>()
            .join("\n\n")
    };

    // 2. Fetch study plan if it exists
    let study_plan_text = match study_plans::get_current_plan(pool, session_id).await? {
        Some(plan) => {
            if let Some(json_value) = &plan.content_json {
                if let Ok(content) = serde_json::from_value::<study_plans::StudyPlanContent>(json_value.clone()) {
                    let mut plan_text = String::from("STUDY PLAN WITH YOUR KNOWLEDGE LEVELS:\n\n");
                    for (i, topic) in content.topics.iter().enumerate() {
                        let status_label = match topic.status.as_str() {
                            "need_to_learn" => "Need to Learn",
                            "need_review" => "Need Review",
                            "know_well" => "Know Well",
                            _ => "Unknown",
                        };
                        plan_text.push_str(&format!("{}. {} [{}]\n   {}\n\n", 
                            i + 1, topic.title, status_label, topic.description));
                    }
                    plan_text
                } else {
                    String::new()
                }
            } else {
                String::new()
            }
        }
        None => String::new(),
    };

    // 3. Build system prompt with context and study plan
    let system_prompt = SYSTEM_PROMPT_TEMPLATE
        .replace("{study_plan}", &study_plan_text)
        .replace("{context}", &context);

    // 4. Fetch recent conversation history
    let recent_messages = messages::get_recent_messages(
        pool, 
        user_id, 
        session_id, 
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

/// Get the total context size for a session (for UI display)
pub async fn get_session_context_size(
    pool: &PgPool,
    user_id: Uuid,
    session_id: Uuid,
) -> Result<i32, async_graphql::Error> {
    let doc_texts = documents::get_session_document_texts(pool, user_id, session_id).await?;
    
    let total_chars: usize = doc_texts.iter().map(|(_, content)| content.len()).sum();
    
    Ok(total_chars as i32)
}

