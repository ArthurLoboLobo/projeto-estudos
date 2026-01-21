use async_graphql::{Context, Result, ID};
use sqlx::PgPool;
use uuid::Uuid;

use crate::graphql::context::GraphQLContext;
use crate::graphql::types::Topic;
use crate::storage::{sessions, topics};

/// Get all topics for a session
pub async fn get_topics(ctx: &Context<'_>, session_id: ID) -> Result<Vec<Topic>> {
    let gql_ctx = ctx.data::<GraphQLContext>()?;
    let profile_id = gql_ctx.require_auth()?;
    let pool = ctx.data::<PgPool>()?;

    let session_uuid = Uuid::parse_str(&session_id).map_err(|_| "Invalid session ID")?;

    // Verify session exists and belongs to user
    let session = sessions::get_session_by_id(pool, profile_id, session_uuid).await?;
    if session.is_none() {
        return Err("Session not found".into());
    }

    let topic_list = topics::get_session_topics(pool, profile_id, session_uuid).await?;
    Ok(topic_list.into_iter().map(Into::into).collect())
}

/// Get a single topic by ID
pub async fn get_topic(ctx: &Context<'_>, id: ID) -> Result<Option<Topic>> {
    let gql_ctx = ctx.data::<GraphQLContext>()?;
    let profile_id = gql_ctx.require_auth()?;
    let pool = ctx.data::<PgPool>()?;

    let topic_id = Uuid::parse_str(&id).map_err(|_| "Invalid topic ID")?;
    let topic = topics::get_topic_by_id(pool, profile_id, topic_id).await?;
    Ok(topic.map(Into::into))
}

/// Mark a topic as completed or not completed
pub async fn update_topic_completion(
    ctx: &Context<'_>,
    id: ID,
    is_completed: bool,
) -> Result<Topic> {
    let gql_ctx = ctx.data::<GraphQLContext>()?;
    let profile_id = gql_ctx.require_auth()?;
    let pool = ctx.data::<PgPool>()?;

    let topic_id = Uuid::parse_str(&id).map_err(|_| "Invalid topic ID")?;

    tracing::info!("Updating topic {} completion to {}", topic_id, is_completed);

    let topic = topics::update_topic_completion(pool, profile_id, topic_id, is_completed).await?;
    let topic = topic.ok_or("Topic not found")?;

    Ok(topic.into())
}
