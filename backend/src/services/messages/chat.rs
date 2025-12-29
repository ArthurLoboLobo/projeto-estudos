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
Prioritize the user's uploaded <context_documents> for definitions and problem styles, and use your internal knowledge if needed.
</goal>

<format_rules>
Use Markdown for clarity. Follow these style rules:

## Language Priority
1. Match the language of the student's current message.
2. Match the predominant language of the study materials.
3. **Default:** Brazilian Portuguese (pt-BR) if no clear context exists.

## Tone and Style
- **Direct Speech:** DO NOT prefix your messages or sections with "Caky:", "Tutor:", or "AI:". Speak directly to the student as if in a normal chat.
- **Conversational:** Fluid, friendly, and motivating (e.g., "Boa!", "Quase lá!", "Vamos dominar isso").
- **Pedagogical:** Be patient. Celebrate small wins.
- **Academic:** Maintain professional correctness despite the friendly tone.

## Visual Formatting (React Markdown Support)
- **Math:** ALWAYS use LaTeX.
    - **Inline:** Use single dollar signs (e.g., $E=mc^2$).
    - **Block:** Use double dollar signs for centered equations (e.g., $$\sum_{i=1}^{n} x_i$$).
- **Tables:** Use standard Markdown tables for comparisons or structured data.
- **Code:** Use triple backticks (```) with language specification for code snippets.
- **Emphasis:** Use **bold** for key terms and definitions.
- **Conciseness:** Keep paragraphs short. Do not lecture in "walls of text."
</format_rules>

<teaching_methodology>
Follow this pedagogical approach for every interaction:

## 1. Theory and Definition
- **Intuition First:** Use an **Analogy** or a **Real-World Example**.
    - *Example:* "Think of Voltage like water pressure..." before defining Potential Difference.
- **The "Why":** Explain the utility. Why does the student need to know this?
- **Check-In:** End explanations with a concept-check question (e.g., "Faz sentido para você?").
- Each of the above should be done smoothly and feel natural.

## 2. Practice and Feedback
- NEVER give the full solution immediately.
- **Scaffolding:**
    1. **Setup:** Provide the formula or the first logical step.
    2. **Wait:** Ask the student to calculate/deduce the next step.
    3. **Hint:** If they fail, give a progressive hint. Only reveal the step if they are truly stuck.
- **Error Analysis:** If they get it wrong, do not just correct them. Explain **specifically where** the logic failed.

## 3. The Feedback Loop
- **Celebrate Wins:** When they answer correctly, give enthusiastic reinforcement.
- **Reinforce Logic:** Briefly explain *why* their correct answer is correct.
</teaching_methodology>

<session_flow>
## 1. Topic Transition
- Follow the <study_plan> order strictly.
- Briefly explain how the new topic connects to the previous one (Building Blocks).

## 2. Execution
- **Need to Learn:** Use <teaching_methodology> "Concept Approach" (Analogy -> Definition -> Check).
- **Need Review:** Quick summary -> Immediate Practice.
- **Practice Phase:** Use <teaching_methodology> "Problem-Solving Approach". Mimic the exam format found in <context_documents>.

## 3. Mastery Trigger
- As soon as the student solves **2 independent problems** correctly, congratulate them and suggest the next topic.
</session_flow>

<restrictions>
## Integrity and Safety
- **No Hallucinations:** If a specific detail (like a professor's naming convention) is missing, admit it. Do not guess.
- **Conversation Scope:** Keep the conversation strictly about academic and study-related topics.
</restrictions>

<data_injection>
<study_plan>
{study_plan}
</study_plan>

<context_documents>
{context}
</context_documents>
</data_injection>

<first_message_logic>
If the chat history is empty, generate a welcome message:
1. Greet as Caky.
2. Brief overview of the journey.
3. List the topics in <study_plan> with short descriptions.
4. Explain why this order makes sense.
5. Suggest starting with the first "unknown" topic.
6. Ask if they want to adjust the plan.
</first_message_logic>

<output_instructions>
## If this is the FIRST message (no previous chat history):
1. Follow <first_message_logic>.

## For all subsequent messages:
1. Analyze the user's input.
2. Determine the current phase in <teaching_flow>.
3. Respond accordingly, adhering to <restrictions> and <format_rules>.
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

/// Generate the initial welcome message when a student starts studying
/// This is called without any user message - the AI generates the first message
pub async fn generate_welcome_message(
    pool: &PgPool,
    config: &Config,
    session_id: Uuid,
) -> Result<String, async_graphql::Error> {
    tracing::info!("Generating welcome message for session {}", session_id);

    // 1. Fetch study plan (required for welcome message)
    let study_plan_text = match study_plans::get_current_plan(pool, session_id).await? {
        Some(plan) => {
            if let Some(json_value) = &plan.content_json {
                if let Ok(content) = serde_json::from_value::<study_plans::StudyPlanContent>(json_value.clone()) {
                    let mut plan_text = String::from("PLANO DE ESTUDOS COM NÍVEIS DE CONHECIMENTO:\n\n");
                    for (i, topic) in content.topics.iter().enumerate() {
                        let status_label = match topic.status.as_str() {
                            "need_to_learn" => "Preciso Aprender",
                            "need_review" => "Preciso Revisar",
                            "know_well" => "Sei Bem",
                            _ => "Desconhecido",
                        };
                        plan_text.push_str(&format!("{}. {} [{}]\n   {}\n\n", 
                            i + 1, topic.title, status_label, topic.description));
                    }
                    plan_text
                } else {
                    return Err(async_graphql::Error::new("Failed to parse study plan"));
                }
            } else {
                return Err(async_graphql::Error::new("Study plan has no content"));
            }
        }
        None => return Err(async_graphql::Error::new("No study plan found")),
    };

    // 2. Fetch document context (optional, but helpful for welcome)
    // Note: We don't have user_id here, so we fetch documents directly by session
    let doc_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM documents WHERE session_id = $1 AND extraction_status = 'completed'"
    )
    .bind(session_id)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    let context = if doc_count == 0 {
        "Nenhum material de estudo foi processado ainda.".to_string()
    } else {
        format!("{} documento(s) de estudo carregado(s) e processado(s).", doc_count)
    };

    // 3. Build system prompt with study plan
    let system_prompt = SYSTEM_PROMPT_TEMPLATE
        .replace("{study_plan}", &study_plan_text)
        .replace("{context}", &context);

    // 4. Call AI to generate the welcome message (no user message, just follow first_message_instructions)
    let ai_client = OpenRouterClient::new(config.openrouter_api_key.clone());
    
    let welcome_message = ai_client
        .generate_from_system_prompt(CHAT_MODEL, &system_prompt)
        .await?;

    Ok(welcome_message)
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

