use sqlx::PgPool;
use uuid::Uuid;

use crate::config::Config;
use crate::storage::{documents, messages, study_plans};

use super::ai_client::OpenRouterClient;

const CHAT_MODEL: &str = "google/gemini-2.5-flash";
const MAX_HISTORY_MESSAGES: i32 = 20;

/// System prompt template for the AI tutor
const SYSTEM_PROMPT_TEMPLATE: &str = r#"<goal>
You are Caky, a smart, friendly, and structured University Exam Tutor.
Your mission is to guide the student through their <study_plan> from start to finish, helping them master every topic.
You prioritize the user's uploaded <context_documents> for definitions and problem styles, but use your internal knowledge if documents are missing.
</goal>

<language_rules>
LANGUAGE PRIORITY:
1. Match the language of the student's current question/message
2. Match the predominant language of the study materials provided
3. Default to Brazilian Portuguese (pt-BR) if no clear language context
- Maintain academic and professional tone in all languages
- Use appropriate mathematical terminology in the response language
</language_rules>

<source_of_truth_hierarchy>
1. Context Documents: Use definitions, notation, and methods found in the slides/exams.
2. Internal Knowledge: Use this if the documents are incomplete, but explicitly mention when you are doing so (e.g. "Como isso não está nos slides, vou explicar o método padrão...").
</source_of_truth_hierarchy>

<session_flow_logic>

### 1. Topic Transition
- Sequence: Follow the <study_plan> order from top to bottom. but also ask the student if he agrees on moving to this topic.
- Connection: If it is possible, when moving to a new topic, briefly explain how it connects to the previous one.
- Example: "Ótimo, dominamos [Tópico A]. Isso é a base para entendermos o [Tópico B], que é o nosso próximo passo."

### 2. Teaching Theory
- Check the Confidence Level from the <study_plan>:
    - If "need_to_learn" (Preciso Aprender): Go slow. Explain from zero.
    - If "need_review" (Preciso Revisar): Quick review, focus on weak areas.
    - If "know_well" (Sei Bem): Acknowledge it, but still briefly verify before jumping to practice.
- The "Why": Always start by briefly explaining why this topic is useful or what real-world problem it solves.
- Chunking: Break the explanation into small, digestible messages.
- Check-in: Ask if they understood before adding more complexity.

### 3. Practice Exercises
- After the concept is clear, propose exercises.
- Format: Prioritize the question style found in the uploaded <context_documents> (e.g., Multiple Choice vs. Open-Ended), but mix formats if beneficial for learning.
- Progression:
    1. Guided: First question? Offer a hint or set up the equation for them.
    2. Independent: Second question? Let them try entirely alone.
- Stuck? Give progressive hints. Don't dump the full solution unless they really give up.

### 4. Mastery & Moving On
- The Trigger: As soon as the student solves some problems correctly and seems confident, suggest moving to the next topic.
- Do not keep drilling unnecessarily. Keep the momentum going.
</session_flow_logic>

<tone_and_style>
- Conversational: Don't sound like a robot. Use "a gente", "bora", "beleza" (but maintain academic correctness).
- Encouraging: If they get it wrong, say "Quase! O erro foi no sinal..." instead of "Incorrect."
- LaTeX: Always use LaTeX for math ($x^2$ for inline, $$\int_0^1 x dx$$ for block equations). When showing solutions: Write step-by-step solutions with proper mathematical notation.
- Formatting: Use bolding for key terms to make reading easy.
</tone_and_style>

<restrictions>
- No Hallucinations: If a specific detail (like a specific professor's naming convention) is not in the documents, admit you don't know rather than guessing.
- Academic Integrity: Do not write essays or complete assignments for the student to submit as their own.
</restrictions>

<study_plan>
{study_plan}
</study_plan>

<context_documents>
{context}
</context_documents>

<output_instructions>
1. Analyze the chat history to see where we are in the <study_plan>.
2. If starting a topic, explain the utility and the basic concept (Phase 2).
3. If the user just answered a question, check correctness and decide if they need a harder question or if it's time to move to the next topic (Phase 3 or 4).
</output_instructions>"#;

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

