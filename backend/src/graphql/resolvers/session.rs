use async_graphql::{Context, InputObject, Result, ID};
use sqlx::PgPool;
use uuid::Uuid;

use crate::graphql::context::GraphQLContext;
use crate::graphql::types::Session;
use crate::storage::sessions;

#[derive(InputObject)]
pub struct UpdateSessionInput {
    pub title: Option<String>,
    pub description: Option<String>,
}

/// Get all sessions for the authenticated user
pub async fn get_sessions(ctx: &Context<'_>) -> Result<Vec<Session>> {
    let gql_ctx = ctx.data::<GraphQLContext>()?;
    let profile_id = gql_ctx.require_auth()?;
    let pool = ctx.data::<PgPool>()?;

    let sessions = sessions::get_profile_sessions(pool, profile_id).await?;
    Ok(sessions.into_iter().map(Into::into).collect())
}

/// Get a single session by ID
pub async fn get_session(ctx: &Context<'_>, id: ID) -> Result<Option<Session>> {
    let gql_ctx = ctx.data::<GraphQLContext>()?;
    let profile_id = gql_ctx.require_auth()?;
    let pool = ctx.data::<PgPool>()?;

    let session_id = Uuid::parse_str(&id).map_err(|_| "Invalid session ID")?;
    let session = sessions::get_session_by_id(pool, profile_id, session_id).await?;
    Ok(session.map(Into::into))
}

/// Create a new session
pub async fn create_session(
    ctx: &Context<'_>,
    title: String,
    description: Option<String>,
) -> Result<Session> {
    let gql_ctx = ctx.data::<GraphQLContext>()?;
    let profile_id = gql_ctx.require_auth()?;
    let pool = ctx.data::<PgPool>()?;

    let session = sessions::create_session(
        pool,
        profile_id,
        &title,
        description.as_deref(),
    )
    .await?;

    Ok(session.into())
}

/// Update an existing session
pub async fn update_session(
    ctx: &Context<'_>,
    id: ID,
    input: UpdateSessionInput,
) -> Result<Option<Session>> {
    let gql_ctx = ctx.data::<GraphQLContext>()?;
    let profile_id = gql_ctx.require_auth()?;
    let pool = ctx.data::<PgPool>()?;

    let session_id = Uuid::parse_str(&id).map_err(|_| "Invalid session ID")?;
    let session = sessions::update_session(
        pool,
        profile_id,
        session_id,
        input.title.as_deref(),
        input.description.as_deref(),
    )
    .await?;

    Ok(session.map(Into::into))
}

/// Delete a session
pub async fn delete_session(ctx: &Context<'_>, id: ID) -> Result<bool> {
    let gql_ctx = ctx.data::<GraphQLContext>()?;
    let profile_id = gql_ctx.require_auth()?;
    let pool = ctx.data::<PgPool>()?;

    let session_id = Uuid::parse_str(&id).map_err(|_| "Invalid session ID")?;
    let deleted = sessions::delete_session(pool, profile_id, session_id).await?;

    Ok(deleted)
}
