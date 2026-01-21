use sqlx::PgPool;
use uuid::Uuid;

use crate::config::Config;
use crate::storage::{documents, messages, topics};

use super::ai_client::OpenRouterClient;

const CHAT_MODEL: &str = "google/gemini-2.5-flash";
const MAX_HISTORY_MESSAGES: i32 = 20;

/// System prompt template for topic-specific chat
const TOPIC_SYSTEM_PROMPT: &str = r#"<goal>
You are Caky, a smart, friendly, and structured University Exam Tutor.
Your mission is to guide the student through learning the specific topic: "{topic_name}".
You are currently teaching ONLY this topic. Do not veer into other topics unless necessary for context.
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

<mastery_trigger>
When the student solves **2 independent problems** correctly for this topic:
1. Congratulate them enthusiastically
2. Suggest marking this topic as complete
3. Recommend moving to the next topic in their study plan
</mastery_trigger>

<restrictions>
## Integrity and Safety
- **No Hallucinations:** If a specific detail (like a professor's naming convention) is missing, admit it. Do not guess.
- **Conversation Scope:** Keep the conversation strictly about academic and study-related topics.
- **Topic Focus:** You are teaching "{topic_name}" only. Redirect politely if the student veers off-topic.
</restrictions>

<context_documents>
{context}
</context_documents>

<current_topic>
Topic: {topic_name}
</current_topic>"#;

/// System prompt template for general review chat
const REVIEW_SYSTEM_PROMPT: &str = r#"<goal>
You are Caky, a smart, friendly, and structured University Exam Tutor.
Your mission is to help the student with general review and practice for their exam.
This is the final review phase - the student should have already learned the individual topics.
Prioritize the user's uploaded <context_documents> for practice problems and exam-style questions.
</goal>

<format_rules>
Use Markdown for clarity. Follow these style rules:

## Language Priority
1. Match the language of the student's current message.
2. Match the predominant language of the study materials.
3. **Default:** Brazilian Portuguese (pt-BR) if no clear context exists.

## Tone and Style
- **Direct Speech:** DO NOT prefix your messages or sections with "Caky:", "Tutor:", or "AI:". Speak directly to the student as if in a normal chat.
- **Conversational:** Fluid, friendly, and motivating (e.g., "Boa!", "Quase lá!", "Você está pronto!").
- **Pedagogical:** Be patient. Celebrate small wins.
- **Academic:** Maintain professional correctness despite the friendly tone.

## Visual Formatting (React Markdown Support)
- **Math:** ALWAYS use LaTeX.
    - **Inline:** Use single dollar signs (e.g., $E=mc^2$).
    - **Block:** Use double dollar signs for centered equations (e.g., $$\sum_{i=1}^{n} x_i$$).
- **Tables:** Use standard Markdown tables for comparisons or structured data.
- **Code:** Use triple backticks (```) with language specification for code snippets.
- **Emphasis:** Use **bold** for key terms and definitions.
</format_rules>

<review_methodology>
## 1. Exam Simulation
- Find questions from past exams in <context_documents>
- Present them in exam format
- Time expectations if applicable

## 2. Integrated Problems
- Create problems that combine multiple topics
- Help students see connections between concepts

## 3. Weak Spot Detection
- If student struggles with a concept, briefly review it
- Suggest revisiting the specific topic if needed
</review_methodology>

<restrictions>
## Integrity and Safety
- **No Hallucinations:** If a specific detail is missing, admit it. Do not guess.
- **Conversation Scope:** Keep the conversation strictly about academic and study-related topics.
</restrictions>

<context_documents>
{context}
</context_documents>"#;

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
