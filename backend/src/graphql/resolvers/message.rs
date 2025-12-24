use async_graphql::{Context, Result, ID};
use sqlx::PgPool;
use uuid::Uuid;

use crate::config::Config;
use crate::graphql::context::GraphQLContext;
use crate::graphql::types::Message;
use crate::services::messages::chat;
use crate::storage::{messages, sessions};

/// Get all messages for a session
pub async fn get_messages(ctx: &Context<'_>, session_id: ID) -> Result<Vec<Message>> {
    let gql_ctx = ctx.data::<GraphQLContext>()?;
    let user_id = gql_ctx.require_auth()?;
    let pool = ctx.data::<PgPool>()?;

    let session_uuid = Uuid::parse_str(&session_id).map_err(|_| "Invalid session ID")?;

    // Verify session exists and belongs to user
    let session = sessions::get_session_by_id(pool, user_id, session_uuid).await?;
    if session.is_none() {
        return Err("Session not found".into());
    }

    let msgs = messages::get_session_messages(pool, user_id, session_uuid).await?;
    Ok(msgs.into_iter().map(Into::into).collect())
}

/// Send a message and get AI response
pub async fn send_message(
    ctx: &Context<'_>,
    session_id: ID,
    content: String,
) -> Result<Message> {
    let gql_ctx = ctx.data::<GraphQLContext>()?;
    let user_id = gql_ctx.require_auth()?;
    let pool = ctx.data::<PgPool>()?;
    let config = ctx.data::<Config>()?;

    let session_uuid = Uuid::parse_str(&session_id).map_err(|_| "Invalid session ID")?;

    // Verify session exists and belongs to user
    let session = sessions::get_session_by_id(pool, user_id, session_uuid).await?;
    if session.is_none() {
        return Err("Session not found".into());
    }

    tracing::info!("Processing message for session {}", session_uuid);

    // Save user message
    messages::create_message(pool, session_uuid, "user", &content).await?;

    // Get AI response
    let ai_response = chat::process_message(
        pool,
        config,
        user_id,
        session_uuid,
        &content,
    )
    .await?;

    // Save AI response
    let assistant_message = messages::create_message(
        pool,
        session_uuid,
        "assistant",
        &ai_response,
    )
    .await?;

    tracing::info!("AI response saved for session {}", session_uuid);

    Ok(assistant_message.into())
}

/// Clear chat history for a session
pub async fn clear_messages(ctx: &Context<'_>, session_id: ID) -> Result<bool> {
    let gql_ctx = ctx.data::<GraphQLContext>()?;
    let user_id = gql_ctx.require_auth()?;
    let pool = ctx.data::<PgPool>()?;

    let session_uuid = Uuid::parse_str(&session_id).map_err(|_| "Invalid session ID")?;

    let deleted = messages::clear_session_messages(pool, user_id, session_uuid).await?;

    Ok(deleted > 0)
}
