use sqlx::PgPool;
use uuid::Uuid;

use crate::config::Config;
use crate::storage::documents;
use crate::storage::study_plans::StudyPlanContent;
use crate::services::messages::ai_client::OpenRouterClient;

const PLANNING_MODEL: &str = "google/gemini-2.5-flash";

/// System prompt for generating the initial study plan
const GENERATE_PLAN_PROMPT: &str = r#"You are an expert academic tutor creating a personalized study plan for a university student.

Based on the study materials provided below, create a study plan as a sequence of topics the student needs to learn.

LANGUAGE DETECTION:
- Analyze the study materials and detect the primary language
- If materials are in Portuguese, generate topic titles and descriptions in Portuguese
- If materials are in English, generate topic titles and descriptions in English
- If materials are in Spanish, generate in Spanish
- Use the same language as the source materials for consistency

Your response MUST be valid JSON with this exact structure:
{
  "topics": [
    {
      "id": "topic-1",
      "title": "Topic Name",
      "description": "Brief explanation of what the student will learn in this topic",
      "status": "need_to_learn"
    }
  ]
}

REQUIREMENTS:
- Create a logical sequence of topics from foundational to advanced
- Each topic should be specific and actionable
- Descriptions should be 1-2 sentences explaining what will be learned
- ALL topics must have status: "need_to_learn" (this is the default)
- Use simple sequential IDs: "topic-1", "topic-2", etc.
- Focus ONLY on topics to learn, not overviews or objectives
- Order topics in the optimal learning sequence
- Match the language of the study materials

STUDY MATERIALS:
{materials}

SESSION TITLE: {title}
SESSION DESCRIPTION: {description}

Generate the JSON study plan now. Output ONLY valid JSON, no markdown formatting or code blocks."#;

/// System prompt for revising the study plan
const REVISE_PLAN_PROMPT: &str = r#"You are an expert academic tutor helping a student refine their study plan.

The student has provided feedback. Apply their requested changes while maintaining a logical learning sequence.

LANGUAGE GUIDELINES:
- PRIORITY 1: If student's feedback/instructions are in a clear language, consider adapting
- PRIORITY 2: Preserve the original language of the study plan
- PRIORITY 3: Match the predominant language of the original study materials
- Default to Brazilian Portuguese only if no other language context exists

CURRENT STUDY PLAN (JSON):
{current_plan}

STUDENT'S FEEDBACK/INSTRUCTIONS:
{instruction}

ORIGINAL STUDY MATERIALS (for reference):
{materials}

Generate an updated JSON study plan with the requested changes.

IMPORTANT:
- Keep the same JSON structure
- Reset ALL topics to status: "need_to_learn"
- Use sequential IDs: "topic-1", "topic-2", etc.
- Only change what the student requested
- Maintain logical topic progression
- Preserve the original language of the plan

Output ONLY valid JSON, no markdown formatting or code blocks."#;

/// Generate an initial study plan from documents
pub async fn generate_study_plan(
    pool: &PgPool,
    config: &Config,
    user_id: Uuid,
    session_id: Uuid,
    session_title: &str,
    session_description: Option<&str>,
) -> Result<StudyPlanContent, async_graphql::Error> {
    // Fetch all document texts
    let doc_texts = documents::get_session_document_texts(pool, user_id, session_id).await?;
    
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
    user_id: Uuid,
    session_id: Uuid,
    current_plan: &StudyPlanContent,
    instruction: &str,
) -> Result<StudyPlanContent, async_graphql::Error> {
    // Fetch document texts for context
    let doc_texts = documents::get_session_document_texts(pool, user_id, session_id).await?;
    
    let materials = if doc_texts.is_empty() {
        "No study materials available.".to_string()
    } else {
        doc_texts
            .iter()
            .map(|(name, content)| format!("=== {} ===\n{}", name, content))
            .collect::<Vec<_>>()
            .join("\n\n---\n\n")
    };

    // Serialize current plan to JSON string
    let current_plan_json = serde_json::to_string_pretty(current_plan)
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

