use async_graphql::{Context, Result, ID};
use sqlx::PgPool;
use uuid::Uuid;

use crate::config::Config;
use crate::graphql::context::GraphQLContext;
use crate::graphql::types::Message;
use crate::services::messages::chat;
use crate::storage::{messages, chats, topics};

/// Get all messages for a chat
pub async fn get_messages(ctx: &Context<'_>, chat_id: ID) -> Result<Vec<Message>> {
    let gql_ctx = ctx.data::<GraphQLContext>()?;
    let profile_id = gql_ctx.require_auth()?;
    let pool = ctx.data::<PgPool>()?;

    let chat_uuid = Uuid::parse_str(&chat_id).map_err(|_| "Invalid chat ID")?;

    // Verify chat exists and belongs to user
    let chat_row = chats::get_chat_by_id(pool, profile_id, chat_uuid).await?;
    if chat_row.is_none() {
        return Err("Chat not found".into());
    }

    let msgs = messages::get_chat_messages(pool, profile_id, chat_uuid).await?;
    Ok(msgs.into_iter().map(Into::into).collect())
}

/// Send a message and get AI response
pub async fn send_message(
    ctx: &Context<'_>,
    chat_id: ID,
    content: String,
) -> Result<Message> {
    let gql_ctx = ctx.data::<GraphQLContext>()?;
    let profile_id = gql_ctx.require_auth()?;
    let pool = ctx.data::<PgPool>()?;
    let config = ctx.data::<Config>()?;

    let chat_uuid = Uuid::parse_str(&chat_id).map_err(|_| "Invalid chat ID")?;

    // Verify chat exists and belongs to user
    let chat_row = chats::get_chat_by_id(pool, profile_id, chat_uuid).await?;
    let chat_row = chat_row.ok_or("Chat not found")?;

    // Get topic info if this is a topic-specific chat
    let topic_info = if let Some(topic_id) = chat_row.topic_id {
        topics::get_topic_by_id(pool, profile_id, topic_id).await?.map(|t| (t.title, t.description))
    } else {
        None
    };

    tracing::info!("Processing message for chat {}", chat_uuid);

    // Get AI response
    let ai_response = chat::process_message(
        pool,
        config,
        profile_id,
        chat_row.session_id,
        chat_uuid,
        &content,
        topic_info.as_ref().map(|(title, _)| title.as_str()),
    )
    .await?;

    // Save user message
    messages::create_message(pool, chat_uuid, "user", &content).await?;

    // Save AI response
    let assistant_message = messages::create_message(
        pool,
        chat_uuid,
        "assistant",
        &ai_response,
    )
    .await?;

    // Mark chat as started if not already
    if !chat_row.is_started {
        chats::mark_chat_started(pool, profile_id, chat_uuid).await?;
    }

    tracing::info!("AI response saved for chat {}", chat_uuid);

    Ok(assistant_message.into())
}

/// Clear chat history for a chat
pub async fn clear_messages(ctx: &Context<'_>, chat_id: ID) -> Result<bool> {
    let gql_ctx = ctx.data::<GraphQLContext>()?;
    let profile_id = gql_ctx.require_auth()?;
    let pool = ctx.data::<PgPool>()?;

    let chat_uuid = Uuid::parse_str(&chat_id).map_err(|_| "Invalid chat ID")?;

    let deleted = messages::clear_chat_messages(pool, profile_id, chat_uuid).await?;

    Ok(deleted > 0)
}

/// Generate the initial welcome message from the AI tutor
/// This creates the first message in a chat without user input
pub async fn generate_welcome(ctx: &Context<'_>, chat_id: ID) -> Result<Message> {
    let gql_ctx = ctx.data::<GraphQLContext>()?;
    let profile_id = gql_ctx.require_auth()?;
    let pool = ctx.data::<PgPool>()?;
    let config = ctx.data::<Config>()?;

    let chat_uuid = Uuid::parse_str(&chat_id).map_err(|_| "Invalid chat ID")?;

    // Verify chat exists and belongs to user
    let chat_row = chats::get_chat_by_id(pool, profile_id, chat_uuid).await?;
    let chat_row = chat_row.ok_or("Chat not found")?;

    // Check if there are already messages (don't regenerate welcome if chat started)
    let has_messages = messages::chat_has_messages(pool, profile_id, chat_uuid).await?;
    if has_messages {
        return Err("Chat already has messages. Welcome message can only be generated for empty chats.".into());
    }

    // Get topic info if this is a topic-specific chat
    let topic_info = if let Some(topic_id) = chat_row.topic_id {
        topics::get_topic_by_id(pool, profile_id, topic_id).await?.map(|t| (t.title, t.description))
    } else {
        None
    };

    tracing::info!("Generating welcome message for chat {}", chat_uuid);

    // Generate welcome message from AI
    let welcome_content = chat::generate_welcome_message(
        pool,
        config,
        profile_id,
        chat_row.session_id,
        topic_info.as_ref().map(|(title, _)| title.as_str()),
    )
    .await?;

    // Save the welcome message as an assistant message
    let welcome_message = messages::create_message(
        pool,
        chat_uuid,
        "assistant",
        &welcome_content,
    )
    .await?;

    // Mark chat as started
    if !chat_row.is_started {
        chats::mark_chat_started(pool, profile_id, chat_uuid).await?;
    }

    tracing::info!("Welcome message saved for chat {}", chat_uuid);

    Ok(welcome_message.into())
}
