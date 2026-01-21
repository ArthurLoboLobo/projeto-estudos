use async_graphql::{Context, Result, ID};
use sqlx::PgPool;
use uuid::Uuid;

use crate::graphql::context::GraphQLContext;
use crate::graphql::types::Chat;
use crate::storage::{sessions, chats};

/// Get all chats for a session
pub async fn get_chats(ctx: &Context<'_>, session_id: ID) -> Result<Vec<Chat>> {
    let gql_ctx = ctx.data::<GraphQLContext>()?;
    let profile_id = gql_ctx.require_auth()?;
    let pool = ctx.data::<PgPool>()?;

    let session_uuid = Uuid::parse_str(&session_id).map_err(|_| "Invalid session ID")?;

    // Verify session exists and belongs to user
    let session = sessions::get_session_by_id(pool, profile_id, session_uuid).await?;
    if session.is_none() {
        return Err("Session not found".into());
    }

    let chat_list = chats::get_session_chats(pool, profile_id, session_uuid).await?;
    Ok(chat_list.into_iter().map(Into::into).collect())
}

/// Get a single chat by ID
pub async fn get_chat(ctx: &Context<'_>, id: ID) -> Result<Option<Chat>> {
    let gql_ctx = ctx.data::<GraphQLContext>()?;
    let profile_id = gql_ctx.require_auth()?;
    let pool = ctx.data::<PgPool>()?;

    let chat_id = Uuid::parse_str(&id).map_err(|_| "Invalid chat ID")?;
    let chat = chats::get_chat_by_id(pool, profile_id, chat_id).await?;
    Ok(chat.map(Into::into))
}

/// Get the chat for a specific topic
pub async fn get_chat_by_topic(ctx: &Context<'_>, topic_id: ID) -> Result<Option<Chat>> {
    let gql_ctx = ctx.data::<GraphQLContext>()?;
    let profile_id = gql_ctx.require_auth()?;
    let pool = ctx.data::<PgPool>()?;

    let topic_uuid = Uuid::parse_str(&topic_id).map_err(|_| "Invalid topic ID")?;
    let chat = chats::get_chat_by_topic(pool, profile_id, topic_uuid).await?;
    Ok(chat.map(Into::into))
}

/// Get the review chat for a session
pub async fn get_review_chat(ctx: &Context<'_>, session_id: ID) -> Result<Option<Chat>> {
    let gql_ctx = ctx.data::<GraphQLContext>()?;
    let profile_id = gql_ctx.require_auth()?;
    let pool = ctx.data::<PgPool>()?;

    let session_uuid = Uuid::parse_str(&session_id).map_err(|_| "Invalid session ID")?;

    // Verify session exists and belongs to user
    let session = sessions::get_session_by_id(pool, profile_id, session_uuid).await?;
    if session.is_none() {
        return Err("Session not found".into());
    }

    let chat = chats::get_review_chat(pool, profile_id, session_uuid).await?;
    Ok(chat.map(Into::into))
}
