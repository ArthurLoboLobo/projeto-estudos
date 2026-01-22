use async_graphql::{Context, Result, ID};
use sqlx::PgPool;
use uuid::Uuid;

use crate::config::Config;
use crate::graphql::context::GraphQLContext;
use crate::graphql::types::Session;
use crate::services::planning;
use crate::services::messages::chat as chat_service;
use crate::storage::{sessions, documents, topics, chats, messages};
use crate::storage::sessions::{SessionStatus, DraftPlan, DraftPlanTopic};

/// Generate the initial study plan from documents (stores as draft_plan)
pub async fn generate_plan(ctx: &Context<'_>, session_id: ID) -> Result<Session> {
    let gql_ctx = ctx.data::<GraphQLContext>()?;
    let profile_id = gql_ctx.require_auth()?;
    let pool = ctx.data::<PgPool>()?;
    let config = ctx.data::<Config>()?;

    let session_uuid = Uuid::parse_str(&session_id).map_err(|_| "Invalid session ID")?;

    // Verify session exists and belongs to user
    let session = sessions::get_session_by_id(pool, profile_id, session_uuid).await?;
    let session = session.ok_or("Session not found")?;

    // Check if session is in the right status
    if session.status != SessionStatus::Planning {
        return Err("Session must be in 'PLANNING' status to generate a plan".into());
    }

    // Check if at least one document has completed extraction
    let doc_texts = documents::get_session_document_texts(pool, profile_id, session_uuid).await?;
    if doc_texts.is_empty() {
        return Err("At least one document must have completed extraction before planning".into());
    }

    tracing::info!("Generating study plan for session {}", session_uuid);

    // Generate the study plan
    let plan_content = planning::generate_study_plan(
        pool,
        config,
        profile_id,
        session_uuid,
        &session.title,
        session.description.as_deref(),
        &gql_ctx.language,
    )
    .await?;

    // Convert to DraftPlan format
    let draft_plan = DraftPlan {
        topics: plan_content
            .topics
            .into_iter()
            .map(|t| DraftPlanTopic {
                id: t.id,
                title: t.title,
                description: Some(t.description),
                is_completed: false,
            })
            .collect(),
    };

    // Save the draft plan to the session
    let updated_session = sessions::update_draft_plan(pool, profile_id, session_uuid, &draft_plan).await?;
    let updated_session = updated_session.ok_or("Failed to update session with draft plan")?;

    tracing::info!("Study plan generated and saved for session {}", session_uuid);

    Ok(updated_session.into())
}

/// Revise the draft plan based on user instruction
pub async fn revise_plan(
    ctx: &Context<'_>,
    session_id: ID,
    instruction: String,
) -> Result<Session> {
    let gql_ctx = ctx.data::<GraphQLContext>()?;
    let profile_id = gql_ctx.require_auth()?;
    let pool = ctx.data::<PgPool>()?;
    let config = ctx.data::<Config>()?;

    let session_uuid = Uuid::parse_str(&session_id).map_err(|_| "Invalid session ID")?;

    // Verify session exists and belongs to user
    let session = sessions::get_session_by_id(pool, profile_id, session_uuid).await?;
    let session = session.ok_or("Session not found")?;

    // Check if session is in the right status
    if session.status != SessionStatus::Planning {
        return Err("Session must be in 'PLANNING' status to revise the plan".into());
    }

    // Get current draft plan
    let current_draft = sessions::parse_draft_plan(&session)?;
    let current_draft = current_draft.ok_or("No draft plan found. Please generate a plan first.")?;

    tracing::info!("Revising study plan for session {} with instruction: {}", session_uuid, instruction);

    // Convert to planning service format
    let current_content = crate::storage::sessions::DraftPlan {
        topics: current_draft.topics,
    };

    // Revise the plan using AI
    let revised_content = planning::revise_study_plan(
        pool,
        config,
        profile_id,
        session_uuid,
        &current_content,
        &instruction,
        &gql_ctx.language,
    )
    .await?;

    // Convert back to DraftPlan format
    let draft_plan = DraftPlan {
        topics: revised_content
            .topics
            .into_iter()
            .map(|t| DraftPlanTopic {
                id: t.id,
                title: t.title,
                description: Some(t.description),
                is_completed: false,
            })
            .collect(),
    };

    // Save the revised draft plan
    let updated_session = sessions::update_draft_plan(pool, profile_id, session_uuid, &draft_plan).await?;
    let updated_session = updated_session.ok_or("Failed to update session with revised plan")?;

    tracing::info!("Study plan revised for session {}", session_uuid);

    Ok(updated_session.into())
}

/// Update a topic's completion status in the draft plan (pre-filtering)
pub async fn update_draft_topic_completion(
    ctx: &Context<'_>,
    session_id: ID,
    topic_id: String,
    is_completed: bool,
) -> Result<Session> {
    let gql_ctx = ctx.data::<GraphQLContext>()?;
    let profile_id = gql_ctx.require_auth()?;
    let pool = ctx.data::<PgPool>()?;

    let session_uuid = Uuid::parse_str(&session_id).map_err(|_| "Invalid session ID")?;

    // Verify session exists and belongs to user
    let session = sessions::get_session_by_id(pool, profile_id, session_uuid).await?;
    let session = session.ok_or("Session not found")?;

    // Check if session is in the right status
    if session.status != SessionStatus::Planning {
        return Err("Session must be in 'PLANNING' status to update topic completion".into());
    }

    // Get current draft plan
    let mut draft_plan = sessions::parse_draft_plan(&session)?;
    let draft_plan = draft_plan.as_mut().ok_or("No draft plan found")?;

    // Find and update the topic
    let topic = draft_plan.topics
        .iter_mut()
        .find(|t| t.id == topic_id)
        .ok_or("Topic not found in draft plan")?;
    
    topic.is_completed = is_completed;

    // Save the updated draft plan
    let updated_session = sessions::update_draft_plan(pool, profile_id, session_uuid, draft_plan).await?;
    let updated_session = updated_session.ok_or("Failed to update session")?;

    Ok(updated_session.into())
}

/// Finalize the plan and start studying
/// This materializes the draft_plan into topics and creates chats
pub async fn start_studying(ctx: &Context<'_>, session_id: ID) -> Result<Session> {
    let gql_ctx = ctx.data::<GraphQLContext>()?;
    let profile_id = gql_ctx.require_auth()?;
    let pool = ctx.data::<PgPool>()?;
    let config = ctx.data::<Config>()?;

    let session_uuid = Uuid::parse_str(&session_id).map_err(|_| "Invalid session ID")?;

    // Verify session exists and belongs to user
    let session = sessions::get_session_by_id(pool, profile_id, session_uuid).await?;
    let session = session.ok_or("Session not found")?;

    // Check if session is in planning status
    if session.status != SessionStatus::Planning {
        return Err("Session must be in 'PLANNING' status to start studying".into());
    }

    // Verify a draft plan exists
    let draft_plan = sessions::parse_draft_plan(&session)?;
    let draft_plan = draft_plan.ok_or("No study plan found. Please generate a plan first.")?;

    tracing::info!("Starting studying phase for session {}", session_uuid);

    // Materialize topics from draft_plan
    let topics_data: Vec<(String, Option<String>, i32, bool)> = draft_plan
        .topics
        .iter()
        .enumerate()
        .map(|(i, t)| (t.title.clone(), t.description.clone(), i as i32, t.is_completed))
        .collect();

    let created_topics = topics::create_topics_batch(pool, session_uuid, topics_data).await?;

    // Create a chat for each topic and collect chat info for background generation
    let mut topic_chats: Vec<(Uuid, String)> = Vec::new();
    for topic in &created_topics {
        let chat = chats::create_topic_chat(pool, session_uuid, topic.id).await?;
        topic_chats.push((chat.id, topic.title.clone()));
    }

    // Create the general review chat
    let review_chat = chats::create_review_chat(pool, session_uuid).await?;

    // Update session status to ACTIVE and clear the draft_plan
    sessions::update_session_status(pool, profile_id, session_uuid, SessionStatus::Active).await?;
    let updated = sessions::clear_draft_plan(pool, profile_id, session_uuid).await?;
    let updated = updated.ok_or("Failed to update session status")?;

    tracing::info!(
        "Started studying for session {} with {} topics",
        session_uuid,
        created_topics.len()
    );

    // Spawn background tasks to generate welcome messages for all chats
    let pool_clone = pool.clone();
    let config_clone = config.clone();
    let language = gql_ctx.language.clone();
    
    tokio::spawn(async move {
        // Generate welcome messages for all topic chats in parallel
        let mut handles = Vec::new();
        
        for (chat_id, topic_title) in topic_chats {
            let pool = pool_clone.clone();
            let config = config_clone.clone();
            let language = language.clone();
            
            let handle = tokio::spawn(async move {
                match generate_and_save_welcome(&pool, &config, profile_id, session_uuid, chat_id, Some(&topic_title), &language).await {
                    Ok(_) => tracing::info!("Welcome message generated for topic chat {}", chat_id),
                    Err(e) => tracing::error!("Failed to generate welcome for topic chat {}: {:?}", chat_id, e),
                }
            });
            handles.push(handle);
        }
        
        // Generate welcome message for review chat
        let review_handle = tokio::spawn({
            let pool = pool_clone.clone();
            let config = config_clone.clone();
            let review_chat_id = review_chat.id;
            let language = language.clone();
            
            async move {
                match generate_and_save_welcome(&pool, &config, profile_id, session_uuid, review_chat_id, None, &language).await {
                    Ok(_) => tracing::info!("Welcome message generated for review chat {}", review_chat_id),
                    Err(e) => tracing::error!("Failed to generate welcome for review chat {}: {:?}", review_chat_id, e),
                }
            }
        });
        handles.push(review_handle);
        
        // Wait for all to complete
        for handle in handles {
            let _ = handle.await;
        }
        
        tracing::info!("All welcome messages generated for session {}", session_uuid);
    });

    Ok(updated.into())
}

/// Helper function to generate and save a welcome message
async fn generate_and_save_welcome(
    pool: &PgPool,
    config: &Config,
    profile_id: Uuid,
    session_id: Uuid,
    chat_id: Uuid,
    topic_name: Option<&str>,
    language: &str,
) -> Result<(), async_graphql::Error> {
    // Generate welcome message from AI
    let welcome_content = chat_service::generate_welcome_message(
        pool,
        config,
        profile_id,
        session_id,
        topic_name,
        language,
    )
    .await?;

    // Save the welcome message as an assistant message
    messages::create_message(
        pool,
        chat_id,
        "assistant",
        &welcome_content,
    )
    .await?;

    // Mark chat as started
    chats::mark_chat_started(pool, profile_id, chat_id).await?;

    Ok(())
}
