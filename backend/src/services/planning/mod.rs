use sqlx::PgPool;
use uuid::Uuid;

use crate::config::Config;
use crate::storage::documents;
use crate::services::messages::ai_client::OpenRouterClient;

const PLANNING_MODEL: &str = "google/gemini-2.5-flash";

/// System prompt for generating the initial study plan
const GENERATE_PLAN_PROMPT: &str = r#"You are an expert academic tutor creating a personalized study plan for a university student.

Based on the study materials provided below, create a comprehensive study plan that will help the student prepare for their exam.

Your study plan MUST include:
1. **Overview** - A brief summary of what the exam covers based on the materials
2. **Learning Objectives** - What the student should be able to do after completing this plan
3. **Study Modules** - Ordered list of topics to study, each with:
   - Topic name
   - Key concepts to understand
   - Estimated study time
   - Practice suggestions
4. **Study Tips** - Specific advice based on the material type (past exams, slides, notes)
5. **Recommended Study Order** - The optimal sequence to tackle the topics

Format your response in clean Markdown. Use headers (##, ###), bullet points, and numbered lists for clarity.

If some topics appear in past exams but aren't covered in the slides/notes, mark them as "⚠️ Not fully covered in materials - seek additional resources".

STUDY MATERIALS:
{materials}

SESSION TITLE: {title}
SESSION DESCRIPTION: {description}

Generate a focused, actionable study plan now."#;

/// System prompt for revising the study plan
const REVISE_PLAN_PROMPT: &str = r#"You are an expert academic tutor helping a student refine their study plan.

The student has provided feedback on their current study plan. Apply their requested changes while maintaining the plan's structure and quality.

CURRENT STUDY PLAN:
{current_plan}

STUDENT'S FEEDBACK/INSTRUCTIONS:
{instruction}

ORIGINAL STUDY MATERIALS (for reference):
{materials}

Apply the student's requested changes to the study plan. Keep the same Markdown format. Only modify what the student asked for - don't make unnecessary changes.

Output the complete revised study plan."#;

/// Generate an initial study plan from documents
pub async fn generate_study_plan(
    pool: &PgPool,
    config: &Config,
    user_id: Uuid,
    session_id: Uuid,
    session_title: &str,
    session_description: Option<&str>,
) -> Result<String, async_graphql::Error> {
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
    let plan_md = ai_client
        .chat(PLANNING_MODEL, "You are a helpful academic tutor.", &prompt)
        .await?;

    Ok(plan_md)
}

/// Revise an existing study plan based on user instruction
pub async fn revise_study_plan(
    pool: &PgPool,
    config: &Config,
    user_id: Uuid,
    session_id: Uuid,
    current_plan: &str,
    instruction: &str,
) -> Result<String, async_graphql::Error> {
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

    // Build the revision prompt
    let prompt = REVISE_PLAN_PROMPT
        .replace("{current_plan}", current_plan)
        .replace("{instruction}", instruction)
        .replace("{materials}", &materials);

    // Call AI
    let ai_client = OpenRouterClient::new(config.openrouter_api_key.clone());
    let revised_plan = ai_client
        .chat(PLANNING_MODEL, "You are a helpful academic tutor.", &prompt)
        .await?;

    Ok(revised_plan)
}

