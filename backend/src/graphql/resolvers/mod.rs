mod auth;
mod document;
mod message;
pub mod session;

use async_graphql::{Context, Object, Result, ID};

use super::context::GraphQLContext;
use super::types::{Session, User};

pub struct QueryRoot;

#[Object]
impl QueryRoot {
    /// Health check query
    async fn health(&self) -> &str {
        "OK"
    }

    /// Get current authenticated user
    async fn me(&self, ctx: &Context<'_>) -> Result<Option<User>> {
        let gql_ctx = ctx.data::<GraphQLContext>()?;

        if let Some(user_id) = gql_ctx.user_id {
            let pool = ctx.data::<sqlx::PgPool>()?;
            let user = crate::storage::users::get_user_by_id(pool, user_id).await?;
            Ok(user.map(Into::into))
        } else {
            Ok(None)
        }
    }

    /// Get all study sessions for the authenticated user
    async fn sessions(&self, ctx: &Context<'_>) -> Result<Vec<Session>> {
        session::get_sessions(ctx).await
    }

    /// Get a specific study session by ID
    async fn session(&self, ctx: &Context<'_>, id: ID) -> Result<Option<Session>> {
        session::get_session(ctx, id).await
    }
}

pub struct MutationRoot;

#[Object]
impl MutationRoot {
    /// Register a new user
    async fn register(
        &self,
        ctx: &Context<'_>,
        email: String,
        password: String,
    ) -> Result<auth::AuthPayload> {
        auth::register(ctx, email, password).await
    }

    /// Login with email and password
    async fn login(
        &self,
        ctx: &Context<'_>,
        email: String,
        password: String,
    ) -> Result<auth::AuthPayload> {
        auth::login(ctx, email, password).await
    }

    /// Create a new study session
    async fn create_session(
        &self,
        ctx: &Context<'_>,
        title: String,
        description: Option<String>,
    ) -> Result<Session> {
        session::create_session(ctx, title, description).await
    }

    /// Update an existing study session
    async fn update_session(
        &self,
        ctx: &Context<'_>,
        id: ID,
        input: session::UpdateSessionInput,
    ) -> Result<Option<Session>> {
        session::update_session(ctx, id, input).await
    }

    /// Delete a study session
    async fn delete_session(&self, ctx: &Context<'_>, id: ID) -> Result<bool> {
        session::delete_session(ctx, id).await
    }
}
