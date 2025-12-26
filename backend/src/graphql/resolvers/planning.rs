use async_graphql::{Context, Result, ID};
use sqlx::PgPool;
use uuid::Uuid;

use crate::config::Config;
use crate::graphql::context::GraphQLContext;
use crate::graphql::types::{Session, StudyPlan};
use crate::services::planning;
use crate::storage::{sessions, study_plans, documents};

/// Get the current study plan for a session
pub async fn get_study_plan(ctx: &Context<'_>, session_id: ID) -> Result<Option<StudyPlan>> {
    let gql_ctx = ctx.data::<GraphQLContext>()?;
    let user_id = gql_ctx.require_auth()?;
    let pool = ctx.data::<PgPool>()?;

    let session_uuid = Uuid::parse_str(&session_id).map_err(|_| "Invalid session ID")?;

    // Verify session exists and belongs to user
    let session = sessions::get_session_by_id(pool, user_id, session_uuid).await?;
    if session.is_none() {
        return Err("Session not found".into());
    }

    let plan = study_plans::get_current_plan(pool, session_uuid).await?;
    Ok(plan.map(Into::into))
}

/// Get the study plan version history for undo functionality
pub async fn get_study_plan_history(ctx: &Context<'_>, session_id: ID) -> Result<Vec<StudyPlan>> {
    let gql_ctx = ctx.data::<GraphQLContext>()?;
    let user_id = gql_ctx.require_auth()?;
    let pool = ctx.data::<PgPool>()?;

    let session_uuid = Uuid::parse_str(&session_id).map_err(|_| "Invalid session ID")?;

    // Verify session exists and belongs to user
    let session = sessions::get_session_by_id(pool, user_id, session_uuid).await?;
    if session.is_none() {
        return Err("Session not found".into());
    }

    let plans = study_plans::get_plan_history(pool, session_uuid).await?;
    Ok(plans.into_iter().map(Into::into).collect())
}

/// Start the planning phase - generates initial study plan from documents
pub async fn start_planning(ctx: &Context<'_>, session_id: ID) -> Result<StudyPlan> {
    let gql_ctx = ctx.data::<GraphQLContext>()?;
    let user_id = gql_ctx.require_auth()?;
    let pool = ctx.data::<PgPool>()?;
    let config = ctx.data::<Config>()?;

    let session_uuid = Uuid::parse_str(&session_id).map_err(|_| "Invalid session ID")?;

    // Verify session exists and belongs to user
    let session = sessions::get_session_by_id(pool, user_id, session_uuid).await?;
    let session = session.ok_or("Session not found")?;

    // Check if session is in the right stage
    if session.stage != "uploading" {
        return Err("Session must be in 'uploading' stage to start planning".into());
    }

    // Check if at least one document has completed extraction
    let doc_texts = documents::get_session_document_texts(pool, user_id, session_uuid).await?;
    if doc_texts.is_empty() {
        return Err("At least one document must have completed extraction before planning".into());
    }

    tracing::info!("Generating study plan for session {}", session_uuid);

    // Generate the study plan
    let plan_content = planning::generate_study_plan(
        pool,
        config,
        user_id,
        session_uuid,
        &session.title,
        session.description.as_deref(),
    )
    .await?;

    // Save the plan
    let plan = study_plans::create_study_plan(pool, session_uuid, &plan_content).await?;

    // Update session stage to 'planning'
    sessions::update_session_stage(pool, user_id, session_uuid, "planning").await?;

    tracing::info!("Study plan generated and saved for session {}", session_uuid);

    Ok(plan.into())
}

/// Revise the study plan based on user instruction
pub async fn revise_study_plan(
    ctx: &Context<'_>,
    session_id: ID,
    instruction: String,
) -> Result<StudyPlan> {
    let gql_ctx = ctx.data::<GraphQLContext>()?;
    let user_id = gql_ctx.require_auth()?;
    let pool = ctx.data::<PgPool>()?;
    let config = ctx.data::<Config>()?;

    let session_uuid = Uuid::parse_str(&session_id).map_err(|_| "Invalid session ID")?;

    // Verify session exists and belongs to user
    let session = sessions::get_session_by_id(pool, user_id, session_uuid).await?;
    let session = session.ok_or("Session not found")?;

    // Allow plan revisions in both planning and studying stages

    // Get current plan
    let current_plan = study_plans::get_current_plan(pool, session_uuid).await?;
    let current_plan = current_plan.ok_or("No study plan found for this session")?;

    tracing::info!("Revising study plan for session {} with instruction: {}", session_uuid, instruction);

    // Parse the current plan's JSON content
    let current_content = study_plans::parse_plan_content(&current_plan)?;

    // Revise the plan using AI
    let revised_content = planning::revise_study_plan(
        pool,
        config,
        user_id,
        session_uuid,
        &current_content,
        &instruction,
    )
    .await?;

    // Save the new version
    let new_plan = study_plans::create_plan_version(pool, session_uuid, &revised_content, &instruction).await?;

    tracing::info!("Study plan revised and saved (version {}) for session {}", new_plan.version, session_uuid);

    Ok(new_plan.into())
}

/// Undo the last study plan revision
pub async fn undo_study_plan(ctx: &Context<'_>, session_id: ID) -> Result<StudyPlan> {
    let gql_ctx = ctx.data::<GraphQLContext>()?;
    let user_id = gql_ctx.require_auth()?;
    let pool = ctx.data::<PgPool>()?;

    let session_uuid = Uuid::parse_str(&session_id).map_err(|_| "Invalid session ID")?;

    // Verify session exists and belongs to user
    let session = sessions::get_session_by_id(pool, user_id, session_uuid).await?;
    let session = session.ok_or("Session not found")?;

    // Allow plan undo in both planning and studying stages

    tracing::info!("Undoing study plan revision for session {}", session_uuid);

    // Delete the latest version and return the previous one
    let previous_plan = study_plans::delete_latest_version(pool, session_uuid).await?;
    let previous_plan = previous_plan.ok_or("No previous plan version to restore")?;

    tracing::info!("Reverted to plan version {} for session {}", previous_plan.version, session_uuid);

    Ok(previous_plan.into())
}

/// Update a topic's knowledge status
pub async fn update_topic_status(
    ctx: &Context<'_>,
    session_id: ID,
    topic_id: String,
    status: String,
) -> Result<StudyPlan> {
    let gql_ctx = ctx.data::<GraphQLContext>()?;
    let user_id = gql_ctx.require_auth()?;
    let pool = ctx.data::<PgPool>()?;

    let session_uuid = Uuid::parse_str(&session_id).map_err(|_| "Invalid session ID")?;

    // Verify session exists and belongs to user
    let session = sessions::get_session_by_id(pool, user_id, session_uuid).await?;
    if session.is_none() {
        return Err("Session not found".into());
    }

    // Validate status value
    if !["need_to_learn", "need_review", "know_well"].contains(&status.as_str()) {
        return Err("Invalid status. Must be: need_to_learn, need_review, or know_well".into());
    }

    tracing::info!("Updating topic {} status to {} for session {}", topic_id, status, session_uuid);

    // Update the topic status
    let updated_plan = study_plans::update_topic_status(pool, session_uuid, &topic_id, &status).await?;

    Ok(updated_plan.into())
}

/// Finalize the plan and start studying
pub async fn start_studying(ctx: &Context<'_>, session_id: ID) -> Result<Session> {
    let gql_ctx = ctx.data::<GraphQLContext>()?;
    let user_id = gql_ctx.require_auth()?;
    let pool = ctx.data::<PgPool>()?;

    let session_uuid = Uuid::parse_str(&session_id).map_err(|_| "Invalid session ID")?;

    // Verify session exists and belongs to user
    let session = sessions::get_session_by_id(pool, user_id, session_uuid).await?;
    let session = session.ok_or("Session not found")?;

    // Check if session is in planning stage
    if session.stage != "planning" {
        return Err("Session must be in 'planning' stage to start studying".into());
    }

    // Verify a plan exists
    let plan = study_plans::get_current_plan(pool, session_uuid).await?;
    if plan.is_none() {
        return Err("No study plan found. Please complete the planning phase first.".into());
    }

    tracing::info!("Starting studying phase for session {}", session_uuid);

    // Update session stage to 'studying'
    let updated = sessions::update_session_stage(pool, user_id, session_uuid, "studying").await?;
    let updated = updated.ok_or("Failed to update session stage")?;

    Ok(updated.into())
}

